import { NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram-service"
import { encryptSession, newSalt, decryptSession } from "@/lib/crypto"
import { createSession } from "@/lib/session"
import { db } from "@/lib/db"
import { avatarGradient } from "@/lib/file-utils"
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

export async function POST(req: Request) {
  try {
    const { phone, code, phoneCodeHash, password } = await req.json()
    if (!phone || !code || !phoneCodeHash) {
      return NextResponse.json({ error: "phone, code, and phoneCodeHash are required" }, { status: 400 })
    }
    const normalized = phone.replace(/\s+/g, "")

    const result = await telegramService.signIn(normalized, code, phoneCodeHash, password)

    // Upsert user in DB
    let user = await db.user.findUnique({ where: { phone: normalized } })
    const encSession = encryptSession(result.sessionString)
    const salt = user?.encSalt || newSalt()

    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          telegramSession: encSession,
          telegramApiId: null,
          telegramApiHash: null,
          vaultChannelId: user.vaultChannelId,
          vaultChannelAccess: user.vaultChannelAccess || "0",
          vaultReady: !!user.vaultChannelId,
          encSalt: salt,
          name: result.name || user.name,
          // Normalize to lowercase so username-scoped share URLs (?share=username/slug)
          // resolve reliably. Telegram usernames are case-insensitive for identity,
          // and SQLite string comparisons are case-sensitive by default.
          telegramUsername: (result.username || user.telegramUsername || "").toLowerCase() || null,
        },
      })
    } else {
      user = await db.user.create({
        data: {
          phone: normalized,
          name: result.name,
          telegramUsername: result.username ? result.username.toLowerCase() : null,
          avatarColor: avatarGradient(normalized),
          telegramSession: encSession,
          encSalt: salt,
          vaultChannelId: null,
          vaultChannelAccess: "0",
          vaultReady: false,
        },
      })
      await db.activity.create({
        data: { userId: user.id, action: "login", details: JSON.stringify({ phone: normalized }) },
      })
    }

    await createSession(user.id, req)

    // CRITICAL: If the local DB doesn't have a vault channel, check Telegram
    // for an existing TriVE_Storage_Vault channel. The vault persists on the
    // user's Telegram account — logging in from a new device should FIND it,
    // not prompt to create a new one.
    if (!user.vaultChannelId) {
      try {
        const sessionString = decryptSession(encSession)
        const vaultResult = await telegramService.initVault(sessionString)
        // initVault finds OR creates the vault. If it found an existing one,
        // save it to the local DB.
        user = await db.user.update({
          where: { id: user.id },
          data: {
            vaultChannelId: vaultResult.channelId,
            vaultChannelAccess: vaultResult.channelAccess,
            vaultReady: true,
          },
        })
      } catch (e) {
        console.error("[sign-in] failed to check/create vault:", e)
        // Don't fail login — the user can create the vault later
      }
    }

    // Return flags so the frontend knows whether to trigger a vault scan
    const fileCount = await db.file.count({ where: { userId: user.id, trashed: false } })
    return NextResponse.json({
      user: toUser(user),
      vaultReady: user.vaultReady,
      needsVault: !user.vaultChannelId,
      needsScan: !!user.vaultChannelId && fileCount === 0,
      fileCount,
    })
  } catch (e: any) {
    const msg = e?.message || "Sign-in failed"
    const lower = msg.toLowerCase()
    let status = 400
    if (lower.includes("2fa") || lower.includes("password")) status = 401
    else if (lower.includes("flood")) status = 429
    else if (lower.includes("invalid") && lower.includes("code")) status = 400
    return NextResponse.json({ error: msg }, { status })
  }
}
