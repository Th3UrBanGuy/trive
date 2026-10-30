# TriVE — Mechanism

> Deep technical documentation of every core mechanism: encryption, erasure
> coding, deduplication, chunking, share resolution, vault persistence.

---

## 1. Encryption Pipeline

### 1.1 Key Derivation

```
APP_SECRET (env, 32+ bytes random)
   │
   ▼
scryptSync(APP_SECRET, encSalt, 32)   ← encSalt = 16 random bytes (hex, per-user)
   │
   ▼
per-user AES-256 key (32 bytes)
```

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **IV**: 12 random bytes per chunk (`crypto.randomBytes(12)`)
- **Auth tag**: 16 bytes, appended to ciphertext: `[ciphertext | tag]`
- **Salt**: `crypto.randomBytes(16).toString("hex")` per user, stored as `User.encSalt`

### 1.2 Encrypt (per chunk)

```ts
function encryptBuffer(buf: Buffer, userSalt: string) {
  const key = scryptSync(APP_SECRET, userSalt, 32)
  const iv  = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const enc = concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()           // 16 bytes
  return { data: concat([enc, tag]), iv }   // [ciphertext | tag]
}
```

### 1.3 Decrypt (per chunk)

```ts
function decryptBuffer(data: Buffer, ivB64: string, userSalt: string) {
  const key  = scryptSync(APP_SECRET, userSalt, 32)
  const iv   = Buffer.from(ivB64, "base64")
  const tag  = data.subarray(data.length - 16)   // last 16 bytes
  const enc  = data.subarray(0, data.length - 16) // everything before
  const dec  = createDecipheriv("aes-256-gcm", key, iv)
  dec.setAuthTag(tag)
  return concat([dec.update(enc), dec.final()])
}
```

### 1.4 Critical Truncation Rule

> **GCM auth tag is the LAST 16 bytes.** If the buffer has trailing padding
> (erasure-coding zeros) or extra bytes, the tag position shifts and decryption
> produces garbage or fails auth.

**Before decrypting, ALWAYS truncate to exact encrypted size:**
```ts
const expectedEncSize = plainSize + 16   // ciphertext len = plaintext len, tag = 16
if (chunkBuf.length > expectedEncSize) {
  chunkBuf = chunkBuf.subarray(0, expectedEncSize)
}
```

This is applied in both `downloadFileFromVault` and `streamFileFromVault`.

### 1.5 Session String Encryption

