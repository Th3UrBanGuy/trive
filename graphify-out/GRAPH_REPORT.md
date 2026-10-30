# Graph Report - trive  (2026-10-30)

## Corpus Check
- 194 files · ~214,051 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 6, .example 1, .hm 1)

## Summary
- 1800 nodes · 3603 edges · 118 communities (99 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- dependencies
- menubar.tsx
- ui/sidebar.tsx
- file-ops.ts
- telegram-service.ts
- requireUser
- db.ts
- package.json
- 4. Backend API Contract — Full Reference
- admin-panel.tsx
- session.ts
- TriVE — Secure File Management, Powered by Telegram
- dashboard/sidebar.tsx
- file-explorer.tsx
- [[...path]]/route.ts
- use-toast.ts
- sso/route.ts
- What You Must Do When Invoked
- react
- share-dialog.tsx
- share/[id]/download/route.ts
- TriVE $0 Zero-Cost Microservices Architecture & Native Drive Mount Guide
- file-viewers.tsx
- file-preview-dialog.tsx
- worklog.md
- legal-pages.tsx
- webdav-dialog.tsx
- landing.tsx
- compilerOptions
- components.json
- QrCodeModel
- settings/route.ts
- app/page.tsx
- index.ts
- 2. Inviolable Core Mechanisms (Anti-Hallucination Invariants)
- settings-view.tsx
- erasure-coding.ts
- api/files/[id]/route.ts
- toggle-group.tsx
- carousel.tsx
- TriVE — Architecture
- layout.tsx
- 1. CRITICAL — Will Break The App
- Core Mandates
- TriVE — Mechanism
- topbar.tsx
- use-install-prompt.ts
- devDependencies
- chart.tsx
- drawer.tsx
- docs/README.md
- TriVE — Design
- MEDIUM Vulnerabilities
- 3. MEDIUM — Common Pitfalls
- navigation-menu.tsx
- form.tsx
- TriVE — Complete Project Setup Guide
- sign-in/route.ts
- 6. Android Sync Engine — The Native Layer
- 9. Build Roadmap — Phases & Milestones
- 1. Product Capabilities (what TriVE can do)
- public-share-view.tsx
- telegram-service/package.json
- graphify reference: extra exports and benchmark
- TriVE System Analysis & Advanced Open-Source Adaptation Roadmap
- TriVE — What To Do
- scripts
- pagination.tsx
- 1. Executive Summary
- 3. Division of Responsibility — Web vs Android
- 7. File Pipeline & Crypto as Seen by Android
- 8. Project Setup & Module Structure
- dropdown-menu.tsx
- FileExplorer
- 12. Appendices
- 5. Authentication & Session Model on Android
- TriVE — Prompt
- 2. HIGH — Security Anti-Patterns
- 4. LOW — Style / Consistency
- store.ts
- resolve_deps_subproc.js
- scan/route.ts
- graphify reference: query, path, explain
- 10. Security Model & Threat Surface
- 11. Testing, QA & Release Strategy
- formatBytes
- popover.tsx
- VaultSetup
- TriVE Android — Integration & Build Specification
- vercel.json
- dashboard.tsx
- useInstallPromptState
- 4. Encryption / File Ops
- collapsible.tsx
- cn
- resizable.tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- eslint.config.mjs
- hover-card.tsx
- tailwind.config.ts
- check_telegram_deps.js
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- @radix-ui/react-aspect-ratio
- send-code/route.ts
- proxy.ts
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md
- next-env.d.ts
- postcss.config.mjs
- restore-env.sh
- AuthFlow
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 298 edges
2. `react` - 85 edges
3. `lucide-react` - 50 edges
4. `requireUser()` - 43 edges
5. `db` - 36 edges
6. `formatBytes()` - 32 edges
7. `Button()` - 30 edges
8. `formatDate()` - 28 edges
9. `framer-motion` - 23 edges
10. `requireAdmin()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `AdminSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts
- `AdminCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts
- `StatCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts
- `UsersTab()` --calls--> `formatDate()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/file-utils.ts
- `ActivityTab()` --calls--> `formatDate()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/file-utils.ts

## Import Cycles
- None detected.

## Communities (118 total, 19 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.03
Nodes (71): dependencies, archiver, class-variance-authority, clsx, cmdk, crypto-js, date-fns, @dnd-kit/core (+63 more)

### Community 1 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): @radix-ui/react-menubar, Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 2 - "ui/sidebar.tsx"
Cohesion: 0.07
Nodes (36): @radix-ui/react-tooltip, Separator(), SheetDescription(), SheetHeader(), Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps (+28 more)

### Community 3 - "file-ops.ts"
Cohesion: 0.14
Nodes (25): RFC-7233, dynamic, GET(), maxDuration, runtime, PATCH(), dynamic, GET() (+17 more)

### Community 4 - "telegram-service.ts"
Cohesion: 0.09
Nodes (15): BOT_MODE, BOT_TOKENS, _botClientPool, _botConnectingPool, clientCache, getBotClient(), getClient(), getNextBotToken() (+7 more)

### Community 5 - "requireUser"
Cohesion: 0.07
Nodes (32): dynamic, GET(), runtime, dynamic, maxDuration, POST(), runtime, DELETE() (+24 more)

### Community 6 - "db.ts"
Cohesion: 0.07
Nodes (37): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, GET() (+29 more)

### Community 7 - "package.json"
Cohesion: 0.05
Nodes (41): telegram, name, private, version, archiver, bun-types, clsx, crypto-js (+33 more)

### Community 8 - "4. Backend API Contract — Full Reference"
Cohesion: 0.05
Nodes (40): 4.1 Authentication, 4.2 Telegram Status & Vault, 4.3 Folders, 4.4 Files, 4.5 Share Links, 4.6 Public Share (No Auth Required), 4.7 Storage & Activity, 4.8 Settings (+32 more)

### Community 9 - "admin-panel.tsx"
Cohesion: 0.08
Nodes (23): ActivityTab(), adminApi, AdminCard(), adminReq(), AdminSidebar(), AdminUnauthorizedError, formatUptime(), NAV_ITEMS (+15 more)

### Community 10 - "session.ts"
Cohesion: 0.08
Nodes (30): dynamic, POST(), runtime, dynamic, POST(), runtime, cleanupOldRequests(), dynamic (+22 more)

### Community 11 - "TriVE — Secure File Management, Powered by Telegram"
Cohesion: 0.06
Nodes (30): Admin Panel Access, 🛡️ Admin Panel (Hidden), API Routes, Architecture, Brand Identity, Configuration, Credits, Database Schema (+22 more)

### Community 12 - "dashboard/sidebar.tsx"
Cohesion: 0.08
Nodes (32): @radix-ui/react-progress, uuid, Content(), FloatingActionButton(), ConnectionBadge(), MobileSidebar(), NAV, NavItems() (+24 more)

### Community 13 - "file-explorer.tsx"
Cohesion: 0.11
Nodes (26): FileCard(), FileCardAction, StarPillButton(), useIsTouchDevice(), useLongPress(), FolderCard(), RenameContext, FileRow() (+18 more)

### Community 14 - "[[...path]]/route.ts"
Cohesion: 0.23
Nodes (16): RFC-4918, authenticate(), DELETE(), dynamic, GET(), MKCOL(), MOVE(), OPTIONS() (+8 more)

### Community 15 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 16 - "sso/route.ts"
Cohesion: 0.39
Nodes (7): dynamic, POST(), runtime, toUser(), TelegramWidgetAuthData, verifyTelegramWebAppAuth(), verifyTelegramWidgetAuth()

### Community 17 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 18 - "react"
Cohesion: 0.12
Nodes (18): input-otp, @radix-ui/react-switch, react, AuthTab, phoneSchema, Step, BrandMark(), Wordmark() (+10 more)

### Community 19 - "share-dialog.tsx"
Cohesion: 0.10
Nodes (20): @radix-ui/react-slot, ConnectPage(), computeExpiryIso(), EXPIRY_PRESETS, expiryHuman(), ExpiryPreset, ShareContext, ShareDialogInner() (+12 more)

### Community 20 - "share/[id]/download/route.ts"
Cohesion: 0.12
Nodes (23): dynamic, GET(), maxDuration, runtime, clientIp(), dynamic, GET(), isFileInFolder() (+15 more)

### Community 21 - "TriVE $0 Zero-Cost Microservices Architecture & Native Drive Mount Guide"
Cohesion: 0.14
Nodes (13): 1. Executive Concept: Why VPS is Unnecessary, 2. The $0 Multi-Cloud Microservices Blueprint, 3.1 Service A: Frontend UI (Vercel or Cloudflare Pages), 3.2 Service B: Streaming & WebDAV Engine (Hugging Face Docker Space), 3.3 Service C: Database (Turso Serverless SQLite), 3. Platform Breakdown & Setup Instructions, 4. The "Google Drive / Nextcloud" Virtual Network Drive Mechanism, 5. Implementation Roadmap for $0 Setup (+5 more)

### Community 22 - "file-viewers.tsx"
Cohesion: 0.13
Nodes (12): react-markdown, AudioViewer(), blobCache, CodeViewer(), detectLanguage(), EXT_TO_LANG, ImageViewer(), PdfViewer() (+4 more)

### Community 23 - "file-preview-dialog.tsx"
Cohesion: 0.13
Nodes (22): dynamic, GET(), runtime, TYPE_LABELS, PreviewContext, PreviewProvider(), Target, ViewerMeta (+14 more)

### Community 25 - "legal-pages.tsx"
Cohesion: 0.12
Nodes (4): LegalMeta, PAGES, TectonicCredit(), Textarea()

### Community 26 - "webdav-dialog.tsx"
Cohesion: 0.10
Nodes (26): cmdk, @radix-ui/react-dialog, @radix-ui/react-tabs, ResponsiveDialogContent(), ResponsiveDialogContentProps, WebdavDialogProps, Command(), CommandDialog() (+18 more)

### Community 27 - "landing.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-accordion, FAQ_ITEMS, Feature, FEATURES, NAV_LINKS, STEPS, Accordion(), AccordionContent() (+2 more)

### Community 28 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 29 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 30 - "QrCodeModel"
Cohesion: 0.10
Nodes (15): QRCodeProps, QRCodeSvg(), appendBits(), Ecc, ECC_CODEWORDS_PER_BLOCK, getNumDataCodewords(), getNumRawDataModules(), getTotalBits() (+7 more)

### Community 31 - "settings/route.ts"
Cohesion: 0.24
Nodes (9): dynamic, POST(), runtime, DELETE(), dynamic, PATCH(), runtime, toUser() (+1 more)

### Community 32 - "app/page.tsx"
Cohesion: 0.13
Nodes (15): HomeInner(), LEGAL_PAGES, Mode, TAGLINES, useStandalone(), VaultPhase, AdminPanel(), Dashboard() (+7 more)

### Community 33 - "index.ts"
Cohesion: 0.12
Nodes (11): clientCache, __dirname, err(), getClient(), json(), loadGram(), pending, PendingAuth (+3 more)

### Community 34 - "2. Inviolable Core Mechanisms (Anti-Hallucination Invariants)"
Cohesion: 0.13
Nodes (14): 1. System Overview & Technology Stack, 2.1 Zero-Knowledge Encryption Pipeline (`src/lib/crypto.ts`), 2.2 Chunking & Virtual File System (`src/lib/file-ops.ts`), 2.3 Reed-Solomon Erasure Coding (`src/lib/erasure-coding.ts`), 2.4 Telegram MTProto Engine (`src/lib/telegram-service.ts`), 2.5 WebDAV Bridge (`src/app/api/dav/[[...path]]/route.ts`), 2.6 Share Resolution (`src/lib/share-resolve.ts`), 2.7 UI Architecture & Flexbox Layout Rule (+6 more)

### Community 35 - "settings-view.tsx"
Cohesion: 0.28
Nodes (10): @tanstack/react-query, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+2 more)

