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
    const trashed = searchParams.get("trashed") === "1"
    const files = await db.file.findMany({
      where: trashed ? {} : { trashed: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, phone: true, name: true } },
        _count: { select: { chunks: true, shareLinks: true } },
      },
    })
    const result = files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      encrypted: f.encrypted,
      isChunked: f.isChunked,
      totalChunks: f.totalChunks,
      starred: f.starred,
      trashed: f.trashed,
      checksum: f.checksum,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      lastAccessedAt: f.lastAccessedAt?.toISOString() || null,
      user: f.user,
      chunkCount: f._count.chunks,
      shareCount: f._count.shareLinks,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
