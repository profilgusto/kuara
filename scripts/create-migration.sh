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
