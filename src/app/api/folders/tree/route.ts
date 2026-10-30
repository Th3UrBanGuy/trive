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

export async function GET() {
  try {
    const user = await requireUser()
    const folders = await db.folder.findMany({
      where: { userId: user.id, trashed: false },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(folders.map(mapFolder))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