### Community 36 - "erasure-coding.ts"
Cohesion: 0.23
Nodes (12): decode(), encode(), ErasureConfig, ErasureShard, expTable, gfInv(), gfMul(), gfPow() (+4 more)

### Community 37 - "api/files/[id]/route.ts"
Cohesion: 0.18
Nodes (11): DELETE(), dynamic, runtime, DELETE(), dynamic, runtime, DELETE(), dynamic (+3 more)

### Community 38 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 39 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 40 - "TriVE — Architecture"
Cohesion: 0.14
Nodes (14): 10. Mini-Service (legacy), 11. Build & Deploy, 12. Constraints, 1. System Overview, 2. Technology Stack, 3. Directory Structure, 4. Data Model, 5. Request Flow — Upload (+6 more)

### Community 41 - "layout.tsx"
Cohesion: 0.18
Nodes (9): nextConfig, next, next-themes, geistMono, geistSans, metadata, viewport, ThemeProvider() (+1 more)

### Community 42 - "1. CRITICAL — Will Break The App"
Cohesion: 0.20
Nodes (9): 1. CRITICAL — Will Break The App, 5. Summary — The 7 Deadly Sins of TriVE, ❌ Do NOT build a flex column with overflow without `min-h-0`, ❌ Do NOT decrypt a chunk without truncating first, ❌ Do NOT leave the upload route missing, ❌ Do NOT swallow errors in ZIP streaming, ❌ Do NOT use `findUnique` on `telegramUsername`, ❌ Do NOT use the raw Vandermonde matrix in erasure `decode()` (+1 more)

