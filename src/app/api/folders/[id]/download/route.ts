import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { streamFolderZipFromVault } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Download a folder as a ZIP (authenticated). Streams the zip as it's built. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { stream, name } = await streamFolderZipFromVault(id, user.id)
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${encodeURIComponent(name)}.zip"`,
        "cache-control": "private, no-store",
      },
    })
  } catch (e: any) {
    const msg = e?.message || "Download failed"
    const status = msg === "UNAUTHORIZED" ? 401 : msg.includes("not found") ? 404 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json" } })
  }
}
