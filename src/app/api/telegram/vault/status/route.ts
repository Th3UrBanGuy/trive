import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { telegramService } from "@/lib/telegram-service"
import { decryptSession } from "@/lib/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Check vault status. CRITICAL: if the local DB doesn't have a vault channel,
 * we MUST check Telegram for an existing TriVE_Storage_Vault channel before
 * telling the frontend to create one. This is what makes the vault persist
 * across devices — the vault lives on Telegram, not in the local DB.
 */
export async function GET() {
  try {
    const user = await requireUser()
    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

    let vaultChannelId = dbUser.vaultChannelId
    let vaultChannelAccess = dbUser.vaultChannelAccess || "0"
    let vaultReady = !!vaultChannelId

    // If the local DB doesn't have a vault channel, check Telegram for an
    // existing one. The vault persists on the user's Telegram account —
    // logging in from a new device should find it, not create a new one.
    if (!vaultReady && dbUser.telegramSession) {
      try {
        const sessionString = decryptSession(dbUser.telegramSession)
        const result = await telegramService.initVault(sessionString)
        // initVault finds OR creates the vault channel. If it found an
        // existing one, save it to the local DB so we don't check again.
        vaultChannelId = result.channelId
        vaultChannelAccess = result.channelAccess
        vaultReady = true
        await db.user.update({
          where: { id: user.id },
          data: {
            vaultChannelId,
            vaultChannelAccess,
            vaultReady: true,
          },
        })
      } catch (e) {
        console.error("[vault-status] failed to check Telegram for existing vault:", e)
        // Don't fail the whole request — fall through with vaultReady=false
      }
    }

    const fileCount = await db.file.count({ where: { userId: user.id, trashed: false } })
    return NextResponse.json({
      vaultReady,
      vaultChannelId: !!vaultChannelId,
      fileCount,
      needsVault: !vaultReady,
      // If vault exists but local DB has no files, trigger a scan to rebuild
      needsScan: vaultReady && fileCount === 0,
    })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