### Community 43 - "Core Mandates"
Cohesion: 0.14
Nodes (13): 1. Zero-Knowledge Encryption, 2. Telegram as Storage Engine, 3. Native Integration (WebDAV), 4. Erasure Coding (Reed-Solomon GF(2⁸)), 5. Prisma Invariant, Anti-Hallucination Guardrails (7 Inviolable Rules), Core Mandates, graphify (+5 more)

### Community 44 - "TriVE — Mechanism"
Cohesion: 0.06
Nodes (32): 10. Activity Logging, 1.1 Key Derivation, 1.2 Encrypt (per chunk), 1.3 Decrypt (per chunk), 1.4 Critical Truncation Rule, 1.5 Session String Encryption, 1.6 Password Hashing (share passwords + admin), 1. Encryption Pipeline (+24 more)

### Community 45 - "topbar.tsx"
Cohesion: 0.22
Nodes (10): @radix-ui/react-select, Select(), SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator() (+2 more)

### Community 46 - "use-install-prompt.ts"
Cohesion: 0.23
Nodes (10): InstallPromptProvider(), Phase, TAGLINES, BeforeInstallPromptEvent, detectIosSafari(), detectStandalone(), InstallOverlayState, InstallPromptContext (+2 more)

### Community 47 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 48 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 49 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 50 - "docs/README.md"
Cohesion: 0.20
Nodes (6): Documentation Index, Figures (SVG), Quick Start, Severity Summary (from VULNERABILITIES.md), Top 5 Must-Fix-First, TriVE — Software Design Package (SDP)

