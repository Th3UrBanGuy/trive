import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500)
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        telegramId: true,
        phone: true,
        name: true,
        telegramUsername: true,
        avatarUrl: true,
        authMethod: true,
        vaultReady: true,
        telegramSession: true,
        vaultChannelId: true,
        storageLimitBytes: true,
        encSalt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { files: true, folders: true, shareLinks: true, activities: true },
        },
      },
    })
    const result = users.map((u) => ({
      id: u.id,
      telegramId: u.telegramId,
      phone: u.phone,
      name: u.name,
      telegramUsername: u.telegramUsername,
      avatarUrl: u.avatarUrl,
      authMethod: u.authMethod,
      vaultReady: u.vaultReady,
      telegramConnected: !!u.telegramSession || !!process.env.TELEGRAM_BOT_TOKEN,
      hasVault: !!u.vaultChannelId,
      storageLimit: Number(u.storageLimitBytes || 0),
      hasEncryption: !!u.encSalt,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      _count: u._count,
    }))
    return NextResponse.json(result)
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
