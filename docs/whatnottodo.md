# TriVE — What NOT To Do

> Anti-patterns, known pitfalls, and things that will break TriVE.
> Read this before making any change.

---

## 1. CRITICAL — Will Break The App

### ❌ Do NOT use `findUnique` on `telegramUsername`
```ts
// ❌ THROWS Prisma validation error — field is NOT @unique
db.user.findUnique({ where: { telegramUsername: "ra726ma" } })

// ✅ Use findFirst
db.user.findFirst({ where: { telegramUsername: "ra726ma" } })

// ✅ Or use the shared helper for share resolution
import { findShare } from "@/lib/share-resolve"
```
**Why**: `telegramUsername` is not marked `@unique` in the schema. `findUnique`
requires a unique field. This was the root cause of Task 2's bug.

---

### ❌ Do NOT decrypt a chunk without truncating first
```ts
// ❌ Produces garbage or auth failure if chunk has padding (erasure coding)
const plain = decryptBuffer(chunkBuf, iv, salt)

// ✅ Truncate to exact encrypted size = plainSize + 16 (GCM tag)
const expectedEncSize = plainSize + 16
if (chunkBuf.length > expectedEncSize) {
  chunkBuf = chunkBuf.subarray(0, expectedEncSize)
}
const plain = decryptBuffer(chunkBuf, iv, salt)
```
**Why**: `decryptBuffer` takes the LAST 16 bytes as the GCM auth tag. If the
buffer has trailing padding (erasure-coding zeros) or extra Telegram bytes,
the tag position shifts → decryption fails or produces garbage. This was Task 5's root cause.

---

### ❌ Do NOT use the raw Vandermonde matrix in erasure `decode()`
```ts
// ❌ Produces completely wrong reconstructed data
const vdm = vandermonde(totalShards, dataShards)
const subMatrix = useIndices.map(i => vdm[i])  // WRONG

// ✅ Use the GENERATOR matrix (vdm × topInverse)
const vdm = vandermonde(totalShards, dataShards)
const topInverse = matrixInverse(vdm.slice(0, dataShards))
const generatorMatrix = matrixMul(vdm, topInverse)
const subMatrix = useIndices.map(i => generatorMatrix[i])  // CORRECT
```
**Why**: Encode uses `generatorMatrix = vdm × topInverse`. The top N rows are
identity (systematic). Decode must invert the same generator rows. Using raw
Vandermonde produces a wrong inverse → wrong data. This was Task 5's root cause #1.

---

### ❌ Do NOT build a flex column with overflow without `min-h-0`
```tsx
// ❌ Footer pushed below viewport (the user's exact complaint from Task AUDIT-FIX-1)
<div className="flex flex-col max-h-[90vh] overflow-hidden">
  <div className="...header">
  <div className="overflow-y-auto">       {/* MISSING min-h-0 + flex-1 */}
  <div className="...footer">             {/* gets clipped */}
</div>

// ✅ Add min-h-0 + flex-1 to scrollable child, shrink-0 to header/footer
<div className="flex flex-col max-h-[90vh] overflow-hidden">
  <div className="shrink-0 ...header">
  <div className="flex-1 min-h-0 overflow-y-auto">
  <div className="shrink-0 ...footer">
</div>
```
**Why**: Flexbox children have implicit `min-height: auto` — they won't shrink
below content size. Without `min-h-0`, the scrollable body grows past
`max-h-[90vh]` and `overflow-hidden` clips the footer.

---

### ❌ Do NOT swallow errors in ZIP streaming
```ts
// ❌ Produces a valid but EMPTY zip if all files fail silently
for (const file of files) {
  try {
    archive.append(await download(file), { name: file.name })
  } catch (e) {
    console.error(e)  // swallowed — no archive.append happens
  }
}
archive.finalize()  // empty zip!

// ✅ Track failures, destroy the stream if ALL files fail
let added = 0
for (const file of files) {
  try {
    archive.append(await download(file), { name: file.name })
    added++
  } catch (e) { console.error(e) }
}
if (added === 0) {
  archive.destroy(new Error("All files failed"))
  return
}
archive.finalize()
```
**Why**: `archive.finalize()` on an empty archive produces a valid ZIP with zero
entries (just the End-of-Central-Directory record). The user sees a "blank zip".
This was Task 4's root cause.

