import { NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { phone } = await req.json()
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }
    const normalized = phone.replace(/\s+/g, "")
    const result = await telegramService.sendCode(normalized)
    return NextResponse.json(result)
  } catch (e: any) {
    const msg = e?.message || "Failed to send code"
    const lower = msg.toLowerCase()
    const status = lower.includes("flood") ? 429 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
