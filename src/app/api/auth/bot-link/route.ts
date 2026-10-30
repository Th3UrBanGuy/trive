import { NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { createSession } from "@/lib/session"
import { newSalt } from "@/lib/crypto"
import { avatarGradient } from "@/lib/file-utils"
import type { User } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface PendingAuth {
  authKey: string
  telegramId?: string
  name?: string
  username?: string
  avatarUrl?: string
  confirmed: boolean
  createdAt: number
}

// In-memory pending auth store
const pendingAuths = new Map<string, PendingAuth>()

// Clean up stale requests older than 10 minutes
function cleanupOldRequests() {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of pendingAuths.entries()) {
    if (v.createdAt < cutoff) pendingAuths.delete(k)
  }
}

function toUser(u: any): User {
  return {
    id: u.id,
    telegramId: u.telegramId,
    phone: u.phone,
    name: u.name,
    telegramUsername: u.telegramUsername,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    authMethod: u.authMethod,
    botChatId: u.botChatId,
    vaultReady: true,
    telegramConnected: true,
    botConnected: !!process.env.TELEGRAM_BOT_TOKEN,
    createdAt: u.createdAt.toISOString(),
  }
}

/**
 * POST /api/auth/bot-link
 * Initiates a Deep-Link bot login session.
 * Generates an authKey and returns a deep-link to t.me/BotUsername?start=auth_<key>
 */
export async function POST() {
  cleanupOldRequests()
  const authKey = crypto.randomBytes(12).toString("hex")
  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    "Trive_Storage_bot"

  pendingAuths.set(authKey, {
    authKey,
    confirmed: false,
    createdAt: Date.now(),
  })

  const deepLink = `https://t.me/${botUsername}?start=auth_${authKey}`

  return NextResponse.json({
    authKey,
    botUsername,
    deepLink,
  })
}

/**
 * GET /api/auth/bot-link?authKey=...
 * Polls for confirmation from the bot.
 * Queries Telegram Bot API getUpdates to see if the user clicked /start auth_<key>.
 */
export async function GET(req: Request) {
  cleanupOldRequests()
  const { searchParams } = new URL(req.url)
  const authKey = searchParams.get("authKey")

  if (!authKey) {
    return NextResponse.json({ error: "authKey is required" }, { status: 400 })
  }

  const reqItem = pendingAuths.get(authKey)
  if (!reqItem) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 404 })
  }

  // Already confirmed
  if (reqItem.confirmed && reqItem.telegramId) {
    let user = await db.user.findUnique({ where: { telegramId: reqItem.telegramId } })
    if (user) {
      await createSession(user.id, req)
      return NextResponse.json({ confirmed: true, user: toUser(user) })
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ confirmed: false, error: "Bot token not configured" })
  }

  try {
    // Check Telegram getUpdates for the /start auth_<key> command
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?offset=-30&limit=30&allowed_updates=["message"]`,
      { cache: "no-store" }
    )
    const data = await res.json()

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        const text = update?.message?.text || ""
        const from = update?.message?.from
        const chatId = update?.message?.chat?.id

        if (from && text.includes(`auth_${authKey}`)) {
          const telegramId = String(from.id)
          const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "Telegram User"
          const username = from.username ? from.username.toLowerCase() : null

          // Fetch user profile photo if available
          let avatarUrl: string | null = null
          try {
            const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`)
            const photoData = await photoRes.json()
            if (photoData.ok && photoData.result?.photos?.[0]?.[0]) {
              const fileId = photoData.result.photos[0][0].file_id
              const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
              const fileData = await fileRes.json()
              if (fileData.ok && fileData.result?.file_path) {
                avatarUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
              }
            }
          } catch {}

          // Mark confirmed
          reqItem.confirmed = true
          reqItem.telegramId = telegramId
          reqItem.name = name
          reqItem.username = username || undefined
          reqItem.avatarUrl = avatarUrl || undefined

          // Send confirmation message in Telegram
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId || telegramId,
              text: `🔐 *TriVE Login Approved!*\n\nWelcome *${name}*! Your web browser is now authorized and signed in to your zero-knowledge cloud drive.\n\nAll your uploaded files will be stored safely right here in this bot chat.`,
              parse_mode: "Markdown",
            }),
          }).catch(() => {})

          // Upsert user in database
          let user = await db.user.findUnique({ where: { telegramId } })
          const salt = user?.encSalt || newSalt()

          if (user) {
            user = await db.user.update({
              where: { id: user.id },
              data: {
                name: name || user.name,
                telegramUsername: username || user.telegramUsername,
                avatarUrl: avatarUrl || user.avatarUrl,
                botChatId: String(chatId || telegramId),
                authMethod: "sso",
                vaultReady: true,
                encSalt: salt,
              },
            })
          } else {
            user = await db.user.create({
              data: {
                telegramId,
                name,
                telegramUsername: username,
                avatarUrl,
                avatarColor: avatarGradient(telegramId),
                botChatId: String(chatId || telegramId),
                authMethod: "sso",
                vaultReady: true,
                encSalt: salt,
              },
            })
            await db.activity.create({
              data: {
                userId: user.id,
                action: "login",
                details: JSON.stringify({ method: "bot_deep_link", telegramId }),
              },
            }).catch(() => {})
          }

          await createSession(user.id, req)

          return NextResponse.json({
            confirmed: true,
            user: toUser(user),
          })
        }
      }
    }
  } catch (err: any) {
    console.error("[bot-link] error polling updates:", err)
  }

  return NextResponse.json({ confirmed: false })
}
