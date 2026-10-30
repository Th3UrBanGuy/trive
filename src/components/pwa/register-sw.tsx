"use client"

import * as React from "react"

/**
 * Register the TriVE service worker (`/sw.js`) on mount.
 *
 * - Only registers when `serviceWorker` is in navigator (i.e. a real browser,
 *   not SSR) AND we're in a production-like context. In Next dev mode the SW
 *   can intercept HMR requests and break hot reload, so we skip it there.
 * - Swallows registration errors silently — a failed SW must never crash the app.
 * - Renders nothing.
 */
export function RegisterSW() {
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    // Skip in Next.js dev mode — SW caches break HMR / fast refresh.
    if (process.env.NODE_ENV === "development") return

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
      } catch {
        // Silent — SW is a progressive enhancement.
      }
    }

    // Defer until after first paint so it never blocks the initial frame.
    if (document.readyState === "complete") {
      void register()
    } else {
      window.addEventListener("load", register, { once: true })
    }

    return () => {
      window.removeEventListener("load", register)
    }
  }, [])

  return null
}
