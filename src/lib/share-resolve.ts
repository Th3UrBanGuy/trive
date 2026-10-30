import { db } from "@/lib/db"
import type { ShareLink } from "@/lib/types"

/**
 * Resolve a share link from a public `?share=` key.
 *
 * Supported key formats:
 *   1. "username/slug"   → find the user by telegramUsername (case-insensitive),
 *                          then the share by customSlug scoped to that user.
 *   2. "username/token"  → same as above, but match by opaque token.
 *   3. "slug"            → backward-compatible GLOBAL lookup by customSlug.
 *   4. "token"           → backward-compatible GLOBAL lookup by token.
 *
 * Why this helper exists:
 *   - `telegramUsername` is NOT a `@unique` field on the User model, so
 *     `db.user.findUnique({ where: { telegramUsername } })` throws a Prisma
 *     validation error. We use `findFirst` instead.
 *   - SQLite string comparisons are case-sensitive by default, and Telegram
 *     usernames preserve the user's chosen casing (e.g. "Ra726ma"). We store
 *     them lowercased (see sign-in route) and lowercase the lookup key here.
 *     A JS-level fallback guards against any legacy mixed-case rows.
 */
export async function findShare(key: string) {
  if (!key) return null

  // ---- username/slug  OR  username/token ----
  if (key.includes("/")) {
    const slashIdx = key.indexOf("/")
    const usernameRaw = key.slice(0, slashIdx)
    const slugOrToken = key.slice(slashIdx + 1)
    if (!usernameRaw || !slugOrToken) return null

    const username = usernameRaw.toLowerCase()

    // Find the user by telegramUsername. `telegramUsername` is not @unique,
    // so we MUST use findFirst (findUnique throws a validation error).
    // Try the lowercased value first (canonical form), then fall back to a
    // JS case-insensitive scan in case any legacy row wasn't normalized.
    let user = await db.user.findFirst({
      where: { telegramUsername: username },
      select: { id: true },
    })
    if (!user) {
      const candidates = await db.user.findMany({
        where: { telegramUsername: { not: null } },
        select: { id: true, telegramUsername: true },
      })
      const hit = candidates.find(
        (c) => (c.telegramUsername || "").toLowerCase() === username
      )
      if (hit) user = { id: hit.id }
    }
    if (!user) return null

    // Try customSlug first (lowercased — slugs are stored lowercase), then
    // the opaque token (tokens are random strings, matched verbatim).
    return (
      (await db.shareLink.findFirst({
        where: { customSlug: slugOrToken.toLowerCase(), userId: user.id },
        include: { file: true, folder: true, items: true },
      })) ||
      (await db.shareLink.findFirst({
        where: { token: slugOrToken, userId: user.id },
        include: { file: true, folder: true, items: true },
      }))
    )
  }

  // ---- backward-compatible global lookup (no slash) ----
  const slug = key.toLowerCase()
  return (
    (await db.shareLink.findUnique({
      where: { customSlug: slug },
      include: { file: true, folder: true, items: true },
    })) ||
    (await db.shareLink.findUnique({
      where: { token: key },
      include: { file: true, folder: true, items: true },
    }))
  )
}

/**
 * Map a raw Prisma ShareLink row (with included relations) to the public
 * ShareLink type sent to the dashboard. Centralizes the share → JSON shape
 * so both `GET /api/share` (list) and `POST /api/share/batch` (create)
 * return identical shapes.
 *
 * Exposes:
 *   - viewerEmails: unique emails that have accessed (split from the raw
 *     comma-separated `viewerEmails` column). Returns `[]` when emailGate is
 *     off or no one has accessed yet. The dashboard uses this to render an
 *     "Access log" panel on each share row.
 *   - allowedEmails: the raw allowlist string (comma-separated emails) or
 *     null. The dashboard uses this to render the configured allowlist.
 */
export function mapShare(s: any): ShareLink {
  const rawViewerEmails: string | null = s.viewerEmails
  const viewerEmails: string[] = rawViewerEmails && rawViewerEmails.trim()
    ? rawViewerEmails
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
    : []

  return {
    id: s.id,
    token: s.token,
    customSlug: s.customSlug,
    fileId: s.fileId,
    folderId: s.folderId,
    hasPassword: !!s.password,
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    downloadCount: s.downloadCount,
    maxDownloads: s.maxDownloads,
    viewCount: s.viewCount,
    maxViews: s.maxViews,
    viewOnly: s.viewOnly,
    emailGate: s.emailGate,
    accessIps: !!s.accessIps,
    allowedEmails: s.allowedEmails && typeof s.allowedEmails === "string" ? s.allowedEmails.trim() || null : null,
    viewerEmails,
    lastAccessedAt: s.lastAccessedAt ? s.lastAccessedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    item: s.file
      ? { name: s.file.name, size: Number(s.file.size), mimeType: s.file.mimeType }
      : s.folder
      ? { name: s.folder.name, size: 0, mimeType: "folder" }
      : s.items?.length
      ? { name: `${s.items.length} items`, size: 0, mimeType: "batch" }
      : undefined,
  }
}
