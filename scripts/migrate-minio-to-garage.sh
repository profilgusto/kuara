#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — One-time production cutover: MinIO → Garage
# ─────────────────────────────────────────────────────────────────────────────
# Moves the media bucket from the running MinIO container to Garage and
# switches the web service over, with the site up the whole time except for
# the few seconds of an ordinary web restart.
#
# This REPLACES update-app-in-server.sh for the one deploy that introduces
# Garage. Do NOT run update-app-in-server.sh for that deploy: it would restart
# web against an empty Garage bucket and every image on the site would break.
#
# Before running (on the server, from the repo root):
#   1. From the dev machine: ./scripts/backup-prod-full.sh --source minio
#   2. git pull origin main          # brings this script and the Garage compose
#   3. ./scripts/migrate-minio-to-garage.sh
#
# Options:
#   -y, --yes   do not pause for confirmation before the two points of change
#               (switching web to Garage, stopping MinIO)
#
# What it does, in order — everything before step 6 leaves the live site
# untouched and still on MinIO:
#   1. Pre-flight (disk, MinIO running, compose file has Garage)
#   2. Adds GARAGE_RPC_SECRET / S3_ACCESS_KEY / S3_SECRET_KEY to .env.prod
#   3. Builds the new migrate + web images
#   4. Starts Garage next to MinIO, enables public read on the bucket
#   5. Copies every object MinIO → Garage and verifies the copy
#   6. Runs migrations and restarts web on the new image   ← the cutover
#   7. Copies again, to catch anything uploaded to MinIO during 5–6
#   8. Verifies the site serves media from Garage
#   9. Stops MinIO — stopped, NOT removed: container and volume are the rollback
#
# Safe to re-run after a failure: env vars are only added when missing, and
# objects are copied with `rclone copy`, which never deletes.
#
# Rollback, for as long as the MinIO container and its volume exist:
#   docker start <minio container>                     # id is printed in step 9
#   git checkout <commit before the Garage change>
#   docker tag kuara-web:rollback kuara-web:latest
#   docker compose -f docker-compose.prod.yml up -d --no-deps web
# Files uploaded after the cutover exist only in Garage; bring them back with
#   git checkout main && docker compose -f docker-compose.prod.yml run --rm \
#       rclone copy garage:kuara-media minio:kuara-media
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_APP="$REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"
ENV_BACKUP="$REPO_DIR/.env.prod.pre-garage"
BUCKET="kuara-media"
MIN_FREE_KB=$((2 * 1024 * 1024))   # 2 GB: the media is briefly stored twice
ASSUME_YES=0

DC=(docker compose -f "$COMPOSE_APP")

# ── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }
step() { echo; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; log "▶ $*"; }

confirm() {
    [[ $ASSUME_YES -eq 1 ]] && return 0
    read -r -p "$1 [y/N] " reply || reply=""
    [[ "$reply" =~ ^[yY]$ ]] || fail "Stopped at your request. Nothing after this point was changed; re-run to continue."
}

