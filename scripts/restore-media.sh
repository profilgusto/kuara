#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — Load a media archive into the Garage bucket
# ─────────────────────────────────────────────────────────────────────────────
# Uploads a kuara-media.tar (as written by backup-prod-full.sh) into the
# bucket of the running stack. The database must already be restored: each
# object's Content-Type is taken from its row in `media`.
#
# Two things a plain "copy the files back" gets wrong, and this does not:
#   - Names. The archive is unpacked inside a Linux container, never on the
#     host. macOS rewrites accented filenames to a different Unicode form, so
#     a file that passed through a Mac folder comes back under a key the
#     database no longer matches — a 404 for "hidrelétrica.png".
#   - Types. Uploading from files guesses Content-Type from the extension. The
#     library holds WebP images named .png; guessed, they would be served with
#     the wrong type. The database recorded the real one at upload time.
#
# Usage (repo root; the stack must be up):
#   ./scripts/restore-media.sh <path/to/kuara-media.tar>             # dev
#   set -a; source .env.prod; set +a
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/restore-media.sh <tar>  # prod
#
# Never deletes: objects already in the bucket and absent from the archive
# are left alone.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BUCKET="kuara-media"
TAR="${1:-}"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$TAR" && -s "$TAR" ]] || die "Usage: $0 <path/to/kuara-media.tar>"
TAR="$(cd "$(dirname "$TAR")" && pwd)/$(basename "$TAR")"
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PLAN="$(mktemp "${TMPDIR:-/tmp}/kuara-media-plan.XXXXXX")"
trap 'rm -f "$PLAN"' EXIT

# One line per media row: up '<filename>' '<mime type>', single-quoted for sh
# with embedded quotes escaped — built in SQL so no filename ever passes
# through a shell unquoted.
docker compose exec -T postgres psql -U kuara -d kuara -tA -c "
    SELECT 'up ''' || replace(filename, '''', '''\''''') || ''' '''
        || replace(coalesce(mime_type, 'application/octet-stream'), '''', '') || ''''
    FROM media WHERE filename IS NOT NULL ORDER BY id;" | tr -d '\r' > "$PLAN"

[[ -s "$PLAN" ]] || die "The media table is empty — restore the database before the media."

docker compose run --rm -T \
    -v "$TAR:/in/media.tar:ro" -v "$PLAN:/in/plan.sh:ro" \
    --entrypoint sh rclone -c '
        set -e
        mkdir -p /tmp/x && tar -xf /in/media.tar -C /tmp/x
        src="/tmp/x/'"$BUCKET"'"; dst="garage:'"$BUCKET"'"
        n=0; missing=0
        up() {
            if [ ! -f "$src/$1" ]; then
                echo "  no file in the archive for media row: $1"; missing=$((missing + 1)); return 0
            fi
            rclone copyto "$src/$1" "$dst/$1" --header-upload "Content-Type: $2" -q
            n=$((n + 1))
        }
        . /in/plan.sh
        # Whatever the archive holds that no row names (orphans): size and
        # modtime already match for everything uploaded above, so only the
        # leftovers are sent.
        rclone copy "$src" "$dst" -q
        echo "  $n object(s) uploaded with their recorded type, $missing row(s) without a file"
    '
