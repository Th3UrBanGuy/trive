import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { fileCategory, CATEGORY_COLORS } from "@/lib/file-utils"
import type { StorageAnalytics } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<string, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
  pdf: "PDFs",
  spreadsheet: "Sheets",
  presentation: "Slides",
  archive: "Archives",
  code: "Code",
  document: "Documents",
  other: "Other",
}

export async function GET() {
  try {
    const user = await requireUser()
    const files = await db.file.findMany({ where: { userId: user.id, trashed: false }, select: { size: true, mimeType: true, createdAt: true } })
    const folders = await db.folder.count({ where: { userId: user.id, trashed: false } })

    let totalUsed = 0
    const byTypeMap = new Map<string, { size: number; count: number }>()
    for (const f of files) {
      const size = Number(f.size)
      totalUsed += size
      const cat = fileCategory(f.mimeType)
      const cur = byTypeMap.get(cat) || { size: 0, count: 0 }
      cur.size += size
      cur.count += 1
      byTypeMap.set(cat, cur)
    }
    const byType = Array.from(byTypeMap.entries())
      .map(([type, v]) => ({
        type,
        label: TYPE_LABELS[type] || type,
        size: v.size,
        count: v.count,
        color: CATEGORY_COLORS[type] || CATEGORY_COLORS.other,
      }))
      .sort((a, b) => b.size - a.size)

    // Upload trend (last 7 days)
    const trend: { date: string; size: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setDate(d.getDate() + 1)
      const dayFiles = files.filter((f) => f.createdAt >= d && f.createdAt < end)
      const size = dayFiles.reduce((acc, f) => acc + Number(f.size), 0)
      trend.push({ date: d.toISOString().slice(0, 10), size })
    }

    const recentActivity = await db.activity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    })

    const result: StorageAnalytics = {
      totalUsed,
      fileCount: files.length,
      folderCount: folders,
      byType,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt.toISOString(),
      })),
      uploadTrend: trend,
    }
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
