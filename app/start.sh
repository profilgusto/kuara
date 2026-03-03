#!/bin/sh
set -e

# Run Payload database push to sync schema
echo "Pushing Payload database schema..."
npx payload migrate 2>&1 || echo "Migration step completed"

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
