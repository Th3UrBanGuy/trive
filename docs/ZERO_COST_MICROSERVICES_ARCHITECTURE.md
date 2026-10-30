# TriVE $0 Zero-Cost Microservices Architecture & Native Drive Mount Guide

> **Target:** 100% Free Hosting across Specialized Platforms ($0/month, No VPS Required)  
> **Integrations:** Vercel (Frontend), Turso / Supabase (Database), Hugging Face / Koyeb (Streaming Engine), Telegram (Storage), Native OS (WebDAV / Rclone Mount).

---

## 1. Executive Concept: Why VPS is Unnecessary

Running a single VPS costs \$5 to \$20/month, requires Linux maintenance, and creates a single point of failure. 

By splitting TriVE into a **modern Decoupled Serverless / Microservices Mesh**, we leverage the highest free tiers across specialized cloud providers:
- **Frontend & Dashboard:** Vercel / Cloudflare Pages (Free, infinite scale edge CDN)
- **Database Index:** Turso (Free cloud SQLite / LibSQL, 9 GB, 1B reads/mo, zero sleep)
- **Telegram Streamer & WebDAV Gateway:** Hugging Face Docker Space (Free, 16 GB RAM, 2 vCPU, **Never Sleeps**)
- **Storage:** Telegram Cloud (`TriVE_Storage_Vault`, Unlimited, $0)

---

## 2. The $0 Multi-Cloud Microservices Blueprint

```
                     ┌──────────────────────────────────────────────┐
                     │          User Interface & Client              │
                     │  - Web Browser / PWA (Mobile/Desktop)        │
                     │  - Windows File Explorer / Mac Finder         │
                     │  - Mobile File Managers (Solid / CX)          │
                     └──────────────────────┬───────────────────────┘
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        ▼                                                                       ▼
[ Service A: Frontend CDN ]                                         [ Service B: WebDAV & MTProto Gateway ]
Platform: Vercel / Cloudflare Pages                                 Platform: Hugging Face Docker Space / Koyeb
Cost: $0 / month                                                    Cost: $0 / month (16 GB RAM, 2 vCPU, No Sleep)
Responsibilities:                                                   Responsibilities:
- Next.js 16 App Router UI                                          - WebDAV Server (/api/dav)
- Telegram Mini App (TMA) SSO                                       - GramJS MTProto Engine (TCP to Telegram)
- Bot Deep-Link Auth Handshake                                      - AES-256-GCM Streaming Encryption/Decryption
- File Previewers & Dashboards                                      - HTTP 206 Byte-Range Streaming
        │                                                                       │
        └───────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
                           [ Service C: Global Serverless Database ]
                           Platform: Turso (LibSQL Serverless SQLite)
                           Cost: $0 / month (9 GB storage, 1B reads/month)
                           Responsibilities:
                           - Users, Folders, Files, FileChunks, Shares
                           - Zero Cold-Start, Multi-Region Replicas
                           - 100% Native Prisma Compatibility
                                            │
                                            ▼
                           [ Storage Layer: Telegram DC Cloud ]
                           Platform: Telegram Cloud (TriVE_Storage_Vault)
                           Cost: $0 / month (Infinite capacity)
```

---

## 3. Platform Breakdown & Setup Instructions

### 3.1 Service A: Frontend UI (Vercel or Cloudflare Pages)
- **Role:** Delivers the Next.js React frontend, PWA service worker, and authenticated client dashboards.
- **Why Vercel:** Next.js is developed by Vercel; deployment takes 1 click via GitHub repository sync.
- **Cost:** \$0 (Vercel Hobby plan includes unlimited bandwidth, automatic SSL, and global edge caching).

