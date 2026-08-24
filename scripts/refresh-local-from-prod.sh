#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — Rebuild the local dev stack from production data
# ─────────────────────────────────────────────────────────────────────────────
# Clones production's database and media, wipes the local Kuara stack, rebuilds
# the web image from source, and loads the clone into it. The result is a local
# environment whose content matches https://kuara.ufsj.edu.br as of the run.
#
# The download happens first on purpose: if production is unreachable or the
# dump fails, the existing local stack is still standing and untouched.
#
# Usage (from the repo root):
#   ./scripts/refresh-local-from-prod.sh              # clean Kuara, rebuild, clone
#   ./scripts/refresh-local-from-prod.sh -y           # no confirmation prompt
#   ./scripts/refresh-local-from-prod.sh --no-cache   # rebuild ignoring layer cache
#   ./scripts/refresh-local-from-prod.sh --all        # ALSO prune every other
#                                                     # container/image/volume
#                                                     # on this machine
#
# Overridable via environment:
#   KUARA_SSH_HOST   default kuara.ufsj.edu.br
#   KUARA_SSH_USER   default filgusto
#   KUARA_SSH_PORT   default 22691
#   KUARA_REMOTE_DIR default ~/kuara-house/kuara
#
# Production is only ever read from: the script runs pg_dump and `mc mirror`
# against it and deletes its own staging files afterwards. It never writes to
# the production database, bucket, or containers.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${KUARA_SSH_HOST:-kuara.ufsj.edu.br}"
SSH_USER="${KUARA_SSH_USER:-filgusto}"
SSH_PORT="${KUARA_SSH_PORT:-22691}"
REMOTE_DIR="${KUARA_REMOTE_DIR:-~/kuara-house/kuara}"
REMOTE_COMPOSE="docker compose -f docker-compose.prod.yml"
BUCKET="kuara-media"

# -n: ssh reads stdin by default and drains it, which would leave the
# confirmation prompt below with nothing to read. Nothing is ever piped
# into these calls, so detaching stdin is free.
SSH=(ssh -n -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}")
STAGING="$(mktemp -d "${TMPDIR:-/tmp}/kuara-clone.XXXXXX")"
REMOTE_STAGING="/tmp/kuara-clone-$$"

PRUNE_ALL=0
NO_CACHE=0
ASSUME_YES=0
KEEP_STAGING=0

# ── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
step() { echo; echo "──────── $* ────────"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

cleanup() {
    local rc=$?
    # Always drop the staging copy on the production server, even on failure —
    # its disk sits near capacity and these files are ~220 MB per run.
    "${SSH[@]}" "rm -rf $REMOTE_STAGING" 2>/dev/null || true
    if [[ $KEEP_STAGING -eq 0 ]]; then
        rm -rf "$STAGING"
    else
        echo "Staging kept at: $STAGING"
    fi
    exit $rc
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)          PRUNE_ALL=1 ;;
        --no-cache)     NO_CACHE=1 ;;
        --keep-staging) KEEP_STAGING=1 ;;
        -y|--yes)       ASSUME_YES=1 ;;
        -h|--help)      sed -n '2,28p' "$0"; exit 0 ;;
        *)              die "Unknown option: $1 (try --help)" ;;
    esac
    shift
done

cd "$REPO_DIR"

# ── Pre-flight ───────────────────────────────────────────────────────────────
step "Pre-flight"

docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and retry."
[[ -f "$REPO_DIR/.env" ]] || die ".env not found at repo root. Copy .env.example and fill it in."
command -v rsync >/dev/null || die "rsync is required but not installed."

for var in POSTGRES_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD; do
    grep -qE "^${var}=.+" "$REPO_DIR/.env" || die "$var is empty in .env"
done

"${SSH[@]}" -o ConnectTimeout=15 true 2>/dev/null \
    || die "Cannot reach ${SSH_USER}@${SSH_HOST}:${SSH_PORT} over SSH."

"${SSH[@]}" "cd $REMOTE_DIR && $REMOTE_COMPOSE ps -q --status running postgres" 2>/dev/null | grep -q . \
    || die "Production postgres is not running — refusing to clone from a stopped database."

log "Docker OK · .env OK · production reachable and healthy"

# ── Confirmation ─────────────────────────────────────────────────────────────
if [[ $PRUNE_ALL -eq 1 ]]; then
    cat <<WARN

  ┌────────────────────────────────────────────────────────────────────┐
  │  --all: this prunes EVERY container, image and volume on this      │
  │  machine, including ones unrelated to Kuara. Any other project's   │
  │  database volume on this Docker install will be destroyed.         │
  └────────────────────────────────────────────────────────────────────┘

WARN
    if [[ $ASSUME_YES -eq 0 ]]; then
        read -r -p 'Type "apagar tudo" to confirm: ' reply || reply=""
        [[ "$reply" == "apagar tudo" ]] || die "Not confirmed — nothing was changed."
    fi
