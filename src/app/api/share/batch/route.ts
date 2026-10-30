import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { randomToken, hashPassword } from "@/lib/crypto"
import { mapShare } from "@/lib/share-resolve"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Create a SINGLE share link containing multiple files AND/OR folders.
 * The share preserves the file structure — recipients see all items in one view.
 * Custom slugs ARE supported.
 *
 * Body: { fileIds?: string[], folderIds?: string[], customSlug?, password?, expiresAt?, maxDownloads?, viewOnly?, maxViews?, emailGate?, allowedEmails? }
 * Returns: ShareLink (single)
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { fileIds, folderIds, customSlug, ...opts } = body

    const hasFiles = Array.isArray(fileIds) && fileIds.length > 0
    const hasFolders = Array.isArray(folderIds) && folderIds.length > 0

    if (!hasFiles && !hasFolders) {
      return NextResponse.json({ error: "fileIds or folderIds array required" }, { status: 400 })
    }

    // Verify ownership
    let verifiedFileIds: string[] = []
    let verifiedFolderIds: string[] = []
    if (hasFiles) {
      const files = await db.file.findMany({ where: { id: { in: fileIds }, userId: user.id }, select: { id: true } })
      verifiedFileIds = files.map((f) => f.id)
    }
    if (hasFolders) {
      const folders = await db.folder.findMany({ where: { id: { in: folderIds }, userId: user.id }, select: { id: true } })
      verifiedFolderIds = folders.map((f) => f.id)
    }

    const totalItems = verifiedFileIds.length + verifiedFolderIds.length
    if (totalItems === 0) {
      return NextResponse.json({ error: "No valid items found" }, { status: 404 })
    }

    // Validate custom slug if provided
    let finalSlug: string | null = null
    if (customSlug && typeof customSlug === "string" && customSlug.trim()) {
      const slug = customSlug.trim().toLowerCase()
      const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ error: "Custom link must be 2-64 chars: letters, numbers, hyphens." }, { status: 400 })
      }
      const reserved = new Set(["api", "share", "auth", "telegram", "files", "folders", "storage", "activity", "settings", "admin", "app", "dashboard"])
      if (reserved.has(slug)) {
        return NextResponse.json({ error: "This link is reserved." }, { status: 400 })
      }
      const existing = await db.shareLink.findFirst({ where: { customSlug: slug, userId: user.id } })
      if (existing) {
        return NextResponse.json({ error: "You already used this custom link." }, { status: 409 })
      }
      finalSlug = slug
    }

    // Create ONE share link
    const share = await db.shareLink.create({
      data: {
        userId: user.id,
        // For single-item backward compat, set fileId/folderId if only one item
        fileId: totalItems === 1 && verifiedFileIds.length === 1 ? verifiedFileIds[0] : null,
        folderId: totalItems === 1 && verifiedFolderIds.length === 1 ? verifiedFolderIds[0] : null,
        token: randomToken(16),
        customSlug: finalSlug,
        password: opts.password ? hashPassword(String(opts.password)) : null,
        expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
        maxDownloads: typeof opts.maxDownloads === "number" && opts.maxDownloads > 0 ? opts.maxDownloads : null,
        viewOnly: !!opts.viewOnly,
        maxViews: typeof opts.maxViews === "number" && opts.maxViews > 0 ? opts.maxViews : null,
        emailGate: !!opts.emailGate,
        allowedEmails: opts.allowedEmails && typeof opts.allowedEmails === "string" ? opts.allowedEmails.trim() : null,
        // Create ShareItem records for ALL items (so the public view can list them all)
        items: {
          create: [
            ...verifiedFileIds.map((fid) => ({ fileId: fid, folderId: null })),
            ...verifiedFolderIds.map((fid) => ({ fileId: null, folderId: fid })),
          ],
        },
      },
      include: { file: true, folder: true, items: true },
    })

    await db.activity.create({
      data: {
        userId: user.id,
        action: "share",
        details: JSON.stringify({ count: totalItems, files: verifiedFileIds.length, folders: verifiedFolderIds.length, token: share.token, customSlug: finalSlug }),
      },
    })

    return NextResponse.json(mapShare(share))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
