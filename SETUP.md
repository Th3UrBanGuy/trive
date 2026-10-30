# TriVE — Complete Project Setup Guide

This zip contains the **complete TriVE project** — a zero-knowledge encrypted
cloud storage SaaS built on Next.js 16 + Telegram MTProto.

## Quick Start (on a new device)

```bash
# 1. Unzip the project
unzip trive-complete.zip -d trive
cd trive

# 2. Install dependencies (requires Node 18+ and Bun)
bun install
#   — OR —
npm install

# 3. Install Telegram (GramJS) — already in package.json, but if needed:
#    (it's in dependencies, so `bun install` handles it)

# 4. Push the database schema to SQLite
bun run db:push
#   This creates db/custom.db from prisma/schema.prisma

# 5. Start the dev server
bun run dev
#   → http://localhost:3000

# 6. Lint (optional, to verify everything is clean)
bun run lint
```

## What's Included

| Path | Description |
|------|-------------|
| `src/` | All source code (136 .ts/.tsx files) — Next.js 16 App Router |
| `src/app/api/` | 38 API route handlers (auth, files, folders, share, telegram, admin) |
| `src/lib/` | Core libraries (crypto, erasure-coding, file-ops, telegram-service, etc.) |
| `src/components/` | React components (landing, auth, dashboard, ui, legal, pwa) |
| `public/` | Static assets (TriVE logos, PWA icons, manifest, service worker) |
| `docs/` | Complete SDP documentation (9 .md files + 5 SVG architecture figures) |
| `prisma/schema.prisma` | Database schema (7 models: User, Folder, File, FileChunk, ShareLink, ShareItem, Activity) |
| `mini-services/telegram-service/` | Standalone Telegram gateway service (port 3001) |
| `db/custom.db` | SQLite database (existing user data — may be empty) |
| `.env` | Environment variables with real Telegram credentials |
| `restore-env.sh` | Script to restore .env if it gets wiped |
| `worklog.md` | Complete work history (9 task entries) |

## Environment Variables (`.env`)

The `.env` file is included with real credentials:

```
DATABASE_URL=file:/home/z/my-project/db/custom.db
TELEGRAM_API_ID=35740212
TELEGRAM_API_HASH=f70f925ef1d4b78d2ca58065575b5b26
APP_SECRET=trive-prod-secret-change-me-2026
ADMIN_PASSWORD=trive-admin-2026-tectonic
NEXT_PUBLIC_APP_NAME=TriVE
```

**⚠️ Change `APP_SECRET` and `ADMIN_PASSWORD` for production use.**
If `.env` gets wiped, run: `bash restore-env.sh`

## Documentation (`docs/`)

| File | Content |
|------|---------|
| `README.md` | Index + severity summary |
| `architecture.md` | System architecture, data flow, directory structure |
| `design.md` | Visual system, design tokens, component patterns |
| `mechanism.md` | Encryption, erasure coding, dedup, share resolution |
| `prompt.md` | AI-assistant system prompts (5 prompts) |
| `skills.md` | Product capabilities + dev skills |
| `whattodo.md` | Best practices + checklists |
| `whatnottodo.md` | Anti-patterns + the "7 deadly sins" |
| `VULNERABILITIES.md` | Full security audit (6 CRITICAL, 8 HIGH, 10 MEDIUM) |
| `figures/*.svg` | 5 architecture diagrams |

## Critical Rules (from `docs/whatnottodo.md`)

1. **NEVER** use `findUnique` on `telegramUsername` (not @unique) → use `findFirst`
2. **NEVER** decrypt without truncating to `plainSize + 16` (GCM auth tag)
3. **NEVER** use raw Vandermonde in erasure `decode()` → use generator matrix
4. **NEVER** build `flex flex-col` + overflow without `min-h-0` on scroll child
5. **NEVER** swallow errors in ZIP streaming → `archive.destroy()` if all fail
6. **NEVER** let the upload route go missing → verify `src/app/api/files/upload/route.ts` exists
7. **NEVER** overwrite `worklog.md` → always append

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM + SQLite
- **Telegram**: GramJS (`telegram` v2.26.22)
- **Encryption**: AES-256-GCM, scrypt, HMAC-SHA256
- **Erasure Coding**: Reed-Solomon GF(2⁸)
- **State**: Zustand (client), TanStack Query (server)
- **Animation**: Framer Motion

## Build for Production

```bash
bun run build    # Creates .next/standalone/ output
bun run start    # Runs the production server
```

## Admin Panel

Hidden at `/?admin=1` — password is `ADMIN_PASSWORD` from `.env`.

## License

Built by Tectonic.
