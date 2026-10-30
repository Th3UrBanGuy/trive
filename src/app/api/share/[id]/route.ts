import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const share = await db.shareLink.findUnique({ where: { id } })
    if (!share || share.userId !== user.id) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 })
    }
    await db.shareLink.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
