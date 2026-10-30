# session.ts

> 22 nodes

## Key Concepts

- **session.ts** (57 connections) — `src/lib/session.ts`
- **createSession()** (10 connections) — `src/lib/session.ts`
- **getCurrentUser()** (10 connections) — `src/lib/session.ts`
- **login/route.ts** (5 connections) — `src/app/api/admin/login/route.ts`
- **me/route.ts** (5 connections) — `src/app/api/auth/me/route.ts`
- **createAdminSession()** (4 connections) — `src/lib/session.ts`
- **hashIP()** (3 connections) — `src/lib/session.ts`
- **isAdmin()** (3 connections) — `src/lib/session.ts`
- **sign()** (3 connections) — `src/lib/session.ts`
- **verify()** (3 connections) — `src/lib/session.ts`
- **POST()** (2 connections) — `src/app/api/admin/login/route.ts`
- **GET()** (2 connections) — `src/app/api/auth/me/route.ts`
- **GET()** (2 connections) — `src/app/api/telegram/status/route.ts`
- **getClientIp()** (2 connections) — `src/lib/session.ts`
- **ipSameNetwork()** (1 connections) — `src/lib/session.ts`
- **dynamic** (1 connections) — `src/app/api/admin/login/route.ts`
- **runtime** (1 connections) — `src/app/api/admin/login/route.ts`
- **dynamic** (1 connections) — `src/app/api/auth/me/route.ts`
- **runtime** (1 connections) — `src/app/api/auth/me/route.ts`
- **ADMIN_COOKIE** (1 connections) — `src/lib/session.ts`
- **DEVICE_COOKIE** (1 connections) — `src/lib/session.ts`
- **SESSION_COOKIE** (1 connections) — `src/lib/session.ts`

## Relationships

- [db.ts](db.ts.md) (12 shared connections)
- [requireUser](requireUser.md) (8 shared connections)
- [types.ts](types.ts.md) (6 shared connections)
- [crypto.ts](crypto.ts.md) (6 shared connections)
- [file-ops.ts](file-ops.ts.md) (4 shared connections)
- [bot-link/route.ts](bot-link-route.ts.md) (3 shared connections)
- [sso/route.ts](sso-route.ts.md) (3 shared connections)
- [\[\[...path\]\]/route.ts]([[...path]]-route.ts.md) (3 shared connections)
- [db](db.md) (3 shared connections)
- [settings/route.ts](settings-route.ts.md) (3 shared connections)
- [admin/logout/route.ts](admin-logout-route.ts.md) (2 shared connections)
- [store.ts](store.ts.md) (1 shared connections)

## Source Files

- `src/app/api/admin/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/telegram/status/route.ts`
- `src/lib/session.ts`

## Audit Trail

- EXTRACTED: 87 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*