# Graph Report - trive  (2026-10-29)

## Corpus Check
- 186 files · ~208,170 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .example 1, .lock 1)

## Summary
- 1726 nodes · 3471 edges · 110 communities (94 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
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
- react
- file-explorer.tsx
- [[...path]]/route.ts
- use-toast.ts
- crypto.ts
- What You Must Do When Invoked
- auth-flow.tsx
- share-dialog.tsx
- sw.js
- TriVE $0 Zero-Cost Microservices Architecture & Native Drive Mount Guide
- file-viewers.tsx
- file-utils.ts
- worklog.md
- legal-pages.tsx
- lucide-react
- landing.tsx
- compilerOptions
- components.json
- types.ts
- settings/route.ts
- app/page.tsx
- command.tsx
- 2. Inviolable Core Mechanisms (Anti-Hallucination Invariants)
- context-menu.tsx
- erasure-coding.ts
- 1. Product Capabilities (what TriVE can do)
- toggle-group.tsx
- carousel.tsx
- TriVE — Architecture
- layout.tsx
- vault/status/route.ts
- Core Mandates
- TriVE — Mechanism
- select.tsx
- use-install-prompt.ts
- devDependencies
- chart.tsx
- drawer.tsx
- TriVE — Software Design Package (SDP)
- TriVE — Design
- MEDIUM Vulnerabilities
- 3. MEDIUM — Common Pitfalls
- cn
- folders/route.ts
- TriVE — Complete Project Setup Guide
- public/route.ts
- 6. Android Sync Engine — The Native Layer
- 9. Build Roadmap — Phases & Milestones
- docs/README.md
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
- install-banner.tsx
- breadcrumb.tsx
- 12. Appendices
- 5. Authentication & Session Model on Android
- TriVE — Prompt
- 3. Component Patterns
- scroll-area.tsx
- 2. Code Conventions
- 2. Development Skills (what you need to work on TriVE)
- graphify reference: query, path, explain
- 10. Security Model & Threat Surface
- 11. Testing, QA & Release Strategy
- utils.ts
- popover.tsx
- vault-setup.tsx
- TriVE Android — Integration & Build Specification
- sheet.tsx
- radio-group.tsx
- 4. Encryption / File Ops
- collapsible.tsx
- hover-card.tsx
- resizable.tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- eslint.config.mjs
- tailwind.config.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- @radix-ui/react-aspect-ratio
- proxy.ts
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md
- next-env.d.ts
- postcss.config.mjs
- restore-env.sh

## God Nodes (most connected - your core abstractions)
1. `cn()` - 298 edges
2. `react` - 83 edges
3. `lucide-react` - 49 edges
4. `requireUser()` - 43 edges
5. `db` - 36 edges
6. `formatBytes()` - 32 edges
7. `Button()` - 29 edges
8. `formatDate()` - 28 edges
9. `framer-motion` - 23 edges
10. `requireAdmin()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `requireUser()`  [EXTRACTED]
  src/app/api/activity/route.ts → src/lib/session.ts
- `GET()` --calls--> `requireAdmin()`  [EXTRACTED]
  src/app/api/admin/telegram/route.ts → src/lib/session.ts
- `AdminSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts
- `AdminCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts
- `StatCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/admin/admin-panel.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (110 total, 16 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.03
Nodes (71): dependencies, archiver, class-variance-authority, clsx, cmdk, crypto-js, date-fns, @dnd-kit/core (+63 more)

### Community 1 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): @radix-ui/react-menubar, Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 2 - "ui/sidebar.tsx"
Cohesion: 0.07
Nodes (35): @radix-ui/react-tooltip, Input(), Separator(), Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter() (+27 more)

### Community 3 - "file-ops.ts"
Cohesion: 0.10
Nodes (33): dynamic, GET(), maxDuration, runtime, dynamic, maxDuration, POST(), runtime (+25 more)

### Community 4 - "telegram-service.ts"
Cohesion: 0.05
Nodes (24): clientCache, __dirname, err(), getClient(), json(), loadGram(), pending, PendingAuth (+16 more)

### Community 5 - "requireUser"
Cohesion: 0.08
Nodes (31): DELETE(), dynamic, PATCH(), runtime, dynamic, GET(), runtime, DELETE() (+23 more)

### Community 6 - "db.ts"
Cohesion: 0.08
Nodes (32): dynamic, GET(), runtime, dynamic, GET(), runtime, DELETE(), dynamic (+24 more)

### Community 7 - "package.json"
Cohesion: 0.05
Nodes (36): telegram, name, private, version, archiver, bun-types, clsx, crypto-js (+28 more)

### Community 8 - "4. Backend API Contract — Full Reference"
Cohesion: 0.05
Nodes (40): 4.1 Authentication, 4.2 Telegram Status & Vault, 4.3 Folders, 4.4 Files, 4.5 Share Links, 4.6 Public Share (No Auth Required), 4.7 Storage & Activity, 4.8 Settings (+32 more)

### Community 9 - "admin-panel.tsx"
Cohesion: 0.07
Nodes (38): @radix-ui/react-slot, react-day-picker, adminApi, AdminCard(), adminReq(), AdminSidebar(), AdminUnauthorizedError, formatUptime() (+30 more)

### Community 10 - "session.ts"
Cohesion: 0.10
Nodes (23): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, GET() (+15 more)

### Community 11 - "TriVE — Secure File Management, Powered by Telegram"
Cohesion: 0.06
Nodes (30): Admin Panel Access, 🛡️ Admin Panel (Hidden), API Routes, Architecture, Brand Identity, Configuration, Credits, Database Schema (+22 more)

### Community 12 - "react"
Cohesion: 0.06
Nodes (50): @radix-ui/react-progress, react, @tanstack/react-query, uuid, Wordmark(), Content(), DashboardInner(), FloatingActionButton() (+42 more)

### Community 13 - "file-explorer.tsx"
Cohesion: 0.12
Nodes (26): framer-motion, FileCard(), FileCardAction, StarPillButton(), useIsTouchDevice(), useLongPress(), FolderCard(), RenameContext (+18 more)

### Community 14 - "[[...path]]/route.ts"
Cohesion: 0.23
Nodes (16): RFC-4918, authenticate(), DELETE(), dynamic, GET(), MKCOL(), MOVE(), OPTIONS() (+8 more)

### Community 15 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 16 - "crypto.ts"
Cohesion: 0.11
Nodes (31): cleanupOldRequests(), dynamic, GET(), PendingAuth, pendingAuths, POST(), runtime, toUser() (+23 more)

### Community 17 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 18 - "auth-flow.tsx"
Cohesion: 0.08
Nodes (24): input-otp, @radix-ui/react-label, react-hook-form, zod, AuthFlow(), AuthTab, OtpInput(), phoneSchema (+16 more)

### Community 19 - "share-dialog.tsx"
Cohesion: 0.09
Nodes (26): date-fns, @radix-ui/react-switch, sonner, ConnectPage(), computeExpiryIso(), EXPIRY_PRESETS, expiryHuman(), ExpiryPreset (+18 more)

### Community 21 - "TriVE $0 Zero-Cost Microservices Architecture & Native Drive Mount Guide"
Cohesion: 0.14
Nodes (13): 1. Executive Concept: Why VPS is Unnecessary, 2. The $0 Multi-Cloud Microservices Blueprint, 3.1 Service A: Frontend UI (Vercel or Cloudflare Pages), 3.2 Service B: Streaming & WebDAV Engine (Hugging Face Docker Space), 3.3 Service C: Database (Turso Serverless SQLite), 3. Platform Breakdown & Setup Instructions, 4. The "Google Drive / Nextcloud" Virtual Network Drive Mechanism, 5. Implementation Roadmap for $0 Setup (+5 more)

### Community 22 - "file-viewers.tsx"
Cohesion: 0.11
Nodes (15): mammoth, react-markdown, react-syntax-highlighter, AudioViewer(), blobCache, CodeViewer(), detectLanguage(), DocxViewer() (+7 more)

### Community 23 - "file-utils.ts"
Cohesion: 0.25
Nodes (12): CATEGORIES, FilesDirectView(), useShareDialog(), CategoryColor(), CopyButton(), EncryptionPill(), FileIcon(), FileTypeBadge() (+4 more)

### Community 25 - "legal-pages.tsx"
Cohesion: 0.12
Nodes (4): LegalMeta, LegalPage(), PAGES, Textarea()

### Community 26 - "lucide-react"
Cohesion: 0.13
Nodes (20): lucide-react, PreviewContext, PreviewProvider(), Target, ViewerMeta, MoveContext, Target, SWATCHES (+12 more)

### Community 27 - "landing.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-accordion, FAQ_ITEMS, Feature, FEATURES, NAV_LINKS, STEPS, Accordion(), AccordionContent() (+2 more)

### Community 28 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 29 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 30 - "types.ts"
Cohesion: 0.09
Nodes (20): dynamic, GET(), runtime, dynamic, GET(), runtime, TYPE_LABELS, Activity (+12 more)

### Community 31 - "settings/route.ts"
Cohesion: 0.24
Nodes (9): dynamic, POST(), runtime, DELETE(), dynamic, PATCH(), runtime, toUser() (+1 more)

### Community 32 - "app/page.tsx"
Cohesion: 0.15
Nodes (11): HomeInner(), LEGAL_PAGES, Mode, TAGLINES, useStandalone(), VaultPhase, AdminPanel(), Dashboard() (+3 more)

### Community 33 - "command.tsx"
Cohesion: 0.18
Nodes (9): cmdk, Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+1 more)

### Community 34 - "2. Inviolable Core Mechanisms (Anti-Hallucination Invariants)"
Cohesion: 0.13
Nodes (14): 1. System Overview & Technology Stack, 2.1 Zero-Knowledge Encryption Pipeline (`src/lib/crypto.ts`), 2.2 Chunking & Virtual File System (`src/lib/file-ops.ts`), 2.3 Reed-Solomon Erasure Coding (`src/lib/erasure-coding.ts`), 2.4 Telegram MTProto Engine (`src/lib/telegram-service.ts`), 2.5 WebDAV Bridge (`src/app/api/dav/[[...path]]/route.ts`), 2.6 Share Resolution (`src/lib/share-resolve.ts`), 2.7 UI Architecture & Flexbox Layout Rule (+6 more)

### Community 35 - "context-menu.tsx"
Cohesion: 0.17
Nodes (7): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuShortcut(), ContextMenuSubContent(), ContextMenuSubTrigger()

### Community 36 - "erasure-coding.ts"
Cohesion: 0.23
Nodes (12): decode(), encode(), ErasureConfig, ErasureShard, expTable, gfInv(), gfMul(), gfPow() (+4 more)

### Community 37 - "1. Product Capabilities (what TriVE can do)"
Cohesion: 0.33
Nodes (6): 1. Product Capabilities (what TriVE can do), Account, Core Storage, File Viewing, PWA, Sharing

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

### Community 42 - "vault/status/route.ts"
Cohesion: 0.22
Nodes (7): dynamic, GET(), runtime, dynamic, GET(), runtime, telegramService

### Community 43 - "Core Mandates"
Cohesion: 0.14
Nodes (13): 1. Zero-Knowledge Encryption, 2. Telegram as Storage Engine, 3. Native Integration (WebDAV), 4. Erasure Coding (Reed-Solomon GF(2⁸)), 5. Prisma Invariant, Anti-Hallucination Guardrails (7 Inviolable Rules), Core Mandates, graphify (+5 more)

### Community 44 - "TriVE — Mechanism"
Cohesion: 0.06
Nodes (32): 10. Activity Logging, 1.1 Key Derivation, 1.2 Encrypt (per chunk), 1.3 Decrypt (per chunk), 1.4 Critical Truncation Rule, 1.5 Session String Encryption, 1.6 Password Hashing (share passwords + admin), 1. Encryption Pipeline (+24 more)

### Community 45 - "select.tsx"
Cohesion: 0.17
Nodes (10): @radix-ui/react-select, Select(), SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator() (+2 more)

### Community 46 - "use-install-prompt.ts"
Cohesion: 0.21
Nodes (11): zustand, InstallPromptProvider(), Phase, TAGLINES, BeforeInstallPromptEvent, detectIosSafari(), detectStandalone(), InstallOverlayState (+3 more)

### Community 47 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, bun-types, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tw-animate-css (+4 more)

### Community 48 - "chart.tsx"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 49 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 50 - "TriVE — Software Design Package (SDP)"
Cohesion: 0.33
Nodes (6): Documentation Index, Figures (SVG), Quick Start, Severity Summary (from VULNERABILITIES.md), Top 5 Must-Fix-First, TriVE — Software Design Package (SDP)

### Community 51 - "TriVE — Design"
Cohesion: 0.15
Nodes (13): 1. Product Philosophy, 2. Visual System, 4. State Management, 5. API Design, 6. Error Handling, 7. File Categorization, 8. PWA, Animations (+5 more)

### Community 52 - "MEDIUM Vulnerabilities"
Cohesion: 0.05
Nodes (39): C-1. Open SSRF via Caddy `XTransformPort` query param, C-2. `APP_SECRET` fallback makes all crypto and session forgery trivial, C-3. Per-user file encryption key derived from server secret — NOT zero-knowledge, C-4. Upload endpoint was missing (FIXED), C-5. Share `password` and `email` transmitted as URL query parameters, C-6. Admin password compared with non-constant-time `!==`, CRITICAL Vulnerabilities, Executive Summary (+31 more)

### Community 53 - "3. MEDIUM — Common Pitfalls"
Cohesion: 0.06
Nodes (34): 1. CRITICAL — Will Break The App, 2. HIGH — Security Anti-Patterns, 3. MEDIUM — Common Pitfalls, 4. LOW — Style / Consistency, 5. Summary — The 7 Deadly Sins of TriVE, ❌ Do NOT build a flex column with overflow without `min-h-0`, ❌ Do NOT build new UI primitives, ❌ Do NOT compare passwords with `===` or `!==` (+26 more)

### Community 54 - "cn"
Cohesion: 0.09
Nodes (32): @radix-ui/react-avatar, @radix-ui/react-navigation-menu, @radix-ui/react-slider, @radix-ui/react-tabs, FullLogo(), FolderRow(), BarButton(), Avatar() (+24 more)

### Community 55 - "folders/route.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), mapFolder(), POST(), runtime, postFolderManifest()

### Community 56 - "TriVE — Complete Project Setup Guide"
Cohesion: 0.18
Nodes (10): Admin Panel, Build for Production, Critical Rules (from `docs/whatnottodo.md`), Documentation (`docs/`), Environment Variables (`.env`), License, Quick Start (on a new device), Tech Stack (+2 more)

### Community 57 - "public/route.ts"
Cohesion: 0.16
Nodes (19): dynamic, POST(), runtime, appendEmail(), clientIp(), collectFolderTree(), dynamic, emailAllowed() (+11 more)

### Community 58 - "6. Android Sync Engine — The Native Layer"
Cohesion: 0.20
Nodes (10): 6.1 Sync Engine Design Goals, 6.2 Local Room Database Schema, 6.3 IndexSyncWorker (Periodic), 6.4 UploadQueueWorker (On-Demand), 6.5 DownloadWorker (Foreground Service), 6.6 VaultScanWorker (On-Demand), 6.7 Conflict Resolution, 6.8 Battery & Data Saver Settings (+2 more)

### Community 59 - "9. Build Roadmap — Phases & Milestones"
Cohesion: 0.20
Nodes (10): 9. Build Roadmap — Phases & Milestones, Estimated Total Timeline, Phase 0 — Bootstrap (1 day), Phase 1 — Auth Flow (3 days), Phase 2 — File Browser (5 days), Phase 3 — Upload & Download (5 days), Phase 4 — Share Management (3 days), Phase 5 — Public Share Viewer (2 days) (+2 more)

### Community 60 - "docs/README.md"
Cohesion: 0.20
Nodes (4): 3. Z.ai SDK Skills (available in this environment), 4. Tooling Skills, How to Use a Skill, TriVE — Skills

### Community 61 - "public-share-view.tsx"
Cohesion: 0.11
Nodes (23): ActivityTab(), FilesTab(), OverviewTab(), SharesTab(), UserExpand(), UsersTab(), Inner(), FileViewerDispatcher() (+15 more)

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
Cohesion: 0.22
Nodes (9): 10. Git / Commit, 1. Before You Start, 3. The Flexbox `min-h-0` Pattern (CRITICAL), 5. Accessibility Checklist, 6. Responsive Checklist, 7. When Adding a New API Route, 8. When Adding a New UI Component, 9. After You Finish (+1 more)

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

### Community 72 - "install-banner.tsx"
Cohesion: 0.36
Nodes (8): InstallSection(), Navbar(), InstallBanner(), isRecentlyDismissed(), markDismissed(), InstallOverlay(), useInstallOverlay, useInstallPromptState()

### Community 73 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (6): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 74 - "12. Appendices"
Cohesion: 0.29
Nodes (7): 12. Appendices, Appendix A — Backend File Inventory, Appendix B — Backend Environment Variables, Appendix C — Brand Identity Reference, Appendix D — Glossary, Appendix E — Quick-Start Checklist for an AI Taking Over, Appendix F — Open Questions / Decisions Deferred

### Community 75 - "5. Authentication & Session Model on Android"
Cohesion: 0.29
Nodes (7): 5.1 The Session Lifecycle, 5.2 Cookie Persistence with OkHttp, 5.3 Biometric Unlock Gate, 5.4 Sign-Out Flow, 5.5 Handling 401s Globally, 5.6 First-Run Vault Setup, 5. Authentication & Session Model on Android

### Community 76 - "TriVE — Prompt"
Cohesion: 0.29
Nodes (6): 1. Master System Prompt, 2. Code Review Prompt, 3. Bug Triage Prompt, 4. Feature Implementation Prompt, 5. Security Audit Prompt, TriVE — Prompt

### Community 77 - "3. Component Patterns"
Cohesion: 0.33
Nodes (6): 3. Component Patterns, Accessibility, Flexbox Overflow (critical pattern), Framer Motion, Responsive, Shadcn/ui First

### Community 78 - "scroll-area.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-scroll-area, ScrollArea(), ScrollBar()

### Community 80 - "2. Code Conventions"
Cohesion: 0.40
Nodes (5): 2. Code Conventions, API Routes, React, Styling, TypeScript

### Community 81 - "2. Development Skills (what you need to work on TriVE)"
Cohesion: 0.50
Nodes (4): 2. Development Skills (what you need to work on TriVE), Must-Have, Nice-to-Have, Should-Have

### Community 82 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 83 - "10. Security Model & Threat Surface"
Cohesion: 0.33
Nodes (6): 10.1 Trust Boundaries, 10.2 Android-Specific Threats, 10.3 Network Security Config, 10.4 Backend Security Caveats (Inherited), 10.5 Secrets Handling, 10. Security Model & Threat Surface

### Community 84 - "11. Testing, QA & Release Strategy"
Cohesion: 0.33
Nodes (6): 11.1 Test Pyramid, 11.2 Critical Path Smoke Test, 11.3 Performance Budgets, 11.4 Release Strategy, 11.5 Backend Deployment Considerations, 11. Testing, QA & Release Strategy

### Community 85 - "utils.ts"
Cohesion: 0.24
Nodes (4): recharts, AnalyticsView(), Checkbox(), Skeleton()

### Community 87 - "vault-setup.tsx"
Cohesion: 0.22
Nodes (6): BrandMark(), isNetworkError(), SCAN_TAGLINES, VaultScanning(), VaultSetup(), create()

### Community 88 - "TriVE Android — Integration & Build Specification"
Cohesion: 0.25
Nodes (7): 2.1 High-Level Diagram, 2.2 Why Cookie-Based Auth Works on Android, 2.3 Component Inventory, 2.4 File Size Constraints, 2. Architecture Overview, Table of Contents, TriVE Android — Integration & Build Specification

### Community 90 - "sheet.tsx"
Cohesion: 0.17
Nodes (8): @radix-ui/react-dialog, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 91 - "radio-group.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-radio-group, RadioGroup(), RadioGroupItem()

### Community 92 - "4. Encryption / File Ops"
Cohesion: 0.40
Nodes (5): 4. Encryption / File Ops, Before Decrypting a Chunk, Erasure Decode, User Lookup by telegramUsername, ZIP Streaming

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

## Knowledge Gaps
- **727 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+722 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 884 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `menubar.tsx`, `ui/sidebar.tsx`, `admin-panel.tsx`, `react`, `file-explorer.tsx`, `use-toast.ts`, `auth-flow.tsx`, `share-dialog.tsx`, `file-viewers.tsx`, `file-utils.ts`, `legal-pages.tsx`, `lucide-react`, `landing.tsx`, `command.tsx`, `context-menu.tsx`, `toggle-group.tsx`, `carousel.tsx`, `select.tsx`, `chart.tsx`, `drawer.tsx`, `public-share-view.tsx`, `pagination.tsx`, `install-banner.tsx`, `breadcrumb.tsx`, `scroll-area.tsx`, `utils.ts`, `popover.tsx`, `vault-setup.tsx`, `sheet.tsx`, `radio-group.tsx`, `hover-card.tsx`, `resizable.tsx`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `menubar.tsx`, `ui/sidebar.tsx`, `package.json`, `admin-panel.tsx`, `file-explorer.tsx`, `use-toast.ts`, `auth-flow.tsx`, `share-dialog.tsx`, `file-viewers.tsx`, `file-utils.ts`, `legal-pages.tsx`, `lucide-react`, `landing.tsx`, `app/page.tsx`, `command.tsx`, `context-menu.tsx`, `toggle-group.tsx`, `carousel.tsx`, `layout.tsx`, `select.tsx`, `use-install-prompt.ts`, `chart.tsx`, `drawer.tsx`, `cn`, `public-share-view.tsx`, `pagination.tsx`, `install-banner.tsx`, `breadcrumb.tsx`, `scroll-area.tsx`, `utils.ts`, `popover.tsx`, `vault-setup.tsx`, `sheet.tsx`, `radio-group.tsx`, `hover-card.tsx`, `resizable.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _727 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.028169014084507043 - nodes in this community are weakly interconnected._
- **Should `menubar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `ui/sidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._