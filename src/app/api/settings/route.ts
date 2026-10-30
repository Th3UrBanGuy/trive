import { NextResponse } from "next/server"
import { requireUser, destroySession } from "@/lib/session"
import { db } from "@/lib/db"
import { telegramService } from "@/lib/telegram-service"
import { decryptSession } from "@/lib/crypto"
import type { User } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toUser(u: any): User {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    avatarColor: u.avatarColor,
    vaultReady: u.vaultReady,
    telegramConnected: !!u.telegramSession,
    createdAt: u.createdAt.toISOString(),
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser()
    const { name } = await req.json()
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 })
    }
    const updated = await db.user.update({ where: { id: user.id }, data: { name: name.trim() } })
    return NextResponse.json(toUser(updated))
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function DELETE() {
  try {
    const user = await requireUser()
    const dbUser = await db.user.findUnique({ where: { id: user.id }, include: { files: { include: { chunks: true } } } })
    if (dbUser?.telegramSession && dbUser.vaultChannelId) {
      const sessionString = decryptSession(dbUser.telegramSession)
      // best-effort: delete all chunk messages from telegram
      for (const file of dbUser.files) {
        for (const chunk of file.chunks) {
          try {
            await telegramService.deleteMessage(sessionString, dbUser.vaultChannelId, dbUser.vaultChannelAccess || "0", chunk.telegramMessageId)
          } catch {}
        }
      }
    }
    // cascading deletes handle files/folders/chunks/shares/activities
    await db.user.delete({ where: { id: user.id } })
    await destroySession()
    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