---

### ❌ Do NOT leave the upload route missing
The upload route at `src/app/api/files/upload/route.ts` MUST exist. Without it,
the entire upload pipeline (encrypt, chunk, dedup, erasure code, manifest) is
dead code and the app cannot accept files. Always verify it exists after any
filesystem reset.

---

## 2. HIGH — Security Anti-Patterns

### ❌ Do NOT trust `APP_SECRET` fallback
```ts
// ❌ If APP_SECRET is unset, uses a publicly-known constant → anyone can forge sessions
const secret = process.env.APP_SECRET || "telecloud-dev-fallback"

// ✅ Refuse to boot without it
const secret = process.env.APP_SECRET
if (!secret || secret.length < 32) {
  throw new Error("APP_SECRET must be set to a 32+ byte random string")
}
```

---

### ❌ Do NOT put passwords in URL query parameters
```ts
// ❌ Leaks to logs, browser history, Referer header, proxy caches
fetch(`/api/share/${token}/download?password=${password}`)

// ✅ Use POST body or a custom header
fetch(`/api/share/${token}/download`, {
  method: "POST",
  headers: { "X-Share-Password": password },
  body: JSON.stringify({ email }),
})
```

---

### ❌ Do NOT compare passwords with `===` or `!==`
```ts
// ❌ Timing side-channel (short-circuits on first differing byte)
if (password !== adminPwd) { ... }

// ✅ Constant-time comparison
if (!crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPwd))) { ... }
```

---

### ❌ Do NOT echo arbitrary CORS origins with credentials
```ts
// ❌ Any malicious site can make authenticated fetch() calls
res.headers.set("Access-Control-Allow-Origin", origin)
res.headers.set("Access-Control-Allow-Credentials", "true")

// ✅ Strict allowlist
const ALLOWED = ["https://trive.space-z.ai", "http://localhost:3000"]
if (ALLOWED.includes(origin)) {
  res.headers.set("Access-Control-Allow-Origin", origin)
  res.headers.set("Access-Control-Allow-Credentials", "true")
}
```

---

### ❌ Do NOT use `dangerouslySetInnerHTML` without sanitization
```tsx
// ❌ mammoth .docx output can contain <script>, onerror= handlers
<div dangerouslySetInnerHTML={{ __html: mammothHtml }} />

// ✅ Sanitize with DOMPurify first
import DOMPurify from "isomorphic-dompurify"
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mammothHtml) }} />
```

---

### ❌ Do NOT delete Telegram messages before DB rows
```ts
// ❌ If DB delete fails after Telegram delete, messages are gone but DB still references them
await telegramService.deleteMessage(...)  // succeeds
await db.file.delete(...)                  // fails → orphaned reference

// ✅ Delete DB row first (cascade kills chunks + shares), then best-effort Telegram
await db.file.delete(...)                  // cascade cleanup
try { await telegramService.deleteMessage(...) } catch {}  // best-effort
```

---

## 3. MEDIUM — Common Pitfalls

### ❌ Do NOT overwrite the worklog
Always APPEND to `/home/z/my-project/worklog.md`. Use `>>` (append mode), never `>` (overwrite). The worklog is the canonical history — overwriting loses task context for future agents.

---

### ❌ Do NOT touch `.trive-loader` CSS or toast positioning
The `.trive-loader` triangle animation in `globals.css` is pixel-perfect per the user's spec. The `[data-sonner-toaster]` positioning rules handle mobile safe-area. Both are canonical — do not modify.

---

