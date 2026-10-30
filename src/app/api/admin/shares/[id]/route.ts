import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const share = await db.shareLink.findUnique({ where: { id } })
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 })
    await db.shareLink.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
