import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json(null, { status: 200 })
  return NextResponse.json(user)
}
