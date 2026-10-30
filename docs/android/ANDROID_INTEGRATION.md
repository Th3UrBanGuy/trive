# TriVE Android — Integration & Build Specification

> **Audience:** AI agents and human engineers building the native Android companion app for the TriVE web platform.
>
> **Source project:** `/home/z/my-project/trive/` — a Next.js 16 zero-knowledge encrypted cloud storage SaaS that uses Telegram MTProto as its storage engine.
>
> **Goal of this document:** Hand off enough context that any competent Android developer (human or AI) can stand up the Android app, integrate it with the existing web backend without modifying the backend, ship a v1 to internal test, and have a clear path to feature parity with the web app.
>
> **Status:** Source web backend is feature-complete and production-ready. Android app is greenfield.
>
> **Built by:** Tectonic · © 2026

---

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [Architecture Overview](#2-architecture-overview)
3.  [Division of Responsibility — Web vs Android](#3-division-of-responsibility--web-vs-android)
4.  [Backend API Contract — Full Reference](#4-backend-api-contract--full-reference)
5.  [Authentication & Session Model on Android](#5-authentication--session-model-on-android)
6.  [Android Sync Engine — The Native Layer](#6-android-sync-engine--the-native-layer)
7.  [File Pipeline & Crypto as Seen by Android](#7-file-pipeline--crypto-as-seen-by-android)
8.  [Project Setup & Module Structure](#8-project-setup--module-structure)
9.  [Build Roadmap — Phases & Milestones](#9-build-roadmap--phases--milestones)
10. [Security Model & Threat Surface](#10-security-model--threat-surface)
11. [Testing, QA & Release Strategy](#11-testing-qa--release-strategy)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### 1.1 What TriVE Is

TriVE is a zero-knowledge encrypted file storage product. Files are AES-256-GCM encrypted per-chunk (20 MB chunks) on the server, then uploaded as Telegram messages to a private channel owned by the end user — the "vault" — using GramJS MTProto. The server holds a SQLite database (via Prisma) that records the virtual file tree (folders, files, chunks, share links, activities); the actual file bytes live on Telegram's servers and are addressed by `(channelId, accessHash, messageId)` tuples.

This means TriVE has effectively unlimited free storage, but a server-mediated upload/download path. The web app is the canonical UI; the Android app will be a native companion that talks to the same backend HTTP API the web app uses.

### 1.2 Why Build a Separate Android App

Three reasons, in priority order:

1. **Background sync** — Android WorkManager + Foreground Service can keep the local index fresh and the upload queue drained even when the app is closed. A web PWA cannot do this reliably on Android (Chrome throttles service workers after ~5 minutes).
2. **Native file viewer integration** — Android's `DocumentFile`, `MediaStore`, and `FileProvider` plumbing make it trivial to share-into TriVE from any other app and to open TriVE files in external editors. WebView-based bridges are fragile.
3. **Native crypto & network** — OkHttp + Bouncy Castle + Kotlin Coroutines give us streaming multipart upload, true resume-on-reconnect, and hardware-backed AES key storage (`Keystore`) — none of which the browser can guarantee.

### 1.3 The Core Strategy

**Do not rebuild the backend. Reuse it verbatim.**

The web backend already implements: Telegram MTProto session management, OTP login, 2FA, vault channel init, file encryption/chunking/dedup/erasure-coding, manifest posting, cross-device vault scanning, share-link creation with password / view-only / expiry / email-gate / IP allowlist / batch / folder-ZIP, public share resolution, cascade deletes, admin panel, and an activity log.

The Android app will be a **first-class API client** that:

- Authenticates against the existing `/api/auth/send-code` + `/api/auth/sign-in` endpoints.
- Persists the resulting session cookie in `EncryptedSharedPreferences`.
- Drives the same REST surface the web app drives.
- Adds a native sync layer that the web app does not have — this is the Android app's primary reason to exist.

### 1.4 What's Already Working on the Backend

A non-exhaustive inventory of what you do **not** need to reimplement:

| Capability | Backend Implementation | Android Reuses It Via |
|---|---|---|
| Telegram OTP login (real MTProto) | `src/app/api/auth/send-code` + `sign-in` | POST these endpoints |
| 2FA password verification | `src/lib/telegram-service.ts:signIn(password)` | POST `password` field to `/sign-in` |
| Vault channel create-or-find | `telegramService.initVault` (auto-runs on sign-in) | POST `/api/telegram/vault/init` |
| Per-user encryption keys | `scrypt(APP_SECRET, encSalt, 32)` in `src/lib/crypto.ts` | N/A — server-side only |
| AES-256-GCM per-chunk encrypt/decrypt | `encryptBuffer` / `decryptBuffer` | N/A — server-side only |
| Chunking (20 MB) | `CHUNK_SIZE` in `src/lib/file-utils.ts` | Server handles it transparently |
| Reed-Solomon erasure coding (5+3 default) | `src/lib/erasure-coding.ts` | Server handles it transparently |
| SHA-256 dedup by chunk checksum | `uploadFileToVault` step 1.5 | Server handles it transparently |
| Vault manifest posting (cross-device rebuild) | `postFileManifest` / `postFolderManifest` | Server handles it; trigger scan from Android |
| Vault re-scan | `scanVaultAndRebuild` | POST `/api/telegram/vault/scan` |
| Share-link creation (single/batch/folder, custom slug, password, expiry, view-only, email gate, IP allowlist, max views, max downloads) | `/api/share`, `/api/share/batch`, `/api/share/check-slug` | POST these endpoints |
| Public share resolution (token OR username/slug) | `/api/share/public` + `src/lib/share-resolve.ts` | GET these endpoints |
| Streaming download (server-side decrypt) | `streamFileFromVault` | GET `/api/files/[id]/download` |
| Folder-as-ZIP download | `streamFolderZipFromVault` | GET `/api/folders/[id]/download` |
| Batch-share ZIP download | `streamBatchZipFromVault` | GET `/api/share/[id]/download` (no fileId) |
| Cascade delete (file → chunks → shares) | Prisma `onDelete: Cascade` on File schema | DELETE `/api/files/[id]` |
| Soft trash + 30-day retention pattern | `trashed` flag on File / Folder | PATCH `/api/files/[id]` `{trashed:true}` |
| Activity log | `/api/activity` (GET) — server auto-logs every action | Read-only on Android |
| Admin panel | Hidden `/?admin=1` — separate admin cookie | Defer to v2 on Android |
| Storage analytics | `/api/storage` | GET endpoint |
| Hidden admin (full system stats, user mgmt, file mgmt, share mgmt) | `/api/admin/*` (12 routes) | Defer to v2 |

### 1.5 What the Android App Will Add

The native-only layer:

1. **Local SQLite mirror** of the file/folder/share index, synced from the server, so the app opens instantly even offline.
2. **Background upload queue** — WorkManager-backed, survives reboot, retries with exponential backoff, integrates with the Android share-sheet so users can "Share → TriVE" from any app.
3. **Background vault scan** — if the user logs in on a new device via the web app and the local DB is empty, the Android app detects this on next foreground and triggers `/api/telegram/vault/scan` automatically.
4. **Foreground-service download** — long-running downloads (multi-GB folder ZIP) survive screen-off and backgrounding.
5. **Native file viewers** — PDF, image (with zoom/pan), audio, video, code (syntax highlight), text, DOCX (via `mammoth`-equivalent on Android — e.g., `apache-poi`).
6. **Biometric unlock** — fingerprint / face unlock gating the app, since the session cookie is long-lived.
7. **Deep links** — `trive://share/<token>` and `trive://share/<username>/<slug>` resolve directly to the public-share viewer inside the app.
8. **Share-sheet integration** — Android "Share to TriVE" uploads to the current folder.

---

## 2. Architecture Overview

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Android Device                         │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────────────────┐ │
│  │  Kotlin + Compose  │  │  WorkManager Sync Engine         │ │
│  │  UI Layer          │  │  - UploadQueueWorker             │ │
│  │  - Auth            │  │  - VaultScanWorker (periodic)    │ │
│  │  - FileExplorer    │  │  - IndexSyncWorker (periodic)    │ │
│  │  - Viewers         │  │  - DownloadWorker (foreground)   │ │
│  │  - ShareDialog     │  │                                  │ │
│  └─────────┬──────────┘  └────────────┬────────────────────┘ │
│            │                            │                     │
│  ┌─────────▼────────────────────────────▼──────────────────┐ │
│  │  Local Room SQLite (file/folder/share cache mirror)    │ │
│  │  + EncryptedSharedPreferences (session cookie + ukey)  │ │
│  └─────────┬─────────────────────────────────────────────┬─┘ │
│            │                                             │   │
└────────────┼─────────────────────────────────────────────┼───┘
             │ HTTPS (Cookie: tc_session=...)              │
             │                                             │
             ▼                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            Existing TriVE Web Backend (Next.js 16)              │
│            Port 3000 (dev) / :81 via Caddy (prod)              │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐   │
│  │ API Routes │  │ Prisma ORM │  │  GramJS (MTProto)        │   │
│  │ (38 total) │──│ (SQLite)   │  │  Real Telegram client    │   │
│  └────────────┘  └────────────┘  └────────────┬─────────────┘   │
│                                                │                 │
│  ┌─────────────────────────────────────────────▼──────────────┐ │
│  │  TriVE VFS (src/lib/file-ops.ts)                            │ │
│  │  • AES-256-GCM encrypt per chunk                            │ │
│  │  • Chunk 20 MB, dedup by SHA-256                            │ │
│  │  • Reed-Solomon erasure code (5+3)                          │ │
│  │  • Manifest posting + vault scan                            │ │
│  │  • Streaming decrypt download                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ MTProto over TCP
                                   ▼
                    ┌───────────────────────────┐
                    │  Telegram Cloud (DC)       │
                    │  User's private channel     │
                    │  "TriVE_Storage_Vault"     │
                    └───────────────────────────┘
```

### 2.2 Why Cookie-Based Auth Works on Android

The web backend uses `httpOnly` cookies named `tc_session` and `tc_device`, set by `createSession()` in `src/lib/session.ts`. The Android app talks to the same backend over HTTPS, so the cookie jar approach works natively:

- Android's `OkHttp` + `CookieJar` (or `PersistentCookieJar`) persists cookies across app restarts.
- The session is HMAC-signed with `APP_SECRET` and is device-bound (the server stores an IP hash + nonce in `User.telegramApiHash` — see `session.ts:115-119`).
- On Android we do **not** need to manually re-create the device-binding logic. The OkHttp `Cookie` will be sent on every request, and the server's `getCurrentUser()` (in `src/lib/session.ts:130`) will validate it.

The only caveat: the device-binding stored in `telegramApiHash` is a soft check that the server currently does not actually verify on every request (see the comment at `session.ts:152-158` — "For now: accept any IP"). So Android users can move between Wi-Fi and cellular without getting kicked out.

### 2.3 Component Inventory

| Android Layer | Library / Approach | Why |
|---|---|---|
| UI | Jetpack Compose + Material 3 | Modern, declarative, matches the premium feel of the web app |
| Async | Kotlin Coroutines + Flow | Backpressure-friendly, structured concurrency |
| HTTP | OkHttp 4 + PersistentCookieJar | Cookie persistence is the entire auth story |
| Local DB | Room (SQLite) | Mirror of the web Prisma schema, subset of fields |
| Background work | WorkManager 2.9+ | UploadQueue, VaultScan, IndexSync — survives reboot |
| Foreground services | `Service` + `NotificationCompat` | Long-running downloads (multi-GB folder ZIPs) |
| Secure storage | `EncryptedSharedPreferences` (Tink) | Session cookie, biometric-gated |
| Biometric | `BiometricPrompt` | App-unlock gate |
| Image loading | Coil | Built on OkHttp, Compose-native |
| PDF viewer | PdfRenderer (Android system) or PdfBox-Android | No external deps needed |
| Code highlighting | Prism4j or Markwon + syntax-highlight extension | Matches web's react-syntax-highlighter feel |
| DOCX | Apache POI (with POI-OOXML-Lite) | Equivalent of web's `mammoth` |
| ZIP streaming | `java.util.zip.ZipInputStream` for download | For folder-share download |
| Deep links | `intent-filter` in `AndroidManifest.xml` | `trive://` scheme |
| DI | Hilt | Standard, works with WorkManager |

### 2.4 File Size Constraints

The backend has these hard limits (see `src/lib/file-utils.ts` and `src/app/api/files/upload/route.ts`):

- **Max file size:** 4 GB (`MAX_FILE_SIZE`)
- **Chunk size:** 20 MB (`CHUNK_SIZE`) — happens server-side; Android uploads the whole file via multipart and the server splits it
- **Request timeout:** `maxDuration = 300` seconds (5 min) on upload + download routes — this is a serverless-function ceiling, not a server CPU limit
- **Vault scan timeout:** `maxDuration = 120` seconds

**Implication for Android:** A 4 GB upload will not finish in 5 minutes on most connections. The upload route's `maxDuration = 300` is a Next.js serverless timeout, not enforced by the Next.js dev server (which runs as a long-lived Node process). For production deployments on Vercel/Cloudflare Workers, you will need to either (a) run the Next.js server on a long-running host (the existing `bun run start` standalone server works), or (b) implement client-side chunked upload — which is **out of scope for v1** because the web app does not do it either.

For v1, Android uploads use the same `multipart/form-data` POST that the web app uses (see `src/lib/api.ts:64-83`). This is fine for files under ~500 MB on a typical mobile connection. For larger files, defer to v2.

---

## 3. Division of Responsibility — Web vs Android

This is the single most important section for the Android developer. It defines what to build and what to delegate to the backend.

### 3.1 The Backend Owns (Android MUST NOT Reimplement)

| Concern | Why It's Backend-Only |
|---|---|
| Telegram MTProto connection | GramJS is a Node.js library; there is no mature Kotlin MTProto client. Even if there were, the user's StringSession is encrypted with `APP_SECRET` and stored server-side. The Android app must never see the session string. |
| AES-256-GCM file encryption | The encryption key is derived server-side via `scrypt(APP_SECRET, encSalt, 32)`. Sending the key to Android would defeat the zero-knowledge model. The Android app uploads plaintext bytes via HTTPS; the server encrypts before pushing to Telegram. |
| Erasure coding (Reed-Solomon) | Same as above — encoded in `src/lib/erasure-coding.ts`, runs server-side. |
| Chunk deduplication | Dedup key is SHA-256 of the *encrypted* chunk bytes, computed after encryption. Android sees only plaintext, so dedup cannot happen client-side. |
| Vault manifest format | Defined in `postFileManifest` / `scanVaultAndRebuild` in `file-ops.ts`. Android must consume manifests via the scan endpoint, never parse them directly from Telegram. |
| Share-link password hashing | `hashPassword()` uses scrypt with a random 8-byte salt. The salt is part of the stored hash, so verification requires the stored hash. Android always sends plaintext password over HTTPS; server verifies. |
| Activity log writes | The server auto-writes `Activity` rows on every mutation (upload, delete, share, etc.). Android only reads them via `/api/activity`. |
| Cascade deletes | Prisma `onDelete: Cascade` handles chunk + share cleanup when a file is deleted. Android just calls `DELETE /api/files/[id]`. |
| Admin panel | Hidden `/?admin=1`. Defer to Android v2. |

### 3.2 The Android App Owns (Web Does NOT Implement)

| Concern | Why It's Android-Only |
|---|---|
| Local SQLite index mirror | Web uses TanStack Query in-memory cache. Android needs persistent local cache so the app opens instantly offline. |
| Upload queue with WorkManager | Web uses an in-memory queue (`upload-panel.tsx`). Android needs a queue that survives app kill + device reboot. |
| Background vault scan | Web prompts the user to scan. Android should auto-scan on app foreground if `needsScan` flag is true. |
| Foreground-service download | Web uses `fetch()`. Android needs a foreground notification for multi-GB downloads. |
| Biometric unlock | N/A on web. Android uses `BiometricPrompt` to gate app unlock. |
| Share-sheet integration | Android system share-sheet — `ACTION_SEND` intent filter. Not applicable to web. |
| Deep links | `trive://share/<token>` and `trive://share/<username>/<slug>`. Web uses `?share=` query param. |
| Camera capture upload | Native camera intent. Web uses `<input type="file" capture>`. |
| Storage Access Framework | "Open from TriVE" / "Save to TriVE" via `DocumentsProvider`. Web has no equivalent. |

### 3.3 Shared Responsibilities (Both Implement, Must Match)

| Concern | Web Implementation | Android Implementation |
|---|---|---|
| File listing UI | `file-explorer.tsx` (grid/list) | Compose `LazyVerticalGrid` / `LazyColumn` |
| File viewer (PDF, image, code, etc.) | `file-viewers.tsx` | Compose screens using `PdfRenderer`, Coil, Prism4j |
| Share dialog | `share-dialog.tsx` | Compose `ModalBottomSheet` |
| Trash management | `trash-view.tsx` | Compose screen |
| Settings | `settings-view.tsx` | Compose screen |
| Public share viewer | `public-share-view.tsx` | Compose screen, deep-linked from `trive://share/...` |
| Storage analytics | `analytics-view.tsx` | Compose screen with Vico charts |

The Android implementations should match the web's UX flows closely — same labels, same default behaviors, same color tokens. The brand palette is navy → blue → cyan (`#1c3f81`, `#1e84c6`, `#1a8aae`); see `docs/architecture.md` and `globals.css` in the web project.

### 3.4 Decision Matrix — Where to Make a Change

When in doubt about whether to change something on the web or on Android:

| If the change is about... | Make it on... |
|---|---|
| API response shape | Web (add a new route or versioned field) |
| Auth flow | Web (Android follows) |
| File chunking or encryption | Web (server-side only) |
| Telegram behavior | Web (`telegram-service.ts`) |
| Local caching strategy | Android |
| UI animation / motion | Android |
| Background work scheduling | Android |
| Native intents / share sheet | Android |
| Biometric unlock | Android |

---

## 4. Backend API Contract — Full Reference

This section is the canonical reference for every endpoint the Android app will call. **All endpoints are JSON-over-HTTPS with cookie-based auth**, unless noted otherwise. All requests must include `Content-Type: application/json` for POST/PATCH bodies, except `/api/files/upload` which is `multipart/form-data`.

Base URL: in development, `http://10.0.2.2:3000` (Android emulator → host loopback). In production, your deployed Next.js URL (e.g., `https://trive.example.com`). The Android app should read this from `BuildConfig.BACKEND_URL`.

### 4.1 Authentication

#### POST `/api/auth/send-code`

Begin Telegram OTP login. The server calls GramJS `sendCode`, which sends an OTP to the user's Telegram app.

**Request body:**
```json
{ "phone": "+8801712345678" }
```

**Response 200:**
```json
{
  "phoneCodeHash": "abc123...",
  "simulation": false
}
```

**Response 400:** `{ "error": "Failed to send code" }` — usually a malformed phone number.
**Response 429:** `{ "error": "Flood wait: 30 seconds" }` — Telegram rate-limiting. The error message contains the wait time in seconds. The Android app should display this and disable the "Send code" button for the duration.

**Notes:**
- The `phoneCodeHash` is opaque to the client — pass it back to `/sign-in` unchanged.
- `simulation: true` means the server has no `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` and is in legacy simulation mode. In production this should always be `false`.
- Phone numbers must include the country code with `+` prefix. Whitespace is stripped server-side.

#### POST `/api/auth/sign-in`

Verify the OTP and create the user session.

**Request body:**
```json
{
  "phone": "+8801712345678",
  "code": "12345",
  "phoneCodeHash": "abc123...",
  "password": "optional-2fa-password"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "clxxx...",
    "phone": "+8801712345678",
    "name": "Jane Doe",
    "avatarColor": "#1e84c6",
    "vaultReady": true,
    "telegramConnected": true,
    "createdAt": "2026-01-15T10:30:00.000Z"
  },
  "vaultReady": true,
  "needsVault": false,
  "needsScan": false,
  "fileCount": 42
}
```

The response also sets two cookies: `tc_session` (HMAC-signed, 1-year expiry) and `tc_device` (device fingerprint, 1-year expiry). The OkHttp `CookieJar` will persist these.

**Response 400:** `{ "error": "Invalid code" }`
**Response 401:** `{ "error": "2FA password required" }` — re-prompt for password and retry with `password` field set.
**Response 429:** Flood wait — same handling as `/send-code`.

**Notes:**
- If the user has 2FA enabled on their Telegram account, the first call without `password` returns 401 with `2FA` in the error message. Show the password field, retry.
- On success, the server **automatically** checks Telegram for an existing `TriVE_Storage_Vault` channel and creates it if missing (`sign-in/route.ts:82-100`). The Android app does not need to call `/api/telegram/vault/init` after login — but it can, idempotently.
- `needsVault: true` means the vault could not be created automatically. Show the `VaultSetup` screen.
- `needsScan: true` means the vault exists on Telegram but the local DB has no files — the user logged in on a new device. Trigger `/api/telegram/vault/scan` automatically.

#### GET `/api/auth/me`

Returns the current user, or `null` if not logged in.

**Response 200 (logged in):**
```json
{
  "id": "clxxx...",
  "phone": "+8801712345678",
  "name": "Jane Doe",
  "avatarColor": "#1e84c6",
  "vaultReady": true,
  "telegramConnected": true,
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

**Response 200 (not logged in):**
```json
null
```

**Notes:**
- The Android app should call this on app launch to decide whether to show the auth screen or the dashboard.
- This endpoint does **not** return `needsVault` / `needsScan`. For those, call `/api/telegram/vault/status` separately.

#### POST `/api/auth/logout`

Destroys the session cookies server-side. No request body.

**Response:** `204 No Content`

### 4.2 Telegram Status & Vault

#### GET `/api/telegram/status`

Returns server-side Telegram engine health. Useful for a "Server status" indicator in settings.

**Response 200:**
```json
{
  "connected": true,
  "vaultReady": true,
  "simulationMode": false,
  "realMode": true,
  "phone": "+8801712345678",
  "apiIdPresent": true
}
```

#### GET `/api/telegram/vault/status`

Returns vault status. **Important:** this route has side effects — if the local DB has no vault channel but the user is logged in, it calls `telegramService.initVault` to find-or-create the vault on Telegram and updates the DB. (See `vault/status/route.ts:29-50`.)

**Response 200:**
```json
{
  "vaultReady": true,
  "vaultChannelId": true,
  "fileCount": 42,
  "needsVault": false,
  "needsScan": false
}
```

**Notes:**
- `vaultChannelId` is a boolean (not the actual ID) for security.
- If `needsScan: true`, call POST `/api/telegram/vault/scan` next.

#### POST `/api/telegram/vault/init`

Force create-or-find the vault channel. Idempotent — safe to call any time. Use this if `needsVault: true` from `/vault/status`.

**Response 200:**
```json
{ "vaultReady": true, "channelId": "..." }
```

#### POST `/api/telegram/vault/scan`

Rebuild the local DB file index from the vault channel's manifest messages. This is what makes files persist across devices — log in on Android, scan, all your files appear.

**Response 200:**
```json
{
  "scanned": 247,
  "added": 42,
  "skipped": 205,
  "errors": []
}
```

**Notes:**
- Has a 120-second timeout. For users with very large vaults, this may time out — re-call as needed; the scan is idempotent (skips already-known manifest message IDs).
- After scan completes, refresh the local file list via `/api/files`.

### 4.3 Folders

#### GET `/api/folders?parentId=root|<id>&starred=1&trashed=1&q=search`

Returns folders at the given parent. Defaults to root + non-trashed.

**Query params (all optional):**
- `parentId` — `root` or omit for root; otherwise a folder ID
- `starred=1` — only starred folders
- `trashed=1` — only trashed folders
- `q=search` — search by name (when searching, parentId is ignored)

**Response 200:**
```json
[
  {
    "id": "clxxx...",
    "name": "Work",
    "parentId": null,
    "color": "#1e84c6",
    "icon": null,
    "starred": false,
    "trashed": false,
    "fileCount": 12,
    "folderCount": 3,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-20T14:22:00.000Z"
  }
]
```

#### GET `/api/folders/tree`

Returns the full folder tree for the current user, non-trashed. Useful for the "Move to..." dialog.

**Response 200:** flat array of all folders (no nesting in response — client builds the tree from `parentId`).

#### POST `/api/folders`

Create a folder.

**Request body:**
```json
{ "name": "New Folder", "parentId": "root", "color": "#1e84c6" }
```

`parentId` is `"root"`, `null`, or a folder ID. `color` is optional.

**Response 200:** the new folder object (same shape as GET).

**Notes:** The server also posts a folder manifest to the Telegram vault channel so the folder persists across devices (`postFolderManifest`).

#### PATCH `/api/folders/[id]`

Update a folder. Body fields are all optional — only the included fields are updated.

**Request body:**
```json
{ "name": "Renamed", "starred": true, "trashed": true }
```

**Response 200:** the updated folder object.

#### DELETE `/api/folders/[id]`

If the folder is not trashed, moves it to trash. If already trashed, deletes it permanently (recursive — files + subfolders + their Telegram chunk messages).

**Response:** `204 No Content`

#### GET `/api/folders/[id]/download`

Download a folder as a streaming ZIP. The ZIP is built server-side as the response streams — `archiver` pipes through `Readable.toWeb()`.

**Response 200:** `application/zip` stream with `Content-Disposition: attachment; filename="folder-name.zip"`.

**Notes:**
- 300-second timeout.
- The Android app should use a foreground service to download large folder ZIPs — see §6.5.

### 4.4 Files

#### GET `/api/files?folderId=root|<id>&starred=1&trashed=1&q=search&all=1`

Returns files. Defaults to root + non-trashed.

**Query params (all optional):**
- `folderId` — `root` or omit for root; otherwise a folder ID
- `starred=1` — only starred files
- `trashed=1` — only trashed files
- `q=search` — search by name
- `all=1` — fetch ALL files regardless of folder (for "Recent", "Files by type" screens)

**Response 200:**
```json
[
  {
    "id": "clxxx...",
    "name": "report.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "encrypted": true,
    "isChunked": false,
    "totalChunks": 1,
    "starred": false,
    "trashed": false,
    "thumbnail": "data:image/jpeg;base64,...",
    "folderId": null,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
]
```

**Notes:** `thumbnail` is a base64 data URL for images under 15 MB (320×320 JPEG, quality 70). For larger images and non-images, `thumbnail` is `null`.

#### POST `/api/files/upload?folderId=root|<id>`

Upload a file. Multipart form data. The server:
1. Validates size (≤ 4 GB) and storage quota (0 = unlimited).
2. Validates destination folder ownership.
3. Calls `uploadFileToVault()` which:
   - Generates a thumbnail if it's an image < 15 MB.
   - Splits into 20 MB chunks.
   - Encrypts each chunk with AES-256-GCM (per-chunk IV).
   - Computes SHA-256 of each encrypted chunk for dedup.
   - Checks the DB for existing chunks with the same checksum — reuses Telegram message IDs if found.
   - If 3+ data shards, applies Reed-Solomon erasure coding (default 5+3).
   - Uploads each chunk to the vault channel via GramJS.
   - Posts a file manifest message to the vault (JSON, contains chunk map + metadata).
   - Creates the `File` row + `FileChunk` rows in the DB.

**Request:**
- `Content-Type: multipart/form-data`
- Form field: `file` — the actual file bytes
- Query param: `folderId` — `root` or a folder ID

**Response 200:** the new file object (same shape as GET).

**Response 413:** `{ "error": "File exceeds the 4GB limit" }` or `{ "error": "Storage quota exceeded", "used": 524288000, "limit": 1073741824 }`.

**Response 429:** Telegram flood wait. Error message contains wait seconds.

**Notes:**
- The web app uses `XMLHttpRequest` for progress events (`api.ts:64-83`). Android should use OkHttp's `RequestBody` with a `ProgressListener` for the same effect.
- 300-second serverless timeout. For mobile uploads of >500 MB, recommend Wi-Fi only.

#### PATCH `/api/files/[id]`

Update a file. Body fields are all optional.

**Request body:**
```json
{
  "name": "renamed.pdf",
  "starred": true,
  "trashed": true,
  "folderId": "clxxx..." // or "root" or null
}
```

**Response 200:** the updated file object.

**Notes:** Renaming, starring, or moving the file updates its manifest on Telegram (`postFileManifestUpdate`) so the change persists across devices.

#### DELETE `/api/files/[id]`

If the file is not trashed, moves it to trash. If already trashed, deletes it permanently (cascade-removes chunks + shares; best-effort deletes Telegram chunk messages).

**Response:** `204 No Content`

#### GET `/api/files/[id]/download`

Stream-download a file with server-side decryption. Bytes start flowing as soon as the first chunk is decrypted.

**Response 200:** `application/octet-stream` (or the actual MIME type) with `Content-Disposition: inline; filename="..."`.

**Response 401:** Not authenticated.
**Response 404:** File not found / doesn't belong to user.
**Response 500:** Decryption failed, chunk missing, etc.

**Notes:**
- 300-second timeout.
- The Android app should stream this to a `File` in app-private storage and open it via `FileProvider` + `Intent.ACTION_VIEW`.
- `Content-Disposition: inline` means the file will be displayed inline if the viewer supports it; for download, use OkHttp to stream to disk.

### 4.5 Share Links

#### GET `/api/share`

List all share links created by the current user.

**Response 200:**
```json
[
  {
    "id": "clxxx...",
    "token": "abc123def456...",
    "customSlug": "q4-report",
    "fileId": "clxxx...",
    "folderId": null,
    "hasPassword": false,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "downloadCount": 3,
    "maxDownloads": 10,
    "viewCount": 15,
    "maxViews": null,
    "viewOnly": false,
    "emailGate": false,
    "accessIps": false,
    "lastAccessedAt": "2026-07-25T08:00:00.000Z",
    "createdAt": "2026-07-20T12:00:00.000Z",
    "item": {
      "name": "report.pdf",
      "size": 1048576,
      "mimeType": "application/pdf"
    }
  }
]
```

**Notes:** `accessIps` is a boolean (not the actual IP list) for security — it tells the UI whether the gate is set without exposing the IPs.

#### POST `/api/share`

Create a single share link for one file or one folder.

**Request body (all fields except `fileId` OR `folderId` are optional):**
```json
{
  "fileId": "clxxx...",
  "folderId": null,
  "password": "secret123",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "maxDownloads": 10,
  "maxViews": 100,
  "viewOnly": false,
  "emailGate": false,
  "allowedEmails": "alice@example.com,bob@example.com",
  "accessIps": "192.168.1.0/24,10.0.0.5",
  "customSlug": "q4-report"
}
```

**Validation:**
- Exactly one of `fileId` or `folderId` must be set.
- `customSlug` must match `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$` (2-64 chars, letters/numbers/hyphens, no leading/trailing hyphen).
- Reserved slugs: `api`, `share`, `auth`, `telegram`, `files`, `folders`, `storage`, `activity`, `settings`, `admin`, `app`, `dashboard`.
- Slugs are unique **per user**, not globally. Two users can both have `q4-report`.
- `expiresAt` must be a valid ISO datetime string.
- `maxDownloads` and `maxViews` must be positive integers if set.

**Response 200:** the new share link object (same shape as GET).

**Response 400:** Validation error with a human-readable message.
**Response 404:** File/folder not found / doesn't belong to user.
**Response 409:** Custom slug already in use by this user.

#### POST `/api/share/batch`

Create a single share link containing multiple files and/or folders. The recipient sees all items in one view; "Download all" zips everything.

**Request body:**
```json
{
  "fileIds": ["clxxx1", "clxxx2"],
  "folderIds": ["clxxx3"],
  "customSlug": "project-bundle",
  "password": "secret",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "maxDownloads": 5,
  "viewOnly": false,
  "emailGate": true,
  "allowedEmails": "alice@example.com"
}
```

**Response 200:** a single share link object (with `item.name` like "3 items", `item.mimeType: "batch"`).

#### DELETE `/api/share/[id]`

Revoke a share link. Cascade-deletes the share items.

**Response:** `204 No Content`

#### GET `/api/share/check-slug?slug=q4-report`

Check if a custom slug is available for the current user. Use this in real-time as the user types in the slug field.

**Response 200:**
```json
{ "available": true, "reason": "Available" }
```
or
```json
{ "available": false, "reason": "You already used this link" }
```

### 4.6 Public Share (No Auth Required)

These endpoints are called by share recipients — no `tc_session` cookie needed.

#### GET `/api/share/public?token=<token>&password=<pw>&email=<email>`

Or: `?share=<customSlug>&password=<pw>&email=<email>`
Or: `?token=<username>/<slug>&...` (combines username + slug for per-user slugs)

Resolves the share link, applies all gates (password, email, IP, expiry, view/download caps), increments view count, returns the share metadata + item info.

**Response 200 (no gates, fully accessible):**
```json
{
  "id": "clxxx...",
  "token": "abc123...",
  "customSlug": "q4-report",
  "item": {
    "type": "file",
    "name": "report.pdf",
    "size": 1048576,
    "mimeType": "application/pdf"
  },
  "hasPassword": false,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "downloadCount": 3,
  "maxDownloads": 10,
  "viewCount": 16,
  "maxViews": null,
  "viewOnly": false,
  "emailGate": false,
  "needsPassword": false,
  "needsEmail": false,
  "emailAllowed": true,
  "expired": false,
  "exhausted": false,
  "viewOnlyEnforced": false,
  "createdAt": "2026-07-20T12:00:00.000Z"
}
```

**Response 200 (password required):**
```json
{
  "token": "abc123...",
  "customSlug": null,
  "item": { ... },  // item is included even before password — the web UI hides it client-side; Android should hide too
  "hasPassword": true,
  ...
  "needsPassword": true,
  "needsEmail": false,
  ...
}
```

**Response 200 (expired):**
```json
{
  "token": "abc123...",
  "item": null,
  "expired": true,
  "exhausted": false,
  ...
}
```

**Response 200 (exhausted — view or download cap reached):**
```json
{
  "token": "abc123...",
  "item": null,
  "expired": false,
  "exhausted": true,
  ...
}
```

**Response 404:** `{ "error": "Share link not found", "removed": true }` — the underlying file was deleted or trashed.

**Notes:**
- For folder shares, `item.type: "folder"` and `item.files` is an array of files in the folder (recursive). The Android app renders this as a browsable tree.
- For batch shares, `item.type: "batch"` and `item.files` + `item.folders` arrays.

#### GET `/api/share/[id]/download?password=<pw>&email=<email>&fileId=<fid>&inline=1`

Download a file from a share link. The `id` in the URL is the share `token` or `customSlug` (or `username/slug`).

**Behaviors:**
- Single file share: streams the file with `Content-Disposition: attachment` (or `inline` if `?inline=1`).
- Folder share without `fileId`: streams a ZIP of the entire folder.
- Folder share with `fileId`: streams a single file from the folder (verifies the file is inside the shared folder recursively).
- Batch share without `fileId`: streams a ZIP of all items.
- Batch share with `fileId`: streams a single file (verifies the file is a direct ShareItem OR inside one of the share's folders recursively).

**Response 200:** binary stream with appropriate content-type.
**Response 401:** `{ "error": "Incorrect password", "needsPassword": true }`
**Response 403:** `{ "error": "This link is view-only. Downloads are disabled.", "viewOnly": true }` or `{ "error": "Access from this network is not allowed" }` (IP allowlist)
**Response 410:** `{ "error": "This share link has expired" }` or `{ "error": "Download limit reached" }`

**Security note for Android:** The web app currently sends `password` and `email` as URL query parameters. **This leaks credentials in server logs, browser history, and the `Referer` header.** The Android app should follow the same convention for now (server compatibility), but **file a follow-up** to migrate to `X-Share-Password` and `X-Share-Email` headers server-side. See `docs/VULNERABILITIES.md` C-5.

### 4.7 Storage & Activity

#### GET `/api/storage`

Returns storage analytics for the current user.

**Response 200:**
```json
{
  "totalUsed": 524288000,
  "fileCount": 42,
  "folderCount": 7,
  "byType": [
    { "type": "image", "label": "Images", "size": 314572800, "count": 25, "color": "#1e84c6" },
    { "type": "pdf", "label": "PDFs", "size": 209715200, "count": 17, "color": "#e74c3c" }
  ],
  "recentActivity": [
    { "id": "clxxx...", "action": "upload", "details": "{...}", "createdAt": "2026-07-25T08:00:00.000Z" }
  ],
  "uploadTrend": [
    { "date": "2026-07-19", "size": 52428800 },
    { "date": "2026-07-20", "size": 104857600 }
  ]
}
```

#### GET `/api/activity`

Returns the last 50 activities for the current user. Same shape as `recentActivity` above.

### 4.8 Settings

#### PATCH `/api/settings`

Update profile. Currently only `name` is updatable.

**Request body:**
```json
{ "name": "Jane Doe" }
```

**Response 200:** the updated user object.

#### DELETE `/api/settings`

Delete the user account permanently. Best-effort deletes all Telegram chunk messages from the vault, then cascade-deletes all DB rows.

**Response:** `204 No Content`

**Notes:** This is destructive. The Android app should require biometric re-auth + typed confirmation ("DELETE") before calling this endpoint.

### 4.9 Error Conventions

All error responses follow this shape:
```json
{ "error": "Human-readable message" }
```

HTTP status codes used:
- `200` — success
- `204` — success, no body
- `400` — validation error
- `401` — authentication required / failed
- `403` — forbidden (IP allowlist, view-only download)
- `404` — not found
- `409` — conflict (custom slug already used)
- `410` — gone (expired, exhausted)
- `413` — payload too large (file size, quota)
- `429` — rate limited (Telegram flood wait)
- `500` — server error

Special error messages to handle on Android:
- `"UNAUTHORIZED"` (raw) → maps to 401
- `"Flood wait: N seconds"` → 429, show countdown timer
- `"2FA password required"` → 401, show password field
- `"Vault not initialized"` → 400, redirect to vault setup
- `"Storage quota exceeded"` → 413, show upgrade prompt (or "free, unlimited" message)
- `"This file is no longer available"` → 404, share was cascade-deleted

---

## 5. Authentication & Session Model on Android

### 5.1 The Session Lifecycle

```
App Launch
  │
  ▼
Check EncryptedSharedPreferences for `tc_session` cookie
  │
  ├─ Not found → Show AuthFlow (phone → code → optional 2FA)
  │                  │
  │                  ▼
  │              POST /api/auth/send-code {phone}
  │                  │
  │                  ▼
  │              Show OTP input screen
  │                  │
  │                  ▼
  │              POST /api/auth/sign-in {phone, code, phoneCodeHash, password?}
  │                  │
  │                  ▼
  │              OkHttp CookieJar captures tc_session + tc_device cookies
  │              Persist to EncryptedSharedPreferences
  │                  │
  │                  ▼
  │              Check needsVault / needsScan → vault setup or scan
  │                  │
  │                  ▼
  │              Show Dashboard
  │
  └─ Found → GET /api/auth/me (validate session)
                  │
                  ├─ 200 + user → BiometricPrompt → Dashboard
                  │
                  └─ 200 + null or 401 → Clear cookies, show AuthFlow
```

### 5.2 Cookie Persistence with OkHttp

Use `PersistentCookieJar` (or implement `CookieJar` yourself with `EncryptedSharedPreferences` as the backing store):

```kotlin
// AuthModule.kt — Hilt module
@Module
@InstallIn(SingletonComponent::class)
object AuthModule {

    @Provides
    @Singleton
    fun provideCookieJar(context: Context): ClearableCookieJar {
        return PersistentCookieJar(
            SetCookieCache(),
            SharedPrefsCookiePersistor(
                EncryptedSharedPreferences.create(
                    context,
                    "trive_cookies",
                    MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            )
        )
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(cookieJar: ClearableCookieJar): OkHttpClient {
        return OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)  // matches server maxDuration
            .writeTimeout(300, TimeUnit.SECONDS)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                        else HttpLoggingInterceptor.Level.NONE
            })
            .build()
    }
}
```

### 5.3 Biometric Unlock Gate

After the session cookie is loaded, require biometric auth before showing the dashboard:

```kotlin
// BiometricGate.kt
class BiometricGate(private val activity: FragmentActivity) {

    fun unlock(onSuccess: () -> Unit, onError: (String) -> Unit) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onSuccess()
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                onError(errString.toString())
            }
        })

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock TriVE")
            .setSubtitle("Use your fingerprint or face to access your vault")
            .setNegativeButtonText("Sign out")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        prompt.authenticate(info)
    }
}
```

The "Sign out" negative button clears the cookies and returns to the auth screen — this is the user's escape hatch if biometrics fail.

### 5.4 Sign-Out Flow

```kotlin
suspend fun signOut() {
    api.post("/api/auth/logout")  // server clears cookies
    cookieJar.clear()             // local persistence cleared
    navController.navigate("auth") {
        popUpTo("dashboard") { inclusive = true }
    }
}
```

### 5.5 Handling 401s Globally

Add an OkHttp interceptor that catches 401 responses and triggers a global "session expired" event:

```kotlin
class SessionExpiredInterceptor(
    private val cookieJar: ClearableCookieJar,
    private val sessionState: SessionState  // SharedFlow<Unit>
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code == 401 && chain.request().url.encodedPath != "/api/auth/sign-in") {
            cookieJar.clear()
            sessionState.emitSessionExpired()
        }
        return response
    }
}
```

The session-state SharedFlow is observed by the main activity, which navigates to the auth screen.

### 5.6 First-Run Vault Setup

After login, if `needsVault: true`:

```kotlin
// VaultSetupViewModel.kt
fun createVault() {
    viewModelScope.launch {
        _uiState.value = VaultUiState.Creating
        try {
            api.post("/api/telegram/vault/init")
            _uiState.value = VaultUiState.Ready
        } catch (e: Exception) {
            _uiState.value = VaultUiState.Error(e.message ?: "Failed to create vault")
        }
    }
}
```

If `needsScan: true`:

```kotlin
// Triggered automatically on dashboard entry if needsScan=true
fun autoScan() {
    viewModelScope.launch {
        val result = api.post<VaultScanResult>("/api/telegram/vault/scan")
        // Show a toast: "Restored ${result.added} files from your vault"
    }
}
```

---

## 6. Android Sync Engine — The Native Layer

This is the Android app's primary value-add. The web app has no equivalent — it relies on TanStack Query's in-memory cache and `refetchInterval` polling. The Android app needs durable persistence and background work.

### 6.1 Sync Engine Design Goals

1. **Instant open** — the app shows the last-known file list within 50 ms, then refreshes in the background.
2. **Offline-first mutations** — file/folder/share operations queue locally and sync when connectivity returns.
3. **Survives reboot** — WorkManager persists scheduled jobs to disk; they survive device restarts.
4. **Battery-aware** — only sync on unmetered Wi-Fi by default; users can opt into cellular.
5. **Conflict-free** — the backend is the source of truth; the local DB is always a read-only mirror except for the upload queue.

### 6.2 Local Room Database Schema

A subset of the Prisma schema. Drop fields that are server-internal-only (`encIv`, `manifestMessageId`, `dataShards`, etc.) — the Android app never needs them.

```kotlin
// FileEntity.kt
@Entity(tableName = "files", indices = [Index("folderId"), Index("starred"), Index("trashed")])
data class FileEntity(
    @PrimaryKey val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val isChunked: Boolean,
    val totalChunks: Int,
    val starred: Boolean,
    val trashed: Boolean,
    val thumbnail: String?,
    val folderId: String?,
    val createdAt: Long,  // epoch millis
    val updatedAt: Long,
    val lastSyncedAt: Long  // when this row was last fetched from server
)

// FolderEntity.kt
@Entity(tableName = "folders", indices = [Index("parentId")])
data class FolderEntity(
    @PrimaryKey val id: String,
    val name: String,
    val parentId: String?,
    val color: String?,
    val icon: String?,
    val starred: Boolean,
    val trashed: Boolean,
    val createdAt: Long,
    val updatedAt: Long,
    val lastSyncedAt: Long
)

// ShareLinkEntity.kt
@Entity(tableName = "share_links", indices = [Index("fileId"), Index("folderId")])
data class ShareLinkEntity(
    @PrimaryKey val id: String,
    val token: String,
    val customSlug: String?,
    val fileId: String?,
    val folderId: String?,
    val hasPassword: Boolean,
    val expiresAt: Long?,
    val downloadCount: Int,
    val maxDownloads: Int?,
    val viewCount: Int,
    val maxViews: Int?,
    val viewOnly: Boolean,
    val emailGate: Boolean,
    val accessIps: Boolean,
    val lastAccessedAt: Long?,
    val createdAt: Long,
    val itemName: String?,
    val itemSize: Long?,
    val itemMimeType: String?
)

// UploadQueueEntry.kt — Android-only, not on the server
@Entity(tableName = "upload_queue")
data class UploadQueueEntry(
    @PrimaryKey(autoGenerate = true) val rowId: Long = 0,
    val localUri: String,        // content:// URI to the file
    val fileName: String,
    val mimeType: String,
    val size: Long,
    val folderId: String?,      // null = root
    val status: UploadStatus,    // PENDING, IN_PROGRESS, FAILED, COMPLETED
    val attempts: Int = 0,
    val lastError: String?,
    val createdAt: Long,
    val updatedAt: Long
)

enum class UploadStatus { PENDING, IN_PROGRESS, FAILED, COMPLETED }
```

### 6.3 IndexSyncWorker (Periodic)

Refreshes the local DB from the server. Runs every 15 minutes (WorkManager minimum interval) on unmetered Wi-Fi.

```kotlin
class IndexSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            syncFolders()
            syncFiles()
            syncShares()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    private suspend fun syncFolders() {
        val remoteFolders = api.get<List<FolderDto>>("/api/folders?parentId=root")
        val now = System.currentTimeMillis()
        val entities = remoteFolders.map { it.toEntity(now) }
        db.folderDao().upsertAll(entities)
        // Optional: delete local rows whose ID isn't in the remote set
        db.folderDao().deleteMissing(remoteFolders.map { it.id })
    }

    private suspend fun syncFiles() {
        val remoteFiles = api.get<List<FileDto>>("/api/files?all=1")
        // ... similar upsert pattern
    }

    private suspend fun syncShares() {
        val remoteShares = api.get<List<ShareLinkDto>>("/api/share")
        // ... similar
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<IndexSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.UNMETERED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "trive-index-sync",
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
```

### 6.4 UploadQueueWorker (On-Demand)

Processes the upload queue. Triggered when a new file is queued (via the share-sheet or in-app picker) and runs until the queue is empty.

```kotlin
class UploadQueueWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val queue = db.uploadQueueDao().getPending(limit = 1) ?: return Result.success()
        val entry = queue.first()
        val contentResolver = applicationContext.contentResolver

        return try {
            // Mark in-progress
            db.uploadQueueDao().updateStatus(entry.rowId, UploadStatus.IN_PROGRESS, null)

            // Stream the file from the content URI directly to OkHttp multipart
            val progressListener = ProgressListener { bytesRead, contentLength, done ->
                val pct = if (contentLength > 0) (bytesRead * 100 / contentLength).toInt() else 0
                setProgressAsync(workDataOf("progress" to pct, "rowId" to entry.rowId))
            }

            val file = entry.toRequestBody(contentResolver, progressListener)
            val response = api.uploadFile(file, entry.folderId)

            // On success — record the new file ID, mark complete
            db.uploadQueueDao().updateStatus(entry.rowId, UploadStatus.COMPLETED, null)

            // Force a sync of the file index so the new file shows up in Room
            IndexSyncWorker.schedule(applicationContext)

            Result.success()

        } catch (e: Exception) {
            db.uploadQueueDao().updateStatus(
                entry.rowId,
                UploadStatus.FAILED,
                e.message
            )
            // Retry up to 5 times with exponential backoff
            if (runAttemptCount < 5) Result.retry() else Result.failure()
        }
    }

    companion object {
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<UploadQueueWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork("trive-upload-queue", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
```

**Progress reporting to UI:**

The UI observes `WorkManager.getWorkInfosForUniqueWorkLiveData("trive-upload-queue")` and reads `progress` from the WorkInfo to update a progress bar.

### 6.5 DownloadWorker (Foreground Service)

Long-running downloads (multi-GB folder ZIPs) require a foreground service to avoid being killed by the OS.

```kotlin
class DownloadWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val url = inputData.getString("url") ?: return Result.failure()
        val destFile = File(applicationContext.cacheDir, inputData.getString("filename")!!)
        setForegroundAsync(createForegroundInfo("Downloading ${destFile.name}"))

        return try {
            val request = Request.Builder().url(url).build()
            val response = okHttpClient.newCall(request).execute()

            response.body?.byteStream()?.use { input ->
                destFile.outputStream().use { output ->
                    input.copyTo(output) { bytesRead, total ->
                        val pct = if (total > 0) (bytesRead * 100 / total).toInt() else 0
                        setProgressAsync(workDataOf("progress" to pct))
                        notificationManager.notify(
                            NOTIF_ID,
                            buildProgressNotification(destFile.name, pct)
                        )
                    }
                }
            }

            Result.success()
        } catch (e: Exception) {
            destFile.delete()
            Result.failure()
        }
    }

    private fun createForegroundInfo(contentText: String): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("TriVE")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_download)
            .setOngoing(true)
            .build()

        return ForegroundInfo(NOTIF_ID, notification)
    }
}
```

### 6.6 VaultScanWorker (On-Demand)

Triggered after first login on a new device, or manually from Settings.

```kotlin
class VaultScanWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        setForegroundAsync(createForegroundInfo("Scanning your vault..."))
        return try {
            val result = api.post<VaultScanResult>("/api/telegram/vault/scan")
            // After scan, refresh the local index
            IndexSyncWorker.schedule(applicationContext)
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
```

### 6.7 Conflict Resolution

The Android app is **always last-writer-wins** with the server as the source of truth. There is no client-side optimistic concurrency.

For mutations (rename, star, move, trash), the Android app:
1. Updates the local Room row immediately (optimistic update).
2. Sends the PATCH to the server.
3. On success: marks the row as synced.
4. On failure: rolls back the local change and shows an error toast.

If the user does the same operation on the web app simultaneously, the next `IndexSyncWorker` run will overwrite the local row with the server's view.

### 6.8 Battery & Data Saver Settings

Expose these in Settings → Sync:

| Setting | Default | Storage |
|---|---|---|
| Sync on Wi-Fi only | true | EncryptedSharedPreferences |
| Sync on cellular | false | EncryptedSharedPreferences |
| Sync interval | 15 min | EncryptedSharedPreferences |
| Auto-upload from camera | false (opt-in only) | EncryptedSharedPreferences |
| Max upload size on cellular | 10 MB | EncryptedSharedPreferences |

### 6.9 Auto-Upload from Camera (Optional v2)

If the user opts in, register a `ContentObserver` on `MediaStore.Images.Media` and enqueue uploads for new photos. This is the "drop-in Google Photos replacement" feature — defer to v2.

---

## 7. File Pipeline & Crypto as Seen by Android

This section explains what the Android app needs to know about the backend's encryption/chunking pipeline. **The Android app does not perform encryption** — it uploads plaintext over HTTPS and the server encrypts before pushing to Telegram. The Android app only needs to understand the pipeline for two reasons:

1. To display correct progress (a 4 GB file will take a long time to upload because the server has to chunk + encrypt + upload to Telegram serially).
2. To set user expectations about file integrity.

### 7.1 The Pipeline (Server-Side)

```
Android uploads file (multipart)
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│  Server: uploadFileToVault() in src/lib/file-ops.ts                  │
│                                                                      │
│  1. Generate thumbnail if image < 15 MB (sharp, 320×320, JPEG 70%)  │
│  2. Split into 20 MB chunks                                          │
│  3. For each chunk:                                                  │
│     a. AES-256-GCM encrypt (key = scrypt(APP_SECRET, encSalt, 32))  │
│     b. SHA-256 of encrypted bytes = checksum (dedup key)            │
│     c. Query DB: does this checksum exist for this user?            │
│        - YES: reuse existing telegramMessageId, mark chunk deduped   │
│        - NO: upload to Telegram vault channel, save new chunk row    │
│  4. If totalChunks >= 3: Reed-Solomon erasure coding (5+3 default)  │
│     a. Compute parity shards from data shards                       │
│     b. Upload parity shards as additional messages                   │
│  5. Post file manifest message (JSON) to vault channel               │
│  6. Create File row + FileChunk rows in DB                           │
│  7. Return FileItem to Android                                       │
└───────────────────────────────────────────────────────────────────┘
```

### 7.2 The Download Pipeline (Server-Side)

```
Android GETs /api/files/[id]/download
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│  Server: streamFileFromVault() in src/lib/file-ops.ts                │
│                                                                      │
│  For each chunk (in order):                                          │
│    1. Download chunk from Telegram (via GramJS, parallel prefetch)   │
│    2. Truncate to exact encrypted size (plainSize + 16 GCM tag)      │
│    3. AES-256-GCM decrypt                                            │
│    4. If chunk missing and erasure-coded: reconstruct from parity    │
│    5. Stream decrypted bytes to HTTP response                         │
│                                                                      │
│  Bytes start flowing after chunk 0 is decrypted — no full-file      │
│  buffering.                                                          │
└───────────────────────────────────────────────────────────────────┘
```

### 7.3 What Android Needs to Know

| Question | Answer |
|---|---|
| Does Android need the APP_SECRET? | **No.** Never. The server-side encryption key is derived from APP_SECRET + the user's encSalt. Sending the key to Android would defeat the entire security model. |
| Does Android need to encrypt files before upload? | **No.** HTTPS provides transport encryption. The server encrypts before storage. |
| Does Android need to decrypt files after download? | **No.** The server decrypts before streaming. Android receives plaintext. |
| Does Android need to handle chunking? | **No.** The server splits files into 20 MB chunks. Android uploads the whole file as one multipart POST. |
| Does Android need to know the manifest format? | **No.** Manifests are server-internal. Android triggers scans via `/api/telegram/vault/scan` and consumes the resulting file list via `/api/files`. |
| Can Android verify file integrity? | **Partially.** The server stores a SHA-256 of the original plaintext as `File.checksum`. Android can compute SHA-256 of a downloaded file and compare — but this is redundant because the server verifies on every download. |
| What if a download fails mid-stream? | Retry the whole request. Server-side streaming does not support range requests (the file is decrypted chunk-by-chunk, so resumption is non-trivial). |

### 7.4 The Zero-Knowledge Caveat

The web app's marketing copy claims "zero-knowledge" — the server *cannot* decrypt user files. **This is currently false** (see `docs/VULNERABILITIES.md` C-3). The encryption key is derived from `APP_SECRET` (a server-side secret) + `encSalt` (stored in the DB), so the server operator can decrypt any file.

**For Android v1:** Do not change this. The Android app benefits from the same security model as the web app — files are encrypted at rest on Telegram's servers (Telegram only sees ciphertext), but the TriVE server can decrypt.

**For future v2:** If true zero-knowledge is desired, implement client-side encryption on Android (and the web) — derive the key from a user-supplied password via scrypt, never send the key to the server. This requires changing `src/lib/crypto.ts` and the upload/download pipeline significantly. **Out of scope for v1.**

### 7.5 Streaming Multipart Upload with Progress

The web app uses `XMLHttpRequest` for upload progress. Android uses OkHttp with a custom `RequestBody`:

```kotlin
class ProgressRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val listener: (Long, Long) -> Unit  // bytesRead, totalBytes
) : RequestBody() {

    override fun contentType(): MediaType? = mimeType.toMediaTypeOrNull()

    override fun contentLength(): Long {
        return contentResolver.openFileDescriptor(uri, "r")?.use {
            it.statSize
        } ?: throw IOException("Cannot get file size")
    }

    override fun writeTo(sink: BufferedSink) {
        val total = contentLength()
        var bytesRead = 0L

        contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                sink.write(buffer, 0, read)
                bytesRead += read
                listener(bytesRead, total)
            }
        } ?: throw IOException("Cannot open input stream")
    }
}
```

Usage:

```kotlin
suspend fun uploadFile(uri: Uri, fileName: String, mimeType: String, folderId: String?): FileDto {
    val body = ProgressRequestBody(contentResolver, uri, mimeType) { read, total ->
        // Emit progress to a StateFlow that the UI observes
        _uploadProgress.emit(UploadProgress(fileName, read, total))
    }

    val multipart = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("file", fileName, body)
        .build()

    val url = if (folderId != null) "/api/files/upload?folderId=$folderId"
              else "/api/files/upload?folderId=root"

    val request = Request.Builder()
        .url("$baseUrl$url")
        .post(multipart)
        .build()

    return withContext(Dispatchers.IO) {
        okHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException(response.body?.string() ?: "Upload failed")
            gson.fromJson(response.body?.string(), FileDto::class.java)
        }
    }
}
```

### 7.6 Streaming Download to File

```kotlin
suspend fun downloadToFile(fileId: String, destFile: File, onProgress: (Long, Long) -> Unit) {
    val request = Request.Builder()
        .url("$baseUrl/api/files/$fileId/download")
        .build()

    withContext(Dispatchers.IO) {
        okHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Download failed: ${response.code}")

            val total = response.body?.contentLength() ?: -1L
            var bytesRead = 0L

            response.body?.byteStream()?.use { input ->
                destFile.outputStream().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        bytesRead += read
                        onProgress(bytesRead, total)
                    }
                }
            }
        }
    }
}
```

### 7.7 Opening Files via FileProvider

After download, open the file in the appropriate external app:

```kotlin
// AndroidManifest.xml — inside <application>
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>