### ❌ Do NOT use indigo or purple
The TriVE brand is navy → blue → cyan only. Indigo and purple are banned unless the user explicitly requests them. Check `oklch` hue values — anything in the 270-300 range is purple/indigo.

---

### ❌ Do NOT build new UI primitives
Use existing shadcn/ui components from `src/components/ui/` (40+ components installed). Restyle via `className` + the utility classes in `globals.css`. Never build a custom Dialog, Button, Input, etc.

---

### ❌ Do NOT use z-ai-web-dev-sdk on the client
The SDK is backend-only. If a client component needs AI, call an API route that uses the SDK. Never import it in a `"use client"` file.

---

### ❌ Do NOT write absolute URLs with ports
```ts
// ❌ Breaks the Caddy gateway
fetch("http://localhost:3001/api/test")
io("http://localhost:3003")

// ✅ Relative path + XTransformPort query param
fetch("/api/test?XTransformPort=3001")
io("/?XTransformPort=3003")
```

---

### ❌ Do NOT run `bun run build`
The sandbox is 4GB RAM. `bun run build` (production build) will likely OOM. Use `bun run dev` only. The production build happens in the deployment pipeline, not locally.

---

### ❌ Do NOT forget the `.env` restoration
The `.env` file gets wiped on sandbox filesystem resets. If you see "Telegram not connected" or `simulationMode: true`, check `.env` has `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `APP_SECRET`, `ADMIN_PASSWORD`. Restore from `trive-final.zip` or the `restore-env.sh` script inside it.

---

### ❌ Do NOT rely on `viewOnly` as a security boundary
```ts
// viewOnly blocks download but NOT inline (?inline=1) — users can still Save As
if (share.viewOnly && !inline) { return 403 }
```
`?inline=1` bypasses the check and serves the file with `Content-Disposition: inline`. The user can right-click → Save As. Treat `viewOnly` as a UX hint, not a security guarantee. Document this to users.

---

### ❌ Do NOT make `clientCache` keys from `sessionString.slice(0, 32)`
```ts
// ❌ StringSession prefixes are identical across users → cross-user client reuse
const key = sessionString.slice(0, 32)

// ✅ Use a hash of the full session string
const key = sha256(sessionString)
```

---

## 4. LOW — Style / Consistency

### ❌ Do NOT skip lint
Run `bun run lint` before considering any task complete. ESLint catches TypeScript errors, Next.js rules, and accessibility issues.

---

### ❌ Do NOT use emojis in code or UI
Unless the user explicitly requests them or they already exist. The TriVE brand is clean and professional.

---

### ❌ Do NOT create test files
The user has explicitly said "do not write any test code." Verification is done via `bun run lint`, dev server logs, and Agent Browser.

---

### ❌ Do NOT create documentation files unless asked
"NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User." — The `docs/` folder exists because the user explicitly asked for SDP documentation.

---

### ❌ Do NOT use `find`, `grep`, `cat`, `head`, `tail`, `ls` in Bash
Use the Grep, Glob, Read, and LS tools instead. If you must run grep, use `rg` (ripgrep, pre-installed).

---

### ❌ Do NOT forget safe-area insets on floating elements
```tsx
// ❌ Overlaps iOS home indicator
<div className="fixed bottom-4 right-4">

// ✅ Respects safe area
<div className="fixed bottom-4 right-4 bottom-safe-lg">
```

---

## 5. Summary — The 7 Deadly Sins of TriVE

1. **`findUnique` on `telegramUsername`** → Prisma error (use `findFirst`)
2. **Decrypt without truncation** → garbage/auth-failure (truncate to `plainSize + 16`)
3. **Raw Vandermonde in erasure decode** → wrong data (use generator matrix)
4. **Flex column without `min-h-0`** → footer off-screen (add `min-h-0` + `flex-1`)
5. **Swallowed errors in ZIP** → empty zip (destroy if all fail)
6. **Missing upload route** → app can't accept files (always verify it exists)
7. **Overwriting the worklog** → lost history (always append, never overwrite)
