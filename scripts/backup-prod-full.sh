#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — Full production backup, pulled to this machine
# ─────────────────────────────────────────────────────────────────────────────
# Copies everything production cannot regenerate — the database, every media
# object and .env.prod — into a timestamped folder on the machine running this
# script. backup-db.sh (the nightly cron on the server) covers the database
# only and keeps it on the same disk as the data it protects.
#
# Run from the dev machine, at the repo root:
#   ./scripts/backup-prod-full.sh
#   ./scripts/backup-prod-full.sh --out /Volumes/x # default: ~/kuara-backups
#
# Result: <out>/prod_<timestamp>/
#   kuara.dump         pg_dump -Fc of the kuara database
#   kuara-media.tar    every object in the bucket. Kept as a tar on purpose:
#                      unpacked on macOS, accented filenames would be rewritten
#                      to another Unicode form and stop matching the database.
#                      Load it with scripts/restore-media.sh.
#   objects.txt        the object names inside the tar
#   env.prod           production's .env.prod (mode 600 — it holds secrets)
#   SHA256SUMS         checksum of every file above
#   MANIFEST.txt       what was captured, and the counts that were verified
#   remote-count, remote-migrations
#                      read by refresh-local-from-prod.sh --from-backup
#
# Restore test / local clone of the backup:
#   ./scripts/refresh-local-from-prod.sh --from-backup <out>/prod_<timestamp>
#
# Overridable via environment (same as refresh-local-from-prod.sh):
#   KUARA_SSH_HOST, KUARA_SSH_USER, KUARA_SSH_PORT, KUARA_REMOTE_DIR
#
# Production is only ever read from, and everything is streamed over SSH:
# nothing is written to the production disk, which sits near capacity.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
SSH_HOST="${KUARA_SSH_HOST:-kuara.ufsj.edu.br}"
SSH_USER="${KUARA_SSH_USER:-filgusto}"
SSH_PORT="${KUARA_SSH_PORT:-22691}"
REMOTE_DIR="${KUARA_REMOTE_DIR:-~/kuara-house/kuara}"
REMOTE_COMPOSE="docker compose -f docker-compose.prod.yml"
BUCKET="kuara-media"
OUT_ROOT="$HOME/kuara-backups"

# -n: see refresh-local-from-prod.sh — ssh would otherwise drain our stdin.
SSH=(ssh -n -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}")

# ── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
step() { echo; echo "──────── $* ────────"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out)     OUT_ROOT="${2:-}"; shift ;;
        -h|--help) sed -n '2,36p' "$0"; exit 0 ;;
        *)         die "Unknown option: $1 (try --help)" ;;
    esac
    shift
done

[[ -n "$OUT_ROOT" ]] || die "--out needs a directory."

DEST="$OUT_ROOT/prod_$(date +%Y%m%d_%H%M%S)"

# A half-written folder must never be mistaken for a backup.
finish() {
    local rc=$?
    if [[ $rc -ne 0 && -d "$DEST" ]]; then
        mv "$DEST" "$DEST.INCOMPLETE" 2>/dev/null || true
        echo "Backup FAILED — partial data left at $DEST.INCOMPLETE" >&2
    fi
    exit $rc
}
trap finish EXIT

remote() { "${SSH[@]}" "cd $REMOTE_DIR && $*"; }
psql_count() {
    remote "$REMOTE_COMPOSE exec -T postgres psql -U kuara -d kuara -tAc \"$1\"" 2>/dev/null | tr -d ' \r\n'
}

# ── Pre-flight ───────────────────────────────────────────────────────────────
step "Pre-flight"

command -v python3 >/dev/null || die "python3 is required (to read the media archive)."

"${SSH[@]}" -o ConnectTimeout=15 true 2>/dev/null \
    || die "Cannot reach ${SSH_USER}@${SSH_HOST}:${SSH_PORT} over SSH."

remote "$REMOTE_COMPOSE ps -q --status running postgres" 2>/dev/null | grep -q . \
    || die "Production postgres is not running."

remote "$REMOTE_COMPOSE ps -q --status running garage" 2>/dev/null | grep -q . \
    || die "Production garage is not running."

umask 077
mkdir -p "$DEST"
log "Production reachable · writing to $DEST"

# ── 1. Database ──────────────────────────────────────────────────────────────
step "1/3 · Database"

# -Fc (custom format): compressed, and pg_restore can drop owners/ACLs.
remote "$REMOTE_COMPOSE exec -T postgres pg_dump -U kuara -d kuara -Fc" \
    2>/dev/null > "$DEST/kuara.dump"

[[ -s "$DEST/kuara.dump" ]] || die "Database dump came back empty."
head -c 5 "$DEST/kuara.dump" | grep -q "PGDMP" || die "Dump is not a valid PostgreSQL archive."

