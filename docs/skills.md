# TriVE — Skills

> Capabilities the app provides (product skills) + skills required to develop it.

---

## 1. Product Capabilities (what TriVE can do)

### Core Storage
| Skill | Description |
|-------|-------------|
| **Encrypted file storage** | AES-256-GCM per-chunk encryption, stored in user's private Telegram channel |
| **Chunked upload** | Files split into 20MB chunks, each encrypted + uploaded independently |
| **Streaming download** | Parallel prefetch (3 chunks ahead), decrypt-on-fly, no buffering |
| **Erasure coding** | Reed-Solomon GF(2⁸) for files ≥60MB — survives missing/corrupt chunks |
| **Deduplication** | SHA-256 of encrypted bytes → skip re-upload of identical chunks (per-user) |
| **Folder hierarchy** | Tree-structured folders (self-ref `parentId`), starred, trashed |
| **Cross-device sync** | Manifest messages in vault → scan rebuilds index on new device |
| **Thumbnails** | Auto-generated for images (sharp, 320×320 JPEG) |

### File Viewing
| Skill | Formats |
|-------|---------|
| **Image viewer** | jpg, png, gif, webp, svg (zoom controls) |
| **Video player** | mp4, webm, mov (native HTML5) |
| **Audio player** | mp3, wav, ogg (native HTML5) |
| **PDF viewer** | react-pdf (page navigation) |
| **DOCX viewer** | mammoth.js (HTML render) |
| **Code viewer** | syntax highlighter (prism) |
| **Text/Markdown** | plain text + markdown render |
| **Blob URL preview** | prevents browser auto-download, enables inline embed |

### Sharing
| Skill | Description |
|-------|-------------|
| **Single file share** | One link → one file |
| **Folder share** | One link → browsable folder tree + ZIP download |
| **Batch share** | One link → multiple files + folders (unified view) |
| **Custom slug** | `/?share=username/my-report` (per-user, case-insensitive) |
| **Password gate** | scrypt-hashed password required to view |
| **Expiry** | Presets (1h, 1d, 7d, 30d, custom datetime) |
| **View limit** | Link dies after N views |
| **Download limit** | Downloads blocked after N pulls |
| **View-only** | Preview allowed, download blocked (UX hint, not security boundary) |
| **Email gate** | Require email to view; optional allowlist |
| **IP allowlist** | Restrict to specific networks |
| **Live delete detection** | 1.5s polling → instant "removed" state if owner deletes |
| **Cascade revoke** | File delete → all shares for it die instantly |

### Account
| Skill | Description |
|-------|-------------|
| **Telegram login** | Phone → code → (2FA password if set) → persistent session |
| **Vault auto-detect** | Finds existing `TriVE_Storage_Vault` channel on login |
| **Vault auto-create** | Creates the channel if not found |
| **Account deletion** | Cascading delete (files, folders, shares, activity, Telegram messages) |
| **Admin panel** | Hidden `/?admin=1` — view users, files, shares, DB stats, activity |

### PWA
| Skill | Description |
|-------|-------------|
| **Installable** | manifest + service worker + install overlay |
| **Standalone mode** | Skips landing, goes to auth in installed PWA |
| **Offline shell** | SW caches app shell (API is network-first) |

---

## 2. Development Skills (what you need to work on TriVE)

### Must-Have
| Skill | Level | Why |
|-------|-------|-----|
| **TypeScript** | Expert | Strict mode, generics, discriminated unions (ShareState, FetchState) |
| **Next.js 16 App Router** | Expert | RSC, route handlers, dynamic segments, proxy.ts middleware |
| **React 19** | Expert | Hooks, concurrent features, `use` hook, actions |
| **Tailwind CSS 4** | Expert | `@theme inline`, oklch colors, `@layer`, custom utilities |
| **Prisma ORM** | Advanced | Schema design, relations, cascade, BigInt, `db:push` |
| **Node `crypto`** | Advanced | AES-256-GCM, scrypt, HMAC, timingSafeEqual |
| **GramJS** | Advanced | StringSession, InputPeerChannel, sendFile, downloadMedia, getMessages |

### Should-Have
| Skill | Level | Why |
|-------|-------|-----|
| **Framer Motion** | Intermediate | Entrance, hover, AnimatePresence, layout animations |
| **Zustand** | Intermediate | Client state (auth, ui, nav, upload) |
| **TanStack Query** | Intermediate | Server state, cache invalidation, mutations |
| **shadcn/ui** | Intermediate | Component composition, className restyling |
| **Reed-Solomon / GF(2⁸)** | Intermediate | Erasure coding math (matrix ops, GF arithmetic) |
| **SQLite** | Intermediate | Prisma datasource, WAL mode, case-sensitivity |
| **Archiver (npm)** | Intermediate | ZipArchive → Readable.toWeb streaming |

### Nice-to-Have
| Skill | Why |
|-------|-----|
| **PWA / Service Workers** | manifest, sw.js, install prompt, standalone mode |
| **MTProto protocol** | Understanding Telegram's transport layer |
| **Caddy** | Reverse proxy, XTransformPort, TLS |
| **Web Accessibility (WCAG 2.2)** | aria-labels, focus rings, 44px touch targets |
| **Web Crypto API** | For future client-side zero-knowledge encryption |

---

## 3. Z.ai SDK Skills (available in this environment)

These skills are available via the `Skill` tool and can be integrated into TriVE:

| Skill | Purpose | TriVE integration potential |
|-------|---------|-----------------------------|
| **LLM** | Text generation, chatbot | AI-powered file search, smart folder naming |
| **VLM** | Image understanding | Auto-tagging uploaded images, alt-text generation |
| **TTS** | Text-to-speech | Read-aloud for text/Markdown files |
| **ASR** | Speech-to-text | Transcribe audio files |
| **Image-Generation** | AI image creation | Generate thumbnails for non-image files |
| **Image-Search** | Web image search | Find reference images |
| **Web-Search** | Real-time web search | Search documentation |
| **Web-Reader** | Web page extraction | Save web articles as files |
| **Video-Generation** | AI video creation | — |
| **PDF** | PDF creation/manipulation | Generate reports from file metadata |
| **PPTX** | Presentations | — |
| **XLSX** | Spreadsheets | Export analytics as Excel |
| **DOCX** | Word documents | — |
| **Charts** | Data visualization | Storage analytics charts |

### How to Use a Skill
1. Invoke `Skill(command="skill-name")` to load instructions
2. Read the SKILL.md for parameters + usage
3. Use `z-ai-web-dev-sdk` in a backend API route (NEVER client-side)
4. Call from the frontend via relative API path

---

## 4. Tooling Skills

| Tool | Purpose |
|------|---------|
| `bun run dev` | Start dev server (port 3000, Turbopack, HMR) |
| `bun run lint` | ESLint (must pass before any task is complete) |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run build` | Production build + standalone output |
| `agent-browser` | Headless browser for E2E verification |
| `sqlite3` (not installed) | Direct DB inspection (use Prisma Studio or bun script instead) |
