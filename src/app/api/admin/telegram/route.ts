import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { telegramService } from "@/lib/telegram-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdmin()
    const health = await telegramService.health()
    return NextResponse.json(health)
  } catch (e: any) {
    const status = e?.message === "ADMIN_UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
