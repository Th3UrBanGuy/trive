"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/lib/store"
import { api } from "@/lib/api"
import { Landing } from "@/components/landing/landing"
import { AuthFlow } from "@/components/auth/auth-flow"
import { Dashboard } from "@/components/dashboard/dashboard"
import { PublicShareView } from "@/components/dashboard/public-share-view"
import { VaultSetup, VaultScanning } from "@/components/dashboard/vault-setup"
import { RegisterSW } from "@/components/pwa/register-sw"
import { useInstallOverlay } from "@/components/pwa/use-install-prompt"
import {
  InstallOverlay,
  InstallPromptProvider,
} from "@/components/pwa/install-overlay"
import { AdminPanel } from "@/components/admin/admin-panel"
import {
  LegalPage,
  type LegalPageId,
} from "@/components/legal/legal-pages"

type Mode = "landing" | "auth"

/**
 * Vault phase — which screen to show after the user is authed.
 *   "checking"   → still probing (sign-in flags missing → api.vaultStatus())
 *   "needsVault" → no vault channel yet → onboarding prompt
 *   "needsScan"  → vault exists, DB empty → restore-from-vault flow
 *   "ready"      → show the dashboard
 */
type VaultPhase = "checking" | "needsVault" | "needsScan" | "ready"

/** Valid ?page= values that render a legal SPA view. */
const LEGAL_PAGES: LegalPageId[] = [
  "legal",
  "terms",
  "privacy",
  "disclaimer",
  "contact",
]

const TAGLINES = [
  "Securing your vault…",
  "Connecting to Telegram…",
  "Preparing your files…",
  "Almost there…",
]

