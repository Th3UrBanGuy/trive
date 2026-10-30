import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get("limit") || 200), 1000)
    const activities = await db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, phone: true, name: true } } },
    })
    const result = activities.map((a) => ({
      id: a.id,
      userId: a.userId,
      action: a.action,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
