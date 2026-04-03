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
  npx esbuild payload.config.ts \
    --bundle \
    --packages=external \
    --format=esm \
    --platform=node \
    --outfile=payload.config.mjs && \
  PAYLOAD_CONFIG_PATH=./payload.config.mjs npx payload migrate:create && \
  rm payload.config.mjs
"
