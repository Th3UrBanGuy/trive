import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"
import { deleteFileFromVault } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const file = await db.file.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })
    await deleteFileFromVault(id, file.userId)
    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