// res/xml/file_paths.xml
<paths>
    <cache-path name="cache" path="." />
    <files-path name="files" path="." />
</paths>

// OpenFileAction.kt
fun openFile(context: Context, file: File, mimeType: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Open with"))
}
```

---

## 8. Project Setup & Module Structure

### 8.1 Project Bootstrap

**Prerequisites:**
- Android Studio Iguana or newer
- JDK 17 (Android Studio bundles this)
- Kotlin 2.0+
- Android Gradle Plugin 8.5+
- Min SDK 26 (Android 8.0), Target SDK 35, Compile SDK 35

**Project name:** `TriVE Android`
**Package name:** `com.tect0nic.trive` (use `tect0nic` to match the web's brand attribution)

**Steps:**

1. Create a new project in Android Studio: Empty Compose Activity.
2. Convert to a multi-module project (see §8.2).
3. Add Hilt: `kapt` → `ksp`, add `dagger-hilt-android`, `androidx.hilt:hilt-work`, `androidx.hilt:hilt-navigation-compose`.
4. Add OkHttp: `com.squareup.okhttp3:okhttp:4.12.0`, `com.squareup.okhttp3:logging-interceptor:4.12.0`, `com.github.franmontiel:PersistentCookieJar:v1.0.1`.
5. Add Room: `androidx.room:room-runtime:2.6.1`, `androidx.room:room-ktx:2.6.1`, ksp `androidx.room:room-compiler:2.6.1`.
6. Add WorkManager: `androidx.work:work-runtime-ktx:2.9.0`, `androidx.hilt:hilt-work:1.2.0`, ksp `androidx.hilt:hilt-compiler:1.2.0`.
7. Add Compose BOM: `androidx.compose:compose-bom:2024.09.00`.
8. Add Coil: `io.coil-kt:coil-compose:2.6.0`.
9. Add Navigation: `androidx.navigation:navigation-compose:2.7.7`.
10. Add DataStore: `androidx.datastore:datastore-preferences:1.1.1` (for sync settings).
11. Add biometric: `androidx.biometric:biometric:1.2.0-alpha05`.
12. Add Moshi or Gson for JSON parsing — recommend **kotlinx.serialization** for type safety.

### 8.2 Module Structure

```
trive-android/
├── app/                          # App module — UI, DI, WorkManager workers
│   ├── src/main/
│   │   ├── java/com/tect0nic/trive/
│   │   │   ├── TriveApplication.kt
│   │   │   ├── MainActivity.kt
│   │   │   ├── di/                # Hilt modules
│   │   │   ├── data/              # Repositories + Room
│   │   │   │   ├── api/           # API DTOs + Retrofit interface
│   │   │   │   ├── db/            # Room entities + DAOs + database
│   │   │   │   └── repo/          # Repository implementations
│   │   │   ├── domain/            # Use cases + models
│   │   │   ├── sync/              # WorkManager workers
│   │   │   ├── ui/                # Compose screens
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── viewer/
│   │   │   │   ├── share/
│   │   │   │   └── settings/
│   │   │   └── util/
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts              # Project-level
├── settings.gradle.kts
└── gradle/libs.versions.toml     # Version catalog
```

### 8.3 Network Layer

```kotlin
// data/api/TrieveApi.kt
interface TrieveApi {
    @POST("/api/auth/send-code")
    suspend fun sendCode(@Body body: SendCodeRequest): SendCodeResponse

