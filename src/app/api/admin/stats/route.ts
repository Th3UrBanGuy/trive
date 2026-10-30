import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdmin()
    const [users, files, folders, shares, chunks, activities] = await Promise.all([
      db.user.count(),
      db.file.count(),
      db.folder.count(),
      db.shareLink.count(),
      db.fileChunk.count(),
      db.activity.count(),
    ])
    const storageAgg = await db.file.aggregate({ _sum: { size: true } })
    const totalStorage = Number(storageAgg._sum.size || 0)
    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentUsers = await db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } })
    const trashedFiles = await db.file.count({ where: { trashed: true } })
    const activeShares = await db.shareLink.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
    })

    return NextResponse.json({
      users,
      files,
      folders,
      shares,
      chunks,
      activities,
      totalStorage,
      recentUsers,
      trashedFiles,
      activeShares,
    })
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
