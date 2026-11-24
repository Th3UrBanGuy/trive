#!/bin/bash
# TriVE .env restore script — run if .env gets wiped (sandbox filesystem reset)
cat > /home/z/my-project/.env << 'ENVCONTENT'
DATABASE_URL=file:./db/custom.db

# Telegram MTProto credentials — TriVE app (real mode, production)
TELEGRAM_API_ID=YOUR_TELEGRAM_API_ID
TELEGRAM_API_HASH=YOUR_TELEGRAM_API_HASH

# App encryption pepper for session strings
APP_SECRET=YOUR_APP_SECRET_MIN_32_CHARS

# Admin panel access (hidden at /?admin=1)
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

# Public app name
NEXT_PUBLIC_APP_NAME=TriVE
ENVCONTENT
echo "✅ .env restored with real Telegram credentials"
