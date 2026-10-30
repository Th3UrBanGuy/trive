import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { generatePropfindResponse, generateOptionsResponse } from "@/lib/webdav-utils"
import { streamFileFromVault, uploadFileToVault, deleteFileFromVault } from "@/lib/file-ops"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authenticate(req: Request) {
  const user = await getCurrentUser()
  if (user) return user

  const authHeader = req.headers.get("Authorization")
  if (authHeader?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.split(" ")[1], "base64").toString()
      const [loginId, password] = decoded.split(":")
      if (password === process.env.ADMIN_PASSWORD) {
        const u = await db.user.findFirst({
          where: {
            OR: [
              { telegramUsername: loginId.toLowerCase() },
              { telegramId: loginId },
              ...(loginId ? [{ phone: loginId }] : []),
              { id: loginId },
            ],
          },
        })
        if (u) return { 
          id: u.id,
          telegramId: u.telegramId,
          phone: u.phone, 
          name: u.name, 
          telegramConnected: !!u.telegramSession || !!process.env.TELEGRAM_BOT_TOKEN,
          vaultReady: u.vaultReady
        }
      }
    } catch {}
  }
  return null
}

async function resolvePath(userId: string, pathParts: string[]) {
  let currentFolderId: string | null = null
  let currentItem: any = null

  if (!pathParts || pathParts.length === 0) return { folderId: null, currentItem: null }

  for (let i = 0; i < pathParts.length; i++) {
    const part = decodeURIComponent(pathParts[i])
    if (!part) continue

    const folder = await db.folder.findFirst({
      where: { userId, parentId: currentFolderId, name: part, trashed: false }
    })

    if (folder) {
      currentFolderId = folder.id
      currentItem = { type: 'folder', item: folder }
      continue
    }

    if (i === pathParts.length - 1) {
      const file = await db.file.findFirst({
        where: { userId, folderId: currentFolderId, name: part, trashed: false }
      })
      if (file) {
        currentItem = { type: 'file', item: file }
        break
      }
    }
    return null
  }
  return { folderId: currentFolderId, currentItem }
}

export async function OPTIONS() {
  return generateOptionsResponse()
}

export async function PROPFIND(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) {
    return new Response("Unauthorized", { 
      status: 401, 
      headers: { 
        'WWW-Authenticate': 'Basic realm="TriVE WebDAV"',
        'Content-Type': 'text/plain'
      } 
    })
  }

  const params = await context?.params
  const path = params?.path || []
  const depth = req.headers.get("Depth") || "1"
  
  const resolution = await resolvePath(user.id, path)
  if (!resolution && path.length > 0) return new Response("Not Found", { status: 404 })

  const folderId = resolution?.currentItem?.type === 'folder' ? resolution.currentItem.item.id : (resolution?.folderId || null)
  
  if (resolution?.currentItem?.type === 'file') {
    const xml = generatePropfindResponse(req.url, [], [], "0")
    return new Response(xml, {
      status: 207,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'DAV': '1, 2' }
    })
  }

  const folders = await db.folder.findMany({
    where: { userId: user.id, parentId: folderId, trashed: false }
  })
  const files = await db.file.findMany({
    where: { userId: user.id, folderId, trashed: false }
  })

  const xml = generatePropfindResponse(req.url, folders, files, depth)

  return new Response(xml, {
    status: 207,
    headers: { 
      'Content-Type': 'application/xml; charset=utf-8', 
      'DAV': '1, 2',
      'MS-Author-Via': 'DAV'
    }
  })
}

export async function GET(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const params = await context?.params
  const path = params?.path || []

  const resolution = await resolvePath(user.id, path)
  if (!resolution || resolution.currentItem?.type !== 'file') return new Response("Not Found", { status: 404 })

  const file = resolution.currentItem.item
  const rangeHeader = req.headers.get("Range") || req.headers.get("range")
  const { stream, name, mimeType, size, rangeResult } = await streamFileFromVault(file.id, user.id, rangeHeader)

  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes",
  }

  if (rangeResult) {
    headers["Content-Range"] = `bytes ${rangeResult.start}-${rangeResult.end}/${rangeResult.total}`
    headers["Content-Length"] = String(rangeResult.contentLength)
    return new Response(stream, {
      status: 206,
      headers,
    })
  }

  headers["Content-Length"] = String(size)
  return new Response(stream, {
    status: 200,
    headers,
  })
}

export async function PUT(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const params = await context?.params
  const path = params?.path || []

  if (path.length === 0) return new Response("Forbidden", { status: 403 })

  const fileName = decodeURIComponent(path[path.length - 1])
  const parentPath = path.slice(0, -1)
  const parentResolution = await resolvePath(user.id, parentPath)
  
  if (!parentResolution && parentPath.length > 0) return new Response("Conflict", { status: 409 })

  const folderId = parentResolution?.folderId || null
  const buffer = Buffer.from(await req.arrayBuffer())

  try {
    await uploadFileToVault({
      userId: user.id,
      fileName,
      mimeType: req.headers.get("Content-Type") || "application/octet-stream",
      buffer,
      folderId
    })
    return new Response(null, { status: 201 })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}

export async function MKCOL(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const params = await context?.params
  const path = params?.path || []

  const folderName = decodeURIComponent(path[path.length - 1])
  const parentPath = path.slice(0, -1)
  const parentResolution = await resolvePath(user.id, parentPath)

  if (!parentResolution && parentPath.length > 0) return new Response("Conflict", { status: 409 })

  const folderId = parentResolution?.folderId || null
  
  await db.folder.create({
    data: {
      userId: user.id,
      name: folderName,
      parentId: folderId
    }
  })

  return new Response(null, { status: 201 })
}

export async function DELETE(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const params = await context?.params
  const path = params?.path || []

  const resolution = await resolvePath(user.id, path)
  if (!resolution || !resolution.currentItem) return new Response("Not Found", { status: 404 })

  const { type, item } = resolution.currentItem
  if (type === 'file') {
    await deleteFileFromVault(item.id, user.id)
  } else {
    await db.folder.update({ where: { id: item.id }, data: { trashed: true } })
  }

  return new Response(null, { status: 204 })
}

export async function MOVE(req: Request, context: any) {
  const user = await authenticate(req)
  if (!user) return new Response("Unauthorized", { status: 401 })

  const params = await context?.params
  const sourcePath = params?.path || []

  const destinationUrl = req.headers.get("Destination")
  if (!destinationUrl) return new Response("Bad Request", { status: 400 })

  const sourceResolution = await resolvePath(user.id, sourcePath)
  if (!sourceResolution || !sourceResolution.currentItem) return new Response("Not Found", { status: 404 })

  try {
    const url = new URL(destinationUrl)
    const destPathParts = url.pathname.split('/').filter(p => p && p !== 'api' && p !== 'dav' && p !== 'connect')
    const destName = decodeURIComponent(destPathParts[destPathParts.length - 1])
    const destParentPath = destPathParts.slice(0, -1)
    const destParentResolution = await resolvePath(user.id, destParentPath)

    if (!destParentResolution && destParentPath.length > 0) return new Response("Conflict", { status: 409 })

    const destFolderId = destParentResolution?.folderId || null
    const { type, item } = sourceResolution.currentItem

    if (type === 'file') {
      await db.file.update({
        where: { id: item.id },
        data: { name: destName, folderId: destFolderId }
      })
    } else {
      await db.folder.update({
        where: { id: item.id },
        data: { name: destName, parentId: destFolderId }
      })
    }

    return new Response(null, { status: 201 })
  } catch (e) {
    return new Response("Invalid Destination", { status: 400 })
  }
}
