import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { postFolderManifest } from "@/lib/file-ops"
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

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(req.url)
    const parentIdParam = searchParams.get("parentId")
    const starred = searchParams.get("starred") === "1"
    const trashed = searchParams.get("trashed") === "1"
    const q = searchParams.get("q")

    let where: any = { userId: user.id, trashed }
    if (starred) where.starred = true
    if (q) where.name = { contains: q }
    // When searching, don't filter by parentId — search ALL folders
    if (!q) {
      if (parentIdParam === "root" || parentIdParam === null) {
        where.parentId = null
      } else if (parentIdParam) {
        where.parentId = parentIdParam
      }
    }
    if (trashed) {
      delete where.trashed
      where.trashed = true
    } else {
      where.trashed = false
    }

    const folders = await db.folder.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { files: true, children: true } } },
    })

    const result: Folder[] = folders.map(mapFolder).map((f, i) => ({
      ...f,
      fileCount: (folders[i] as any)._count?.files ?? 0,
      folderCount: (folders[i] as any)._count?.children ?? 0,
    }))

    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const { name, parentId, color } = await req.json()
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 })
    }
    const folder = await db.folder.create({
      data: {
        userId: user.id,
        name: name.trim(),
        parentId: parentId === "root" || !parentId ? null : parentId,
        color: color || null,
      },
    })
    await db.activity.create({
      data: { userId: user.id, action: "folder_create", details: JSON.stringify({ name: folder.name, id: folder.id }) },
    })
    // Post folder manifest to vault so it persists across devices
    await postFolderManifest(user.id, folder.id).catch(() => {})
    return NextResponse.json(mapFolder(folder))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