### 3.2 Service B: Streaming & WebDAV Engine (Hugging Face Docker Space)
- **The Secret Weapon:** While Render and Fly.io sleep after 15 minutes on free tiers, **Hugging Face Spaces** provides **16 GB of RAM, 2 vCPUs, 50 GB disk, and DOES NOT SLEEP** on its standard free tier!
- **Role:** Handles persistent TCP connections to Telegram MTProto, high-throughput file chunk transfers, and continuous WebDAV sessions.
- **Deployment:** A single lightweight `Dockerfile` wrapping the Next.js/Node runtime or Bun gateway.

### 3.3 Service C: Database (Turso Serverless SQLite)
- **Role:** Cloud-hosted SQLite that never wipes, replacing local `db/custom.db`.
- **Why Turso:**
  - 100% SQLite compatible (uses LibSQL).
  - 9 GB free storage (enough for millions of file metadata records).
  - Supported directly by Prisma via `@prisma/adapter-libsql`.
  - Latency < 10ms with global edge replicas.

---

## 4. The "Google Drive / Nextcloud" Virtual Network Drive Mechanism

You asked: *How can we use TriVE as a virtual network drive in Windows Explorer or mobile phone without paying a penny?*

This is **WebDAV (Web Distributed Authoring and Versioning)**, which is already integrated into TriVE at `/api/dav/[[...path]]`.

### Method A: Windows Explorer (No Software Installation)
Windows has built-in WebDAV network drive mapping:
1. Open **File Explorer** $\rightarrow$ Click **This PC**.
2. Click **Computer** tab (or `...` menu) $\rightarrow$ Select **Map network drive**.
3. Choose a drive letter (e.g. `Z:` or `T:` for TriVE).
4. In the Folder field, enter:
   `https://<your-app-url>/api/dav`
5. Check **"Connect using different credentials"** $\rightarrow$ Click **Finish**.
6. Enter your TriVE Username (or phone) and Admin Password.
7. **Result:** A native network drive `T:\` appears in Windows Explorer. You can drag and drop files, open folders, and save directly from Word, Photoshop, or VS Code!

### Method B: RaiDrive or Rclone (High Performance with Virtual Caching)
For local drive experience with instant file caching (exactly like Google Drive for Desktop):
- **Using RaiDrive (Free for Windows):**
  1. Install RaiDrive.
  2. Click **Add** $\rightarrow$ Select **NAS / WebDAV**.
  3. Enter server: `<your-app-url>`, path: `/api/dav`.
  4. Select drive letter (e.g., `Z:`).
  5. RaiDrive mounts TriVE as a local hard disk with background chunk caching.
- **Using Rclone (Windows, macOS, Linux):**
  ```bash
  rclone mount trive: Z: --vfs-cache-mode full --vfs-read-chunk-size 20M
  ```

### Method C: macOS Finder
1. Open **Finder** $\rightarrow$ Press `Cmd + K` (Connect to Server).
2. Enter: `https://<your-app-url>/api/dav`.
3. Click **Connect** $\rightarrow$ Enter credentials.
4. TriVE mounts as a native volume on your Mac desktop and in Finder sidebar.

### Method D: Android & iOS Mobile
- Install **Solid Explorer**, **CX File Explorer**, or **Documents by Readdle**.
- Tap **Add Storage** $\rightarrow$ **WebDAV**.
- Enter URL `https://<your-app-url>/api/dav`, username, and password.
- Browse, stream videos, and upload photos directly from mobile phone without opening any browser!

---

## 5. Implementation Roadmap for $0 Setup

1. **Step 1: Database Migration to Turso:**
   - Configure `DATABASE_URL="libsql://your-db.turso.io"` and `TURSO_AUTH_TOKEN`.
   - Update `src/lib/db.ts` to use `@prisma/adapter-libsql`.
2. **Step 2: Deploy Streaming Backend to Hugging Face / Koyeb:**
   - Create Docker container for MTProto/WebDAV gateway.
3. **Step 3: Deploy Frontend to Vercel:**
   - Connect GitHub repo $\rightarrow$ Deploy Next.js 16 to Vercel with zero configuration.
4. **Step 4: Enable Network Drive Access:**
   - Test WebDAV connection from Windows, Mac, and Mobile.
