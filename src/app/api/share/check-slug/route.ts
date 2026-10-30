import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i
const RESERVED = new Set([
  "api", "share", "auth", "telegram", "files", "folders", "storage",
  "activity", "settings", "admin", "app", "dashboard", "login", "signup",
])

/** Check if a custom slug is available for the current user.
 *  Slugs are unique PER USER (not globally), so two different users can
 *  both have "q4-report" as their slug — the URL includes the username:
 *  /?share=username/q4-report */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = (searchParams.get("slug") || "").trim().toLowerCase()
    if (!slug) return NextResponse.json({ available: false, reason: "Enter a custom link" })
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ available: false, reason: "Use 2-64 letters, numbers, or hyphens" })
    }
    if (RESERVED.has(slug)) {
      return NextResponse.json({ available: false, reason: "This link is reserved" })
    }
    // Check uniqueness for the current user only
    let userId: string | undefined
    try {
      const user = await requireUser()
      userId = user.id
    } catch {}
    if (userId) {
      const existing = await db.shareLink.findFirst({
        where: { customSlug: slug, userId },
      })
      if (existing) return NextResponse.json({ available: false, reason: "You already used this link" })
    } else {
      // No auth — global check as fallback
      const existing = await db.shareLink.findUnique({ where: { customSlug: slug } })
      if (existing) return NextResponse.json({ available: false, reason: "Already taken" })
    }
    return NextResponse.json({ available: true, reason: "Available" })
  } catch (e: any) {
    return NextResponse.json({ available: false, reason: "Check failed" }, { status: 500 })
  }
}
