#!/bin/bash
# TriVE .env restore script — run if .env gets wiped (sandbox filesystem reset)
cat > /home/z/my-project/.env << 'ENVCONTENT'
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Telegram MTProto credentials — TriVE app (real mode, production)
TELEGRAM_API_ID=35740212
TELEGRAM_API_HASH=f70f925ef1d4b78d2ca58065575b5b26

# App encryption pepper for session strings
APP_SECRET=trive-prod-secret-change-me-2026

# Admin panel access (hidden at /?admin=1)
ADMIN_PASSWORD=trive-admin-2026-tectonic

# Public app name
NEXT_PUBLIC_APP_NAME=TriVE
ENVCONTENT
echo "✅ .env restored with real Telegram credentials"
