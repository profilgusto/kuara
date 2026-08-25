#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — App Update Script
# ─────────────────────────────────────────────────────────────────────────────
#
# Updates only the Kuara application (web service) without touching
# Traefik, PostgreSQL, or MinIO infrastructure.
#
# Run this for every subsequent deploy after the initial setup with deploy.sh.
#
# Usage (from repo root on the server):
#   ./scripts/update-app-in-server.sh [--branch main]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"
COMPOSE_APP="$REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }
step() { echo; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; log "▶ $*"; }

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch) BRANCH="$2"; shift 2 ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
step "Pre-flight checks"
cd "$REPO_DIR"

command -v docker &>/dev/null      || fail "Docker is not installed."
docker compose version &>/dev/null || fail "Docker Compose plugin is not installed."
[[ -f "$ENV_FILE" ]]               || fail ".env.prod not found. Run deploy.sh first."
[[ -f "$COMPOSE_APP" ]]            || fail "$COMPOSE_APP not found."

# ── Load env vars into shell ──────────────────────────────────────────────────
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

log "Pre-flight checks passed."

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
step "Pulling latest code from origin/$BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
log "Now at commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# ── Step 2: Validate migration index consistency ──────────────────────────────
step "Validating migration index consistency"
MIGRATIONS_DIR="$REPO_DIR/app/migrations"
INDEX_FILE="$MIGRATIONS_DIR/index.ts"
idx_errors=0

# Quote style is whatever Prettier last decided (it flipped this file from
# single to double quotes), so match either — the index is not wrong just
# because the quotes changed.
for f in "$MIGRATIONS_DIR"/[0-9]*.ts; do
    name="$(basename "$f" .ts)"
    grep -qE "from [\"']\./$name[\"']" "$INDEX_FILE" \
        || { log "ERROR: $name.ts exists but is not referenced in migrations/index.ts"; idx_errors=$((idx_errors + 1)); }
done

while IFS= read -r name; do
    [[ -f "$MIGRATIONS_DIR/$name.ts" ]] \
        || { log "ERROR: migrations/index.ts references '$name' but the file does not exist"; idx_errors=$((idx_errors + 1)); }
done < <(sed -nE "s|.*from ['\"]\./([^'\"]+)['\"].*|\\1|p" "$INDEX_FILE")

[[ $idx_errors -eq 0 ]] || fail "Migration index is inconsistent. Fix app/migrations/index.ts before deploying."
log "Migration index OK."

# ── Step 3: Build updated images ─────────────────────────────────────────────
step "Building updated application images"
docker compose -f "$COMPOSE_APP" build --pull migrate web
log "Images built."

# ── Step 4: Run database migrations ──────────────────────────────────────────
step "Running database migrations"
# Runs against the already-running postgres. Aborts on non-zero exit.
docker compose -f "$COMPOSE_APP" run --rm migrate
log "Migrations complete."

# ── Step 5: Restart web service with the new image ───────────────────────────
step "Restarting web service"
# --no-deps: only restart web, leave postgres/minio/traefik untouched.
docker compose -f "$COMPOSE_APP" up -d --no-deps web
log "Web service restarted."

# ── Step 6: Wait for web service health ──────────────────────────────────────
step "Waiting for web service to become healthy (up to 3 min)"
MAX_WAIT=180
ELAPSED=0
# The app is served under NEXT_PUBLIC_BASE_PATH (e.g. /kuara), so the health
# endpoint lives at ${BASE_PATH}/api/health — not at the bare /api/health.
HEALTH_URL="http://127.0.0.1:3000${NEXT_PUBLIC_BASE_PATH:-}/api/health"
until docker compose -f "$COMPOSE_APP" exec -T web \
        wget -qO- "$HEALTH_URL" &>/dev/null; do
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        log "Web service did not become healthy within ${MAX_WAIT}s."
        log "Check logs: docker compose -f docker-compose.prod.yml logs --tail=50 web"
        exit 1
    fi
    sleep 5; ELAPSED=$((ELAPSED + 5))
done
log "Web service is healthy."

# ── Step 7: Prune dangling images ────────────────────────────────────────────
step "Pruning unused Docker images"
docker image prune -f

# ── Done ─────────────────────────────────────────────────────────────────────
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Update complete!"
echo
docker compose -f "$COMPOSE_APP" ps
