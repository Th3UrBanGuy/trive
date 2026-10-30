import { requireUser } from "@/lib/session"
import { streamFileFromVault } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * STREAMING download — bytes start flowing to the client as soon as the first
 * chunk is decrypted, before subsequent chunks are even fetched. This is the
 * "bullet fast" path: no full-file buffering.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const rangeHeader = req.headers.get("range")
    const { stream, name, mimeType, size, rangeResult } = await streamFileFromVault(id, user.id, rangeHeader)

    const headers: Record<string, string> = {
      "content-type": mimeType || "application/octet-stream",
      "content-disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "cache-control": "private, no-store",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
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
  } catch (e: any) {
    const msg = e?.message || "Download failed"
    const status = msg === "UNAUTHORIZED" ? 401 : msg.includes("not found") ? 404 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } })
  }
}
