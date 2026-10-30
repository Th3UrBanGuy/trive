import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { telegramService } from "@/lib/telegram-service"
import { decryptSession } from "@/lib/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const user = await requireUser()
    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser?.telegramSession) {
      return NextResponse.json({ error: "Telegram not connected" }, { status: 400 })
    }
    const sessionString = decryptSession(dbUser.telegramSession)
    const result = await telegramService.initVault(sessionString)
    await db.user.update({
      where: { id: user.id },
      data: {
        vaultChannelId: result.channelId,
        vaultChannelAccess: result.channelAccess,
        vaultReady: true,
      },
    })
    await db.activity.create({
      data: { userId: user.id, action: "vault_init", details: JSON.stringify({ channelId: result.channelId }) },
    })
    return NextResponse.json({ vaultReady: true, channelId: result.channelId })
  } catch (e: any) {
    const msg = e?.message || "Vault init failed"
    const status = msg.toLowerCase().includes("flood") ? 429 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
