#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — Production Deploy Script
# ─────────────────────────────────────────────────────────────────────────────
# Run on the server from the repo root:
#   ./scripts/deploy.sh [--branch main]
#
# What it does:
#   1. Pulls latest code from git
#   2. Builds migrator and runner images
#   3. Runs pending DB migrations (exits non-zero on failure → aborts deploy)
#   4. Starts/updates all services
#   5. Waits for the web service to become healthy
#   6. Prunes dangling images to free disk space
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
BRANCH="${BRANCH:-main}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch) BRANCH="$2"; shift 2 ;;
        *) fail "Unknown argument: $1" ;;
    esac
done

# ── Pre-flight checks ─────────────────────────────────────────────────────────
cd "$REPO_DIR"

[[ -f ".env.prod" ]]   || fail ".env.prod not found. Copy .env.prod.example and fill in values."
[[ -f "$COMPOSE_FILE" ]] || fail "docker-compose.prod.yml not found."
command -v docker &>/dev/null || fail "docker is not installed."

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
log "Pulling latest code from origin/$BRANCH …"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
log "Now at commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# ── Step 2: Build images ──────────────────────────────────────────────────────
log "Building images (migrator + runner) …"
docker compose -f "$COMPOSE_FILE" build --pull migrate web

# ── Step 3: Ensure postgres is up before running migrations ───────────────────
log "Starting postgres …"
docker compose -f "$COMPOSE_FILE" up -d postgres

log "Waiting for postgres to be healthy …"
ELAPSED=0
until docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_isready -U kuara -d kuara &>/dev/null; do
    if [[ $ELAPSED -ge 60 ]]; then
        fail "Postgres did not become healthy within 60s."
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done
log "Postgres is healthy."

# ── Step 4: Run database migrations ───────────────────────────────────────────
# --rm removes the container after exit. Exits non-zero if any migration fails,
# which causes this script to abort (set -e) before the web service updates.
log "Running database migrations …"
docker compose -f "$COMPOSE_FILE" run --rm migrate
log "Migrations complete."

# ── Step 5: Bring up all services ─────────────────────────────────────────────
log "Starting/updating all services …"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# ── Step 6: Health check — wait for web to respond ────────────────────────────
log "Waiting for web service to become healthy …"
MAX_WAIT=120
ELAPSED=0
until docker compose -f "$COMPOSE_FILE" exec -T web \
        node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1))" \
        2>/dev/null; do
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        log "Web service did not become healthy within ${MAX_WAIT}s."
        log "Check logs with: docker compose -f docker-compose.prod.yml logs -f web"
        exit 1
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done
log "Web service is healthy."

# ── Step 7: Prune dangling images ─────────────────────────────────────────────
log "Pruning unused Docker images …"
docker image prune -f

log "Deploy complete. Running containers:"
docker compose -f "$COMPOSE_FILE" ps
