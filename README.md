---
title: TriVE — Zero-Knowledge Cloud Drive
emoji: 🔐
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# TriVE — Secure File Management, Powered by Telegram

<p align="center">
  <img src="public/trive-mark-trimmed.png" width="120" height="120" alt="TriVE Logo" />
</p>

<p align="center">
  <strong>Zero-knowledge, end-to-end encrypted cloud storage that uses your Telegram account as the storage engine.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="PRODUCT_REVIEW.md">Full Product Review</a> ·
  <a href="#credits">Credits</a>
</p>

---

## Overview

TriVE is a SaaS file management system that turns your personal Telegram account into an infinite, encrypted cloud vault. Files are AES-256-GCM encrypted per-chunk before they ever touch Telegram's servers — Telegram only stores ciphertext. Your files persist across devices via vault manifests, download with bullet-fast parallel streaming, and can be shared with granular access controls (password, view-only, expiry, email-gate, custom vanity links).

**Built by [Tectonic](https://tect0nic.com)**

---

## Features

### 🔐 Security & Encryption
- **Zero-knowledge architecture** — TriVE's servers never see plaintext
- **AES-256-GCM per-chunk encryption** — each chunk encrypted independently with its own IV
- **Encrypted session storage** — MTProto session strings encrypted at rest
- **Per-user encryption keys** — derived via scrypt with per-user salt

### 📁 File Management
- **Unlimited storage** — powered by your Telegram account
- **Auto-chunking** — files >20MB split into encrypted chunks, reassembled on download
- **Cross-device persistence** — vault manifests enable full file index rebuild on any device
- **Bullet-fast downloads** — parallel prefetch (3 chunks ahead) with streaming decryption
- **File viewers** — PDF, code (40+ languages with syntax highlighting), text/markdown, DOCX, images (zoom/pan), audio, video
- **Folder management** — nested folders with colors, recursive ZIP download
- **Touch-optimized** — long-press multi-select, native app feel
- **Star, trash, move, rename** — full file operations

### 🔗 Sharing
- **Custom vanity links** — `/?share=my-slug`
- **Password protection** — hashed with scrypt
- **View-only mode** — inline preview, download blocked
- **Time-based expiry** — 1h / 24h / 7d / 30d / Never / Custom datetime
- **Max views & max downloads** — atomic counters
- **Email gate** — require email to access, with optional allowlist
- **IP allowlist** — restrict by network (API)
- **Folder sharing** — share a folder as a streaming ZIP download
- **Batch sharing** — share multiple files at once with shared settings
- **Cascade delete** — delete a file → all its share links die instantly (recipients see "removed" within 1.5s)

### 📱 PWA & Native Feel
- **Installable** — add to home screen / desktop as a native app
- **Offline support** — service worker caches the app shell
- **Animated install overlay** — premium triangle loader + transition animation
- **Standalone mode** — opens in its own window, no browser chrome
- **App icons** — generated from the TriVE logo (192px, 512px, maskable, apple-touch)
- **Safe area support** — respects iOS notch / home indicator

### 🛡️ Admin Panel (Hidden)
- **Completely hidden** — no link in the UI; accessed via `/?admin=1` + password
- **System-wide stats** — users, files, folders, shares, storage, activities
- **User management** — view all users, delete users + their files
- **File management** — browse/delete any file across all users
- **Share management** — view/revoke any share link
- **Activity log** — system-wide activity feed
- **System info** — DB size, telegram health, env status, uptime, memory

### 🎨 Premium UI/UX
- **Brand identity** — navy → blue → cyan gradient, pixel-sampled from the TriVE logo
- **Glassmorphism** — `.glass`, `.glass-strong` utilities throughout
- **Bento grid layouts** — varied tile sizes for features and analytics
- **Framer Motion animations** — view transitions, hover lifts, spring selections
- **Dark + light mode** — light default (logo bg `#ebeff2`), dark navy vault mode
- **Responsive** — mobile-first, touch targets ≥44px, custom scrollbars
- **Dynamic fetching** — live data with refetchInterval (3s files, 5s storage, 1.5s public share)
- **Sticky footers** — proper bottom positioning with `mt-auto` pattern

### ⚡ Real Telegram MTProto
- **Official GramJS** — uses the `telegram` package for MTProto communication
- **Real OTP login** — enter your phone → receive code in Telegram → verify
- **2FA support** — optional Telegram cloud password
- **Private vault channel** — `TriVE_Storage_Vault` created on your account
- **Real storage** — files stored as encrypted documents in your vault channel

---

## Screenshots

The app has been thoroughly screenshot-documented. **24 screenshots** covering every page and feature are in the [`screenshot/`](screenshot/) folder. For a detailed line-by-line description of each screenshot and the features it shows, see the **[📋 Full Product Review](PRODUCT_REVIEW.md)**.

### Screenshot Index

| # | Screenshot | Description |
|---|-----------|-------------|
| 1 | [01-landing-hero.png](screenshot/01-landing-hero.png) | Landing page hero section with headline, CTAs, and dashboard mockup |
| 2 | [02-landing-full.png](screenshot/02-landing-full.png) | Full landing page (top to bottom) |
| 3 | [03-landing-features.png](screenshot/03-landing-features.png) | Features bento grid (unlimited storage, chunking, encryption, etc.) |
| 4 | [04-landing-howitworks.png](screenshot/04-landing-howitworks.png) | How it works — 3-step process |
| 5 | [05-landing-security.png](screenshot/05-landing-security.png) | Zero-knowledge security section |
| 6 | [06-landing-faq.png](screenshot/06-landing-faq.png) | FAQ accordion |
| 7 | [07-landing-footer.png](screenshot/07-landing-footer.png) | Footer with Tectonic credit |
| 8 | [08-auth-phone.png](screenshot/08-auth-phone.png) | Telegram phone number login |
| 9 | [09-legal-terms.png](screenshot/09-legal-terms.png) | Terms of Service page |
| 10 | [10-legal-privacy.png](screenshot/10-legal-privacy.png) | Privacy Policy page |
| 11 | [11-legal-disclaimer.png](screenshot/11-legal-disclaimer.png) | Disclaimer page |
| 12 | [12-legal-contact.png](screenshot/12-legal-contact.png) | Contact page |
| 13 | [13-admin-overview.png](screenshot/13-admin-overview.png) | Admin panel — system statistics overview |
| 14 | [14-admin-users.png](screenshot/14-admin-users.png) | Admin panel — user management |
| 15 | [15-dashboard-files.png](screenshot/15-dashboard-files.png) | Dashboard — files grid view |
| 16 | [16-dashboard-sidebar.png](screenshot/16-dashboard-sidebar.png) | Dashboard — sidebar navigation |
| 17 | [17-dashboard-list-view.png](screenshot/17-dashboard-list-view.png) | Dashboard — files list/table view |
| 18 | [18-dashboard-starred.png](screenshot/18-dashboard-starred.png) | Dashboard — starred files |
| 19 | [19-dashboard-shared.png](screenshot/19-dashboard-shared.png) | Dashboard — shared links management |
| 20 | [20-admin-files.png](screenshot/20-admin-files.png) | Admin panel — file management |
| 21 | [21-admin-shares.png](screenshot/21-admin-shares.png) | Admin panel — share management |
| 22 | [22-admin-activity.png](screenshot/22-admin-activity.png) | Admin panel — activity log |
| 23 | [23-admin-system.png](screenshot/23-admin-system.png) | Admin panel — system information |
| 24 | [24-public-share.png](screenshot/24-public-share.png) | Public share view (what recipients see) |

---

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ / [Bun](https://bun.sh/) runtime
- A Telegram account
- Telegram API credentials (from [my.telegram.org](https://my.telegram.org))

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/trive.git
cd trive

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your Telegram API credentials

# Set up the database
bun run db:push

# Start the dev server
bun run dev
```

Open `http://localhost:3000` in your browser.

### Production Build

```bash
bun run build
bun run start
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path (default: `file:./db/custom.db`) |
| `TELEGRAM_API_ID` | Yes | Telegram API ID from [my.telegram.org](https://my.telegram.org) |
| `TELEGRAM_API_HASH` | Yes | Telegram API hash from my.telegram.org |
| `APP_SECRET` | Yes | Pepper for session encryption (change in production) |
| `ADMIN_PASSWORD` | Yes | Password for the hidden admin panel (`/?admin=1`) |
| `NEXT_PUBLIC_APP_NAME` | No | App name (default: `TriVE`) |

### Example `.env`

```env
DATABASE_URL=file:./db/custom.db
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
APP_SECRET=your-random-secret-key
ADMIN_PASSWORD=your-admin-password
NEXT_PUBLIC_APP_NAME=TriVE
```

### Getting Telegram API Credentials

1. Go to [my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Go to "API development tools"
4. Create a new application
5. Copy the `api_id` and `api_hash`

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ React UI │  │ Zustand  │  │ TanStack Query    │  │
│  │ (shadcn) │  │ (state)  │  │ (server state)    │  │
│  └────┬─────┘  └──────────┘  └────────┬──────────┘  │
│       │                               │              │
│       │         Service Worker        │              │
│       │      (offline cache)          │              │
└───────┼───────────────────────────────┼──────────────┘
        │                               │
        ▼                               ▼
┌──────────────────────────────────────────────────────┐
│                 Next.js 16 (Port 3000)                │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ API Routes  │  │ Prisma ORM  │  │ GramJS       │  │
│  │ (38 routes) │──│ (SQLite)    │  │ (MTProto)    │  │
│  └─────────────┘  └─────────────┘  └──────┬───────┘  │
│                                          │           │
│  ┌──────────────────────────────────────┐│           │
│  │ TriVE VFS (file-ops.ts)              ││           │
│  │ • Per-chunk encryption (AES-256-GCM) ││           │
│  │ • Chunking (20MB)                    ││           │
│  │ • Manifest posting                   ││           │
│  │ • Vault scanning (cross-device)      ││           │
│  │ • Parallel streaming download        ││           │
│  └──────────────────────────────────────┘│           │
└──────────────────────────────────────────┼───────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │   Telegram MTProto     │
                              │   (DC2 Production)     │
                              │                        │
                              │  ┌──────────────────┐  │
                              │  │ TriVE_Storage_   │  │
                              │  │ Vault (channel)   │  │
                              │  │                   │  │
                              │  │ [encrypted chunk] │  │
                              │  │ [encrypted chunk] │  │
                              │  │ [manifest JSON]   │  │
                              │  │ [encrypted chunk] │  │
                              │  │ [manifest JSON]   │  │
                              │  └──────────────────┘  │
                              └────────────────────────┘
```

### Database Schema

```
User
├── id, phone, name, avatarColor
├── telegramSession (encrypted)
├── vaultChannelId, vaultReady
├── encSalt (per-user encryption salt)
├── Folder[]
│   ├── name, color, parentId, starred, trashed
│   └── children[] (recursive)
├── File[]
│   ├── name, mimeType, size
│   ├── encIv, isChunked, totalChunks
│   ├── manifestMessageId (for vault scan dedup)
│   ├── FileChunk[]
│   │   ├── index, telegramMessageId
│   │   ├── encIv (per-chunk IV), plainSize
│   │   └── checksum (SHA-256)
│   └── ShareLink[]
│       ├── token, customSlug
│       ├── password (hashed), expiresAt
│       ├── viewOnly, maxViews, maxDownloads
│       ├── emailGate, allowedEmails
│       └── viewCount, downloadCount
└── Activity[]
    └── action, details, createdAt
```

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-code` | Send Telegram OTP |
| POST | `/api/auth/sign-in` | Verify OTP + create session |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/telegram/status` | Telegram engine health |
| POST | `/api/telegram/vault/init` | Create vault channel |
| GET | `/api/telegram/vault/status` | Vault + file count |
| POST | `/api/telegram/vault/scan` | Rebuild file index from vault |
| GET/POST | `/api/folders` | List / create folders |
| GET | `/api/folders/tree` | Full folder tree |
| PATCH/DELETE | `/api/folders/[id]` | Rename / delete folder |
| GET | `/api/folders/[id]/download` | Download folder as ZIP |
| GET | `/api/files` | List files (with filters) |
| POST | `/api/files/upload` | Upload file (multipart) |
| PATCH/DELETE | `/api/files/[id]` | Update / delete file |
| GET | `/api/files/[id]/download` | Stream file download |
| POST | `/api/share` | Create share link |
| POST | `/api/share/batch` | Batch create share links |
| GET | `/api/share` | List user's shares |
| DELETE | `/api/share/[id]` | Revoke share |
| GET | `/api/share/public` | Public share lookup |
| GET | `/api/share/[id]/download` | Public share download |
| GET | `/api/share/check-slug` | Check custom slug availability |
| GET | `/api/storage` | Storage analytics |
| GET | `/api/activity` | User activity log |
| PATCH/DELETE | `/api/settings` | Update profile / delete account |
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/logout` | Admin logout |
| GET | `/api/admin/stats` | System-wide statistics |
| GET | `/api/admin/users` | All users |
| DELETE | `/api/admin/users/[id]` | Delete user |
| GET | `/api/admin/files` | All files |
| DELETE | `/api/admin/files/[id]` | Delete any file |
| GET | `/api/admin/shares` | All shares |
| DELETE | `/api/admin/shares/[id]` | Revoke any share |
| GET | `/api/admin/activity` | System-wide activity |
| GET | `/api/admin/db` | System info |
| GET | `/api/admin/telegram` | Telegram health |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| Telegram | GramJS (`telegram` package) |
| State | Zustand (client), TanStack Query (server) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Toasts | Sonner |
| PWA | Web Manifest + Service Worker |
| Charts | Recharts |
| ZIP | Archiver v8 |
| Image | Sharp (thumbnails) |

---

## Project Structure

```
trive/
├── prisma/
│   └── schema.prisma              # Database schema
├── public/
│   ├── manifest.webmanifest       # PWA manifest
│   ├── sw.js                      # Service worker
│   ├── trive-mark-trimmed.png     # Logo mark (transparent)
│   ├── trive-logo.png             # Full logo (light mode)
│   ├── trive-logo-light.png       # Full logo (dark mode)
│   ├── icon-192.png               # PWA icon 192px
│   ├── icon-512.png               # PWA icon 512px
│   ├── icon-maskable-*.png        # Maskable PWA icons
│   ├── apple-touch-icon.png       # iOS app icon
│   └── favicon.ico                # Favicon (multi-size)
├── screenshot/                    # 24 screenshots
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (metadata, PWA, theme)
│   │   ├── page.tsx               # Main SPA page (routing)
│   │   ├── globals.css            # Brand tokens, glassmorphism, loader
│   │   └── api/                   # 38 API routes
│   ├── components/
│   │   ├── brand.tsx              # BrandMark, Wordmark, FullLogo
│   │   ├── theme-provider.tsx     # next-themes wrapper
│   │   ├── auth/
│   │   │   └── auth-flow.tsx      # Telegram login (phone → OTP → 2FA)
│   │   ├── landing/
│   │   │   └── landing.tsx        # Marketing landing page
│   │   ├── dashboard/
│   │   │   ├── dashboard.tsx      # Dashboard shell
│   │   │   ├── sidebar.tsx        # Navigation sidebar
│   │   │   ├── topbar.tsx         # Search, sort, view toggle
│   │   │   ├── file-explorer.tsx  # File/folder browser
│   │   │   ├── file-card.tsx      # Grid file card
│   │   │   ├── file-row.tsx       # List file row
│   │   │   ├── file-viewers.tsx   # PDF/code/text/docx viewers
│   │   │   ├── file-preview-dialog.tsx
│   │   │   ├── upload-panel.tsx   # Upload progress manager
│   │   │   ├── new-folder-dialog.tsx
│   │   │   ├── share-dialog.tsx   # Share creation (file/folder/batch)
│   │   │   ├── move-dialog.tsx
│   │   │   ├── selection-action-bar.tsx
│   │   │   ├── shared-links-view.tsx
│   │   │   ├── trash-view.tsx
│   │   │   ├── analytics-view.tsx # Bento analytics dashboard
│   │   │   ├── settings-view.tsx
│   │   │   ├── public-share-view.tsx
│   │   │   └── vault-setup.tsx    # Vault creation + scanning
│   │   ├── admin/
│   │   │   └── admin-panel.tsx    # Hidden admin panel (6 tabs)
│   │   ├── legal/
│   │   │   ├── legal-pages.tsx    # Terms, Privacy, Disclaimer, Contact
│   │   │   └── tectonic-credit.tsx
│   │   └── pwa/
│   │       ├── register-sw.tsx    # Service worker registration
│   │       ├── use-install-prompt.ts
│   │       ├── install-banner.tsx
│   │       └── install-overlay.tsx
│   ├── lib/
│   │   ├── telegram-service.ts    # GramJS MTProto engine
│   │   ├── file-ops.ts            # VFS: upload, download, scan, delete
│   │   ├── crypto.ts              # AES-256-GCM, session encryption
│   │   ├── session.ts             # User + admin session management
│   │   ├── db.ts                  # Prisma client
│   │   ├── api.ts                 # Typed API client
│   │   ├── store.ts               # Zustand stores
│   │   ├── types.ts               # Shared TypeScript types
│   │   └── file-utils.ts          # Formatting, categories, colors
│   └── proxy.ts                   # CORS proxy (Next.js 16)
├── PRODUCT_REVIEW.md              # Detailed product review
├── README.md                      # This file
└── .env                           # Environment configuration
```

---

## Brand Identity

The TriVE brand is derived from the actual TriVE logo:

| Element | Color | Usage |
|---------|-------|-------|
| Navy | `#1c3f81` | `--brand-deep` (gradient start, dark mode base) |
| Blue | `#1e84c6` | `--brand` / `--primary` (buttons, accents, links) |
| Cyan | `#1a8aae` | `--brand-cyan` (gradient end, highlights) |
| Background | `#ebeff2` | `--background` (light mode, logo bg) |
| Foreground | `#203240` | `--foreground` (light mode text) |

**Brand gradient**: `linear-gradient(135deg, #1c3f81, #1e84c6, #1a8aae)`

All colors were pixel-sampled from the uploaded TriVE logo PNG for exact accuracy.

---

## Admin Panel Access

The admin panel is **completely hidden** — there is no link to it anywhere in the normal UI.

1. Navigate to `/?admin=1`
2. Enter the admin password (set via `ADMIN_PASSWORD` in `.env`)
3. Access the full admin dashboard with 6 tabs:
   - **Overview** — system-wide statistics
   - **Users** — view/delete all users
   - **Files** — browse/delete any file
   - **Shares** — view/revoke any share link
   - **Activity** — system-wide activity feed
   - **System** — DB info, telegram health, env status, uptime

---

## Credits

**Built by [Tectonic](https://tect0nic.com)**

TriVE uses the following open-source technologies:
- [Next.js](https://nextjs.org/) — React framework
- [GramJS](https://gram.js.org/) — Telegram MTProto client
- [Prisma](https://www.prisma.io/) — Database ORM
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Framer Motion](https://www.framer.dev/motion/) — Animations
- [Recharts](https://recharts.org/) — Charts
- [Archiver](https://www.archiverjs.com/) — ZIP streaming
- [Mammoth](https://github.com/mwilliamson/mammoth.js) — DOCX viewer
- [Lucide](https://lucide.dev/) — Icons

---

## License

© 2026 TriVE. Built by [Tectonic](https://tect0nic.com). All rights reserved.

---

*For a detailed visual walkthrough of every page and feature, see the **[📋 Full Product Review](PRODUCT_REVIEW.md)**.*
