import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdmin()

    // 1. Check /app/data/ssh_info.json
    const infoPath = path.join(process.cwd(), "data", "ssh_info.json")
    if (fs.existsSync(infoPath)) {
      try {
        const raw = fs.readFileSync(infoPath, "utf8")
        const parsed = JSON.parse(raw)
        return NextResponse.json({ ok: true, ...parsed })
      } catch {}
    }

    // 2. Query tmate socket directly if available
    try {
      const { stdout: sshCmd } = await execAsync("tmate -S /tmp/tmate.sock display -p '#{tmate_ssh}'")
      const { stdout: webCmd } = await execAsync("tmate -S /tmp/tmate.sock display -p '#{tmate_web}'")
      return NextResponse.json({
        ok: true,
        ssh: sshCmd.trim(),
        web: webCmd.trim(),
        available: true,
      })
    } catch {
      return NextResponse.json({
        ok: true,
        ssh: null,
        web: null,
        available: false,
        message: "tmate SSH daemon not running or not supported in local dev environment.",
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unauthorized" },
      { status: 401 }
    )
  }
}
