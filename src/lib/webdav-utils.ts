import type { FileItem, Folder } from "./types"

/**
 * Lightweight WebDAV XML generator.
 * Follows RFC 4918. Highly optimized for Windows Explorer and macOS Finder.
 */

export function generatePropfindResponse(
  baseUrl: string,
  folders: Folder[],
  files: any[],
  depth: string = "1"
): string {
  // baseUrl is the URL of the collection being listed
  const canonicalUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  
  const responses = [
    // The resource itself
    generateItemProp(canonicalUrl, null, true)
  ]

  // Only include children if depth is not 0
  if (depth !== "0") {
    // Sub-folders
    responses.push(...folders.map(f => generateItemProp(`${canonicalUrl}${encodeURIComponent(f.name)}/`, f, true)))
    // Files
    responses.push(...files.map(f => generateItemProp(`${canonicalUrl}${encodeURIComponent(f.name)}`, f, false)))
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${responses.join('\n')}
</D:multistatus>`
}

function generateItemProp(url: string, item: any, isFolder: boolean): string {
  const name = item ? item.name : (url === '/' ? 'Root' : url.split('/').filter(Boolean).pop() || 'Root')
  const createdAt = item ? new Date(item.createdAt).toISOString() : new Date().toISOString()
  const updatedAt = item ? new Date(item.updatedAt).toUTCString() : new Date().toUTCString()
  const size = item && !isFolder ? Number(item.size) : 0
  const mimeType = item && !isFolder ? item.mimeType : 'httpd/unix-directory'

  // Href must be the path part only for best compatibility
  let href = url
  try {
    if (url.startsWith('http')) href = new URL(url).pathname
  } catch {}

  return `  <D:response>
    <D:href>${href}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(name)}</D:displayname>
        <D:getcontentlength>${size}</D:getcontentlength>
        <D:getcontenttype>${mimeType}</D:getcontenttype>
        <D:resourcetype>${isFolder ? '<D:collection/>' : ''}</D:resourcetype>
        <D:getlastmodified>${updatedAt}</D:getlastmodified>
        <D:creationdate>${createdAt}</D:creationdate>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return ''
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  })
}

export function generateOptionsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'Allow': 'OPTIONS, GET, HEAD, POST, DELETE, PROPFIND, MKCOL, PUT, MOVE, COPY, LOCK, UNLOCK',
      'DAV': '1, 2',
      'MS-Author-Via': 'DAV',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'DAV, MS-Author-Via',
      'Cache-Control': 'no-cache'
    }
  })
}
