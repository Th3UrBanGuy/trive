import { NextResponse } from "next/server"
import { destroyAdminSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await destroyAdminSession()
  return new NextResponse(null, { status: 204 })
}
