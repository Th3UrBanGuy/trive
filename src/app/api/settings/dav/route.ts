import { NextResponse } from "next/server"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/crypto"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function generateReadablePassword(): string {
  // 12-character secure alphanumeric token
  return `trv_${crypto.randomBytes(6).toString("hex")}`
}

export async function GET() {
  try {
    const sessionUser = await requireUser()
    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        telegramId: true,
        telegramUsername: true,
        customUsername: true,
        davPassword: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const davUsername = user.customUsername || user.telegramUsername || user.telegramId
    return NextResponse.json({
      username: davUsername,
      telegramUsername: user.telegramUsername,
      customUsername: user.customUsername,
      hasPassword: !!user.davPassword,
      davPath: "/api/dav",
    })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireUser()
    const body = await req.json()
    const { username, password, generateRandom } = body

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updateData: { customUsername?: string; davPassword?: string } = {}
    let plainPasswordToReturn: string | undefined

    // 1. Handle username change
    if (typeof username === "string") {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, "")
      if (cleanUsername.length > 0) {
        if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
          return NextResponse.json(
            { error: "Username must be 3-30 characters (letters, numbers, underscores only)." },
            { status: 400 }
          )
        }

        // Check uniqueness across other users
        const existing = await db.user.findFirst({
          where: {
            id: { not: user.id },
            OR: [
              { customUsername: cleanUsername },
              { telegramUsername: cleanUsername },
            ],
          },
        })
        if (existing) {
          return NextResponse.json(
            { error: "This username is already taken. Please choose another." },
            { status: 409 }
          )
        }
        updateData.customUsername = cleanUsername
      }
    }

    // 2. Handle password generation or update
    if (generateRandom) {
      const generated = generateReadablePassword()
      updateData.davPassword = hashPassword(generated)
      plainPasswordToReturn = generated
    } else if (typeof password === "string") {
      const cleanPass = password.trim()
      if (cleanPass.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long." },
          { status: 400 }
        )
      }
      updateData.davPassword = hashPassword(cleanPass)
      plainPasswordToReturn = cleanPass
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        telegramId: true,
        telegramUsername: true,
        customUsername: true,
        davPassword: true,
      },
    })

    const finalUsername = updated.customUsername || updated.telegramUsername || updated.telegramId

    return NextResponse.json({
      success: true,
      username: finalUsername,
      customUsername: updated.customUsername,
      hasPassword: !!updated.davPassword,
      password: plainPasswordToReturn,
    })
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : 500
    return NextResponse.json({ error: e?.message || "Failed" }, { status })
  }
}