### Community 51 - "TriVE — Design"
Cohesion: 0.10
Nodes (19): 1. Product Philosophy, 2. Visual System, 3. Component Patterns, 4. State Management, 5. API Design, 6. Error Handling, 7. File Categorization, 8. PWA (+11 more)

### Community 52 - "MEDIUM Vulnerabilities"
Cohesion: 0.05
Nodes (39): C-1. Open SSRF via Caddy `XTransformPort` query param, C-2. `APP_SECRET` fallback makes all crypto and session forgery trivial, C-3. Per-user file encryption key derived from server secret — NOT zero-knowledge, C-4. Upload endpoint was missing (FIXED), C-5. Share `password` and `email` transmitted as URL query parameters, C-6. Admin password compared with non-constant-time `!==`, CRITICAL Vulnerabilities, Executive Summary (+31 more)

### Community 53 - "3. MEDIUM — Common Pitfalls"
Cohesion: 0.18
Nodes (11): 3. MEDIUM — Common Pitfalls, ❌ Do NOT build new UI primitives, ❌ Do NOT forget the `.env` restoration, ❌ Do NOT make `clientCache` keys from `sessionString.slice(0, 32)`, ❌ Do NOT overwrite the worklog, ❌ Do NOT rely on `viewOnly` as a security boundary, ❌ Do NOT run `bun run build`, ❌ Do NOT touch `.trive-loader` CSS or toast positioning (+3 more)

