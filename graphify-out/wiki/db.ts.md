# db.ts

> 42 nodes

## Key Concepts

- **db.ts** (38 connections) — `src/lib/db.ts`
- **requireAdmin()** (22 connections) — `src/lib/session.ts`
- **deleteFileFromVault()** (11 connections) — `src/lib/file-ops.ts`
- **db/route.ts** (10 connections) — `src/app/api/admin/db/route.ts`
- **admin/files/[id]/route.ts** (9 connections) — `src/app/api/admin/files/[id]/route.ts`
- **users/[id]/route.ts** (9 connections) — `src/app/api/admin/users/[id]/route.ts`
- **admin/activity/route.ts** (7 connections) — `src/app/api/admin/activity/route.ts`
- **admin/files/route.ts** (7 connections) — `src/app/api/admin/files/route.ts`
- **shares/[id]/route.ts** (7 connections) — `src/app/api/admin/shares/[id]/route.ts`
- **shares/route.ts** (7 connections) — `src/app/api/admin/shares/route.ts`
- **stats/route.ts** (7 connections) — `src/app/api/admin/stats/route.ts`
- **users/route.ts** (7 connections) — `src/app/api/admin/users/route.ts`
- **deleteFolderRecursive()** (4 connections) — `src/lib/file-ops.ts`
- **DELETE()** (3 connections) — `src/app/api/admin/files/[id]/route.ts`
- **DELETE()** (3 connections) — `src/app/api/admin/users/[id]/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/activity/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/db/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/files/route.ts`
- **DELETE()** (2 connections) — `src/app/api/admin/shares/[id]/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/shares/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/stats/route.ts`
- **GET()** (2 connections) — `src/app/api/admin/users/route.ts`
- **fs** (1 connections) — `fs`
- **dynamic** (1 connections) — `src/app/api/admin/activity/route.ts`
- **runtime** (1 connections) — `src/app/api/admin/activity/route.ts`
- *... and 17 more nodes in this community*

## Relationships

- [db](db.md) (13 shared connections)
- [session.ts](session.ts.md) (12 shared connections)
- [requireUser](requireUser.md) (8 shared connections)
- [file-ops.ts](file-ops.ts.md) (8 shared connections)
- [crypto.ts](crypto.ts.md) (6 shared connections)
- [\[\[...path\]\]/route.ts]([[...path]]-route.ts.md) (3 shared connections)
- [types.ts](types.ts.md) (3 shared connections)
- [share/\[id\]/download/route.ts](share-[id]-download-route.ts.md) (2 shared connections)
- [telegram-service.ts](telegram-service.ts.md) (1 shared connections)
- [bot-link/route.ts](bot-link-route.ts.md) (1 shared connections)
- [sso/route.ts](sso-route.ts.md) (1 shared connections)
- [folders/route.ts](folders-route.ts.md) (1 shared connections)

## Source Files

- `fs`
- `src/app/api/admin/activity/route.ts`
- `src/app/api/admin/db/route.ts`
- `src/app/api/admin/files/[id]/route.ts`
- `src/app/api/admin/files/route.ts`
- `src/app/api/admin/shares/[id]/route.ts`
- `src/app/api/admin/shares/route.ts`
- `src/app/api/admin/stats/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/lib/db.ts`
- `src/lib/file-ops.ts`
- `src/lib/session.ts`

## Audit Trail

- EXTRACTED: 123 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*