import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { mapFile, deleteFileFromVault, postFileManifestUpdate } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = await req.json()
    const file = await db.file.findUnique({ where: { id } })
    if (!file || file.userId !== user.id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    const updated = await db.file.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.starred !== undefined ? { starred: body.starred } : {}),
        ...(body.trashed !== undefined ? { trashed: body.trashed, trashedAt: body.trashed ? new Date() : null } : {}),
        ...(body.folderId !== undefined ? { folderId: body.folderId === "root" || !body.folderId ? null : body.folderId } : {}),
      },
    })
    if (body.trashed === true) {
      await db.activity.create({ data: { userId: user.id, action: "trash", details: JSON.stringify({ name: file.name }) } })
    }
    // If the file was renamed, starred, or moved — update the manifest on Telegram
    // so the change persists across devices on next vault scan.
    if (body.name !== undefined || body.starred !== undefined || body.folderId !== undefined) {
      await postFileManifestUpdate(user.id, id).catch(() => {})
    }
    return NextResponse.json(mapFile(updated))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const file = await db.file.findUnique({ where: { id } })
    if (!file || file.userId !== user.id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    // If already trashed, delete permanently; else move to trash
    if (file.trashed) {
      await deleteFileFromVault(id, user.id)
    } else {
      await db.file.update({ where: { id }, data: { trashed: true, trashedAt: new Date() } })
    }
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