### Community 54 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 55 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 56 - "TriVE — Complete Project Setup Guide"
Cohesion: 0.18
Nodes (10): Admin Panel, Build for Production, Critical Rules (from `docs/whatnottodo.md`), Documentation (`docs/`), Environment Variables (`.env`), License, Quick Start (on a new device), Tech Stack (+2 more)

### Community 57 - "sign-in/route.ts"
Cohesion: 0.13
Nodes (18): dynamic, POST(), runtime, toUser(), dynamic, runtime, dynamic, POST() (+10 more)

### Community 58 - "6. Android Sync Engine — The Native Layer"
Cohesion: 0.20
Nodes (10): 6.1 Sync Engine Design Goals, 6.2 Local Room Database Schema, 6.3 IndexSyncWorker (Periodic), 6.4 UploadQueueWorker (On-Demand), 6.5 DownloadWorker (Foreground Service), 6.6 VaultScanWorker (On-Demand), 6.7 Conflict Resolution, 6.8 Battery & Data Saver Settings (+2 more)

### Community 59 - "9. Build Roadmap — Phases & Milestones"
Cohesion: 0.20
Nodes (10): 9. Build Roadmap — Phases & Milestones, Estimated Total Timeline, Phase 0 — Bootstrap (1 day), Phase 1 — Auth Flow (3 days), Phase 2 — File Browser (5 days), Phase 3 — Upload & Download (5 days), Phase 4 — Share Management (3 days), Phase 5 — Public Share Viewer (2 days) (+2 more)

### Community 60 - "1. Product Capabilities (what TriVE can do)"
Cohesion: 0.13
Nodes (14): 1. Product Capabilities (what TriVE can do), 2. Development Skills (what you need to work on TriVE), 3. Z.ai SDK Skills (available in this environment), 4. Tooling Skills, Account, Core Storage, File Viewing, How to Use a Skill (+6 more)

### Community 61 - "public-share-view.tsx"
Cohesion: 0.15
Nodes (8): sonner, SWATCHES, FetchState, ShareBody, DialogClose(), Input(), Label(), PublicShare

### Community 62 - "telegram-service/package.json"
Cohesion: 0.20
Nodes (9): dependencies, telegram, telegram, name, private, scripts, dev, type (+1 more)

### Community 63 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 64 - "TriVE System Analysis & Advanced Open-Source Adaptation Roadmap"
Cohesion: 0.13
Nodes (14): 1. Executive Summary, 2. Deep Dive: Current TriVE Architecture vs. Competitors, 3.1 The Problem with MTProto Phone Number + OTP, 3.2 The Zero-Restriction, Infinite-Scale Solution: Triple SSO, 3. Millions-of-Users Authentication Analysis: Solving Bans & Rate Limits, 4. High-Value Advanced Mechanisms to Adapt from Top Open-Source Projects, 5. Prioritized Implementation Roadmap for Review, 6. Verification & Zero-Hallucination Gate (+6 more)

### Community 65 - "TriVE — What To Do"
Cohesion: 0.14
Nodes (14): 10. Git / Commit, 1. Before You Start, 2. Code Conventions, 3. The Flexbox `min-h-0` Pattern (CRITICAL), 5. Accessibility Checklist, 6. Responsive Checklist, 7. When Adding a New API Route, 8. When Adding a New UI Component (+6 more)

### Community 66 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+1 more)

### Community 67 - "pagination.tsx"
Cohesion: 0.22
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 68 - "1. Executive Summary"
Cohesion: 0.33
Nodes (6): 1.1 What TriVE Is, 1.2 Why Build a Separate Android App, 1.3 The Core Strategy, 1.4 What's Already Working on the Backend, 1.5 What the Android App Will Add, 1. Executive Summary

### Community 69 - "3. Division of Responsibility — Web vs Android"
Cohesion: 0.40
Nodes (5): 3.1 The Backend Owns (Android MUST NOT Reimplement), 3.2 The Android App Owns (Web Does NOT Implement), 3.3 Shared Responsibilities (Both Implement, Must Match), 3.4 Decision Matrix — Where to Make a Change, 3. Division of Responsibility — Web vs Android

