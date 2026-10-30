import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const { command, cwd } = await req.json()

    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "Command required" }, { status: 400 })
    }

    // Execute command with platform shell (bash in Linux container, cmd.exe in Windows)
    const workDir = cwd || process.cwd()
    const isWindows = process.platform === "win32"
    const defaultShell = isWindows ? (process.env.ComSpec || "cmd.exe") : "/bin/bash"

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 30000,
        shell: defaultShell,
        env: { ...process.env, PATH: process.env.PATH },
      })

      return NextResponse.json({
        ok: true,
        stdout,
        stderr,
        cwd: workDir,
      })
    } catch (cmdErr: any) {
      return NextResponse.json({
        ok: false,
        stdout: cmdErr.stdout || "",
        stderr: cmdErr.stderr || cmdErr.message,
        code: cmdErr.code,
        cwd: workDir,
      })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unauthorized" },
      { status: 401 }
    )
  }
}
