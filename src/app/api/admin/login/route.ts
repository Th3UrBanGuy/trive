import { NextResponse } from "next/server"
import { createAdminSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const adminPwd = process.env.ADMIN_PASSWORD
    if (!adminPwd) {
      return NextResponse.json({ error: "Admin not configured" }, { status: 500 })
    }
    if (!password || password !== adminPwd) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    await createAdminSession()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
