import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { mapFile } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(req.url)
    const folderIdParam = searchParams.get("folderId")
    const starred = searchParams.get("starred") === "1"
    const trashed = searchParams.get("trashed") === "1"
    const q = searchParams.get("q")
    const all = searchParams.get("all") === "1" // fetch ALL files regardless of folder

    let where: any = { userId: user.id }
    if (starred) where.starred = true
    if (q) where.name = { contains: q }
    if (trashed) {
      where.trashed = true
    } else {
      where.trashed = false
    }
    // When "all" is set, don't filter by folder (for Recent, Files Direct, etc.)
    if (!all && !starred && !q && !trashed) {
      where.folderId = folderIdParam === "root" || !folderIdParam ? null : folderIdParam
    } else if (!all && folderIdParam && folderIdParam !== "root" && !starred && !q) {
      where.folderId = folderIdParam
    }

    const files = await db.file.findMany({ where, orderBy: { createdAt: "desc" } })
    return NextResponse.json(files.map(mapFile))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
