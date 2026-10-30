import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import type { Activity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    const activities = await db.activity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    const result: Activity[] = activities.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