    @POST("/api/auth/sign-in")
    suspend fun signIn(@Body body: SignInRequest): SignInResponse

    @POST("/api/auth/logout")
    suspend fun logout(): Unit

    @GET("/api/auth/me")
    suspend fun me(): UserDto?

    @GET("/api/telegram/status")
    suspend fun telegramStatus(): TelegramStatusDto

    @GET("/api/telegram/vault/status")
    suspend fun vaultStatus(): VaultStatusDto

    @POST("/api/telegram/vault/init")
    suspend fun initVault(): VaultInitResponse

    @POST("/api/telegram/vault/scan")
    suspend fun scanVault(): VaultScanResult

    @GET("/api/folders")
    suspend fun listFolders(
        @Query("parentId") parentId: String? = null,
        @Query("starred") starred: Int? = null,
        @Query("trashed") trashed: Int? = null,
        @Query("q") q: String? = null
    ): List<FolderDto>

    @GET("/api/folders/tree")
    suspend fun folderTree(): List<FolderDto>

    @POST("/api/folders")
    suspend fun createFolder(@Body body: CreateFolderRequest): FolderDto

    @PATCH("/api/folders/{id}")
    suspend fun updateFolder(
        @Path("id") id: String,
        @Body body: UpdateFolderRequest
    ): FolderDto