get_env() { grep "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }

rclone() { "${DC[@]}" run --rm -T rclone "$@"; }
count()  { rclone lsf -R --files-only "$1:$BUCKET" | wc -l | tr -d ' \r'; }
sql()    { "${DC[@]}" exec -T postgres psql -U kuara -d kuara -tAc "$1" | tr -d '\r'; }

while [[ $# -gt 0 ]]; do
    case $1 in
        -y|--yes)  ASSUME_YES=1; shift ;;
        -h|--help) sed -n '2,45p' "$0"; exit 0 ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

# ── Step 1: Pre-flight ───────────────────────────────────────────────────────
step "1/9 · Pre-flight checks"
cd "$REPO_DIR"

command -v docker &>/dev/null      || fail "Docker is not installed."
docker compose version &>/dev/null || fail "Docker Compose plugin is not installed."
command -v openssl &>/dev/null     || fail "openssl is required to generate the Garage secrets."
[[ -f "$ENV_FILE" ]]               || fail ".env.prod not found."
[[ -f "$REPO_DIR/garage/garage.toml" ]] \
    || fail "garage/garage.toml not found — run 'git pull origin main' first."
grep -qE '^  garage:' "$COMPOSE_APP" \
    || fail "docker-compose.prod.yml has no garage service — run 'git pull origin main' first."

# Located by label, not by compose service: this must find the container that
# the OLD compose file created, whatever profile the new file puts it under.
PROJECT="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' \
    "$("${DC[@]}" ps -q postgres 2>/dev/null | head -1)" 2>/dev/null || true)"
[[ -n "$PROJECT" ]] || fail "Could not find the running postgres container of this stack."
MINIO_CID="$(docker ps -q \
    --filter "label=com.docker.compose.project=$PROJECT" \
    --filter "label=com.docker.compose.service=minio" | head -1)"
[[ -n "$MINIO_CID" ]] \
    || fail "No running MinIO container in project '$PROJECT'. If a previous run already stopped it, the migration is done."

[[ -n "$(get_env MINIO_ROOT_USER)" && -n "$(get_env MINIO_ROOT_PASSWORD)" ]] \
    || fail "MINIO_ROOT_USER / MINIO_ROOT_PASSWORD must stay in .env.prod until the migration is signed off."

DOCKER_ROOT="$(docker info --format '{{.DockerRootDir}}')"
FREE_KB="$(df -Pk "$DOCKER_ROOT" | awk 'NR==2 {print $4}')"
df -h "$DOCKER_ROOT" | sed 's/^/  /'
[[ "$FREE_KB" -ge "$MIN_FREE_KB" ]] \
    || fail "Less than 2 GB free under $DOCKER_ROOT. Free space first (docker builder prune -f — never -a)."

log "Project '$PROJECT' · MinIO container $MINIO_CID is running · disk OK"

# ── Step 2: Garage secrets in .env.prod ──────────────────────────────────────
step "2/9 · Garage variables in .env.prod"

if [[ ! -f "$ENV_BACKUP" ]]; then
    cp -p "$ENV_FILE" "$ENV_BACKUP"
    chmod 600 "$ENV_BACKUP"
    log "Saved the current file as $(basename "$ENV_BACKUP")."
fi

add_env() {   # add_env NAME VALUE — only when NAME has no value yet
    if [[ -n "$(get_env "$1")" ]]; then
        log "$1 already set — kept."
    else
        printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
        log "$1 generated and added."
    fi
}

# Guarantee the file ends in a newline before appending to it.
[[ -z "$(tail -c 1 "$ENV_FILE")" ]] || echo >> "$ENV_FILE"
if [[ -z "$(get_env GARAGE_RPC_SECRET)$(get_env S3_ACCESS_KEY)$(get_env S3_SECRET_KEY)" ]]; then
    printf '\n# ── Object Storage (Garage) — added by migrate-minio-to-garage.sh ──\n' >> "$ENV_FILE"
fi
add_env GARAGE_RPC_SECRET "$(openssl rand -hex 32)"
# Garage only accepts keys shaped GK + 24 hex chars, with a 64-hex-char secret.
add_env S3_ACCESS_KEY     "GK$(openssl rand -hex 12)"
add_env S3_SECRET_KEY     "$(openssl rand -hex 32)"

[[ "$(get_env S3_ACCESS_KEY)" =~ ^GK[0-9a-f]{24}$ ]] || fail "S3_ACCESS_KEY must be 'GK' followed by 24 hex characters."
[[ "$(get_env S3_SECRET_KEY)" =~ ^[0-9a-f]{64}$ ]]   || fail "S3_SECRET_KEY must be 64 hex characters."
[[ "$(get_env GARAGE_RPC_SECRET)" =~ ^[0-9a-f]{64}$ ]] || fail "GARAGE_RPC_SECRET must be 64 hex characters."

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── Step 3: Build ────────────────────────────────────────────────────────────
step "3/9 · Building the new application images"

# Same rollback tag update-app-in-server.sh keeps. The outgoing image has
# http://minio:9000 baked into its /media rewrite, which is exactly what a
# rollback to MinIO needs.
OUTGOING="$("${DC[@]}" images -q web 2>/dev/null || true)"
if [[ -n "$OUTGOING" ]]; then
    docker tag "$OUTGOING" kuara-web:rollback
    log "Tagged the outgoing image as kuara-web:rollback ($(echo "$OUTGOING" | cut -c1-12))."
else
    log "No running web image to tag — skipping the rollback tag."
fi

"${DC[@]}" build --pull migrate web
log "Images built. The site is still running the old image, on MinIO."

# ── Step 4: Start Garage ─────────────────────────────────────────────────────
step "4/9 · Starting Garage alongside MinIO"

"${DC[@]}" up -d --wait garage

ELAPSED=0
until "${DC[@]}" exec -T garage /garage bucket info "$BUCKET" &>/dev/null; do
    [[ $ELAPSED -lt 60 ]] || fail "Garage did not create the $BUCKET bucket within 60s. Check: docker compose -f docker-compose.prod.yml logs garage"
    sleep 3; ELAPSED=$((ELAPSED + 3))
done

# Public read on the web endpoint — what /media/* is proxied to. The
# garage-init service does the same on every later `up`; done directly here so
# the cutover does not depend on a one-shot container having finished.
"${DC[@]}" exec -T garage /garage bucket website --allow "$BUCKET"

rclone lsf "garage:$BUCKET" --max-depth 1 >/dev/null \
    || fail "The S3 credentials in .env.prod are not accepted by Garage."
rclone lsf "minio:$BUCKET" --max-depth 1 >/dev/null \
    || fail "Cannot read the MinIO bucket with MINIO_ROOT_USER / MINIO_ROOT_PASSWORD."
log "Garage is up, the bucket exists, both ends answer."

# ── Step 5: First copy ───────────────────────────────────────────────────────
step "5/9 · Copying media MinIO → Garage"

# --checksum: decide from size + hash in the listings, with no per-object HEAD.
copy_and_check() {
    rclone copy "minio:$BUCKET" "garage:$BUCKET" --checksum --transfers 8 --stats-one-line --stats 15s -v
    # --one-way: everything in MinIO must be in Garage; Garage may hold more
    # (uploads made after the cutover).
    rclone check "minio:$BUCKET" "garage:$BUCKET" --one-way
}
copy_and_check

SRC_N="$(count minio)"; DST_N="$(count garage)"
log "Objects — MinIO: $SRC_N · Garage: $DST_N"
[[ "$SRC_N" -gt 0 ]]         || fail "MinIO reports an empty bucket — refusing to cut over to nothing."
[[ "$DST_N" -ge "$SRC_N" ]]  || fail "Garage has fewer objects than MinIO after the copy."

# ── Step 6: Cutover ──────────────────────────────────────────────────────────
step "6/9 · Switching the web service to Garage"
confirm "Garage holds a verified copy. Restart web on the new image now?"

"${DC[@]}" run --rm migrate
log "Migrations complete."

"${DC[@]}" up -d --no-deps web

MAX_WAIT=180; ELAPSED=0
HEALTH_URL="http://127.0.0.1:3000${NEXT_PUBLIC_BASE_PATH:-}/api/health"
until "${DC[@]}" exec -T web wget -qO- "$HEALTH_URL" &>/dev/null; do
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        log "Web did not become healthy within ${MAX_WAIT}s. MinIO is still running."
        log "Logs: docker compose -f docker-compose.prod.yml logs --tail=50 web"
        log "Rollback: see the header of this script."
        exit 1
    fi
    sleep 5; ELAPSED=$((ELAPSED + 5))
done
log "Web is healthy on the new image."

# ── Step 7: Delta copy ───────────────────────────────────────────────────────
step "7/9 · Copying anything uploaded to MinIO during the switch"
copy_and_check
SRC_N="$(count minio)"; DST_N="$(count garage)"
log "Objects — MinIO: $SRC_N · Garage: $DST_N"

# ── Step 8: Verify ───────────────────────────────────────────────────────────
step "8/9 · Verifying the site serves media from Garage"

verify_failed() {
    log "VERIFICATION FAILED: $*"
    log "MinIO was left running. Rollback: see the header of this script."
    exit 1
}

MEDIA_ROWS="$(sql 'SELECT count(*) FROM media;')"
log "media rows: $MEDIA_ROWS · objects in Garage: $DST_N"
[[ "$DST_N" -ge "$SRC_N" ]] || verify_failed "Garage has fewer objects than MinIO."

# A filename that needs no URL-encoding, so the probe tests storage, not quoting.
SAMPLE="$(sql "SELECT filename FROM media WHERE filename ~ '^[A-Za-z0-9._-]+\$' ORDER BY id DESC LIMIT 1;")"
[[ -n "$SAMPLE" ]] || verify_failed "No media row to probe with."

BASE="${NEXT_PUBLIC_BASE_PATH:-}"
for path in "/media/$SAMPLE" "$BASE/api/media/file/$SAMPLE"; do
    if "${DC[@]}" exec -T web wget -qO /dev/null "http://127.0.0.1:3000$path"; then
        printf '  %-60s OK\n' "$path"
    else
        verify_failed "web does not serve $path"
    fi
done

if command -v curl &>/dev/null && [[ -n "${TRAEFIK_DOMAIN:-}" ]]; then
    for path in "$BASE/api/health" "/media/$SAMPLE"; do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://${TRAEFIK_DOMAIN}$path" || true)"
        printf '  %-60s %s\n' "https://${TRAEFIK_DOMAIN}$path" "$code"
        [[ "$code" == "200" ]] || verify_failed "public URL $path answered $code"
    done
    # Video and PDF players depend on partial content.
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -H 'Range: bytes=0-99' "https://${TRAEFIK_DOMAIN}/media/$SAMPLE" || true)"
    printf '  %-60s %s\n' "Range request on /media/$SAMPLE" "$code"
    [[ "$code" == "206" ]] || log "WARNING: Range request answered $code instead of 206 — check video/PDF playback by hand."