elif [[ $ASSUME_YES -eq 0 ]]; then
    echo
    echo "This destroys the local Kuara containers, images and volumes"
    echo "(including the local database) and rebuilds them from production."
    read -r -p "Continue? [y/N] " reply || reply=""
    [[ "$reply" =~ ^[yY]$ ]] || die "Not confirmed — nothing was changed."
fi

# ── 1. Dump production ───────────────────────────────────────────────────────
step "1/6 · Dumping production"

# Streamed straight to a local file: nothing lands on the production disk.
# -Fc (custom format) so pg_restore can drop ownership and ACLs on the way in.
log "Dumping database…"
"${SSH[@]}" "cd $REMOTE_DIR && $REMOTE_COMPOSE exec -T postgres \
    pg_dump -U kuara -d kuara -Fc" 2>/dev/null > "$STAGING/kuara.dump"

[[ -s "$STAGING/kuara.dump" ]] || die "Database dump came back empty."
# Custom-format archives start with the magic string "PGDMP". Checked with
# head rather than `pg_restore --list` because the Postgres client tools are
# not installed on a stock macOS; the authoritative check is pg_restore's own
# exit code when it runs inside the container in step 5.
head -c 5 "$STAGING/kuara.dump" | grep -q "PGDMP" \
    || die "Dump is not a valid PostgreSQL archive."
log "Database dumped ($(du -h "$STAGING/kuara.dump" | cut -f1)), archive verified"

# Recorded now, while production is still on the line, so the verification at
# the end can compare like for like.
"${SSH[@]}" "cd $REMOTE_DIR && $REMOTE_COMPOSE exec -T postgres \
    psql -U kuara -d kuara -tAc \"SELECT count(*) FROM payload_migrations;\"" \
    > "$STAGING/remote-migrations" 2>/dev/null
REMOTE_MIGRATIONS="$(tr -d ' \r\n' < "$STAGING/remote-migrations")"

# Media goes through `mc mirror` (an S3-level export) rather than a raw copy of
# MinIO's data volume: the on-disk layout is version-specific, the object API
# is not.
log "Exporting media objects…"
"${SSH[@]}" "set -e
    cd $REMOTE_DIR
    mkdir -p $REMOTE_STAGING
    $REMOTE_COMPOSE exec -T minio sh -c '
        set -e
        rm -rf /tmp/kuara-export && mkdir -p /tmp/kuara-export
        mc alias set src http://127.0.0.1:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null
        mc mirror --quiet --overwrite src/$BUCKET /tmp/kuara-export/$BUCKET >/dev/null
    '
    $REMOTE_COMPOSE cp minio:/tmp/kuara-export/$BUCKET $REMOTE_STAGING/$BUCKET
    $REMOTE_COMPOSE exec -T minio rm -rf /tmp/kuara-export
" 2>/dev/null

rsync -a -e "ssh -p $SSH_PORT" \
    "${SSH_USER}@${SSH_HOST}:$REMOTE_STAGING/$BUCKET" "$STAGING/"

# Counted via a temp file rather than $(...): bash's command-substitution
# parser mis-reads a single quote nested inside a double-quoted remote command.
"${SSH[@]}" "cd $REMOTE_DIR && $REMOTE_COMPOSE exec -T minio sh -c '
    mc alias set src http://127.0.0.1:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null
    mc ls --recursive src/$BUCKET | wc -l'" > "$STAGING/remote-count" 2>/dev/null

REMOTE_OBJECTS="$(tr -d ' \r' < "$STAGING/remote-count")"
LOCAL_FILES="$(find "$STAGING/$BUCKET" -type f | wc -l | tr -d ' ')"

[[ "$REMOTE_OBJECTS" == "$LOCAL_FILES" ]] \
    || die "Media transfer incomplete: production has $REMOTE_OBJECTS objects, downloaded $LOCAL_FILES."
log "Media exported ($LOCAL_FILES objects, $(du -sh "$STAGING/$BUCKET" | cut -f1))"

# ── 2. Clean ─────────────────────────────────────────────────────────────────
step "2/6 · Removing the local stack"

# --rmi local drops the images this compose project built; -v drops the named
# volumes, which is what actually clears the old database and bucket.
docker compose down -v --rmi local --remove-orphans 2>&1 | sed 's/^/  /' || true

if [[ $PRUNE_ALL -eq 1 ]]; then
    log "Pruning all remaining Docker objects on this machine"
    docker system prune -a --volumes -f 2>&1 | tail -3 | sed 's/^/  /'
fi

log "Local stack removed"

# ── 3. Build ─────────────────────────────────────────────────────────────────
step "3/6 · Building the web image from source"

BUILD_ARGS=(--pull)
[[ $NO_CACHE -eq 1 ]] && BUILD_ARGS+=(--no-cache)
docker compose build "${BUILD_ARGS[@]}" web 2>&1 | tail -5 | sed 's/^/  /'
log "Image built"

# ── 4. Start data services ───────────────────────────────────────────────────
step "4/6 · Starting postgres + minio"

