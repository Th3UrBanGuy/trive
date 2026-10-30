import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/crypto"
import { findShare } from "@/lib/share-resolve"
import { streamFileFromVault, streamFolderZipFromVault, streamBatchZipFromVault } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "0.0.0.0"
}

/** Recursively check if a file is inside a folder (or its subfolders). */
async function isFileInFolder(fileId: string, folderId: string): Promise<boolean> {
  const file = await db.file.findUnique({ where: { id: fileId }, select: { folderId: true } })
  if (!file) return false
  if (file.folderId === folderId) return true
  if (!file.folderId) return false
  // Walk up the folder tree
  let currentFolderId = file.folderId
  while (currentFolderId) {
    if (currentFolderId === folderId) return true
    const folder = await db.folder.findUnique({ where: { id: currentFolderId }, select: { parentId: true } })
    if (!folder) return false
    currentFolderId = folder.parentId || null
  }
  return false
}

// Public download by share token OR custom slug.
// Supports: single file (stream), folder (zip), view-only (inline preview).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: key } = await params
    const { searchParams } = new URL(req.url)
    const password = searchParams.get("password")
    const email = searchParams.get("email")
    const inline = searchParams.get("inline") === "1" // for embedding in viewers

    const share = await findShare(key)
    if (!share) return NextResponse.json({ error: "Share link not found" }, { status: 404 })

    // Trashed/deleted item → blocked instantly
    if (share.fileId && (!share.file || share.file.trashed)) {
      return NextResponse.json({ error: "This file is no longer available", removed: true } as any, { status: 404 })
    }
    if (share.folderId && (!share.folder || share.folder.trashed)) {
      return NextResponse.json({ error: "This folder is no longer available", removed: true } as any, { status: 404 })
    }

    // Expiry
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This share link has expired" }, { status: 410 })
    }
    // Download cap (only counts actual downloads, not inline views)
    if (!inline && share.maxDownloads !== null && share.downloadCount >= share.maxDownloads) {
      return NextResponse.json({ error: "Download limit reached" }, { status: 410 })
    }
    // View-only: allow inline preview but block download
    if (share.viewOnly && !inline) {
      return NextResponse.json({ error: "This link is view-only. Downloads are disabled.", viewOnly: true } as any, { status: 403 })
    }
    // IP allowlist
    if (share.accessIps && share.accessIps.trim()) {
      const allowed = share.accessIps.split(",").map((x) => x.trim()).filter(Boolean)
      const ip = clientIp(req)
      if (!allowed.includes(ip) && !allowed.includes("0.0.0.0")) {
        return NextResponse.json({ error: "Access from this network is not allowed" }, { status: 403 })
      }
    }
    // Password
    if (share.password) {
      if (!password || !verifyPassword(password, share.password)) {
        return NextResponse.json({ error: "Incorrect password", needsPassword: true } as any, { status: 401 })
      }
    }
    // Email gate
    if (share.emailGate) {
      if (!email) {
        return NextResponse.json({ error: "Email required to download", needsEmail: true } as any, { status: 401 })
      }
      const allowlist = share.allowedEmails || ""
      if (allowlist.trim()) {
        const allowed = allowlist.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        if (!allowed.includes(email.toLowerCase())) {
          return NextResponse.json({ error: "This email is not on the allowlist" }, { status: 403 })
        }
      }
    }

    // ---- Batch share (ShareItem): download individual file by fileId ----
    const fileIdParam = searchParams.get("fileId")
    if (share.items && share.items.length > 0 && fileIdParam) {
      // A file is downloadable from a batch share if EITHER:
      //   (a) it's a standalone ShareItem (si.fileId === fileIdParam), OR
      //   (b) it lives inside one of the share's folders (recursive check).
      const directItem = share.items.find((si: any) => si.fileId === fileIdParam)
      let authorized = !!directItem
      if (!authorized) {
        // Check if the file is inside any folder belonging to this batch share.
        const folderIds = share.items
          .filter((si: any) => si.folderId)
          .map((si: any) => si.folderId) as string[]
        for (const fid of folderIds) {
          if (await isFileInFolder(fileIdParam, fid)) {
            authorized = true
            break
          }
        }
      }
      if (!authorized) {
        return NextResponse.json({ error: "File not found in this share" }, { status: 404 })
      }
      const file = await db.file.findUnique({ where: { id: fileIdParam } })
      if (!file || file.trashed || file.userId !== share.userId) {
        return NextResponse.json({ error: "File not found" }, { status: 404 })
      }
      const { stream, name, mimeType, size } = await streamFileFromVault(fileIdParam, share.userId)
      if (!inline) {
        await db.shareLink.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 }, lastAccessedAt: new Date() } })
      }
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": mimeType || "application/octet-stream",
          "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
          "content-length": String(size),
          "cache-control": "private, no-store",
        },
      })
    }

    // ---- Folder share: download individual file OR entire folder as ZIP ----
    if (share.folderId) {
      const fileId = searchParams.get("fileId")
      // If fileId is specified, download just that file from the folder
      if (fileId) {
        // Verify the file belongs to this folder (recursively)
        const file = await db.file.findUnique({ where: { id: fileId } })
        if (!file || file.trashed || file.userId !== share.userId) {
          return NextResponse.json({ error: "File not found in this folder" }, { status: 404 })
        }
        // Verify the file is inside the shared folder (recursive check)
        const isInside = await isFileInFolder(fileId, share.folderId)
        if (!isInside) {
          return NextResponse.json({ error: "File not found in this folder" }, { status: 404 })
        }
        const rangeHeader = req.headers.get("range")
        const { stream, name, mimeType, size, rangeResult } = await streamFileFromVault(fileId, share.userId, rangeHeader)
        if (!inline && !rangeResult) {
          await db.shareLink.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 }, lastAccessedAt: new Date() } })
        }

        const headers: Record<string, string> = {
          "content-type": mimeType || "application/octet-stream",
          "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
          "cache-control": "private, no-store",
          "accept-ranges": "bytes",
        }

        if (rangeResult) {
          headers["content-range"] = `bytes ${rangeResult.start}-${rangeResult.end}/${rangeResult.total}`
          headers["content-length"] = String(rangeResult.contentLength)
          return new Response(stream, {
            status: 206,
            headers,
          })
        }

        headers["content-length"] = String(size)
        return new Response(stream, {
          status: 200,
          headers,
        })
      }
      // No fileId → download entire folder as ZIP
      const { stream, name } = await streamFolderZipFromVault(share.folderId, share.userId)
      if (!inline) {
        await db.shareLink.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 }, lastAccessedAt: new Date() } })
      }
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}.zip"`,
          "cache-control": "private, no-store",
        },
      })
    }

    // ---- Single file share: stream ----
    if (share.fileId) {
      const rangeHeader = req.headers.get("range")
      const { stream, name, mimeType, size, rangeResult } = await streamFileFromVault(share.fileId, share.userId, rangeHeader)
      if (!inline && !rangeResult) {
        await db.shareLink.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 }, lastAccessedAt: new Date() } })
      }

      const headers: Record<string, string> = {
        "content-type": mimeType || "application/octet-stream",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
        "cache-control": "private, no-store",
        "accept-ranges": "bytes",
      }

      if (rangeResult) {
        headers["content-range"] = `bytes ${rangeResult.start}-${rangeResult.end}/${rangeResult.total}`
        headers["content-length"] = String(rangeResult.contentLength)
        return new Response(stream, {
          status: 206,
          headers,
        })
      }

      headers["content-length"] = String(size)
      return new Response(stream, {
        status: 200,
        headers,
      })
    }

    // ---- Batch share WITHOUT fileId: "Download all" → stream everything as a ZIP ----
    // Standalone files go at the zip root; each folder's tree is preserved under
    // its own name. This powers the "Download all" button on the batch share page.
    if (share.items && share.items.length > 0) {
      const { stream, name } = await streamBatchZipFromVault(
        share.items.map((si: any) => ({ fileId: si.fileId, folderId: si.folderId })),
        share.userId,
        "trive-share"
      )
      if (!inline) {
        await db.shareLink.update({ where: { id: share.id }, data: { downloadCount: { increment: 1 }, lastAccessedAt: new Date() } })
      }
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}.zip"`,
          "cache-control": "private, no-store",
        },
      })
    }

    // Unknown share shape — shouldn't happen, but guard anyway.
    return NextResponse.json({ error: "Unsupported share type" }, { status: 400 })
  } catch (e: any) {
    const msg = e?.message || "Download failed"
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } })
  }
}
