import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import type { Folder } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function mapFolder(f: any): Folder {
  return {
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    color: f.color,
    icon: f.icon,
    starred: f.starred,
    trashed: f.trashed,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = await req.json()
    const folder = await db.folder.findUnique({ where: { id } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }
    const updated = await db.folder.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.starred !== undefined ? { starred: body.starred } : {}),
        ...(body.trashed !== undefined ? { trashed: body.trashed } : {}),
      },
    })
    return NextResponse.json(mapFolder(updated))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const folder = await db.folder.findUnique({ where: { id } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }
    // If trashed already, delete permanently (recursive: files + subfolders);
    // else move to trash.
    if (folder.trashed) {
      const { deleteFolderRecursive } = await import("@/lib/file-ops")
      await deleteFolderRecursive(id, user.id)
    } else {
      await db.folder.update({ where: { id }, data: { trashed: true } })
    }
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
