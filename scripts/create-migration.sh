#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kuara — Create a Payload CMS Migration
# ─────────────────────────────────────────────────────────────────────────────
#
# Run this after modifying any Payload collection schema (add/remove/rename
# fields, change types, etc.).
#
# Why esbuild? Node.js 22.12+ throws ERR_REQUIRE_ASYNC_MODULE when the
# payload CLI tries to require() payload.config.ts, because @lexical/*
# packages use ESM top-level await. Pre-compiling to .mjs lets Node load
# the config via native ESM import() instead.
#
# Usage:
#   ./scripts/create-migration.sh
#
# After running: commit the generated migrations/*.ts file alongside your
# collection changes.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_DIR/app/migrations"

BEFORE_COUNT=$(ls "$MIGRATIONS_DIR"/[0-9]*.ts 2>/dev/null | wc -l | tr -d ' ')

docker compose exec web sh -c "
  ARCH=\$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') && \
  ESBUILD=\"/app/node_modules/@esbuild/linux-\${ARCH}/bin/esbuild\" && \
  \$ESBUILD payload.config.ts \
    --bundle \
    --packages=external \
    --format=esm \
    --platform=node \
    --outfile=payload.config.mjs && \
  PAYLOAD_CONFIG_PATH=./payload.config.mjs npx payload migrate:create && \
  rm payload.config.mjs && \
  LATEST=\$(ls -t /app/migrations/*.ts | head -1) && \
  sed -i 's/{ MigrateUpArgs, MigrateDownArgs/{ type MigrateUpArgs, type MigrateDownArgs/g' \"\$LATEST\" && \
  echo \"Patched type imports in \$LATEST\"
"

# ── Post-generation checks (host side) ───────────────────────────────────────
AFTER_COUNT=$(ls "$MIGRATIONS_DIR"/[0-9]*.ts 2>/dev/null | wc -l | tr -d ' ')

if [[ "$AFTER_COUNT" -le "$BEFORE_COUNT" ]]; then
    echo ""
    echo "No new migration file created — schema is already in sync with the database."
    exit 0
fi

LATEST="$(ls -t "$MIGRATIONS_DIR"/[0-9]*.ts | head -1)"
echo "New migration: $(basename "$LATEST")"

# Warn if any ADD COLUMN in the new file references a column already in an older migration
NEW_COLS="$(grep -oP 'ADD COLUMN (?:IF NOT EXISTS )?"?\K[a-z_0-9]+' "$LATEST" 2>/dev/null || true)"
if [[ -n "$NEW_COLS" ]]; then
    OVERLAP="$(while IFS= read -r col; do
        grep -rl "\"$col\"" "$MIGRATIONS_DIR"/[0-9]*.ts 2>/dev/null \
            | grep -qv "$LATEST" && echo "$col" || true
    done <<< "$NEW_COLS")"
    if [[ -n "$OVERLAP" ]]; then
        echo ""
        echo "WARNING: These columns already appear in an older migration:"
        echo "$OVERLAP" | sed 's/^/  - /'
        echo "$(basename "$LATEST") may be a duplicate — review before committing."
    fi
fi
