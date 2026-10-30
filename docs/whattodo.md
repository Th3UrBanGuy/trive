# TriVE — What To Do

> Best practices, conventions, and contribution guide. Follow these for every change.

---

## 1. Before You Start

- [ ] Read `/home/z/my-project/worklog.md` to understand prior work
- [ ] Read the relevant `docs/` file (architecture, mechanism, VULNERABILITIES)
- [ ] Run `bun run lint` to establish a clean baseline
- [ ] Check `.env` has `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `APP_SECRET`, `ADMIN_PASSWORD` (it gets wiped on sandbox resets — restore from `trive-final.zip` if missing)

---

## 2. Code Conventions

### TypeScript
- Strict mode, no `any` unless interfacing with untyped libraries (GramJS)
- Use discriminated unions for state machines (`FetchState`, `SlugValidation`)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Always type API responses with `satisfies PublicShare` etc.

### React
- `"use client"` at the top of any file using hooks/state
- `"use server"` for server actions (we use API routes instead — prefer API)
- Prefer function components with hooks
- Use `React.useCallback` for event handlers passed to memoized children
- Use `React.useEffect` cleanup functions to avoid memory leaks

### API Routes
```ts
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()  // throws UNAUTHORIZED if not logged in
    // ... logic
    return NextResponse.json({ ... })
  } catch (e: any) {
    const msg = e?.message || "Failed"
    let status = 500
    if (msg === "UNAUTHORIZED") status = 401
    return NextResponse.json({ error: msg === "UNAUTHORIZED" ? "Auth required" : msg }, { status })
  }
}
```

### Styling
- Use existing shadcn/ui components from `src/components/ui/`
- Use utility classes from `globals.css`: `.glass`, `.glass-strong`, `.btn-premium`, `.card-premium`, `.text-gradient-brand`, `.bg-brand-gradient`, `.bg-noise`, `.eyebrow`, `.scrollbar-thin`
- Brand colors: `--brand-deep` (navy), `--brand` (blue), `--brand-cyan` (cyan) — NO indigo, NO purple
- Easing: `var(--ease-premium)` (expo-out) for entrances, `var(--ease-spring)` for playful overshoot
- Shadows: `var(--shadow-premium)`, `shadow-brand/15` for brand-tinted glow

---

## 3. The Flexbox `min-h-0` Pattern (CRITICAL)

Any time you build a modal/panel with a pinned header + scrollable body + pinned footer:

```tsx
✅ CORRECT
<div className="flex flex-col max-h-[90vh] overflow-hidden">
  <div className="shrink-0 ...header">             {/* pinned */}
  <div className="flex-1 min-h-0 overflow-y-auto">  {/* scrolls */}
  <div className="shrink-0 ...footer">              {/* pinned */}
</div>

❌ WRONG (footer pushed off-screen)
<div className="flex flex-col max-h-[90vh] overflow-hidden">
  <div className="...header">
  <div className="overflow-y-auto">                  {/* missing min-h-0 + flex-1 */}
  <div className="...footer">
</div>
```

Without `min-h-0`, flexbox children don't shrink below content size → `overflow-y-auto` fails → footer clips.

---

## 4. Encryption / File Ops

### Before Decrypting a Chunk
```ts
// ALWAYS truncate to exact encrypted size (plainSize + 16 GCM tag bytes)
const expectedEncSize = plainSize + 16
if (chunkBuf.length > expectedEncSize) {
  chunkBuf = chunkBuf.subarray(0, expectedEncSize)
}
const plain = decryptBuffer(chunkBuf, iv, salt)
```

### Erasure Decode
```ts
// ALWAYS use the GENERATOR matrix (vdm × topInverse), NOT raw Vandermonde
const vdm = vandermonde(totalShards, dataShards)
const topInverse = matrixInverse(vdm.slice(0, dataShards))
const generatorMatrix = matrixMul(vdm, topInverse)
// build subMatrix from generatorMatrix rows, NOT vdm rows
```

### User Lookup by telegramUsername
```ts
❌ db.user.findUnique({ where: { telegramUsername } })  // THROWS — field is not @unique
✅ db.user.findFirst({ where: { telegramUsername } })   // correct
✅ use findShare() from src/lib/share-resolve.ts         // for share resolution
```

### ZIP Streaming
```ts
const archive = new ZipArchive()
const webStream = Readable.toWeb(archive)  // Node → Web stream bridge
;(async () => {
  for (const file of files) {
    const { buffer } = await downloadFileFromVault(file.id, userId)
    archive.append(buffer, { name: file.path })
  }
  archive.finalize()
})().catch(e => archive.destroy(e))  // never swallow — destroy on error
return { stream: webStream }
```

---

## 5. Accessibility Checklist

- [ ] Every icon-only `<button>` has `aria-label`
- [ ] Every `<input>` without a visible `<label>` has `aria-label`
- [ ] Every custom `<button>` has `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Touch targets ≥ 36px (`size-9`), ideally 40px (`size-10`)
- [ ] Modals have `role="dialog" aria-modal="true"` (Radix Dialog handles this)
- [ ] Semantic HTML: `<main>`, `<nav>`, `<header>`, `<section>`, `<article>`
- [ ] `sr-only` text for screen readers where icon-only
- [ ] Color contrast ≥ 4.5:1 for body text

---

## 6. Responsive Checklist

- [ ] Mobile-first base styles (360px viewport)
- [ ] Breakpoints: `sm:` 640, `md:` 768, `lg:` 1024, `xl:` 1280
- [ ] No horizontal overflow on mobile (test 320px width)
- [ ] Floating elements use `bottom-safe-lg` / `pb-safe` for iOS safe-area
- [ ] Dialogs use `max-w-[calc(100%-2rem)]` on mobile
- [ ] Touch targets ≥ 44px on mobile (WCAG 2.2 SC 2.5.5)

---

## 7. When Adding a New API Route

1. Create `src/app/api/<resource>/<verb>/route.ts`
2. Add `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"`
3. Use `requireUser()` for authenticated routes
4. Wrap in try/catch, return `{ error: string }` with proper HTTP status
5. Add the typed client method to `src/lib/api.ts`
6. If it modifies data, invalidate the relevant TanStack Query cache in the mutation's `onSuccess`
7. Document in `docs/architecture.md` route table

---

## 8. When Adding a New UI Component

1. Place in `src/components/dashboard/` (or appropriate subdir)
2. `"use client"` if it uses hooks
3. Use existing shadcn/ui primitives
4. Apply `.glass` / `.card-premium` / `.btn-premium` utilities
5. Add Framer Motion entrance animation (staggered if in a list)
6. Ensure accessibility (aria-labels, focus rings)
7. Ensure responsiveness (mobile-first)
8. Export from the component file
9. Run `bun run lint`

---

## 9. After You Finish

- [ ] `bun run lint` passes with zero errors
- [ ] Dev server starts: `bun run dev` → HTTP 200 on `/`
- [ ] Check `/home/z/my-project/dev.log` for runtime errors
- [ ] Append to `/home/z/my-project/worklog.md` (NEVER overwrite):
  ```
  ---
  Task ID: <id>
  Agent: <name>
  Task: <what you were asked to do>

  Work Log:
  - <step 1>
  - <step 2>

  Stage Summary:
  - <key results>
  ```
- [ ] If the user can see the result, verify with Agent Browser (mind the 4GB RAM constraint)

---

## 10. Git / Commit

- Commit message format: `<type>: <description>` (feat:, fix:, docs:, refactor:)
- Reference task IDs from worklog in commit body
- Never commit `.env` (it's gitignored, but double-check)
- Never commit `db/custom.db` (gitignored)
