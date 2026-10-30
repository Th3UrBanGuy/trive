import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { scanVaultAndRebuild } from "@/lib/file-ops"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Scan the vault channel for manifest messages and rebuild the file index.
 * Called on login (if needed) or manually from settings. Makes files
 * persistent across devices.
 */
export async function POST() {
  try {
    const user = await requireUser()
    const result = await scanVaultAndRebuild(user.id)
    await db.activity.create({
      data: { userId: user.id, action: "vault_scan", details: JSON.stringify(result) },
    })
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : e?.message?.includes("not") ? 400 : 500
    return NextResponse.json({ error: e?.message || "Scan failed" }, { status })
  }
}
