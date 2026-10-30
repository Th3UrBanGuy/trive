#!/bin/bash
set -e

# Ensure db and data directories exist
mkdir -p /app/db /app/data

# Initialize SQLite DB schema if needed
if [ -f "/app/prisma/schema.prisma" ]; then
  echo "[DB] Checking SQLite database schema..."
  npx prisma@6 db push --skip-generate || true
fi

# Start Next.js standalone server
export PORT=${PORT:-7860}
export HOSTNAME="0.0.0.0"

echo "[TriVE] Starting server on port $PORT..."
exec node server.js
