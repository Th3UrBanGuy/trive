import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { uploadFileToVault } from "@/lib/file-ops"
import { db } from "@/lib/db"
import { MAX_FILE_SIZE } from "@/lib/file-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const user = await requireUser()

    const { searchParams } = new URL(req.url)
    const folderIdParam = searchParams.get("folderId")
    const folderId = folderIdParam && folderIdParam !== "root" ? folderIdParam : null

    // If a destination folder is specified, verify it exists + belongs to this user.
    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId }, select: { userId: true, trashed: true } })
      if (!folder || folder.userId !== user.id) {
        return NextResponse.json({ error: "Destination folder not found" }, { status: 404 })
      }
      if (folder.trashed) {
        return NextResponse.json({ error: "Cannot upload into a trashed folder" }, { status: 400 })
      }
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided (field name must be 'file')" }, { status: 400 })
    }

    // ---- Size limit (4 GB hard ceiling) ----
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB limit` },
        { status: 413 }
      )
    }

    // ---- Storage quota enforcement (0 = unlimited) ----
    if (user.storageLimitBytes && user.storageLimitBytes > 0) {
      const used = await db.file.aggregate({
        where: { userId: user.id, trashed: false },
        _sum: { size: true },
      })
      const usedBytes = Number(used._sum.size || 0)
      if (usedBytes + file.size > Number(user.storageLimitBytes)) {
        return NextResponse.json(
          { error: "Storage quota exceeded", used: usedBytes, limit: Number(user.storageLimitBytes) },
          { status: 413 }
        )
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || "application/octet-stream"
    const fileName = file.name || "untitled"

    const created = await uploadFileToVault({
      userId: user.id,
      fileName,
      mimeType,
      buffer,
      folderId,
    })

    return NextResponse.json(created)
  } catch (e: any) {
    console.error("[upload] error:", e)
    const msg = e?.message || "Upload failed"
    const lower = msg.toLowerCase()
    let status = 500
    if (msg === "UNAUTHORIZED") status = 401
    else if (lower.includes("flood")) status = 429
    else if (lower.includes("not connected") || lower.includes("not initialized") || lower.includes("not configured") || lower.includes("vault")) status = 400
    else if (lower.includes("quota") || lower.includes("exceed")) status = 413
    return NextResponse.json({ error: msg === "UNAUTHORIZED" ? "Authentication required" : msg }, { status })
  }
}
