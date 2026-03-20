#!/usr/bin/env bash
# migrate-media-to-minio.sh
#
# One-time migration: uploads all files from app/media/ into the MinIO
# kuara-media bucket using a temporary minio/mc container.
#
# Prerequisites:
#   - The stack must be running: docker compose up -d (or docker compose -f docker-compose.prod.yml up -d)
#   - app/media/ must contain the files to migrate
#
# Usage (dev):
#   ./scripts/migrate-media-to-minio.sh
#
# Usage (prod):
#   MINIO_ROOT_USER=<user> MINIO_ROOT_PASSWORD=<pass> ./scripts/migrate-media-to-minio.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MEDIA_DIR="${REPO_ROOT}/app/media"
BUCKET="kuara-media"
MINIO_ENDPOINT="http://localhost:9000"

MINIO_USER="${MINIO_ROOT_USER:-kuara}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-kuara_dev_secret}"

if [ ! -d "${MEDIA_DIR}" ] || [ -z "$(ls -A "${MEDIA_DIR}")" ]; then
    echo "No files found in ${MEDIA_DIR} — nothing to migrate."
    exit 0
fi

FILE_COUNT=$(find "${MEDIA_DIR}" -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "Found ${FILE_COUNT} file(s) in ${MEDIA_DIR}. Uploading to MinIO bucket '${BUCKET}'..."

docker run --rm \
    --network kuara-net \
    -v "${MEDIA_DIR}:/media:ro" \
    minio/mc:latest \
    /bin/sh -c "
        mc alias set minio ${MINIO_ENDPOINT} ${MINIO_USER} ${MINIO_PASS} 2>/dev/null || \
        mc alias set minio http://minio:9000 ${MINIO_USER} ${MINIO_PASS};
        mc cp --recursive /media/ minio/${BUCKET}/;
        echo 'Migration complete.';
        mc ls minio/${BUCKET} | wc -l | xargs -I{} echo '{} object(s) now in bucket.';
    "

echo ""
echo "Done. You can now remove the local files and commit the .gitignore change:"
echo "  git rm -r --cached app/media/"
echo "  git commit -m 'chore: stop tracking Payload media uploads in git'"