# Data services come up first and get loaded before `web` ever connects, so
# Payload never initialises a schema against an empty database.
docker compose up -d postgres minio createbuckets 2>&1 | tail -3 | sed 's/^/  /'

log "Waiting for postgres…"
for _ in $(seq 1 60); do
    [[ "$(docker compose ps postgres --format '{{.Health}}' 2>/dev/null)" == "healthy" ]] && break
    sleep 2
done
[[ "$(docker compose ps postgres --format '{{.Health}}')" == "healthy" ]] \
    || die "postgres did not become healthy in 120s."

log "Waiting for the bucket to be created…"
for _ in $(seq 1 30); do
    # -a: `docker compose ps` hides exited containers by default, and this
    # one is expected to have exited — that is exactly the success signal.
    docker compose ps -a createbuckets --format '{{.State}}' 2>/dev/null | grep -q exited && break
    sleep 2
done
log "Data services ready"

# ── 5. Load the data ─────────────────────────────────────────────────────────
step "5/6 · Restoring production data"

docker compose cp "$STAGING/kuara.dump" postgres:/tmp/kuara.dump
# Recreate the schema so the restore lands in a genuinely empty database.
docker compose exec -T postgres psql -U kuara -d kuara -q \
    -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
# --no-owner/--no-privileges: production role grants are meaningless locally.
docker compose exec -T postgres pg_restore -U kuara -d kuara \
    --no-owner --no-privileges /tmp/kuara.dump
docker compose exec -T postgres rm -f /tmp/kuara.dump
log "Database restored"

docker compose cp "$STAGING/$BUCKET" minio:/tmp/kuara-import
docker compose exec -T minio sh -c "
    set -e
    mc alias set dst http://127.0.0.1:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null
    mc mirror --quiet --overwrite /tmp/kuara-import dst/$BUCKET >/dev/null
    rm -rf /tmp/kuara-import
"
log "Media uploaded"

# ── 6. Start the app ─────────────────────────────────────────────────────────
step "6/6 · Starting the app"

docker compose up -d web 2>&1 | tail -3 | sed 's/^/  /'

log "Waiting for http://localhost:3000/api/health…"
HEALTHY=0
for _ in $(seq 1 60); do
    if curl -sf --max-time 5 http://localhost:3000/api/health >/dev/null 2>&1; then
        HEALTHY=1; break
    fi
    sleep 5
done
[[ $HEALTHY -eq 1 ]] || die "Web did not answer in 5 min. Check: docker compose logs web"

# ── Verification ─────────────────────────────────────────────────────────────
step "Verification"

sql() { docker compose exec -T postgres psql -U kuara -d kuara -tAc "$1" 2>/dev/null | tr -d ' \r'; }

COURSES="$(sql 'SELECT count(*) FROM courses;')"
MODULES="$(sql 'SELECT count(*) FROM modules;')"
MEDIA_ROWS="$(sql 'SELECT count(*) FROM media;')"
# push:true inserts a sentinel row named "dev" (batch -1) that is not a
# migration; excluding it keeps the comparison against production honest.
MIGRATIONS="$(sql "SELECT count(*) FROM payload_migrations WHERE name <> 'dev';")"
docker compose exec -T minio sh -c "
    mc alias set dst http://127.0.0.1:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null
    mc ls --recursive dst/$BUCKET | wc -l" > "$STAGING/local-count" 2>/dev/null
OBJECTS="$(tr -d ' \r' < "$STAGING/local-count")"

echo "  courses .................. $COURSES"
echo "  modules .................. $MODULES"
echo "  media rows ............... $MEDIA_ROWS"
echo "  media objects in MinIO ... $OBJECTS  (production: $REMOTE_OBJECTS)"
echo "  migrations applied ....... $MIGRATIONS  (production: $REMOTE_MIGRATIONS)"

# A media row without its object is the failure this whole script exists to
# avoid — a page that renders but shows broken images.
[[ "$OBJECTS" == "$REMOTE_OBJECTS" ]] || die "Object count does not match production."
[[ "$MODULES" -gt 0 ]] || die "No modules restored — the clone did not work."
[[ "$MIGRATIONS" == "$REMOTE_MIGRATIONS" ]] \
    || die "Migration count differs from production ($MIGRATIONS vs $REMOTE_MIGRATIONS)."

# End-to-end check: fetch a real file through the app, not just from storage.
SAMPLE="$(sql "SELECT filename FROM media WHERE filename IS NOT NULL LIMIT 1;")"
for path in "/api/media/file/$SAMPLE" "/media/$SAMPLE"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "http://localhost:3000$path")"
    printf '  %-46s %s\n' "$path" "$code"
    [[ "$code" == "200" ]] || die "Media not served at $path"
done

cat <<DONE

────────────────────────────────────────────────────────────
  Local stack is up with production data.

    App .............. http://localhost:3000
    Payload admin .... http://localhost:3000/payload
    MinIO console .... http://localhost:9001

  Log in with the production credentials — password hashes
  carry over. Logs: docker compose logs -f web
────────────────────────────────────────────────────────────
DONE