else
    log "curl or TRAEFIK_DOMAIN missing — check the public site by hand."
fi
log "The site is serving media from Garage."

# ── Step 9: Stop MinIO ───────────────────────────────────────────────────────
step "9/9 · Stopping MinIO (kept, not removed)"
confirm "Open the site and check a page with images. Stop the MinIO container now?"

# restart=no first: with the original restart:always, the next Docker daemon
# restart would bring it back up on its own.
docker update --restart=no "$MINIO_CID" >/dev/null
docker stop "$MINIO_CID" >/dev/null
log "MinIO container $MINIO_CID stopped. Its volume (kuara-minio-data) is untouched."

# Dangling-only, exactly as update-app-in-server.sh: NEVER -a. On this shared
# host -a would delete other stacks' images, kuara-web:rollback, and the MinIO
# image — which can no longer be pulled from anywhere.
docker image prune -f >/dev/null
docker builder prune -f | tail -1

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Migration complete — the site now runs on Garage."
echo
echo "  From now on, deploy as usual with ./scripts/update-app-in-server.sh"
echo
echo "  Kept for rollback until you decide otherwise:"
echo "    container  $MINIO_CID  (stopped)   → docker start $MINIO_CID"
echo "    volume     kuara-minio-data"
echo "    image      minio/minio:latest  +  kuara-web:rollback"
echo "    file       $(basename "$ENV_BACKUP")"
echo
"${DC[@]}" ps
