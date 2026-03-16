#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — One-Time Migration Baseline Bootstrap
# ─────────────────────────────────────────────────────────────────────────────
#
# RUN THIS EXACTLY ONCE on the production server BEFORE the first deploy
# that uses migrations (i.e., before running deploy.sh for the first time
# after switching from push:true to push:false).
#
# What problem does this solve?
#   Your database schema was previously managed by Payload's push:true.
#   Payload has no record of any migrations ever having been applied.
#   If we run `payload migrate` now, it sees the baseline migration as
#   "pending" and tries to CREATE TABLE on tables that already exist → error.
#
# What this script does:
#   1. Generates the baseline migration file from the CURRENT schema
#      (run once on your local dev machine, committed to git).
#   2. Creates the payload_migrations table in the production database.
#   3. Marks the baseline migration as "already applied" (batch 0).
#      Batch 0 is used as a sentinel to distinguish bootstrap records
#      from real applied migrations (which start at batch 1).
#   4. After this, `payload migrate` will see no pending migrations
#      and do nothing on the first deploy — exactly what we want.
#
# Prerequisites:
#   - Postgres container is running (docker compose -f docker-compose.prod.yml up -d postgres)
#   - The baseline migration file exists in app/migrations/
#   - You have NOT yet run `payload migrate` against this database
#
# Usage (from repo root on the production server):
#   ./scripts/init-migrations-baseline.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
MIGRATIONS_DIR="$REPO_DIR/app/migrations"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# ── Safety guard ──────────────────────────────────────────────────────────────
log "⚠️  This script must be run ONLY ONCE on a database previously managed"
log "   by push:true. Running it again may corrupt migration state."
echo ""
read -r -p "Continue? Type YES to proceed: " CONFIRM
[[ "$CONFIRM" == "YES" ]] || { log "Aborted."; exit 0; }

# ── Find the baseline migration name ─────────────────────────────────────────
BASELINE_FILE="$(ls "$MIGRATIONS_DIR"/*.ts 2>/dev/null | sort | head -1)"
[[ -n "$BASELINE_FILE" ]] || fail "No migration files found in app/migrations/. " \
    "Generate the baseline first on your dev machine: cd app && npx payload migrate:create --name baseline"

# Payload stores the migration name without the .ts extension
BASELINE_NAME="$(basename "$BASELINE_FILE" .ts)"
log "Baseline migration identified: $BASELINE_NAME"

# ── Check postgres is reachable ───────────────────────────────────────────────
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_isready -U kuara -d kuara &>/dev/null \
    || fail "Postgres is not running. Start it with: docker compose -f docker-compose.prod.yml up -d postgres"

# ── Check if payload_migrations already has rows ──────────────────────────────
EXISTING=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U kuara -d kuara -tAq \
    -c "SELECT COUNT(*) FROM payload_migrations;" 2>/dev/null || echo "TABLE_MISSING")

if [[ "$EXISTING" == "TABLE_MISSING" ]]; then
    log "payload_migrations table does not exist yet — will create it."
elif [[ "$EXISTING" -gt 0 ]]; then
    log "payload_migrations already has $EXISTING row(s)."
    read -r -p "Rows already exist. Still continue? Type YES to proceed: " CONFIRM2
    [[ "$CONFIRM2" == "YES" ]] || { log "Aborted."; exit 0; }
else
    log "payload_migrations table exists and is empty — proceeding."
fi

# ── Apply the bootstrap SQL ───────────────────────────────────────────────────
log "Bootstrapping payload_migrations table …"

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U kuara -d kuara << SQL
-- Create the migrations table if Payload hasn't created it yet.
-- This mirrors the schema Payload's postgres adapter generates.
CREATE TABLE IF NOT EXISTS "payload_migrations" (
    "id"         serial PRIMARY KEY,
    "name"       varchar,
    "batch"      numeric,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Mark the baseline migration as applied (batch 0 = bootstrap sentinel).
-- Payload's migrate runner starts real batches at 1, so this won't clash.
INSERT INTO "payload_migrations" ("name", "batch")
VALUES ('${BASELINE_NAME}', 0)
ON CONFLICT DO NOTHING;

SELECT id, name, batch, created_at FROM "payload_migrations" ORDER BY id;
SQL

log "Bootstrap complete. payload_migrations now contains:"
log "  name=$BASELINE_NAME  batch=0 (bootstrap)"
log ""
log "You can now run the normal deploy:"
log "  ./scripts/deploy.sh"
log ""
log "On the first deploy, \`payload migrate\` will see no pending migrations"
log "and exit cleanly without touching any existing tables."
