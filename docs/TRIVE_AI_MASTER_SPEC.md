# TriVE Master System Specification & AI Zero-Hallucination Manual

> **Purpose:** This document is the definitive single source of truth for AI agents and developers working on the TriVE codebase. It combines full architectural analysis with Graphify knowledge-graph mappings to ensure zero hallucination, fast navigation, and deterministic updates.

---

## 1. System Overview & Technology Stack

TriVE transforms a user's private Telegram channel (`TriVE_Storage_Vault`) into an encrypted, deduplicated, erasure-coded virtual file system (VFS).

- **Framework:** Next.js 16 (App Router, Single Page Application at `src/app/page.tsx`)
- **Runtime:** Node.js (strictly `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"` on API routes)
- **Database:** Prisma ORM + SQLite (`prisma/schema.prisma`, `db/custom.db`, client singleton at `src/lib/db.ts`)
- **Telegram MTProto Client:** GramJS (`telegram` v2.26.22) running in-process at `src/lib/telegram-service.ts`
- **Encryption:** Node.js `crypto` — AES-256-GCM, per-user `scryptSync`, per-chunk random IVs (`src/lib/crypto.ts`)
- **Erasure Coding:** Custom Reed-Solomon $GF(2^8)$ systematic generator matrix (`src/lib/erasure-coding.ts`)
- **WebDAV Bridge:** Native WebDAV server at `src/app/api/dav/[[...path]]/route.ts` using `src/lib/webdav-utils.ts`
- **State Management:** Zustand (`src/lib/store.ts`) for UI state; TanStack Query (`src/components/dashboard/query-provider.tsx`) for server state
- **Knowledge Graph:** Graphify AST engine (`graphify-out/graph.json`, `graphify-out/wiki/`)

---

## 2. Inviolable Core Mechanisms (Anti-Hallucination Invariants)

### 2.1 Zero-Knowledge Encryption Pipeline (`src/lib/crypto.ts`)
1. **Key Derivation:**
   ```ts
   // Derived per-user from server secret + user salt
   const key = crypto.scryptSync(process.env.APP_SECRET!, userSalt, 32)
   ```
   - `APP_SECRET`: Environment variable, minimum 32 random bytes.
   - `userSalt`: 16 random hex bytes stored in `User.encSalt`.
2. **Chunk Encryption:**
   - Algorithm: AES-256-GCM.
   - IV: 12 random bytes per chunk (`crypto.randomBytes(12)`), stored as base64 in `FileChunk.encIv`.
   - Structure: `[ciphertext (plainSize bytes) | authTag (16 bytes)]`.
3. **Chunk Decryption & Critical Truncation Rule:**
   - **MANDATORY:** Before calling `decryptBuffer`, ALWAYS truncate the input buffer to exact `plainSize + 16`:
   ```ts
   const expectedEncSize = plainSize + 16
   if (chunkBuf.length > expectedEncSize) {
     chunkBuf = chunkBuf.subarray(0, expectedEncSize)
   }
   const plain = decryptBuffer(chunkBuf, iv, userSalt)
   ```
   *Failure consequence:* GCM reads the last 16 bytes as auth tag; if padding exists (e.g. from erasure coding), decryption fails or returns corrupted bytes.
4. **Session String Encryption:**
   - MTProto `StringSession` strings are encrypted with AES-256-GCM using `sha256(APP_SECRET)`.
   - Storage format: `v1:<iv-b64>:<tag-b64>:<enc-b64>`.

---

### 2.2 Chunking & Virtual File System (`src/lib/file-ops.ts`)
- **Chunk Size:** `CHUNK_SIZE = 20 * 1024 * 1024` (20 MB).
- **Max File Size:** `MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024` (4 GB).
- **Upload Flow (`uploadFileToVault`):**
  1. Verify quota (`User.storageLimitBytes`).
  2. Split file buffer into 20 MB chunks.
  3. Encrypt each chunk independently with unique IV.
  4. Deduplication check: Query `FileChunk` by SHA-256 of encrypted bytes.
  5. Upload new chunks to `TriVE_Storage_Vault` via `telegramService.uploadChunk`.
  6. Compute & upload Reed-Solomon parity shards if $\ge 3$ data chunks.
  7. Insert `File` and `FileChunk` records in SQLite.
  8. Post JSON file manifest to Telegram vault and update `File.manifestMessageId`.
- **Download Flow (`streamFileFromVault`):**
  - Returns `ReadableStream<Uint8Array>`.
  - Prefetches 3 chunks ahead in parallel.
  - Verifies chunk checksum, truncates to `plainSize + 16`, decrypts, and enqueues.

---

### 2.3 Reed-Solomon Erasure Coding (`src/lib/erasure-coding.ts`)
- **Trigger:** When file has $\ge 3$ data chunks ($\ge 60$ MB).
- **Parity Calculation:** `numParity = Math.max(2, Math.ceil(totalChunks * 0.5))` (~50% redundancy).
- **Field:** Galois Field $GF(2^8)$ with primitive polynomial `0x11d` ($x^8 + x^4 + x^3 + x^2 + 1$).
- **Encoding:** Systematic generator matrix $G = V \times (V_{0..N-1})^{-1}$ where $V$ is Vandermonde.
- **CRITICAL DECODING INVARIANT:**
  - Decoding **MUST invert the Generator matrix** ($G$), NEVER the raw Vandermonde matrix:
  ```ts
  const vdm = vandermonde(totalShards, dataShards)
  const topInverse = matrixInverse(vdm.slice(0, dataShards))
  const generatorMatrix = matrixMul(vdm, topInverse)
  const subMatrix = useIndices.map(i => generatorMatrix[i]) // CORRECT
  const decodeMatrix = matrixInverse(subMatrix)
  ```

