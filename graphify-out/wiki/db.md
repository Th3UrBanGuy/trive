# db

> 14 nodes

## Key Concepts

- **db** (36 connections) — `src/lib/db.ts`
- **share/route.ts** (13 connections) — `src/app/api/share/route.ts`
- **batch/route.ts** (12 connections) — `src/app/api/share/batch/route.ts`
- **share-resolve.ts** (10 connections) — `src/lib/share-resolve.ts`
- **mapShare()** (6 connections) — `src/lib/share-resolve.ts`
- **POST()** (5 connections) — `src/app/api/share/batch/route.ts`
- **POST()** (5 connections) — `src/app/api/share/route.ts`
- **hashPassword()** (5 connections) — `src/lib/crypto.ts`
- **randomToken()** (5 connections) — `src/lib/crypto.ts`
- **GET()** (3 connections) — `src/app/api/share/route.ts`
- **dynamic** (1 connections) — `src/app/api/share/batch/route.ts`
- **runtime** (1 connections) — `src/app/api/share/batch/route.ts`
- **dynamic** (1 connections) — `src/app/api/share/route.ts`
- **runtime** (1 connections) — `src/app/api/share/route.ts`

## Relationships

- [db.ts](db.ts.md) (13 shared connections)
- [requireUser](requireUser.md) (11 shared connections)
- [crypto.ts](crypto.ts.md) (7 shared connections)
- [share/\[id\]/download/route.ts](share-[id]-download-route.ts.md) (5 shared connections)
- [types.ts](types.ts.md) (4 shared connections)
- [session.ts](session.ts.md) (3 shared connections)
- [file-ops.ts](file-ops.ts.md) (3 shared connections)
- [bot-link/route.ts](bot-link-route.ts.md) (1 shared connections)
- [sso/route.ts](sso-route.ts.md) (1 shared connections)
- [\[\[...path\]\]/route.ts]([[...path]]-route.ts.md) (1 shared connections)
- [folders/route.ts](folders-route.ts.md) (1 shared connections)
- [settings/route.ts](settings-route.ts.md) (1 shared connections)

## Source Files

- `src/app/api/share/batch/route.ts`
- `src/app/api/share/route.ts`
- `src/lib/crypto.ts`
- `src/lib/db.ts`
- `src/lib/share-resolve.ts`

## Audit Trail

- EXTRACTED: 77 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*