### Community 70 - "7. File Pipeline & Crypto as Seen by Android"
Cohesion: 0.25
Nodes (8): 7.1 The Pipeline (Server-Side), 7.2 The Download Pipeline (Server-Side), 7.3 What Android Needs to Know, 7.4 The Zero-Knowledge Caveat, 7.5 Streaming Multipart Upload with Progress, 7.6 Streaming Download to File, 7.7 Opening Files via FileProvider, 7. File Pipeline & Crypto as Seen by Android

### Community 71 - "8. Project Setup & Module Structure"
Cohesion: 0.25
Nodes (8): 8.1 Project Bootstrap, 8.2 Module Structure, 8.3 Network Layer, 8.4 Repository Layer, 8.5 Compose UI Skeleton, 8.6 AndroidManifest.xml, 8.7 Build Configuration, 8. Project Setup & Module Structure

### Community 72 - "dropdown-menu.tsx"
Cohesion: 0.17
Nodes (7): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuShortcut(), DropdownMenuSubContent(), DropdownMenuSubTrigger()

### Community 73 - "FileExplorer"
Cohesion: 0.27
Nodes (9): DashboardInner(), FileExplorer(), handleCardClick(), handleFileAction(), handleFolderAction(), usePreviewDialog(), useMoveDialog(), setGlobalQueryClient() (+1 more)

### Community 74 - "12. Appendices"
Cohesion: 0.29
Nodes (7): 12. Appendices, Appendix A — Backend File Inventory, Appendix B — Backend Environment Variables, Appendix C — Brand Identity Reference, Appendix D — Glossary, Appendix E — Quick-Start Checklist for an AI Taking Over, Appendix F — Open Questions / Decisions Deferred

### Community 75 - "5. Authentication & Session Model on Android"
Cohesion: 0.29
Nodes (7): 5.1 The Session Lifecycle, 5.2 Cookie Persistence with OkHttp, 5.3 Biometric Unlock Gate, 5.4 Sign-Out Flow, 5.5 Handling 401s Globally, 5.6 First-Run Vault Setup, 5. Authentication & Session Model on Android

### Community 76 - "TriVE — Prompt"
Cohesion: 0.29
Nodes (6): 1. Master System Prompt, 2. Code Review Prompt, 3. Bug Triage Prompt, 4. Feature Implementation Prompt, 5. Security Audit Prompt, TriVE — Prompt

### Community 77 - "2. HIGH — Security Anti-Patterns"
Cohesion: 0.29
Nodes (7): 2. HIGH — Security Anti-Patterns, ❌ Do NOT compare passwords with `===` or `!==`, ❌ Do NOT delete Telegram messages before DB rows, ❌ Do NOT echo arbitrary CORS origins with credentials, ❌ Do NOT put passwords in URL query parameters, ❌ Do NOT trust `APP_SECRET` fallback, ❌ Do NOT use `dangerouslySetInnerHTML` without sanitization

### Community 78 - "4. LOW — Style / Consistency"
Cohesion: 0.29
Nodes (7): 4. LOW — Style / Consistency, ❌ Do NOT create documentation files unless asked, ❌ Do NOT create test files, ❌ Do NOT forget safe-area insets on floating elements, ❌ Do NOT skip lint, ❌ Do NOT use emojis in code or UI, ❌ Do NOT use `find`, `grep`, `cat`, `head`, `tail`, `ls` in Bash

### Community 79 - "store.ts"
Cohesion: 0.27
Nodes (9): zustand, AuthState, NavState, UIState, UploadItem, UploadState, View, Folder (+1 more)

### Community 80 - "resolve_deps_subproc.js"
Cohesion: 0.40
Nodes (5): copyDir(), copyPkg(), { execSync }, fs, path

### Community 81 - "scan/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, maxDuration, POST(), runtime, scanVaultAndRebuild()

### Community 82 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 83 - "10. Security Model & Threat Surface"
Cohesion: 0.33
Nodes (6): 10.1 Trust Boundaries, 10.2 Android-Specific Threats, 10.3 Network Security Config, 10.4 Backend Security Caveats (Inherited), 10.5 Secrets Handling, 10. Security Model & Threat Surface

