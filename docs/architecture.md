# TriVE — Architecture

> Zero-knowledge encrypted cloud storage, powered by Telegram MTProto.
> Built by Tectonic.

---

## 1. System Overview

TriVE turns a user's **private Telegram channel** into an encrypted, deduplicated,
erasure-coded virtual file system. The user authenticates with their Telegram
account (phone + code). Files are encrypted on the server with AES-256-GCM,
split into 20 MB chunks, optionally Reed-Solomon erasure-coded, and uploaded as
Telegram messages to a channel only the user can access.

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's Browser                             │
│  (Next.js 16 RSC + client components, Tailwind 4, shadcn/ui)      │
└───────────────┬──────────────────────────────────┬───────────────┘
                │ HTTPS (cookies)                  │ XHR upload / fetch
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js 16 App Router                          │
│  src/app/page.tsx (single SPA route)                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │  Landing   │ │   Auth     │ │ Dashboard  │ │ Public Share│     │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
└───────────────┬──────────────────────────────────┬───────────────┘
                │ API routes (37 total)             │
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                       API Layer (Node runtime)                    │
│  /api/auth/*        /api/files/*      /api/folders/*              │
│  /api/share/*       /api/telegram/*   /api/storage/*              │
│  /api/activity      /api/settings      /api/admin/*               │
└───────┬───────────────────────────┬──────────────────────────────┘
        │                           │
        ▼                           ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│  Prisma (SQLite) │   │  GramJS (Telegram MTProto client)         │
│  db/custom.db    │   │  src/lib/telegram-service.ts              │
│                  │   │                                          │
│  User, Folder,   │   │  uploadChunk / downloadChunk              │
│  File, FileChunk,│   │  postManifest / scanVaultMessages         │
│  ShareLink,      │   │  initVault / deleteMessage                │
│  ShareItem,      │   └──────────────┬───────────────────────────┘
│  Activity        │                  │ MTProto over TCP
└──────────────────┘                  ▼
                          ┌───────────────────────────┐
                          │  Telegram Cloud (DC)       │
                          │  User's private channel    │
                          │  "TriVE_Storage_Vault"     │
                          │  ┌───────────────────────┐ │
                          │  │ Encrypted chunk msgs  │ │
                          │  │ Manifest text msgs    │ │
                          │  │ Folder manifest msgs  │ │
                          │  └───────────────────────┘ │
                          └───────────────────────────┘
```

See `docs/figures/architecture.svg` for the full diagram.

---

## 2. Technology Stack

| Layer            | Technology                                         |
|------------------|----------------------------------------------------|
| Framework        | Next.js 16 (App Router, Turbopack)                 |
| Language         | TypeScript 5 (strict)                              |
| Styling          | Tailwind CSS 4 + shadcn/ui (New York)              |
| Database         | Prisma ORM + SQLite (`db/custom.db`)               |
| Telegram client  | GramJS (`telegram` v2.26.22)                       |
| Encryption       | Node `crypto` — AES-256-GCM, scrypt, HMAC-SHA256   |
| Erasure coding   | Reed-Solomon GF(2⁸), Vandermonde matrix (in-house) |
| State (client)   | Zustand (UI), TanStack Query (server)              |
| Animation        | Framer Motion                                      |
| Auth             | Signed HMAC session cookies (1 year)               |
| PWA              | manifest.webmanifest + service worker              |
| Gateway          | Caddy (port 81 → 3000, with XTransformPort proxy)  |

---

## 3. Directory Structure

```
src/
├── app/
│   ├── page.tsx              # Single SPA route — landing/auth/dashboard/share
│   ├── globals.css           # Design tokens, glassmorphism, animations
│   ├── proxy.ts              # CORS + security headers (Next.js 16 middleware)
│   └── api/                  # 37 route handlers
│       ├── auth/             # send-code, sign-in, me, sign-out
│       ├── files/            # list, upload, [id] (patch/delete), [id]/download
│       ├── folders/          # list, create, [id], [id]/download
│       ├── share/            # create, batch, [id]/download, public, check-slug
│       ├── telegram/         # status, vault/init, vault/scan
│       ├── storage/          # usage
│       ├── activity/         # log
│       ├── settings/         # account delete
│       └── admin/            # login, users, files, shares, db, activity
├── components/
│   ├── brand.tsx             # TriVE logo (mark, wordmark, full)
│   ├── landing/landing.tsx   # Marketing page
│   ├── auth/auth-flow.tsx    # Phone → code → 2FA login
│   ├── dashboard/            # 25 components (see below)
│   ├── legal/                # Terms, privacy, Tectonic credit
│   ├── pwa/                  # SW register, install overlay
│   └── ui/                   # shadcn/ui primitives (40+ components)
├── lib/
│   ├── crypto.ts             # AES-256-GCM, scrypt, HMAC, password hash
│   ├── db.ts                 # Prisma client singleton
│   ├── erasure-coding.ts     # Reed-Solomon encode/decode
│   ├── file-ops.ts           # Upload/download/zip/delete/manifest pipeline
│   ├── file-utils.ts         # formatBytes, fileCategory, icons
│   ├── session.ts            # Signed cookie session + admin session
│   ├── share-resolve.ts      # username/slug → ShareLink resolution
│   ├── store.ts              # Zustand stores (auth, ui, nav, upload)
│   ├── telegram-service.ts   # GramJS wrapper (vault, chunks, manifests)
│   ├── types.ts              # Shared domain types
│   └── utils.ts              # cn(), misc helpers
└── prisma/
    └── schema.prisma         # 7 models (see Data Model)
```

### Dashboard components (25)

| Component              | Purpose                                       |
|------------------------|-----------------------------------------------|
| `dashboard.tsx`        | Shell: sidebar + topbar + view router + FAB   |
| `sidebar.tsx`          | Nav (My Files, Recent, Starred, Shared, Trash)|
| `topbar.tsx`           | Breadcrumbs, search, sort, view toggle        |
| `file-explorer.tsx`    | Grid/list view, drag-drop, context menu        |
| `file-card.tsx`        | Grid tile (thumbnail, actions, selection)     |
| `file-row.tsx`         | List row                                      |
| `file-viewers.tsx`     | PDF, image, video, audio, code, text, DOCX    |
| `file-preview-dialog.tsx` | Full-screen preview modal                  |
| `files-direct-view.tsx`| "Files" tab — categorized by type             |
| `upload-panel.tsx`     | Floating upload queue (progress, retry)       |
| `new-folder-dialog.tsx`| Folder creation                               |
| `move-dialog.tsx`      | Move files to folder                          |
| `share-dialog.tsx`     | Create + manage share links                   |
| `shared-links-view.tsx`| All shares list                               |
| `public-share-view.tsx`| Public recipient view (no auth)               |
| `selection-action-bar.tsx` | Multi-select actions bar                  |
| `settings-view.tsx`    | Account settings, delete account              |
| `analytics-view.tsx`   | Storage analytics                             |
| `trash-view.tsx`       | Trash bin (restore / delete-forever)          |
| `vault-setup.tsx`      | First-run vault creation + scanning           |
| `query-provider.tsx`   | TanStack Query provider                       |
| `_shared.tsx`          | FileIcon, CopyButton shared bits              |

---

## 4. Data Model

```
User (1) ───< Folder (N) ───< File (N) ───< FileChunk (N)
  │              │                │
  │              └── self-ref (parent)   ├── ShareLink (N) ──< ShareItem (N)
  │                                            │
  └── Activity (N)                             ├── File? (1:1, single-file share)
                                               └── Folder? (1:1, folder share)
```

| Model       | Key fields                                                        |
|-------------|-------------------------------------------------------------------|
| **User**    | `phone` (unique), `telegramUsername`, `telegramSession` (enc), `vaultChannelId`, `vaultChannelAccess`, `encSalt`, `storageLimitBytes` |
| **Folder**  | `userId`, `name`, `parentId` (self-ref tree), `starred`, `trashed`|
| **File**    | `userId`, `folderId`, `name`, `mimeType`, `size`, `encIv`, `checksum`, `manifestMessageId`, `dataShards`, `parityShards` |
| **FileChunk**| `fileId`, `index`, `telegramMessageId`, `encIv`, `plainSize`, `checksum`, `isParity`, `deduped`, `shardSize` |
| **ShareLink**| `userId`, `fileId?`, `folderId?`, `token` (unique), `customSlug?` (unique), `password?`, `expiresAt?`, `maxViews?`, `maxDownloads?`, `viewOnly`, `emailGate`, `allowedEmails`, `accessIps` |
| **ShareItem**| `shareLinkId`, `fileId?`, `folderId?` (batch shares)             |
| **Activity**| `userId`, `action`, `details` (JSON)                             |

See `docs/figures/data-model.svg` for the ER diagram.

---

## 5. Request Flow — Upload

```
Browser                Next.js API               GramJS              Telegram
  │  POST /api/files/upload (multipart)              │                   │
  │ ───────────────────────────────────────────────► │                   │
  │                  requireUser() → User             │                   │
  │                  size ≤ 4GB? quota ok?            │                   │
  │                  uploadFileToVault(userId, buf)   │                   │
  │                   ├─ split into 20MB chunks       │                   │
  │                   ├─ AES-256-GCM encrypt each     │                   │
  │                   ├─ SHA-256 dedup check (DB)     │                   │
  │                   ├─ uploadChunk ───────────────────────────────────► │
  │                   ├─ (erasure) encode parity      │   stores message  │
  │                   ├─ upload parity shards ─────────────────────────►  │
  │                   ├─ db.file.create + db.fileChunk.create × N         │
  │                   ├─ postManifest (JSON text msg) ─────────────────►  │
  │                   └─ db.file.update(manifestMessageId)                │
  │  ◄── 200 { file: FileItem } ──────────────────── │                   │
```

See `docs/figures/upload-pipeline.svg`.

---

## 6. Request Flow — Public Share Download

```
Recipient             Next.js /api/share/[id]/download     GramJS        Telegram
  │  GET /api/share/Ra726ma/ntg/download?fileId=...           │            │
  │ ─────────────────────────────────────────────────────────► │            │
  │                  findShare("Ra726ma/ntg")                   │            │
  │                   ├─ user = findFirst(telegramUsername)     │            │
  │                   └─ share = findFirst(customSlug, userId)  │            │
  │                  gate checks: password / email / IP / expiry│            │
  │                  authorize fileId in share (direct or folder)│           │
  │                  streamFileFromVault / streamBatchZip       │            │
  │                   ├─ for each chunk: downloadChunk ───────────────────► │
  │                   ├─ decryptBuffer (truncate to plainSize+16)│          │
  │                   ├─ (erasure decode if shard missing)      │            │
  │                   └─ verify file checksum                   │            │
  │  ◄── 200 stream (application/octet-stream | application/zip)│           │
```

See `docs/figures/share-resolution.svg`.

---

## 7. Routing (Single-Page App)

`src/app/page.tsx` is the **only** user-visible route. All views are toggled
client-side based on URL query params:

| URL                        | View                          |
|----------------------------|-------------------------------|
| `/`                        | Landing (logged out) or Dashboard (logged in) |
| `/?share=<key>`            | Public share viewer (no auth) |
| `/?admin=1`                | Hidden admin panel            |
| `/?page=terms\|privacy\|disclaimer\|contact` | Legal pages |
| PWA standalone mode        | Skips landing, goes to auth   |

---

## 8. Session & Auth

```
Login flow:
  Phone → /api/auth/send-code → Telegram sends OTP
  Code  → /api/auth/sign-in    → Telegram verifies → StringSession
                                → encryptSession (AES-256-GCM, APP_SECRET key)
                                → db.user.upsert (store enc session)
                                → initVault (find/create channel)
                                → createSession cookie (HMAC-signed, 1 year)

Every request:
  Cookie "tc_session" → verify HMAC → extract userId → getCurrentUser()
```

- Cookie flags: `httpOnly`, `secure` (prod), `sameSite=Lax`, `maxAge=1yr`
- Admin session: separate `tc_admin` cookie, 7-day expiry

---

## 9. Telegram Vault

Each user gets **one** private broadcast channel named `TriVE_Storage_Vault`.
GramJS constructs `InputPeerChannel` directly (channelId + accessHash) —
no entity resolution round-trip.

The vault holds three kinds of messages:
1. **Encrypted file chunks** — binary blobs (20MB), one message per chunk
2. **File manifests** — JSON text messages (metadata + chunk map)
3. **Folder manifests** — JSON text messages (folder tree metadata)

`scanVaultAndRebuild` pages through all messages, parses manifests, and
rebuilds the DB index — enabling **cross-device persistence** (log in from
a new device, scan, all files reappear).

---

## 10. Mini-Service (legacy)

`mini-services/telegram-service/` is a standalone Bun HTTP service on port 3001.
It was the original Telegram gateway before GramJS was inlined into the Next.js
process. It is **still present** and routed via Caddy's `XTransformPort` —
this is a security risk (see `docs/VULNERABILITIES.md` C-1).

---

## 11. Build & Deploy

```
bun run dev      → next dev -p 3000 (Turbopack, HMR)
bun run build    → next build + copy standalone + public
bun run start    → NODE_ENV=production bun .next/standalone/server.js
bun run lint     → eslint .
bun run db:push  → prisma db push (schema → SQLite)
bun run db:generate → prisma generate (client)
```

Caddy (`:81`) reverse-proxies to Next.js (`:3000`) and optionally to
mini-services via `?XTransformPort=<port>`.

---

## 12. Constraints

- **One port externally** (Caddy `:81` → `:3000`). Cross-port requests use
  `?XTransformPort=<port>` query param.
- **No Redis/MySQL** — SQLite + in-memory caching only.
- **4 GB sandbox RAM** — Turbopack cold compiles of Prisma-heavy routes can OOM.
- **Telegram is the only storage** — no S3, no disk (except simulation mode).
