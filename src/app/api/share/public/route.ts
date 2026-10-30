import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/crypto"
import { findShare } from "@/lib/share-resolve"
import type { PublicShare } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "0.0.0.0"
}

function emailAllowed(email: string, allowlist: string | null): boolean {
  if (!allowlist || !allowlist.trim()) return true // no allowlist = any email
  const allowed = allowlist.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.toLowerCase())
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get("token") || searchParams.get("share")
    const password = searchParams.get("password")
    const email = searchParams.get("email")
    // `poll=1` is sent by the frontend's live-polling loop (every 1.5s while the
    // share is granted) to detect cascade deletes. WITHOUT this flag, every
    // poll would increment viewCount — a share with maxViews=10 would exhaust
    // itself within 15 seconds of the recipient opening the link. With this
    // flag, only the INITIAL load (no `poll` param) counts as a view.
    const isPoll = searchParams.get("poll") === "1"
    if (!key) return NextResponse.json({ error: "Token required" }, { status: 400 })

    const share = await findShare(key)
    if (!share) return NextResponse.json({ error: "Share link not found" }, { status: 404 })
    // Valid share types: single file, single folder, OR batch (has items)
    const hasItems = share.items && share.items.length > 0
    if (!share.fileId && !share.folderId && !hasItems) {
      return NextResponse.json({ error: "Unsupported share type" }, { status: 400 })
    }

    // ---- Trashed/deleted item → share dies INSTANTLY ----
    if (share.fileId && (!share.file || share.file.trashed)) {
      return NextResponse.json({ error: "This file is no longer available", removed: true } as any, { status: 404 })
    }
    if (share.folderId && (!share.folder || share.folder.trashed)) {
      return NextResponse.json({ error: "This folder is no longer available", removed: true } as any, { status: 404 })
    }

    const ip = clientIp(req)
    // Build item info — handle single file, single folder, OR multi-item (batch)
    let item: any
    if (share.items && share.items.length > 0) {
      // Multi-item share — collect all files + folders from ShareItem records
      const fileIds = share.items.filter((si: any) => si.fileId).map((si: any) => si.fileId)
      const folderIds = share.items.filter((si: any) => si.folderId).map((si: any) => si.folderId)
      const files = fileIds.length > 0
        ? await db.file.findMany({ where: { id: { in: fileIds }, trashed: false }, select: { id: true, name: true, size: true, mimeType: true, createdAt: true } })
        : []
      const foldersRaw = folderIds.length > 0
        ? await db.folder.findMany({ where: { id: { in: folderIds }, trashed: false }, select: { id: true, name: true, color: true } })
        : []
      // For each folder in the batch, collect its tree (files + subfolders)
      const foldersWithContent = []
      for (const f of foldersRaw) {
        const tree = await collectFolderTree(f.id)
        foldersWithContent.push({
          id: f.id,
          name: f.name,
          color: f.color,
          fileCount: tree.fileCount,
          totalSize: tree.totalSize,
          files: tree.files,
          subfolders: tree.subfolders,
        })
      }
      // Total size = standalone files + all files inside folders
      const folderSizes = foldersWithContent.reduce((a: number, f: any) => a + f.totalSize, 0)
      const fileSizes = files.reduce((a: number, f: any) => a + Number(f.size), 0)
      item = {
        type: "batch",
        name: `${files.length + foldersWithContent.length} item${files.length + foldersWithContent.length === 1 ? "" : "s"}`,
        fileCount: files.length,
        folderCount: foldersWithContent.length,
        totalSize: fileSizes + folderSizes,
        files: files.map((f: any) => ({ id: f.id, name: f.name, size: Number(f.size), mimeType: f.mimeType, createdAt: f.createdAt.toISOString() })),
        folders: foldersWithContent, // folders with their full content tree
      }
    } else if (share.fileId) {
      item = { type: "file", name: share.file!.name, size: Number(share.file!.size), mimeType: share.file!.mimeType }
    } else if (share.folderId) {
      const tree = await collectFolderTree(share.folderId)
      item = {
        type: "folder",
        name: share.folder!.name,
        fileCount: tree.fileCount,
        totalSize: tree.totalSize,
        files: tree.files,
        subfolders: tree.subfolders,
      }
    } else {
      item = null
    }

    // ---- Hard limits (return terminal state without revealing item) ----
    const expired = share.expiresAt ? new Date(share.expiresAt).getTime() < Date.now() : false
    if (expired) {
      return NextResponse.json({
        token: share.token, customSlug: share.customSlug, item: null, hasPassword: !!share.password,
        expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
        downloadCount: share.downloadCount, maxDownloads: share.maxDownloads,
        viewCount: share.viewCount, maxViews: share.maxViews, viewOnly: share.viewOnly,
        emailGate: share.emailGate, needsPassword: false, needsEmail: false, emailAllowed: false,
        expired: true, exhausted: false, viewOnlyEnforced: false,
        createdAt: share.createdAt.toISOString(),
      } satisfies PublicShare)
    }

    const viewExhausted = share.maxViews !== null && share.viewCount >= share.maxViews
    const dlExhausted = share.maxDownloads !== null && share.downloadCount >= share.maxDownloads
    if (viewExhausted || dlExhausted) {
      return NextResponse.json({
        token: share.token, customSlug: share.customSlug, item: null, hasPassword: !!share.password,
        expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
        downloadCount: share.downloadCount, maxDownloads: share.maxDownloads,
        viewCount: share.viewCount, maxViews: share.maxViews, viewOnly: share.viewOnly,
        emailGate: share.emailGate, needsPassword: false, needsEmail: false, emailAllowed: false,
        expired: false, exhausted: true, viewOnlyEnforced: false,
        createdAt: share.createdAt.toISOString(),
      } satisfies PublicShare)
    }

    // ---- IP allowlist ----
    if (share.accessIps && share.accessIps.trim()) {
      const allowed = share.accessIps.split(",").map((x) => x.trim()).filter(Boolean)
      if (!allowed.includes(ip) && !allowed.includes("0.0.0.0")) {
        return NextResponse.json({ error: "Access from this network is not allowed", expired: false, exhausted: false } as any, { status: 403 })
      }
    }

    // ---- Password gate ----
    let passwordOk = !share.password
    if (share.password) {
      if (!password) {
        // ask for password
        return NextResponse.json({
          token: share.token, customSlug: share.customSlug, item, hasPassword: true,
          expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
          downloadCount: share.downloadCount, maxDownloads: share.maxDownloads,
          viewCount: share.viewCount, maxViews: share.maxViews, viewOnly: share.viewOnly,
          emailGate: share.emailGate, needsPassword: true, needsEmail: false, emailAllowed: false,
          expired: false, exhausted: false, viewOnlyEnforced: share.viewOnly,
          createdAt: share.createdAt.toISOString(),
        } satisfies PublicShare)
      }
      if (!verifyPassword(password, share.password)) {
        return NextResponse.json({ error: "Incorrect password", needsPassword: true } as any, { status: 401 })
      }
      passwordOk = true
    }

    // ---- Email gate ----
    let emailOk = !share.emailGate
    if (share.emailGate) {
      if (!email) {
        return NextResponse.json({
          token: share.token, customSlug: share.customSlug, item: passwordOk ? item : null, hasPassword: !!share.password,
          expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
          downloadCount: share.downloadCount, maxDownloads: share.maxDownloads,
          viewCount: share.viewCount, maxViews: share.maxViews, viewOnly: share.viewOnly,
          emailGate: true, needsPassword: !passwordOk, needsEmail: true, emailAllowed: false,
          expired: false, exhausted: false, viewOnlyEnforced: share.viewOnly,
          createdAt: share.createdAt.toISOString(),
        } satisfies PublicShare)
      }
      if (!emailAllowed(email, share.allowedEmails)) {
        return NextResponse.json({ error: "This email is not on the allowlist for this link", needsEmail: true, emailAllowed: false } as any, { status: 403 })
      }
      emailOk = true
    }

    // ---- All gates passed: count the view (atomic, serverless-safe) ----
    // We do NOT increment viewCount when the request has `?poll=1` — that flag
    // is sent by the frontend's live-polling loop (every 1.5s) which checks for
    // cascade deletes. Without this guard, a share with maxViews=10 would
    // exhaust itself within 15 seconds of the recipient opening the link.
    // We still update lastAccessedAt + viewerEmails on every poll so the
    // dashboard shows fresh activity, but the viewCount only ticks on the
    // initial load (no `poll` param).
    const updatedViewerEmails = share.emailGate && email
      ? appendEmail(share.viewerEmails, email)
      : share.viewerEmails

    const viewIncrement = isPoll ? 0 : 1
    await db.shareLink.update({
      where: { id: share.id },
      data: {
        ...(viewIncrement ? { viewCount: { increment: viewIncrement } } : {}),
        lastAccessedAt: new Date(),
        ...(updatedViewerEmails !== share.viewerEmails ? { viewerEmails: updatedViewerEmails } : {}),
      },
    })

    return NextResponse.json({
      id: share.id,
      token: share.token,
      customSlug: share.customSlug,
      item,
      hasPassword: !!share.password,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
      downloadCount: share.downloadCount,
      maxDownloads: share.maxDownloads,
      viewCount: share.viewCount + viewIncrement,
      maxViews: share.maxViews,
      viewOnly: share.viewOnly,
      emailGate: share.emailGate,
      needsPassword: false,
      needsEmail: false,
      emailAllowed: true,
      expired: false,
      exhausted: false,
      viewOnlyEnforced: share.viewOnly,
      createdAt: share.createdAt.toISOString(),
    } satisfies PublicShare)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}