---

### 2.4 Telegram MTProto Engine (`src/lib/telegram-service.ts`)
- Direct MTProto communication via GramJS over TCP (bypassing HTTP gateways).
- Single private broadcast channel per user: `TriVE_Storage_Vault`.
- Channel addressing uses direct `InputPeerChannel(channelId, accessHash)` without extra lookups.
- **Manifest Persistence:**
  - File manifest: JSON text containing `{ type: "trive-manifest", version: 1, fileId, name, mimeType, size, chunks: [...] }`.
  - Folder manifest: JSON text containing `{ type: "trive-folder-manifest", version: 1, folderId, name, parentId, ... }`.
  - Cross-device sync: `scanVaultAndRebuild(userId)` pages through vault messages (100/batch) and re-creates missing database rows.

---

### 2.5 WebDAV Bridge (`src/app/api/dav/[[...path]]/route.ts`)
- Route: Catch-all `[[...path]]` supporting root (`/api/dav`) and nested resources (`/api/dav/Documents/file.pdf`).
- Authentication:
  - Session cookie (`tc_session`) OR HTTP Basic Auth (`username:ADMIN_PASSWORD` or `phone:ADMIN_PASSWORD`).
- Supported HTTP Methods:
  - `OPTIONS`: WebDAV headers (`DAV: 1, 2`).
  - `PROPFIND`: XML directory tree generation (`D:multistatus`) using `src/lib/webdav-utils.ts`.
  - `GET`: Streaming file download via `streamFileFromVault`.
  - `PUT`: Streaming file upload via `uploadFileToVault`.
  - `MKCOL`: Folder creation.
  - `DELETE`: File or folder deletion (via `deleteFileFromVault`).
  - `MOVE`: Renaming or moving items across folders.

---

### 2.6 Share Resolution (`src/lib/share-resolve.ts`)
- Supported URL patterns:
  - `/?share=<username>/<slug>` (primary scoped pattern)
  - `/?share=<username>/<token>`
  - `/?share=<slug>` or `/?share=<token>` (backward compatibility)
- **CRITICAL PRISMA INVARIANT:**
  - `User.telegramUsername` is **NOT marked `@unique`** in SQLite schema.
  - **NEVER run:** `db.user.findUnique({ where: { telegramUsername } })` (throws runtime error).
  - **ALWAYS run:** `db.user.findFirst({ where: { telegramUsername: username.toLowerCase() } })` or use `findShare()` from `src/lib/share-resolve.ts`.

---

### 2.7 UI Architecture & Flexbox Layout Rule
- Single route: `src/app/page.tsx` dynamically renders Landing, Auth, Dashboard, or Public Share.
- **CRITICAL FLEXBOX RULE FOR MODALS & PANELS:**
  ```tsx
  // Pinned header + scrolling content + pinned footer
  <div className="flex flex-col max-h-[90vh] overflow-hidden">
    <div className="shrink-0">Header</div>
    <div className="flex-1 min-h-0 overflow-y-auto">Body</div>
    <div className="shrink-0">Footer</div>
  </div>
  ```
  *Without `min-h-0` and `flex-1`, flexbox children expand past container boundaries, clipping footers.*
- **Design Tokens:** Strictly navy, blue, cyan (`--brand-deep`, `--brand`, `--brand-cyan`). No purple or indigo.

---

## 3. Graphify Knowledge Graph Mapping

Graphify maintains a synchronized graph index at `graphify-out/`:
- **Nodes:** 1,679 | **Edges:** 3,494 | **Communities:** 115
- **Interactive Visualization:** `graphify-out/graph.html`
- **Community Wiki:** `graphify-out/wiki/index.md`

### Key Architectural Hubs (God Nodes)
1. `cn()` (`src/lib/utils.ts`) - 299 connections
2. `react` / `lucide-react` - UI component hubs
3. `requireUser()` (`src/lib/session.ts`) - API authentication hub
4. `db` (`src/lib/db.ts`) - Prisma database singleton
5. `formatBytes()`, `formatDate()` (`src/lib/file-utils.ts`)
6. `uploadFileToVault()`, `downloadFileFromVault()` (`src/lib/file-ops.ts`)
7. `telegramService` (`src/lib/telegram-service.ts`)

### Agent Graphify Operational Commands
When asked any question about TriVE or before making modifications:
```powershell
# 1. Query concepts and call flows
graphify query "How does upload chunking and encryption work?"

# 2. Check relationship path between two symbols
graphify path "uploadFileToVault" "telegramService"

# 3. Explain any node and its direct dependencies
graphify explain "streamFileFromVault"

# 4. Update knowledge graph after modifying code
graphify update .
```

---

## 4. The 7 Deadly Sins (Quick Reference)

1. **`findUnique` on `telegramUsername`** $\rightarrow$ ALWAYS use `findFirst`.
2. **Decryption without truncation** $\rightarrow$ ALWAYS truncate buffer to `plainSize + 16`.
3. **Raw Vandermonde in erasure decode** $\rightarrow$ ALWAYS use systematic Generator matrix.
4. **Flex modal without `min-h-0`** $\rightarrow$ Footer gets clipped off-screen.
5. **Swallowing errors in ZIP streaming** $\rightarrow$ NEVER finalize empty archive; call `archive.destroy(err)`.
6. **Deleting Telegram message before DB** $\rightarrow$ ALWAYS delete SQLite row first, then Telegram message.
7. **Overwriting `worklog.md`** $\rightarrow$ ALWAYS append (`>>`), never overwrite.
