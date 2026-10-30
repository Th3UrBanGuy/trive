import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { randomToken, hashPassword } from "@/lib/crypto"
import { mapShare } from "@/lib/share-resolve"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i

export async function GET() {
  try {
    const user = await requireUser()
    const shares = await db.shareLink.findMany({
      where: { userId: user.id },
      include: { file: true, folder: true, items: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(shares.map(mapShare))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const {
      fileId,
      folderId,
      password,
      expiresAt,
      maxDownloads,
      customSlug,
      viewOnly,
      maxViews,
      emailGate,
      allowedEmails,
      accessIps,
    } = body

    if (!fileId && !folderId) {
      return NextResponse.json({ error: "fileId or folderId required" }, { status: 400 })
    }

    // verify ownership
    if (fileId) {
      const f = await db.file.findUnique({ where: { id: fileId } })
      if (!f || f.userId !== user.id) return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    if (folderId) {
      const f = await db.folder.findUnique({ where: { id: folderId } })
      if (!f || f.userId !== user.id) return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    // Validate + reserve custom slug
    let finalSlug: string | null = null
    if (customSlug && typeof customSlug === "string" && customSlug.trim()) {
      const slug = customSlug.trim().toLowerCase()
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json(
          { error: "Custom link must be 2-64 chars: letters, numbers, hyphens. Start/end with a letter or number." },
          { status: 400 }
        )
      }
      // Reserved slugs
      const reserved = new Set(["api", "share", "auth", "telegram", "files", "folders", "storage", "activity", "settings", "admin", "app", "dashboard"])
      if (reserved.has(slug)) {
        return NextResponse.json({ error: "This link is reserved. Please choose another." }, { status: 400 })
      }
      const existing = await db.shareLink.findFirst({ where: { customSlug: slug, userId: user.id } })
      if (existing) {
        return NextResponse.json({ error: "You already used this custom link. Try another." }, { status: 409 })
      }
      finalSlug = slug
    }

    const share = await db.shareLink.create({
      data: {
        userId: user.id,
        fileId: fileId || null,
        folderId: folderId || null,
        token: randomToken(16),
        customSlug: finalSlug,
        password: password ? hashPassword(String(password)) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxDownloads: typeof maxDownloads === "number" && maxDownloads > 0 ? maxDownloads : null,
        viewOnly: !!viewOnly,
        maxViews: typeof maxViews === "number" && maxViews > 0 ? maxViews : null,
        emailGate: !!emailGate,
        allowedEmails: allowedEmails && typeof allowedEmails === "string" ? allowedEmails.trim() : null,
        accessIps: accessIps && typeof accessIps === "string" ? accessIps.trim() : null,
      },
      include: { file: true },
    })
    await db.activity.create({
      data: { userId: user.id, action: "share", details: JSON.stringify({ name: share.file?.name, token: share.token, customSlug: finalSlug }) },
    })
    return NextResponse.json(mapShare(share))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