    @DELETE("/api/folders/{id}")
    suspend fun deleteFolder(@Path("id") id: String): Unit

    @GET("/api/files")
    suspend fun listFiles(
        @Query("folderId") folderId: String? = null,
        @Query("starred") starred: Int? = null,
        @Query("trashed") trashed: Int? = null,
        @Query("q") q: String? = null,
        @Query("all") all: Int? = null
    ): List<FileDto>

    @Multipart
    @POST("/api/files/upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Query("folderId") folderId: String = "root"
    ): FileDto

    @PATCH("/api/files/{id}")
    suspend fun updateFile(
        @Path("id") id: String,
        @Body body: UpdateFileRequest
    ): FileDto

    @DELETE("/api/files/{id}")
    suspend fun deleteFile(@Path("id") id: String): Unit

    @GET("/api/share")
    suspend fun listShares(): List<ShareLinkDto>

    @POST("/api/share")
    suspend fun createShare(@Body body: CreateShareRequest): ShareLinkDto

    @POST("/api/share/batch")
    suspend fun createBatchShare(@Body body: CreateBatchShareRequest): ShareLinkDto

    @DELETE("/api/share/{id}")
    suspend fun deleteShare(@Path("id") id: String): Unit

    @GET("/api/share/check-slug")
    suspend fun checkSlug(@Query("slug") slug: String): SlugCheckResponse

