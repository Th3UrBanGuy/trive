# TriVE — Design

> Design decisions, patterns, visual system, and product philosophy.

---

## 1. Product Philosophy

TriVE is built on three principles:

1. **Your storage, your account** — Files live in the user's own private Telegram
   channel, not on a third-party server. The user can revoke access at any time
   by deleting the channel or logging out.

2. **Encrypted by default** — Every file chunk is AES-256-GCM encrypted before
   it touches Telegram. Even if Telegram is compromised, the bytes are
   unintelligible without the per-user key.

3. **Feels premium** — The UI targets Linear / Vercel / Arc-browser polish:
   frosted glass, expo-out easing, brand-tinted shadows, micro-interactions.

> ⚠️ **Honesty note**: The "zero-knowledge" claim in the marketing copy is
> aspirational. The current implementation derives the file encryption key from
> a server-side secret (`APP_SECRET` + per-user salt), so the server *can*
> decrypt files. True zero-knowledge requires client-side key derivation from a
> user password. See `docs/VULNERABILITIES.md` C-3.

---

## 2. Visual System

### Brand

The TriVE mark is a triangle filled with a 3-stop gradient, sampled
pixel-accurately from the logo PNG:

| Token         | Hex       | OKLCH                       | Meaning              |
|---------------|-----------|-----------------------------|----------------------|
| `--brand-deep`| `#1c3f81` | `oklch(0.382 0.119 261.6)`  | Navy — top of triangle|
| `--brand`     | `#1e84c6` | `oklch(0.590 0.134 243.6)`  | Blue — middle        |
| `--brand-cyan`| `#1a8aae` | `oklch(0.592 0.107 226.0)`  | Cyan — base          |

- Gradient direction: `135deg` (navy top-left → blue mid → cyan bottom-right)
- Light mode background: `#ebeff2` (logo background, `oklch(0.950 0.006 239.8)`)
- Dark mode: deep navy vault (`oklch(0.17 0.035 261)`)

**Rules**: No indigo. No purple. The 3-stop gradient is the only brand gradient.

### Design Tokens (`globals.css`)

```
:root {
  --radius: 0.75rem;
  --ease-premium:  cubic-bezier(0.16, 1, 0.3, 1);   /* expo-out */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* overshoot */
  --ease-smooth:   cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-premium, --shadow-card-hover, --shadow-glow-brand
  + full light/dark oklch token set
}
```

### Utility Classes

| Class              | Purpose                                          |
|--------------------|--------------------------------------------------|
| `.glass`           | 70% card, 20px blur, 160% saturate, edge highlight|
| `.glass-strong`    | 85% card, 28px blur, 180% saturate               |
| `.glass-panel`     | 60% card, 16px blur (background panels)          |
| `.bg-noise`        | SVG feTurbulence grain at ~3.5% opacity          |
| `.btn-premium`     | Lift + brand glow + shine sweep on hover         |
| `.card-premium`    | Soft shadow + hover lift + brand border brighten |
| `.text-gradient-brand` | Brand 3-stop gradient text                  |
| `.bg-brand-gradient`   | Brand 3-stop gradient background            |
| `.bg-aurora`       | Layered radial brand gradients (hero backdrop)   |
| `.bg-grid`         | 32px grid lines (faint)                          |
| `.eyebrow`         | Uppercase, tracked, small, muted section label   |
| `.link-underline`  | Animated underline growing from left on hover    |
| `.skeleton-premium`| Slow diagonal brand-gradient sweep               |
| `.scrollbar-thin`  | 6px rounded, brand-color on hover                |
| `.trive-loader`    | Canonical triangle materializing animation (DO NOT TOUCH) |

### Animations

All animations use `--ease-premium` (expo-out) by default:
- `animate-fade-in` — 0.4s fade
- `animate-slide-up` — 0.4s fade + 12px slide
- `animate-scale-in` — 0.25s fade + scale 0.95→1
- `animate-shimmer` — 1.5s infinite sweep
- `animate-float` — 3s infinite y-bob (8px)
- `animate-drift-slow` — 14s slow translate/scale (hero orbs)
- `.stagger-1` … `.stagger-6` — 50ms incremental delays for list entrances