function appendEmail(existing: string | null, email: string): string {
  const list = (existing || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (!list.includes(email.toLowerCase())) list.push(email.toLowerCase())
  return list.join(",")
}

/**
 * Recursively collect all files + subfolders in a folder for the public
 * folder view model. Returns a tree structure that the frontend can render
 * as a browsable folder explorer.
 */
async function collectFolderTree(folderId: string): Promise<{
  files: { id: string; name: string; size: number; mimeType: string; createdAt: string }[]
  subfolders: { id: string; name: string; color: string | null; fileCount: number; totalSize: number; files: any[]; subfolders: any[] }[]
  fileCount: number
  totalSize: number
}> {
  const [files, subfolders] = await Promise.all([
    db.file.findMany({
      where: { folderId, trashed: false },
      select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    db.folder.findMany({
      where: { parentId: folderId, trashed: false },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ])

  const result = {
    files: files.map((f) => ({ id: f.id, name: f.name, size: Number(f.size), mimeType: f.mimeType, createdAt: f.createdAt.toISOString() })),
    subfolders: [] as any[],
    fileCount: files.length,
    totalSize: files.reduce((a, f) => a + Number(f.size), 0),
  }

  for (const sf of subfolders) {
    const subTree = await collectFolderTree(sf.id)
    result.subfolders.push({
      id: sf.id,
      name: sf.name,
      color: sf.color,
      fileCount: subTree.fileCount,
      totalSize: subTree.totalSize,
      files: subTree.files,
      subfolders: subTree.subfolders,
    })
    result.fileCount += subTree.fileCount
    result.totalSize += subTree.totalSize
  }

  return result
}
