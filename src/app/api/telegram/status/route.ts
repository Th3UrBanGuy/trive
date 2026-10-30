import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { db } from "@/lib/db"
import { telegramService } from "@/lib/telegram-service"
import type { TelegramStatus } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  // Check service health for simulation flag
  let simulation = true
  let apiIdPresent = false
  let realMode = false
  let botConfigured = false
  let botUsername: string | null = null
  try {
    const h = await telegramService.health()
    simulation = h.simulation
    apiIdPresent = h.apiIdPresent
    realMode = h.realMode
    botConfigured = h.botConfigured
    botUsername = h.botUsername
  } catch {}

  const status: TelegramStatus = {
    connected: !!user?.telegramConnected,
    vaultReady: !!user?.vaultReady,
    simulationMode: simulation,
    realMode,
    phone: user?.phone,
    apiIdPresent,
    botConfigured,
    botUsername,
  }
  return NextResponse.json(status)
}