### Community 84 - "11. Testing, QA & Release Strategy"
Cohesion: 0.33
Nodes (6): 11.1 Test Pyramid, 11.2 Critical Path Smoke Test, 11.3 Performance Budgets, 11.4 Release Strategy, 11.5 Backend Deployment Considerations, 11. Testing, QA & Release Strategy

### Community 85 - "formatBytes"
Cohesion: 0.16
Nodes (18): FilesTab(), OverviewTab(), SharesTab(), UserExpand(), Inner(), FileViewerDispatcher(), pickViewerKind(), UnknownViewer() (+10 more)

### Community 87 - "VaultSetup"
Cohesion: 0.67
Nodes (3): isNetworkError(), VaultSetup(), create()

### Community 88 - "TriVE Android — Integration & Build Specification"
Cohesion: 0.25
Nodes (7): 2.1 High-Level Diagram, 2.2 Why Cookie-Based Auth Works on Android, 2.3 Component Inventory, 2.4 File Size Constraints, 2. Architecture Overview, Table of Contents, TriVE Android — Integration & Build Specification

### Community 89 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, cleanUrls, framework, headers, installCommand

### Community 90 - "dashboard.tsx"
Cohesion: 0.09
Nodes (21): APP_SHELL, date-fns, framer-motion, lucide-react, AnalyticsView(), FolderRow(), MoveContext, MoveProvider() (+13 more)

### Community 91 - "useInstallPromptState"
Cohesion: 0.33
Nodes (6): InstallSection(), Navbar(), InstallBanner(), isRecentlyDismissed(), markDismissed(), useInstallPromptState()

### Community 92 - "4. Encryption / File Ops"
Cohesion: 0.40
Nodes (5): 4. Encryption / File Ops, Before Decrypting a Chunk, Erasure Decode, User Lookup by telegramUsername, ZIP Streaming

### Community 94 - "cn"
Cohesion: 0.07
Nodes (39): @radix-ui/react-avatar, @radix-ui/react-radio-group, @radix-ui/react-scroll-area, @radix-ui/react-slider, OtpInput(), FullLogo(), BarButton(), Section() (+31 more)

### Community 95 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): react-resizable-panels, ResizableHandle(), ResizablePanelGroup()

### Community 96 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 97 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 98 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 99 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

### Community 101 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 102 - "check_telegram_deps.js"
Cohesion: 0.50
Nodes (4): copyDir(), copyPkg(), fs, path

## Knowledge Gaps
- **751 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+746 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 916 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `menubar.tsx`, `ui/sidebar.tsx`, `package.json`, `admin-panel.tsx`, `dashboard/sidebar.tsx`, `file-explorer.tsx`, `use-toast.ts`, `share-dialog.tsx`, `file-viewers.tsx`, `file-preview-dialog.tsx`, `legal-pages.tsx`, `webdav-dialog.tsx`, `landing.tsx`, `QrCodeModel`, `app/page.tsx`, `settings-view.tsx`, `toggle-group.tsx`, `carousel.tsx`, `layout.tsx`, `topbar.tsx`, `use-install-prompt.ts`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `form.tsx`, `public-share-view.tsx`, `pagination.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `dashboard.tsx`, `cn`, `resizable.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `menubar.tsx`, `ui/sidebar.tsx`, `admin-panel.tsx`, `dashboard/sidebar.tsx`, `file-explorer.tsx`, `use-toast.ts`, `react`, `share-dialog.tsx`, `file-viewers.tsx`, `file-preview-dialog.tsx`, `legal-pages.tsx`, `webdav-dialog.tsx`, `landing.tsx`, `settings-view.tsx`, `toggle-group.tsx`, `carousel.tsx`, `topbar.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `form.tsx`, `public-share-view.tsx`, `pagination.tsx`, `dropdown-menu.tsx`, `FileExplorer`, `formatBytes`, `popover.tsx`, `dashboard.tsx`, `useInstallPromptState`, `resizable.tsx`, `hover-card.tsx`, `AuthFlow`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _751 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.028169014084507043 - nodes in this community are weakly interconnected._
- **Should `menubar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `ui/sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06538461538461539 - nodes in this community are weakly interconnected._