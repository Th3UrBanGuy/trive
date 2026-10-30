import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500)
    const shares = await db.shareLink.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, phone: true, name: true } },
        file: { select: { id: true, name: true, size: true, mimeType: true } },
      },
    })
    const result = shares.map((s) => ({
      id: s.id,
      token: s.token,
      customSlug: s.customSlug,
      hasPassword: !!s.password,
      expiresAt: s.expiresAt?.toISOString() || null,
      downloadCount: s.downloadCount,
      maxDownloads: s.maxDownloads,
      viewCount: s.viewCount,
      maxViews: s.maxViews,
      viewOnly: s.viewOnly,
      emailGate: s.emailGate,
      accessIps: !!s.accessIps,
      lastAccessedAt: s.lastAccessedAt?.toISOString() || null,
      createdAt: s.createdAt.toISOString(),
      user: s.user,
      file: s.file ? { ...s.file, size: Number(s.file.size) } : null,
      expired: s.expiresAt ? new Date(s.expiresAt).getTime() < Date.now() : false,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