MEDIA_ROWS="$(psql_count 'SELECT count(*) FROM media;')"
psql_count 'SELECT count(*) FROM payload_migrations;' > "$DEST/remote-migrations"
MIGRATIONS="$(cat "$DEST/remote-migrations")"
[[ "$MEDIA_ROWS" =~ ^[0-9]+$ && "$MIGRATIONS" =~ ^[0-9]+$ ]] || die "Could not read row counts from production."
log "Database dumped ($(du -h "$DEST/kuara.dump" | cut -f1)) · $MEDIA_ROWS media rows · $MIGRATIONS migrations"

# ── 2. Media ─────────────────────────────────────────────────────────────────
step "2/3 · Media"

# Exported through the object API (never the raw data volume, whose layout is
# private to the server) and streamed here as a tar.
remote "$REMOTE_COMPOSE run --rm -T --entrypoint sh rclone -c \
    'rclone copy garage:$BUCKET /tmp/$BUCKET -q && tar -C /tmp -cf - $BUCKET'" \
    2>/dev/null > "$DEST/$BUCKET.tar"
remote "$REMOTE_COMPOSE run --rm -T rclone lsf -R --files-only garage:$BUCKET | wc -l" \
    > "$DEST/remote-count" 2>/dev/null

[[ -s "$DEST/$BUCKET.tar" ]] || die "Media export came back empty."
# Listed with python rather than `tar -t`: bsdtar on macOS prints non-ASCII
# names escaped, and these names are compared byte for byte with the database.
python3 -c '
import sys, tarfile
prefix = sys.argv[2] + "/"
with tarfile.open(sys.argv[1]) as t:
    for m in t:
        if m.isfile() and m.name.startswith(prefix):
            sys.stdout.buffer.write(m.name[len(prefix):].encode() + b"\n")
' "$DEST/$BUCKET.tar" "$BUCKET" > "$DEST/objects.txt" || die "The media archive is not a readable tar."

REMOTE_OBJECTS="$(tr -d ' \r\n' < "$DEST/remote-count")"
echo "$REMOTE_OBJECTS" > "$DEST/remote-count"
LOCAL_FILES="$(wc -l < "$DEST/objects.txt" | tr -d ' ')"

[[ "$REMOTE_OBJECTS" =~ ^[0-9]+$ ]] || die "Could not count the objects in the production bucket."
[[ "$REMOTE_OBJECTS" == "$LOCAL_FILES" ]] \
    || die "Media transfer incomplete: production has $REMOTE_OBJECTS objects, downloaded $LOCAL_FILES."
log "Media downloaded ($LOCAL_FILES objects, $(du -h "$DEST/$BUCKET.tar" | cut -f1))"

# Every row in `media` names one object. A row with no file is a broken image
# in production today — worth knowing, but it is not a failure of the backup.
MISSING=0
while IFS= read -r name; do
    [[ -z "$name" ]] || grep -Fxq -- "$name" "$DEST/objects.txt" || { MISSING=$((MISSING + 1)); echo "  no object for media row: $name"; }
done < <(remote "$REMOTE_COMPOSE exec -T postgres psql -U kuara -d kuara -tAc \
    \"SELECT filename FROM media WHERE filename IS NOT NULL;\"" 2>/dev/null | tr -d '\r')
[[ $MISSING -eq 0 ]] && log "Every media row has its object" \
    || log "WARNING: $MISSING media row(s) have no object in the bucket (listed above)"

# ── 3. Secrets ───────────────────────────────────────────────────────────────
step "3/3 · .env.prod"

"${SSH[@]}" "cat $REMOTE_DIR/.env.prod" > "$DEST/env.prod"
[[ -s "$DEST/env.prod" ]] || die ".env.prod came back empty."
chmod 600 "$DEST/env.prod"
log ".env.prod saved (mode 600)"

# ── Manifest ─────────────────────────────────────────────────────────────────
REMOTE_COMMIT="$(remote "git rev-parse --short HEAD" 2>/dev/null || echo unknown)"

( cd "$DEST" && shasum -a 256 kuara.dump env.prod "$BUCKET.tar" objects.txt > SHA256SUMS )

cat > "$DEST/MANIFEST.txt" <<MANIFEST
Kuara full production backup
  taken at ............. $(date '+%Y-%m-%d %H:%M:%S %z')
  host ................. ${SSH_USER}@${SSH_HOST}:${SSH_PORT}
  deployed commit ...... $REMOTE_COMMIT
  storage backend ...... garage

  kuara.dump ........... $(du -h "$DEST/kuara.dump" | cut -f1)  (pg_dump -Fc)
  migrations applied ... $MIGRATIONS
  media rows ........... $MEDIA_ROWS
  objects in bucket .... $REMOTE_OBJECTS
  objects downloaded ... $LOCAL_FILES  ($(du -h "$DEST/$BUCKET.tar" | cut -f1), $BUCKET.tar)
  rows with no object .. $MISSING

Verify integrity later:  cd "$DEST" && shasum -a 256 -c SHA256SUMS
Restore into local dev:  ./scripts/refresh-local-from-prod.sh --from-backup "$DEST"
MANIFEST

echo
cat "$DEST/MANIFEST.txt"
echo
log "Backup complete: $DEST"
