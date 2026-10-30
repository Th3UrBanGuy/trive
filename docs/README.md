# TriVE — Software Design Package (SDP)

> Complete documentation set for the TriVE zero-knowledge encrypted cloud storage
> platform, built by Tectonic.

## Documentation Index

| Document | Purpose |
|----------|---------|
| **[architecture.md](architecture.md)** | System architecture, component map, data flow, directory structure, tech stack |
| **[design.md](design.md)** | Product philosophy, visual system, design tokens, component patterns |
| **[mechanism.md](mechanism.md)** | Deep technical mechanisms: encryption, erasure coding, dedup, share resolution, vault persistence |
| **[prompt.md](prompt.md)** | AI-assistant system prompts for working on TriVE (master, review, triage, feature, audit) |
| **[skills.md](skills.md)** | Product capabilities + development skills required + Z.ai SDK skill integrations |
| **[whattodo.md](whattodo.md)** | Best practices, conventions, contribution guide, checklists |
| **[whatnottodo.md](whatnottodo.md)** | Anti-patterns, known pitfalls, the "7 deadly sins" |
| **[VULNERABILITIES.md](VULNERABILITIES.md)** | Full security audit: 6 CRITICAL, 8 HIGH, 10 MEDIUM, 11 LOW, 10 workflow flaws, 15 missing features, 9 orphaned-resource risks |

## Figures (SVG)

| Figure | Description |
|--------|-------------|
| [figures/architecture.svg](figures/architecture.svg) | Full system architecture — browser → Next.js → Prisma/GramJS → Telegram |
| [figures/upload-pipeline.svg](figures/upload-pipeline.svg) | Upload flow — chunk → encrypt → dedup → erasure → Telegram → manifest |
| [figures/share-resolution.svg](figures/share-resolution.svg) | Share URL resolution + access gates + download streaming |
| [figures/data-model.svg](figures/data-model.svg) | ER diagram — 7 Prisma models + relations + known issues |
| [figures/encryption-erasure.svg](figures/encryption-erasure.svg) | Key derivation + AES-256-GCM per-chunk + Reed-Solomon encode/decode |

## Quick Start

```bash
# 1. Restore .env (gets wiped on sandbox resets)
bash <(unzip -p trive-final.zip restore-env.sh)

# 2. Install deps (if needed)
bun install

# 3. Push DB schema
bun run db:push

# 4. Start dev server
bun run dev    # → http://localhost:3000

# 5. Lint
bun run lint
```

## Severity Summary (from VULNERABILITIES.md)

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 6 | 1 fixed (C-4 upload route), 5 open |
| HIGH | 8 | 1 fixed (H-3 quota check), 7 open |
| MEDIUM | 10 | 0 fixed, 10 open |
| LOW | 11 | 0 fixed, 11 open |
| Workflow Flaws | 10 | 0 fixed, 10 open |
| Missing Features | 15 | 1 fixed (F-1 upload), 14 open |
| Orphaned Risks | 9 | 0 fixed, 9 open |

## Top 5 Must-Fix-First

1. **C-1**: Remove Caddy `XTransformPort` (open SSRF)
2. **C-2**: Refuse to boot without `APP_SECRET` ≥ 32 bytes
3. **C-3**: Implement real zero-knowledge OR remove the claim
4. **C-5**: Move share passwords out of URL query params
5. **C-6**: Constant-time admin password comparison

---

*Built by Tectonic · Next.js 16 · GramJS · AES-256-GCM · Reed-Solomon GF(2⁸)*
