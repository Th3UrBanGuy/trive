import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const config = {
  matcher: ["/", "/api/:path*", "/connect/:path*", "/connect"],
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get("origin") || "*"
  const userAgent = req.headers.get("user-agent") || ""
  const isBrowser = userAgent.includes("Mozilla")

  // WebDAV methods
  const davMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK"

  // 1. Handle /connect
  if (pathname === "/connect" || pathname.startsWith("/connect/")) {
    if (pathname === "/connect" && isBrowser && req.method === "GET") {
      return NextResponse.next()
    }

    // Rewrite /connect -> /api/dav
    // Ensure we handle root /connect by stripping exactly "/connect"
    let internalPath = pathname.substring(8) // length of "/connect"
    if (!internalPath.startsWith("/")) internalPath = "/" + internalPath
    
    // Construct rewrite URL
    const rewriteUrl = new URL(`/api/dav${internalPath === "/" ? "" : internalPath}`, req.url)
    
    const res = NextResponse.rewrite(rewriteUrl)
    res.headers.set("Access-Control-Allow-Origin", origin)
    res.headers.set("Access-Control-Allow-Methods", davMethods)
    res.headers.set("Access-Control-Allow-Headers", "*")
    res.headers.set("Access-Control-Allow-Credentials", "true")
    res.headers.set("DAV", "1, 2")
    res.headers.set("MS-Author-Via", "DAV")
    return res
  }

  // 2. OPTIONS discovery
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": davMethods,
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true",
        "DAV": "1, 2",
        "MS-Author-Via": "DAV"
      },
    })
  }

  const res = NextResponse.next()
  res.headers.set("Access-Control-Allow-Origin", origin)
  res.headers.set("Access-Control-Allow-Methods", davMethods)
  res.headers.set("Access-Control-Allow-Headers", "*")
  res.headers.set("Access-Control-Allow-Credentials", "true")
  res.headers.set("Vary", "Origin")
  res.headers.set("MS-Author-Via", "DAV")
  res.headers.delete("X-Frame-Options")
  res.headers.set("Cross-Origin-Resource-Policy", "cross-origin")
  res.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none")
  return res
}