    @GET("/api/share/public")
    suspend fun getPublicShare(
        @Query("token") token: String? = null,
        @Query("share") share: String? = null,
        @Query("password") password: String? = null,
        @Query("email") email: String? = null
    ): PublicShareDto

    @GET("/api/storage")
    suspend fun getStorage(): StorageAnalyticsDto

    @GET("/api/activity")
    suspend fun getActivity(): List<ActivityDto>

    @PATCH("/api/settings")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): UserDto

    @DELETE("/api/settings")
    suspend fun deleteAccount(): Unit
}

// data/api/Dtos.kt — mirror of src/lib/types.ts
@Serializable
data class UserDto(
    val id: String,
    val phone: String,
    val name: String?,
    val avatarColor: String?,
    val vaultReady: Boolean,
    val telegramConnected: Boolean,
    val createdAt: String
)

@Serializable
data class FolderDto(
    val id: String,
    val name: String,
    val parentId: String?,
    val color: String?,
    val icon: String?,
    val starred: Boolean,
    val trashed: Boolean,
    val fileCount: Int? = null,
    val folderCount: Int? = null,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class FileDto(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val encrypted: Boolean,
    val isChunked: Boolean,
    val totalChunks: Int,
    val starred: Boolean,
    val trashed: Boolean,
    val thumbnail: String?,
    val folderId: String?,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class SignInResponseDto(
    val user: UserDto,
    val vaultReady: Boolean,
    val needsVault: Boolean,
    val needsScan: Boolean,
    val fileCount: Int
)
```

### 8.4 Repository Layer

```kotlin
// data/repo/FileRepository.kt
class FileRepository @Inject constructor(
    private val api: TrieveApi,
    private val dao: FileDao,
    private val syncSettings: SyncSettings
) {
    fun observeFiles(folderId: String?): Flow<List<FileEntity>> {
        return if (folderId == null || folderId == "root") {
            dao.observeRootFiles()
        } else {
            dao.observeFilesInFolder(folderId)
        }
    }

    suspend fun refreshFiles(folderId: String?): Result<Unit> = runCatching {
        val remote = if (folderId == null) {
            api.listFiles(folderId = "root")
        } else {
            api.listFiles(folderId = folderId)
        }
        val now = System.currentTimeMillis()
        dao.upsertAll(remote.map { it.toEntity(now) })
    }

    suspend fun uploadFile(uri: Uri, fileName: String, mimeType: String, size: Long, folderId: String?) {
        // Insert into queue — UploadQueueWorker handles the rest
        db.uploadQueueDao().insert(
            UploadQueueEntry(
                localUri = uri.toString(),
                fileName = fileName,
                mimeType = mimeType,
                size = size,
                folderId = folderId,
                status = UploadStatus.PENDING,
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis()
            )
        )
        UploadQueueWorker.enqueue(applicationContext)
    }

    suspend fun renameFile(id: String, name: String) {
        // Optimistic local update
        dao.updateName(id, name)
        try {
            api.updateFile(id, UpdateFileRequest(name = name))
        } catch (e: Exception) {
            // Rollback
            dao.revertName(id)
            throw e
        }
    }

    // ... toggleStar, trash, restore, move, delete
}
```

### 8.5 Compose UI Skeleton

```kotlin
// ui/auth/AuthScreen.kt
@Composable
fun AuthScreen(
    onSignedIn: (SignInResponseDto) -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        BrandLogo(size = 96.dp)

        Spacer(modifier = Modifier.height(32.dp))

        when (state.stage) {
            AuthStage.PHONE -> PhoneInputStage(
                phone = state.phone,
                onPhoneChange = viewModel::setPhone,
                onSubmit = viewModel::sendCode
            )
            AuthStage.CODE -> CodeInputStage(
                onCodeChange = viewModel::setCode,
                onSubmit = viewModel::signIn,
                onResend = viewModel::sendCode
            )
            AuthStage.PASSWORD_2FA -> PasswordInputStage(
                onSubmit = viewModel::signInWithPassword
            )
            AuthStage.LOADING -> CircularProgressIndicator()
            AuthStage.ERROR -> Text(
                state.error ?: "Unknown error",
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
```

### 8.6 AndroidManifest.xml

Key entries:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Foreground service for downloads -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Biometric -->
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <!-- Camera (optional v2) -->
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:name=".TriveApplication"
        android:label="TriVE"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/Theme.Trive"
        android:allowBackup="false"
        android:fullBackupContent="false"
        android:dataExtractionRules="@xml/data_extraction_rules">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Trive.Splash">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Deep links: trive://share/<token> -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="trive" android:host="share" />
            </intent-filter>

            <!-- Receive shares from other apps -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="*/*" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="*/*" />
            </intent-filter>
        </activity>

        <!-- FileProvider for opening downloaded files -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

### 8.7 Build Configuration

```kotlin
// app/build.gradle.kts
android {
    namespace = "com.tect0nic.trive"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tect0nic.trive"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Backend URL — overridden in debug vs release builds
        buildConfigField("String", "BACKEND_URL", "\"https://trive.example.com\"")
    }

    buildTypes {
        debug {
            buildConfigField("String", "BACKEND_URL", "\"http://10.0.2.2:3000\"")
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }
}
```

---

## 9. Build Roadmap — Phases & Milestones

This is the recommended build order. Each phase is independently shippable to internal testers.

### Phase 0 — Bootstrap (1 day)

**Goal:** Empty Compose app boots and talks to the backend.

- [ ] Android Studio project created
- [ ] Hilt, Room, OkHttp, Retrofit, WorkManager, Compose BOM added
- [ ] `TriveApplication` annotated with `@HiltAndroidApp`
- [ ] `MainActivity` with `@AndroidEntryPoint`
- [ ] `OkHttpClient` with cookie jar configured
- [ ] `BuildConfig.BACKEND_URL` set to `http://10.0.2.2:3000` for debug
- [ ] A "ping" button that calls `GET /api/auth/me` and displays the raw JSON
- [ ] Backend running on host machine, accessible from emulator

**Exit criteria:** Tap ping → see `null` (not logged in) JSON on screen.

### Phase 1 — Auth Flow (3 days)

**Goal:** User can log in with phone + OTP + optional 2FA.

- [ ] `AuthViewModel` with stage state machine (PHONE → CODE → PASSWORD_2FA → SUCCESS)
- [ ] `AuthScreen` Compose UI matching the web's `auth-flow.tsx`
- [ ] POST `/api/auth/send-code` + POST `/api/auth/sign-in` wired up
- [ ] Cookies persisted in `EncryptedSharedPreferences` via `PersistentCookieJar`
- [ ] On success: navigate to dashboard (or vault setup if `needsVault`)
- [ ] Handle flood-wait errors with countdown timer
- [ ] Handle 2FA password stage

**Exit criteria:** User can log in once and stay logged in across app restarts.

### Phase 2 — File Browser (5 days)

**Goal:** User can see, search, sort, star, and trash files.

- [ ] Room database with `FileEntity`, `FolderEntity`
- [ ] `FileRepository` with optimistic-update pattern
- [ ] `IndexSyncWorker` periodic sync
- [ ] `DashboardScreen` with sidebar nav (My Files, Recent, Starred, Trash)
- [ ] `FileExplorerScreen` with grid/list toggle
- [ ] `FileCard` Composable with thumbnail (Coil)
- [ ] `FileRow` Composable for list view
- [ ] Topbar with search, sort, view-toggle
- [ ] Long-press multi-select with `SelectionActionBar`
- [ ] Star/unstar, rename, trash, move operations
- [ ] Folder navigation with breadcrumbs

**Exit criteria:** App opens to populated file list within 100 ms; background sync keeps it fresh.

### Phase 3 — Upload & Download (5 days)

**Goal:** User can upload from in-app picker + share sheet, and download/view files.

- [ ] `UploadQueueWorker` with WorkManager
- [ ] Upload queue UI (floating panel with progress, retry, cancel)
- [ ] Receive `ACTION_SEND` intent from other apps
- [ ] File picker (`ActivityResultContracts.GetContent` / `OpenDocument`)
- [ ] Multi-file picker
- [ ] Progress reporting via `WorkInfo.progress`
- [ ] `DownloadWorker` (foreground service for large files)
- [ ] `FileProvider` configured for opening downloaded files
- [ ] In-app viewers: PDF (`PdfRenderer`), image (Coil), text, audio (`MediaPlayer`), video (`ExoPlayer`)
- [ ] Code viewer (Prism4j or Markwon + syntax extension)

**Exit criteria:** User can upload a 100 MB file and a 1 GB file via share-sheet, see progress, and view both after upload.

### Phase 4 — Share Management (3 days)

**Goal:** User can create, list, and revoke share links.

- [ ] `ShareDialog` Compose `ModalBottomSheet` with all options (password, expiry, view-only, max downloads, max views, email gate, allowed emails, custom slug)
- [ ] Real-time slug availability check (`/api/share/check-slug`)
- [ ] Batch share creation (`/api/share/batch`)
- [ ] `SharedLinksScreen` listing all shares with stats (downloads, views, last accessed)
- [ ] Revoke share (DELETE)
- [ ] Copy share URL to clipboard
- [ ] Share via Android share-sheet (send link to other apps)

**Exit criteria:** User can create a share link with all gates configured and copy/share the URL.

### Phase 5 — Public Share Viewer (2 days)

**Goal:** Recipient can open a share link in the app (via deep link).

- [ ] Deep link handler for `trive://share/<token>` and `trive://share/<username>/<slug>`
- [ ] `PublicShareScreen` with gate handling (password input, email input)
- [ ] Inline preview for view-only shares
- [ ] Download button (calls `/api/share/[id]/download`)
- [ ] Folder share: tree view + per-file download
- [ ] Batch share: list view + per-file download + "Download all" ZIP

**Exit criteria:** Recipient with the app installed can tap a share link and access the file without leaving the app.

### Phase 6 — Polish & Hardening (3 days)

**Goal:** Production-ready v1.

- [ ] Biometric unlock gate
- [ ] Settings screen (sync settings, account, delete account with confirmation)
- [ ] Storage analytics screen (with Vico charts)
- [ ] Activity log screen
- [ ] Pull-to-refresh
- [ ] Empty states for all screens
- [ ] Error states with retry
- [ ] Loading skeletons
- [ ] Light/dark theme support
- [ ] Safe-area insets for notches
- [ ] Splash screen (Android 12+ SplashScreen API)
- [ ] App icon set (192, 512, maskable, adaptive)
- [ ] ProGuard rules verified (release build works)
- [ ] Sign release build with upload key
- [ ] Upload to Google Play internal testing track

**Exit criteria:** Internal testers can install via Play Store internal track and use the app for daily file management.

### Phase 7 — Optional Nice-to-Haves (Defer to v2)

- Camera capture upload
- Auto-upload from gallery (Google Photos replacement)
- Storage Access Framework integration (`DocumentsProvider`)
- Admin panel (hidden `/?admin=1` features)
- Multi-account support
- True client-side zero-knowledge encryption (requires backend changes)
- Bulk file selection across folders
- Drag-and-drop reordering
- Material You dynamic color

### Estimated Total Timeline

| Phase | Days | Cumulative |
|---|---|---|
| 0 Bootstrap | 1 | 1 |
| 1 Auth | 3 | 4 |
| 2 File Browser | 5 | 9 |
| 3 Upload/Download | 5 | 14 |
| 4 Share Management | 3 | 17 |
| 5 Public Share Viewer | 2 | 19 |
| 6 Polish | 3 | 22 |

**~22 working days** for a senior Android developer. Double that for a junior or for an AI agent doing iterative development with manual testing.

---

## 10. Security Model & Threat Surface

### 10.1 Trust Boundaries

```
┌──────────────────────────────────────────────────────────┐
│  Fully trusted (you control)                              │
│  - Android device (encrypted at rest by Android)          │
│  - EncryptedSharedPreferences (Tink-wrapped AES-256-GCM)  │
│  - OkHttp cookie jar (in EncryptedSharedPreferences)       │
│  - TriVE backend (Next.js server + SQLite + APP_SECRET)   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Trusted for transport, NOT for storage                   │
│  - HTTPS in transit (TLS 1.2+)                            │
│  - Telegram MTProto (server sees only ciphertext)         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Not trusted                                              │
│  - Other apps on the device                              │
│  - Network observers (ISP, Wi-Fi snoops)                 │
│  - The TriVE operator's hosting provider                 │
│  - Telegram itself (only sees encrypted file bytes)      │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Android-Specific Threats

| Threat | Mitigation |
|---|---|
| Session cookie stolen via root / backup | `allowBackup="false"`, `fullBackupContent="false"`, `dataExtractionRules` excludes everything; EncryptedSharedPreferences requires Android keystore |
| App poisoned via Share intent | Validate the incoming URI's MIME type and size before queuing upload |
| MITM during dev (10.0.2.2) | Use `network_security_config.xml` to allow cleartext to `10.0.2.2` only in debug builds |
| Foreground service killed | Use `WorkManager` (not raw Service) — it survives process death |
| Notification permission missing (Android 13+) | Request `POST_NOTIFICATIONS` on first download, with rationale |
| Biometric bypass via adb | `BiometricPrompt` with `BIOMETRIC_STRONG` only; fall back to "Sign out" if user cancels |
| Screen recording of sensitive content | `FLAG_SECURE` on activities showing file previews |
| Account takeover if device lost | Remote wipe via Google "Find My Device" — also expose a "Sign out all devices" endpoint in a future backend version |

### 10.3 Network Security Config

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

### 10.4 Backend Security Caveats (Inherited)

The Android app inherits all of the backend's existing security caveats. **You do not need to fix these for Android v1**, but you should be aware of them. See `docs/VULNERABILITIES.md` for the full list.

The most impactful ones:

1. **C-2: Weak APP_SECRET fallback** — if `.env` gets wiped, the backend falls back to a known constant. Anyone can forge sessions. The Android app cannot fix this; the backend deployment script (`restore-env.sh`) must enforce a strong APP_SECRET.
2. **C-3: False zero-knowledge claim** — the server can decrypt all files. Android v1 inherits this limitation.
3. **C-5: Passwords in URL params** — public-share passwords are sent as `?password=`. The Android app will follow the same convention for v1. Migrate to headers in a future backend release.
4. **C-1: Open SSRF via Caddy XTransformPort** — affects production deployment, not the Android app.

### 10.5 Secrets Handling

- The Android app **must not** contain any server-side secrets (APP_SECRET, ADMIN_PASSWORD, TELEGRAM_API_HASH). These live only on the server.
- The Android app contains `BuildConfig.BACKEND_URL` only — which is public information (the URL of your deployed backend).
- The OkHttp cookie jar in EncryptedSharedPreferences is the only secret stored on-device.

---

## 11. Testing, QA & Release Strategy

### 11.1 Test Pyramid

| Layer | Tool | Coverage Target |
|---|---|---|
| Unit tests | JUnit5 + MockK | Repositories, ViewModels, Mappers — 80% |
| Integration tests | Robolectric | Room DAOs, WorkManager workers — 50% |
| UI tests | Compose UI Test + Hilt | Critical flows only (login, upload, share) |
| E2E tests | Manual + Firebase Test Lab | Smoke test before each release |

**Note:** The web app's docs explicitly say "do not write any test code" (see `docs/whatnottodo.md`). **This rule applies only to the web app, not to the Android app.** Android tests are encouraged.

### 11.2 Critical Path Smoke Test

Before each release, manually verify these flows:

1. Fresh install → log in with phone + OTP (no 2FA)
2. Log in with 2FA-enabled account
3. View file list → tap a file → preview opens
4. Upload a 1 MB image from in-app picker
5. Upload a 50 MB video via Android share sheet
6. Create a folder → upload a file into it
7. Star a file → see it in Starred
8. Trash a file → see it in Trash → restore → see it back in Files
9. Create a share link with password → copy URL → open in browser → enter password → download
10. Open a share link inside the app via deep link
11. Sign out → sign back in → session persists
12. Sign in on a fresh device install (delete app, reinstall) → vault scan auto-runs
13. Background the app during upload → upload continues (foreground service for >5MB)
14. Airplane mode during upload → upload pauses, resumes on reconnect
15. Kill the app, reboot device → upload queue resumes on next launch

### 11.3 Performance Budgets

| Metric | Budget |
|---|---|
| Cold start to dashboard | < 1.5 s on mid-range device (Pixel 4a) |
| File list refresh (network) | < 800 ms for 100 files |
| File list open (cached) | < 100 ms |
| Upload 100 MB on Wi-Fi | < 60 s |
| Memory usage idle | < 80 MB |
| Battery usage (15-min sync) | < 1% per hour |

### 11.4 Release Strategy

1. **Internal alpha** — developer + 2 testers, manual APK install.
2. **Internal testing track** (Google Play) — up to 100 testers.
3. **Closed testing** (Google Play) — opt-in link, up to 1000 testers.
4. **Open testing** (Google Play) — opt-in link, anyone.
5. **Production** — staged rollout: 10% → 50% → 100% over 7 days.

**Version naming:** `1.0.0` (semver) for v1; `1.0.1` for patch; `1.1.0` for minor; `2.0.0` for breaking.

### 11.5 Backend Deployment Considerations

The Android app makes assumptions about the backend deployment:

1. **Long-running Node process** — not serverless. The Next.js standalone server (`bun .next/standalone/server.js`) must run on a host that doesn't impose 5-min timeouts. Suitable hosts: Railway, Fly.io, a VPS (DigitalOcean Droplet, Hetzner). Not suitable: Vercel free tier, Cloudflare Workers.
2. **HTTPS with valid cert** — required for Android Pie+ (cleartext traffic blocked by default). Use Caddy (already configured in the project, see `Caddyfile`) for automatic Let's Encrypt.
3. **Domain ownership** — Android deep links require `assetlinks.json` at `https://<domain>/.well-known/assetlinks.json` for App Links verification. Without it, the deep link still works but shows an app-chooser dialog instead of opening directly.
4. **Persistent SQLite** — the DB file at `/home/z/my-project/trive/db/custom.db` must survive deploys. If deploying to a serverless host, this is a problem — use a persistent volume.
5. **Sticky sessions** — not required (sessions are stateless JWT-style HMAC cookies), but useful for in-memory GramJS client cache warmth.

---

## 12. Appendices

### Appendix A — Backend File Inventory

For the Android developer, here's where to look in the web backend for any feature:

| Feature | Backend File |
|---|---|
| Auth routes | `src/app/api/auth/*` (4 routes) |
| Telegram vault routes | `src/app/api/telegram/*` (4 routes) |
| Folder routes | `src/app/api/folders/*` (4 routes) |
| File routes | `src/app/api/files/*` (4 routes) |
| Share routes | `src/app/api/share/*` (6 routes) |
| Storage + Activity + Settings | `src/app/api/storage/`, `activity/`, `settings/` (3 routes) |
| Admin routes | `src/app/api/admin/*` (12 routes — defer to Android v2) |
| Auth session | `src/lib/session.ts` |
| Crypto helpers | `src/lib/crypto.ts` |
| File pipeline (upload/download/scan/zip) | `src/lib/file-ops.ts` (1059 lines) |
| Telegram MTProto client | `src/lib/telegram-service.ts` |
| Erasure coding | `src/lib/erasure-coding.ts` |
| Share resolver | `src/lib/share-resolve.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Shared types | `src/lib/types.ts` |
| Client API helper (reference impl) | `src/lib/api.ts` |

### Appendix B — Backend Environment Variables

The Android developer doesn't need to set these, but should know they exist:

```env
DATABASE_URL=file:/home/z/my-project/trive/db/custom.db
TELEGRAM_API_ID=35740212
TELEGRAM_API_HASH=f70f925ef1d4b78d2ca58065575b5b26
APP_SECRET=trive-prod-secret-change-me-2026
ADMIN_PASSWORD=trive-admin-2026-tectonic
NEXT_PUBLIC_APP_NAME=TriVE
```

If `.env` is wiped (which happens on sandbox filesystem resets), run `bash restore-env.sh` from the project root.

### Appendix C — Brand Identity Reference

Match these on Android:

| Element | Color | Usage |
|---|---|---|
| Navy | `#1c3f81` | Primary brand, gradient start |
| Blue | `#1e84c6` | Accent, buttons, links |
| Cyan | `#1a8aae` | Gradient end, highlights |
| Background (light) | `#ebeff2` | Light mode background |
| Foreground (light) | `#203240` | Light mode text |
| Background (dark) | `#0c1929` | Dark mode background |
| Foreground (dark) | `#e8eef4` | Dark mode text |

Brand gradient: `linear-gradient(135deg, #1c3f81, #1e84c6, #1a8aae)`

**Forbidden colors:** indigo, purple (per `docs/whatnottodo.md`).

Typography (recommend Inter or system font for performance):
- Display / headings: Inter SemiBold 24-32 sp
- Body: Inter Regular 14-16 sp
- Caption: Inter Regular 12 sp

### Appendix D — Glossary

| Term | Definition |
|---|---|
| Vault | A private Telegram broadcast channel where encrypted file chunks are stored |
| Vault scan | Reading all manifest messages from the vault channel and rebuilding the local DB index |
| Manifest | A JSON text message posted to the vault channel containing file metadata + chunk map |
| Chunk | A 20 MB slice of a file, encrypted independently with its own IV |
| Erasure coding | Reed-Solomon GF(2^8) redundancy — adds parity shards so files survive Telegram message loss |
| Dedup | Reusing existing Telegram message IDs when an uploaded chunk's SHA-256 matches an existing one |
| Share link | A URL pointing to a file/folder/batch with optional gates (password, expiry, etc.) |
| Custom slug | A human-readable share URL segment (e.g., `q4-report`) — unique per user, not globally |
| Email gate | Requiring an email address (optionally allowlisted) to access a share |
| View-only | A share that allows inline preview but blocks download (best-effort — see §10.4) |
| Batch share | A single share link containing multiple files and/or folders |
| MTProto | Telegram's mobile protocol, used by GramJS for real Telegram communication |
| StringSession | A GramJS session token representing an authenticated Telegram connection |
| tc_session | The HMAC-signed cookie name used by TriVE for user auth |
| tc_admin | The HMAC-signed cookie name used by TriVE for admin auth (7-day expiry) |

### Appendix E — Quick-Start Checklist for an AI Taking Over

If you are an AI agent picking up this Android project, follow this exact order:

1. **Read the web backend's** `README.md`, `docs/architecture.md`, `docs/whatnottodo.md`, and `docs/mechanism.md`. These define the contracts you'll be calling.
2. **Start the web backend** in another terminal: `cd /home/z/my-project/trive && bun install && bun run dev`. Verify `http://localhost:3000` returns HTTP 200.
3. **Start an Android emulator** (Pixel 7 API 34 recommended). Verify it can reach `http://10.0.2.2:3000`.
4. **Bootstrap the Android project** per §8.1.
5. **Implement Phase 0** (bootstrap) — exit when the ping button works.
6. **Implement Phase 1** (auth) — exit when login persists across app restarts.
7. **Implement Phase 2** (file browser) — exit when you can list files in grid view.
8. **Implement Phase 3** (upload/download) — exit when share-sheet upload + file preview works.
9. **Implement Phase 4** (share management) — exit when you can create a share link with all options.
10. **Implement Phase 5** (public share viewer) — exit when deep links open share links in-app.
11. **Implement Phase 6** (polish) — exit when biometric unlock, settings, and storage analytics work.
12. **Run the smoke test** in §11.2.
13. **Append to** `/home/z/my-project/trive/worklog.md` per the existing convention (never overwrite).

**Critical pitfalls to avoid:**

- ❌ Do **not** attempt to encrypt files on Android. The server encrypts.
- ❌ Do **not** attempt to call Telegram MTProto from Android. The server proxies.
- ❌ Do **not** store the user's Telegram StringSession on Android. The server stores it encrypted.
- ❌ Do **not** trust the `viewOnly` flag as a security boundary. It blocks the download button but not `?inline=1` URL access.
- ❌ Do **not** make absolute URL requests with ports in the web app's API routes (irrelevant to Android, but worth knowing).
- ✅ Do **reuse the same OkHttp client + cookie jar across all API calls** — the cookie jar is the entire auth story.
- ✅ Do **persist cookies in EncryptedSharedPreferences**, never in plain `SharedPreferences`.
- ✅ Do **use WorkManager for all background work** — raw `Service` will be killed by the OS.
- ✅ Do **match the web's UX flow labels** — users moving between web and Android expect consistency.

### Appendix F — Open Questions / Decisions Deferred

These should be resolved with the product owner before Phase 4:

1. **Push notifications** — do we need FCM for "new share created" or "vault scan complete"? Likely yes for v2.
2. **Offline mode depth** — should the app support viewing downloaded files offline, or just queued uploads? Recommendation: support viewing downloaded files (cache them in app-private storage with a TTL).
3. **Multi-account** — can a user log in with multiple Telegram accounts simultaneously? Recommendation: no, single-account only for v1 (matches web).
4. **Material You dynamic color** — adopt the system's color palette, or stick with the strict TriVE brand colors? Recommendation: brand colors only for v1, dynamic color as an opt-in setting in v2.
5. **Tablet support** — should the UI adapt to large screens? Recommendation: yes, but adaptive layouts can come in v2; for v1 use the phone layout stretched.
6. **iOS port** — defer indefinitely. The web PWA covers iOS sufficiently for now.
7. **Public share viewer for non-users** — should the app handle `trive://share/...` deep links even when the user is not logged in? Recommendation: yes — the public share endpoints don't require auth.

---

**Document version:** 1.0 · 2026-07-25
**Source project:** TriVE web (`/home/z/my-project/trive/`)
**Built by:** Tectonic · © 2026
