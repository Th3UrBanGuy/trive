import { NextResponse } from "next/server"
import { verifyTelegramWidgetAuth, verifyTelegramWebAppAuth, type TelegramWidgetAuthData } from "@/lib/telegram-sso"
import { createSession } from "@/lib/session"
import { db } from "@/lib/db"
import { newSalt } from "@/lib/crypto"
import { avatarGradient } from "@/lib/file-utils"
import type { User } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    let tgUser: {
      id: string | number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    } | null = null

    // 1. Telegram Mini App WebApp initData
    if (body.initData) {
      if (botToken) {
        const verified = verifyTelegramWebAppAuth(body.initData, botToken)
        if (!verified.valid || !verified.user) {
          return NextResponse.json({ error: "Invalid Telegram Mini App signature" }, { status: 401 })
        }
        tgUser = verified.user
      } else {
        // Fallback parse without verification if BOT_TOKEN not configured yet
        try {
          const params = new URLSearchParams(body.initData)
          const userStr = params.get("user")
          if (userStr) tgUser = JSON.parse(userStr)
        } catch {}
      }
    }
    // 2. Telegram Login Widget
    else if (body.widgetData) {
      const widgetData: TelegramWidgetAuthData = body.widgetData
      if (botToken) {
        const isValid = verifyTelegramWidgetAuth(widgetData, botToken)
        if (!isValid) {
          return NextResponse.json({ error: "Invalid Telegram SSO signature" }, { status: 401 })
        }
      }
      tgUser = {
        id: widgetData.id,
        first_name: widgetData.first_name,
        last_name: widgetData.last_name,
        username: widgetData.username,
        photo_url: widgetData.photo_url,
      }
    }
    // 3. Dev / Test mode fallback
    else if (process.env.NODE_ENV !== "production" && body.devUser) {
      tgUser = body.devUser
    }

    if (!tgUser || !tgUser.id) {
      return NextResponse.json({ error: "Telegram authorization data required" }, { status: 400 })
    }

    const telegramId = String(tgUser.id)
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || "Telegram User"
    const username = tgUser.username ? tgUser.username.toLowerCase() : null
    const avatarUrl = tgUser.photo_url || null

    // Upsert user by telegramId
    let user = await db.user.findUnique({ where: { telegramId } })
    const salt = user?.encSalt || newSalt()

    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          name: fullName || user.name,
          telegramUsername: username || user.telegramUsername,
          avatarUrl: avatarUrl || user.avatarUrl,
          botChatId: telegramId,
          authMethod: "sso",
          vaultReady: true,
          encSalt: salt,
        },
      })
    } else {
      user = await db.user.create({
        data: {
          telegramId,
          name: fullName,
          telegramUsername: username,
          avatarUrl,
          avatarColor: avatarGradient(telegramId),
          botChatId: telegramId,
          authMethod: "sso",
          vaultReady: true,
          encSalt: salt,
        },
      })
      await db.activity.create({
        data: {
          userId: user.id,
          action: "login",
          details: JSON.stringify({ method: "telegram_sso", telegramId }),
        },
      }).catch(() => {})
    }

    await createSession(user.id, req)

    return NextResponse.json({
      user: toUser(user),
      vaultReady: true,
      needsVault: false,
      needsScan: false,
      fileCount: 0,
    })
  } catch (e: any) {
    console.error("[telegram-sso] login error:", e)
    return NextResponse.json({ error: e?.message || "Telegram SSO authentication failed" }, { status: 500 })
  }
}
