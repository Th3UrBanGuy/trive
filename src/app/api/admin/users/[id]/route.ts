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
    const user = await db.user.findUnique({
      where: { id },
      include: { files: { include: { chunks: true } } },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Delete all the user's files from Telegram vault + DB (cascades chunks + shares)
    for (const file of user.files) {
      try {
        await deleteFileFromVault(file.id, user.id)
      } catch {}
    }
    // Cascade deletes folders, shares, activities
    await db.user.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
