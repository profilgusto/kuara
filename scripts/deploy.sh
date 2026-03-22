#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — First-Time Production Deploy Script
# ─────────────────────────────────────────────────────────────────────────────
#
# Run this ONCE on the server to set up the entire stack from scratch.
# For subsequent app updates, use: ./scripts/update-app-in-server.sh
#
# Prerequisites on the server:
#   - Docker Engine + Docker Compose plugin  (apt install docker.io docker-compose-plugin)
#   - Git repository cloned to this directory
#   - .env.prod filled in  (cp .env.prod.example .env.prod && nano .env.prod)
#   - Ports 80 and 443 open in the firewall
#   - DNS A record for TRAEFIK_DOMAIN pointing to this server's public IP
#
# Usage (from repo root on the server):
#   ./scripts/deploy.sh [--branch main]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"
COMPOSE_APP="$REPO_DIR/docker-compose.prod.yml"
COMPOSE_TRAEFIK="$REPO_DIR/docker-compose.traefik.yml"
ENV_FILE="$REPO_DIR/.env.prod"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }
step() { echo; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; log "▶ $*"; }

# Read a single variable from .env.prod (safe — no eval)
get_env() { grep "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

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

command -v docker &>/dev/null      || fail "Docker is not installed. Run: apt install docker.io docker-compose-plugin"
docker compose version &>/dev/null || fail "Docker Compose plugin is not installed. Run: apt install docker-compose-plugin"
[[ -f "$ENV_FILE" ]]               || fail ".env.prod not found. Run: cp .env.prod.example .env.prod  then fill in all values."
[[ -f "$COMPOSE_APP" ]]            || fail "$COMPOSE_APP not found."
[[ -f "$COMPOSE_TRAEFIK" ]]        || fail "$COMPOSE_TRAEFIK not found."

# Validate required vars exist and have no placeholder values
for var in NEXT_PUBLIC_SERVER_URL PAYLOAD_SECRET POSTGRES_PASSWORD \
           MINIO_ROOT_USER MINIO_ROOT_PASSWORD TRAEFIK_DOMAIN TRAEFIK_ACME_EMAIL; do
    val="$(get_env "$var")"
    [[ -n "$val" ]]               || fail "$var is not set in .env.prod"
    [[ "$val" != *"CHANGE_ME"* ]] || fail "$var still has a placeholder value — set a real value in .env.prod"
done

log "All pre-flight checks passed."

# ── Load env vars into shell ──────────────────────────────────────────────────
# Docker Compose reads variable substitution (${VAR}) from the shell environment.
# Sourcing here is more reliable than --env-file across all Docker Compose versions.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

log "Target domain: ${TRAEFIK_DOMAIN}"

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
step "Pulling latest code from origin/$BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
log "Now at commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# ── Step 2: Traefik infrastructure ───────────────────────────────────────────
step "Setting up Traefik infrastructure"

# Let docker compose create the traefik-net network — do NOT create it manually
# with `docker network create` as that produces an unlabelled network that compose
# will reject with "incorrect label" errors.
#
# One-time migration: older deployments ran Traefik under the 'kuara' project
# (kuara-traefik-1). The compose file now uses `name: traefik` so the container
# lives in its own project and is never removed by `--remove-orphans` in the
# app compose. Stop the old container if present so the new project can start.
if docker ps --filter "name=kuara-traefik-1" --filter "status=running" -q 2>/dev/null | grep -q .; then
    log "Migrating Traefik from 'kuara' project to 'traefik' project …"
    docker stop kuara-traefik-1 2>/dev/null || true
    docker rm   kuara-traefik-1 2>/dev/null || true
    docker compose -f "$COMPOSE_TRAEFIK" up -d
    log "Traefik migrated and running under 'traefik' project."
elif docker compose -f "$COMPOSE_TRAEFIK" ps --status running 2>/dev/null | grep -q "traefik"; then
    log "Traefik is already running — skipping."
else
    log "Starting Traefik …"
    docker compose -f "$COMPOSE_TRAEFIK" up -d
    log "Traefik is up."
fi

# ── Step 3: Build application images ─────────────────────────────────────────
step "Building application images (migrator + runner)"
docker builder prune -f
docker compose -f "$COMPOSE_APP" build --pull --no-cache migrate web
log "Images built successfully."

# ── Step 4: Start infrastructure services ────────────────────────────────────
step "Starting PostgreSQL and MinIO"
docker compose -f "$COMPOSE_APP" up -d postgres minio

log "Waiting for PostgreSQL to be healthy …"
ELAPSED=0
until docker compose -f "$COMPOSE_APP" exec -T postgres \
        pg_isready -U kuara -d kuara &>/dev/null; do
    if [[ $ELAPSED -ge 60 ]]; then
        fail "PostgreSQL did not become healthy within 60s. Check: docker compose -f docker-compose.prod.yml logs postgres"
    fi
    sleep 3; ELAPSED=$((ELAPSED + 3))
done
log "PostgreSQL is healthy."

# ── Step 5: Run database migrations ──────────────────────────────────────────
step "Running database migrations"
# --rm removes the container after exit.
# Non-zero exit here aborts the script (set -e) — web service is NOT started.
docker compose -f "$COMPOSE_APP" run --rm migrate
log "Migrations complete."

# ── Step 6: Bring up all services ────────────────────────────────────────────
step "Bringing up all application services"
docker compose -f "$COMPOSE_APP" up -d --remove-orphans
log "All services started."

# ── Step 7: Wait for web service health ──────────────────────────────────────
step "Waiting for web service to become healthy (up to 3 min)"
MAX_WAIT=180
ELAPSED=0
until docker compose -f "$COMPOSE_APP" exec -T web \
        wget -qO- http://localhost:3000/api/health &>/dev/null; do
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        log "Web service did not become healthy within ${MAX_WAIT}s."
        log "Check logs: docker compose -f docker-compose.prod.yml logs --tail=50 web"
        exit 1
    fi
    sleep 5; ELAPSED=$((ELAPSED + 5))
done
log "Web service is healthy."

# ── Step 8: Prune dangling images ────────────────────────────────────────────
step "Pruning unused Docker images"
docker image prune -f

# ── Done ─────────────────────────────────────────────────────────────────────
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy complete! Site is live at: https://${TRAEFIK_DOMAIN}"
echo
docker compose -f "$COMPOSE_APP" ps