MTProto `StringSession` strings are encrypted at rest with the same AES-256-GCM,
but keyed from `sha256(APP_SECRET)` (not per-user — the session belongs to the
server's Telegram client connection).

Format: `v1:<iv-b64>:<tag-b64>:<enc-b64>`

### 1.6 Password Hashing (share passwords + admin)

```ts
hashPassword(password)  →  "<salt-hex>:<scrypt-hex>"    // salt = 8 bytes
verifyPassword(password, stored)  →  timingSafeEqual
```

> ⚠️ scrypt uses Node defaults (`N=16384, r=8, p=1`). OWASP recommends
> `N=2^17`. Salt is only 8 bytes (64 bits). See `VULNERABILITIES.md` L-3, L-4.

---

## 2. Chunking

```
File (up to 4GB)
  │
  ├─ Chunk 0  [0      .. 20MB)
  ├─ Chunk 1  [20MB   .. 40MB)
  ├─ Chunk 2  [40MB   .. 60MB)
  ├─ ...
  └─ Chunk N-1 [remainder]

CHUNK_SIZE = 20 * 1024 * 1024   (20 MB)
MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024   (4 GB)
```

- Each chunk is encrypted **independently** with its own IV → enables streaming
  download (decrypt chunk N while chunk N+1 downloads).
- Per-chunk `plainSize` stored in DB → exact truncation on decrypt.
- Per-chunk `checksum` = SHA-256 of the **encrypted** bytes → integrity + dedup key.

---

## 3. Deduplication

Before uploading a chunk, query `FileChunk` for an existing row with the same
`checksum` (SHA-256 of encrypted bytes) for this user:

```
encrypted chunk → sha256 → checksum
   │
   ├─ exists in DB? → reuse telegramMessageId, mark chunk as deduped=true
   └─ not found?    → upload to Telegram, create FileChunk row
```

- **Scope**: per-user (not global). User A and User B with the same file both
  upload their own copies. This is intentional (privacy: no cross-user leakage).
- **Identical files**: if User A uploads the same file twice, every chunk is
  deduped → zero Telegram messages uploaded on the second copy.
- `File.dedupedChunks` count is displayed in the upload panel.

> ⚠️ Dedup is on **encrypted** bytes. Since the key is per-user (derived from
> APP_SECRET + salt), two users' encryptions of the same plaintext differ, so
> cross-user dedup never triggers. Within a user, identical plaintext →
> identical ciphertext only if IVs match (they don't — random per chunk).
> **In practice, dedup only hits when the exact same bytes are uploaded again
> AND the random IV happened to match** — which is vanishingly rare.
> The dedup is effectively dead code for random-IV encryption. See
> `VULNERABILITIES.md` for the dedup design flaw.

---

## 4. Erasure Coding (Reed-Solomon GF(2⁸))

### 4.1 When

Erasure coding is enabled when a file has **3+ data chunks** (≥ 60 MB):

```ts
const useErasure = totalChunks >= 3
const numParity  = useErasure ? Math.max(2, Math.ceil(totalChunks * 0.5)) : 0
```

- 3 data → 2 parity (5 total, 150% overhead)
- 4 data → 2 parity
- 5 data → 3 parity
- 8 data → 4 parity
- Targets ~50% parity overhead (so any ~⅔ of shards can reconstruct)

### 4.2 Encode

```
dataShards = [encrypted_chunk_0, encrypted_chunk_1, ..., encrypted_chunk_N-1]
   │
   ├─ pad each to shardSize (max chunk length) with zeros
   ├─ concatenate → single buffer (shardSize × N bytes)
   │
   ▼
erasure.encode(buffer, N, M)
   │
   ├─ split buffer into N data shards (shardSize each)
   ├─ build Vandermonde matrix V (totalShards × N)
   ├─ topMatrix = V[0..N-1]   (N×N)
   ├─ topInverse = matrixInverse(topMatrix)   (over GF(2⁸))
   ├─ generatorMatrix = V × topInverse        (totalShards × N)
   │   → top N rows = identity (systematic)
   │   → bottom M rows = parity coding rows
   ├─ for each parity row p:
   │     parityShard[byteIdx] = XOR of gfMul(row[d], dataShard[d][byteIdx]) for all d
   └─ return [...dataShards, ...parityShards]
```

Parity shards are uploaded as `FileChunk` rows with `isParity: true`.

### 4.3 Decode (reconstruct missing shard)

```
shards = [d0, null, d2, p0, p1]   // d1 is missing
   │
   ├─ collect available indices + shards
   ├─ take first N available
   ├─ build subMatrix from GENERATOR matrix (NOT raw Vandermonde — this was the bug)
   │     subMatrix[i] = generatorMatrix[availableIndices[i]]
   ├─ decodeMatrix = matrixInverse(subMatrix)
   ├─ for each data shard d to reconstruct:
   │     result[byteIdx] = XOR of gfMul(decodeMatrix[d][s], useShards[s][byteIdx])
   └─ return reconstructed (trim to originalLength)
```

> ⚠️ **The decode function previously used the raw Vandermonde matrix instead of
> the generator matrix** — this produced completely wrong reconstructed data.
> Fixed in Task 5. See `worklog.md` Task 5.

### 4.4 GF(2⁸) Arithmetic

- Primitive polynomial: `0x11d` (x⁸ + x⁴ + x³ + x² + 1)
- Exp/log tables built once at module load
- `gfMul(a, b) = exp[log[a] + log[b]]`
- `gfDiv(a, b) = exp[(log[a] - log[b] + 255) % 255]`
- `gfInv(a)    = exp[255 - log[a]]`

---

## 5. Vault Persistence (Cross-Device)

### 5.1 The Problem

Files are stored as Telegram messages, but the DB (file names, folder structure,
chunk→message map) is local to each device. Log in from a new device → DB is
empty → files appear lost.

### 5.2 Solution: Manifests

Every file gets a **manifest message** posted to the vault as a JSON text message:

```json
{
  "type": "trive-manifest",
  "version": 1,
  "fileId": "cmrz...",
  "name": "report.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "chunkSize": 20971520,
  "totalChunks": 8,
  "checksum": "sha256-of-plaintext",
  "encIv": "base64...",
  "dataShards": 5,
  "parityShards": 3,
  "chunks": [
    { "index": 0, "telegramMessageId": "123", "encIv": "...", "plainSize": 20971520, "isParity": false },
    ...
  ]
}
```

Folders get their own manifest (name, parentId, color, icon).

### 5.3 Scan & Rebuild

`scanVaultAndRebuild(userId)`:
1. Page through ALL vault messages (100/page via `offsetId`)
2. Parse each as JSON manifest
3. Dedup by `manifestMessageId` (skip if already in DB)
4. For file manifests: create `File` + `FileChunk` rows
5. For folder manifests: create `Folder` rows
6. Return `{ scanned, added, skipped, errors }`

Triggered automatically on first login (when DB is empty + vault exists).

> ⚠️ Concurrent scans can produce duplicate rows. See `VULNERABILITIES.md` W-1.

---

## 6. Share Resolution

### 6.1 URL Formats

```
/?share=<slug>                ← legacy global lookup (backward compat)
/?share=<token>               ← legacy global lookup
/?share=<username>/<slug>     ← username-scoped (preferred)
/?share=<username>/<token>    ← username-scoped
```

### 6.2 Resolution Algorithm (`share-resolve.ts`)

```
findShare(key):
  if key contains "/":
    [username, slugOrToken] = key.split("/")
    username = username.toLowerCase()

    # telegramUsername is NOT @unique, so we MUST use findFirst (not findUnique)
    user = db.user.findFirst({ telegramUsername: username })

    # Fallback: JS case-insensitive scan (handles legacy mixed-case rows)
    if !user:
      candidates = db.user.findMany({ telegramUsername: { not: null } })
      user = candidates.find(c => c.telegramUsername.toLowerCase() === username)

    if !user: return null

    # Try customSlug first (lowercased), then token (verbatim)
    return db.shareLink.findFirst({ customSlug: slugOrToken.toLowerCase(), userId: user.id })
        || db.shareLink.findFirst({ token: slugOrToken, userId: user.id })

  # No slash — backward-compat global lookup
  return db.shareLink.findUnique({ customSlug: key.toLowerCase() })
      || db.shareLink.findUnique({ token: key })
```

### 6.3 Access Gates (in order)

1. **Trashed/deleted check** — if file/folder is trashed, share dies instantly
2. **Expiry** — `expiresAt < now` → terminal "expired" state
3. **View/download limits** — `viewCount >= maxViews` → terminal "exhausted"
4. **IP allowlist** — if set and current IP not in list → 403
5. **Password gate** — if set, require `?password=` (returns `needsPassword: true`)
6. **Email gate** — if set, require `?email=` (returns `needsEmail: true`)
7. **All passed** → increment `viewCount`, return item

### 6.4 Live Polling (instant delete detection)

The public share view polls `/api/share/public` every 1.5s. If the owner
deletes the file or revokes the share, the recipient sees the "removed" state
within 1.5s. Polling pauses when the tab is hidden (visibility API).

---

## 7. Download Streaming

### 7.1 Single File

`streamFileFromVault(fileId, userId)` returns a `ReadableStream<Uint8Array>`:
- Parallel prefetch: 3 chunks ahead (fetch chunk N while decrypting N-1)
- Each chunk: download → verify checksum → truncate to plainSize+16 → decrypt → enqueue
- No buffering — bytes flow to the client as they're decrypted

### 7.2 Folder / Batch ZIP

`streamFolderZipFromVault` / `streamBatchZipFromVault`:
1. Collect all (fileId, zipPath) pairs (standalone files + recursive folder tree)
2. Create `archiver` ZipArchive
3. `Readable.toWeb(archive)` → Web ReadableStream (returned immediately)
4. Async fill: for each file → `downloadFileFromVault` → `archive.append(buffer, { name })`
5. On all-done → `archive.finalize()`
6. On all-failed → `archive.destroy(error)` (no silent empty zip)

`downloadFileFromVault` handles erasure coding (data/parity separation, Reed-Solomon
reconstruction if shards missing), then truncates + decrypts + verifies file checksum.

---

## 8. Session Management

### 8.1 Session Cookie

```
createSession(userId, req):
  deviceFingerprint = sha256(DEVICE_COOKIE + userAgent + screenInfo)
  ipHash = sha256(clientIp)
  value = userId + ":" + now + ":" + deviceFingerprint
  mac = HMAC-SHA256(APP_SECRET, value)
  cookie "tc_session" = value + "." + mac
    flags: httpOnly, secure (prod), sameSite=Lax, maxAge=1 year
```

### 8.2 Verification

```
getCurrentUser():
  cookie = req.cookies["tc_session"]
  [value, mac] = cookie.split(".")
  expectedMac = HMAC-SHA256(APP_SECRET, value)
  if !timingSafeEqual(mac, expectedMac): return null
  [userId, ts, deviceFp] = value.split(":")
  user = db.user.findUnique({ id: userId })
  return user (or null)
```

> ⚠️ Device fingerprint is **stored but never verified** (see `VULNERABILITIES.md` H-4).

---

## 9. Telegram Client Cache

GramJS clients are cached per session string to avoid reconnection overhead:

```ts
clientCache: Map<string, { client: TelegramClient, lastUsed: number }>
key = sessionString.slice(0, 32)   // ⚠️ collision risk — see VULNERABILITIES.md W-10
TTL = 5 minutes
```

On cache miss: create `TelegramClient`, `await client.connect()`, store.
On cache hit: check `client.connected`, reconnect if needed.

---

## 10. Activity Logging

Every significant action logs to the `Activity` table:
- `login` — phone (⚠️ PII)
- `upload` — file name, size, chunks
- `download` — file name
- `share` — file name, token
- `delete` — file name
- `folder_create` — folder name

Admin panel (`/?admin=1`) can view all activity.

> ⚠️ No retention policy. See `VULNERABILITIES.md` M-5.