function Splash() {
  const [progress, setProgress] = React.useState(0)
  const [taglineIdx, setTaglineIdx] = React.useState(0)

  // Snappy progress 0 → 90% over ~1s (the boot check is fast).
  React.useEffect(() => {
    const start = Date.now()
    const DURATION = 1000
    let raf = 0
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(90, (elapsed / DURATION) * 90)
      setProgress(pct)
      if (pct < 90) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Rotate taglines every ~1.2s
  React.useEffect(() => {
    const t = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length)
    }, 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden transition-opacity duration-500">
      <div className="absolute inset-0 bg-aurora opacity-80 pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <div className="relative flex flex-col items-center gap-7">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-50 bg-brand/30"
          />
          <div
            className="trive-loader relative"
            style={{ width: 80, height: "calc(80px * 0.866)" }}
          />
        </div>

        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">
            Tri<span className="text-gradient-brand">VE</span>
          </div>
          <div className="h-5 mt-2 relative overflow-hidden">
             <div className="text-xs text-muted-foreground">
                {TAGLINES[taglineIdx]}
             </div>
          </div>
        </div>

        <div className="w-56 max-w-[70vw] mt-1">
          <div className="relative h-1 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground/70 text-center font-mono tabular-nums">
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Detect standalone (PWA) display mode on the client. Returns false during SSR.
 */
function useStandalone(): boolean {
  const [standalone, setStandalone] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia?.("(display-mode: standalone)")
    const standaloneNav = (navigator as unknown as { standalone?: boolean })
      .standalone
    if (mql?.matches || standaloneNav === true) {
      setStandalone(true)
      return
    }
    // Listen for the rare case where it changes mid-session.
    if (!mql) return
    const onChange = (ev: MediaQueryListEvent) => setStandalone(ev.matches)
    mql.addEventListener?.("change", onChange)
    return () => mql.removeEventListener?.("change", onChange)
  }, [])
  return standalone
}

function HomeInner() {
  const [booted, setBooted] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>("landing")
  const [shareToken, setShareToken] = React.useState<string | null>(null)
  const [adminMode, setAdminMode] = React.useState(false)
  const [legalPage, setLegalPage] = React.useState<LegalPageId | null>(null)
  const [vaultPhase, setVaultPhase] = React.useState<VaultPhase>("checking")
  const standalone = useStandalone()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)
  const { openOverlay } = useInstallOverlay()

  // Read the URL ONCE on mount to decide which top-level view to render:
  //   ?admin=1                    → hidden admin panel (skips api.me())
  //   ?share=TOKEN                → public share viewer (no auth)
  //   ?page=legal|terms|...       → legal SPA view (no auth)
  //   otherwise                   → normal flow (api.me() → dashboard / landing / auth)
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)

      // Hidden admin panel — highest priority, completely separate from the
      // user auth flow. We do NOT call api.me() in this branch.
      if (params.get("admin") === "1") {
        setAdminMode(true)
        setBooted(true)
        setLoading(false)
        return
      }

      // Public share viewer (no auth required)
      const share = params.get("share")
      if (share) {
        setShareToken(share)
        setBooted(true)
        setLoading(false)
        return
      }

      // Legal SPA views
      const page = params.get("page")
      if (page && LEGAL_PAGES.includes(page as LegalPageId)) {
        setLegalPage(page as LegalPageId)
        setBooted(true)
        setLoading(false)
        return
      }
    } catch {}

    // Boot safety timeout: if api.me() hangs, show the landing after 4s anyway.
    const safety = setTimeout(() => {
      if (!booted) {
        setBooted(true)
        setLoading(false)
      }
    }, 4000)

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const u = await api.me()
        if (!cancelled) setUser(u)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) {
          clearTimeout(safety)
          setBooted(true)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(safety)
    }
  }, [setUser, setLoading])

  // When a user becomes available (login OR restore from persist/api.me),
  // determine which vault phase to show. Auth-flow attaches `needsVault` /
  // `needsScan` flags to the user object when the user signs in fresh; if
  // those flags are missing (e.g. page refresh → api.me()), we probe
  // `api.vaultStatus()` instead. ALWAYS probe to get the real current state
  // (the sign-in flags can be stale if the user created a vault on another device).
  React.useEffect(() => {
    if (!user) {
      setVaultPhase("checking")
      return
    }
    // Telegram SSO users use the bot inbox which is immediately available
    if (user.authMethod === "sso" || user.vaultReady) {
      setVaultPhase("ready")
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const s = await api.vaultStatus()
        if (cancelled) return
        if (s.needsVault) setVaultPhase("needsVault")
        else if (s.needsScan) setVaultPhase("needsScan")
        else setVaultPhase("ready")
      } catch {
        // If vaultStatus fails, fall back to sign-in flags
        if (cancelled) return
        if (user.needsVault === true) setVaultPhase("needsVault")
        else if (user.needsScan === true) setVaultPhase("needsScan")
        else setVaultPhase("ready")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // Hidden admin panel — renders its own login + dashboard. No link to it
  // exists anywhere in the normal UI; only people who know to visit ?admin=1
  // can reach it.
  if (adminMode) {
    return <AdminPanel />
  }

  // Legal SPA views
  if (legalPage) {
    return (
      <LegalPage
        page={legalPage}
        onBack={() => {
          // Clear ?page= and return to the public app.
          try {
            const url = new URL(window.location.href)
            url.searchParams.delete("page")
            window.history.replaceState({}, "", url.pathname + (url.search || ""))
          } catch {}
          setLegalPage(null)
          // If we have a user, we'll fall through to <Dashboard />; otherwise
          // landing/auth. Either way, we don't re-run api.me() — the cached
          // user (if any) is used.
          if (!user) setMode("landing")
        }}
        onNavigate={(p) => {
          // Update the URL so deep links work and back-button behaves.
          try {
            const url = new URL(window.location.href)
            url.searchParams.set("page", p)
            window.history.replaceState({}, "", url.pathname + url.search)
          } catch {}
          setLegalPage(p)
          // Scroll to top on page change.
          window.scrollTo({ top: 0 })
        }}
      />
    )
  }

  // Public share viewer (no auth required)
  if (shareToken) {
    return <PublicShareView token={shareToken} />
  }

  // Logged in → route through the vault phase before the dashboard.
  if (user) {
    if (vaultPhase === "needsVault") {
      return <VaultSetup onDone={() => setVaultPhase("ready")} />
    }
    if (vaultPhase === "needsScan") {
      return <VaultScanning onDone={() => setVaultPhase("ready")} />
    }
    // "checking" or "ready" → dashboard (the dashboard itself auto-scans
    // silently if needsScan is discovered after mount).
    return <Dashboard />
  }

  // Not logged in.
  // - PWA standalone mode: skip the marketing landing — the user already
  //   installed the app, they want to log in. Go straight to AuthFlow.
  // - Browser: show Landing. Its "Launch App" / "Get Started" buttons flip
  //   mode → "auth" and render the AuthFlow. After successful auth, the
  //   AuthFlow calls setUser and we re-render into Dashboard.
  if (standalone || mode === "auth") {
    return <AuthFlow onBack={() => setMode("landing")} />
  }

  return (
    <Landing
      onLaunch={() => setMode("auth")}
      onInstall={openOverlay}
    />
  )
}

export default function Home() {
  return (
    <InstallPromptProvider>
      <RegisterSW />
      <InstallOverlay />
      <HomeInner />
    </InstallPromptProvider>
  )
}