---

## 3. Component Patterns

### Shadcn/ui First
Always use existing shadcn/ui primitives (`Button`, `Dialog`, `Input`,
`DropdownMenu`, etc.) from `src/components/ui/`. Never build custom
primitives. Restyle via `className` props + the utility classes above.

### Framer Motion
- Entrance: `opacity 0→1` + `y 14→0`, 400ms expo-out, staggered by index
- Hover: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`
- View swaps: `AnimatePresence` + `mode="wait"`
- Modals: scale-in 0.95→1 + blur-in (6px→0)

### Flexbox Overflow (critical pattern)
Any `flex flex-col` container with `overflow-hidden` + a scrollable child
MUST have `min-h-0` + `flex-1` on the scrollable child, and `shrink-0` on
fixed header/footer children. Without `min-h-0`, flexbox children don't
shrink below content size and `overflow-y-auto` fails.

### Responsive
- Mobile-first: base styles target 360px viewports
- Breakpoints: `sm:` (640), `md:` (768), `lg:` (1024), `xl:` (1280)
- Touch targets: minimum 36px (`size-9`), ideally 40px (`size-10`)
- Safe-area: `bottom-safe-lg`, `pb-safe`, `top-safe` for iOS PWA

### Accessibility
- All icon-only buttons need `aria-label`
- All inputs without a visible `<label>` need `aria-label`
- Custom buttons need `focus-visible:ring-2 focus-visible:ring-ring`
- Modals need `role="dialog" aria-modal="true"` (Radix Dialog handles this)

---

## 4. State Management

| Store             | Type         | Purpose                                       |
|-------------------|--------------|-----------------------------------------------|
| `authStore`       | Zustand      | Current user, login/logout                    |
| `uiStore`         | Zustand      | View, sidebar, selection, sort, theme         |
| `navStore`        | Zustand      | Breadcrumbs, current folder                   |
| `uploadStore`     | Zustand      | Upload queue (items, progress, open)          |
| TanStack Query    | React Query  | Server state (files, folders, shares, etc.)   |

---

## 5. API Design

- All API routes use `export const runtime = "nodejs"` + `dynamic = "force-dynamic"`
- Auth via `requireUser()` (throws `UNAUTHORIZED`) or `getCurrentUser()` (returns null)
- Responses are JSON (`NextResponse.json`) or raw streams (for file downloads)
- Upload uses multipart `formData` with XHR for progress tracking
- Download uses `ReadableStream<Uint8Array>` for streaming (no buffering large files)

### Route Conventions
```
GET    /api/{resource}          → list
POST   /api/{resource}          → create
GET    /api/{resource}/[id]     → get one
PATCH  /api/{resource}/[id]     → update
DELETE /api/{resource}/[id]     → delete
GET    /api/{resource}/[id]/download → stream download
```

---

## 6. Error Handling

- API routes return `{ error: string }` with appropriate HTTP status
- Client `api.ts` wraps fetch + throws on non-ok with the error message
- Toast notifications (`sonner`) surface errors to the user
- File ops use try/catch that logs to console + re-throws (never silent)

---

## 7. File Categorization

Files are categorized by MIME type for the "Files" direct view:

| Category | MIME patterns                          | Icon           |
|----------|----------------------------------------|----------------|
| image    | `image/*`                              | Image          |
| video    | `video/*`                              | Film           |
| audio    | `audio/*`                              | Music          |
| pdf      | `application/pdf`                      | FileText       |
| code     | `text/{javascript,typescript,python…}` | Code2          |
| text     | `text/*`                               | FileText       |
| archive  | `application/{zip,x-tar,x-7z…}`       | Archive        |
| doc      | `application/{msword,officedocument}` | FileType       |
| file     | (fallback)                             | File           |

---

## 8. PWA

- `manifest.webmanifest` — name, icons (192/512/maskable), theme color
- `sw.js` — service worker (cache-first for assets, network-first for API)
- Installable — shows animated install overlay on first visit
- Standalone mode — skips landing, goes straight to auth flow
