# TriVE — Project Instructions & Architecture

This file contains foundational mandates for the TriVE project. Detailed specifications are in `docs/TRIVE_AI_MASTER_SPEC.md`.

## Core Mandates

### 1. Zero-Knowledge Encryption
- **Client-Side/Per-Chunk:** All files MUST be encrypted with AES-256-GCM before being sent to any storage backend (Telegram).
- **Per-Chunk IVs:** Each chunk must have its own random IV to enable streaming decryption (`FileChunk.encIv`).
- **Master Key:** The master encryption key is derived from the user's password/secret (`scryptSync(APP_SECRET, userSalt, 32)`); never store plaintext keys in the database.
- **CRITICAL TRUNCATION RULE:** ALWAYS truncate the encrypted chunk buffer to exact `plainSize + 16` before passing to `decryptBuffer`.

### 2. Telegram as Storage Engine
- **MTProto only:** Use GramJS for direct MTProto communication.
- **Vault Channel:** All files are stored in a private channel named `TriVE_Storage_Vault`.
- **Manifest-Based Persistence:** Every file and folder must have a JSON manifest posted to the vault to enable index rebuilding on any device via `scanVaultAndRebuild`.
- **Deletion Order:** Always delete the SQLite record first (cascade cleanup), then best-effort delete from Telegram.

### 3. Native Integration (WebDAV)
- **WebDAV Bridge:** The application exposes a WebDAV server at `/api/dav` (`src/app/api/dav/[[...path]]/route.ts`).
- **Supported Methods:** `PROPFIND`, `GET`, `PUT`, `MKCOL`, `DELETE`, `MOVE`, `OPTIONS`.
- **Authentication:** Supports Basic Auth using `phone:ADMIN_PASSWORD` or `telegramUsername:ADMIN_PASSWORD`.
- **Streaming:** WebDAV downloads and uploads must use the streaming engine (no full-file buffering).

### 4. Erasure Coding (Reed-Solomon GF(2⁸))
- Enabled when total data chunks $\ge 3$.
- **CRITICAL DECODE RULE:** Must invert the systematic GENERATOR matrix ($V \times \text{topInverse}$), NEVER raw Vandermonde.

### 5. Prisma Invariant
- `User.telegramUsername` is NOT `@unique`. NEVER call `db.user.findUnique({ where: { telegramUsername } })`. ALWAYS use `db.user.findFirst` or `findShare()`.

## Technical Architecture

### VFS (Virtual File System)
- Located in `src/lib/file-ops.ts`.
- Handles chunking, encryption, manifest posting, and vault scanning.
- Supports Reed-Solomon Erasure Coding for large files.

### WebDAV Server
- Located in `src/app/api/dav/[[...path]]/route.ts`.
- Lightweight implementation mapping standard WebDAV calls to the VFS engine.
- Uses `src/lib/webdav-utils.ts` for XML generation.

### Security & Sessions
- Session management in `src/lib/session.ts` uses device-binding and HMAC signing (`tc_session`).
- Admin panel is hidden (`/?admin=1`) and password-protected (`tc_admin`).

## Anti-Hallucination Guardrails (7 Inviolable Rules)
1. `findUnique` on `telegramUsername` $\rightarrow$ ALWAYS use `findFirst`.
2. Decryption without truncation $\rightarrow$ ALWAYS truncate buffer to `plainSize + 16`.
3. Raw Vandermonde in erasure decode $\rightarrow$ ALWAYS use systematic Generator matrix.
4. Flex modal without `min-h-0` $\rightarrow$ Footer gets clipped; use `min-h-0` and `flex-1`.
5. Swallowing errors in ZIP streaming $\rightarrow$ NEVER finalize empty archive; call `archive.destroy(err)`.
6. Deleting Telegram message before DB $\rightarrow$ ALWAYS delete SQLite row first, then Telegram.
7. Overwriting `worklog.md` $\rightarrow$ ALWAYS append (`>>`), never overwrite.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
