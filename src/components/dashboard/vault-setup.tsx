"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Check,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { BrandMark, Wordmark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

/**
 * Premium vault-creation + vault-scan flows.
 *
 * - `<VaultSetup />`    → first-login onboarding (user has no vault channel yet)
 * - `<VaultScanning />` → login from a new device (vault exists, local DB empty)
 *
 * Both render on the aurora/grid backdrop inside a glass-strong card and use
 * framer-motion for entrance + success transitions. Both call `onDone()` when
 * the flow is complete so the parent can transition into the dashboard.
 */

/* ---------- Shared TriVE triangle loader (CSS-based, canonical) ---------- */

export function TriVELoader({ size = 72 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--brand) 38%, transparent), transparent 70%)",
        }}
        animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.08, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="trive-loader relative"
        style={{ width: size, height: `calc(${size}px * 0.866)` }}
      />
    </div>
  )
}

/* ---------- Shell — shared premium backdrop + glass card ---------- */

function VaultShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] pointer-events-none" />

      <header className="relative z-10 p-4">
        <Wordmark className="opacity-80" />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          <div className="relative glass-strong rounded-3xl p-7 md:p-10 shadow-2xl shadow-brand/15 ring-1 ring-brand/5">
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  )
}

/* ---------- Feature row (used by VaultSetup) ---------- */

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc?: string
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl glass relative">
      <div className="size-7 shrink-0 rounded-full bg-brand/10 text-brand flex items-center justify-center mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <div className="text-sm font-medium leading-tight">{title}</div>
        {desc && (
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        )}
      </div>
    </div>
  )
}

/* ---------- Network-error helper (mirrors auth-flow) ---------- */

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /couldn't reach telegram|network|econnrefused|enetunreach|etimedout|unreachable|failed to fetch/i.test(
    msg
  )
}

/* ---------- Vault creation (first login → needsVault=true) ---------- */

export function VaultSetup({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = React.useState<
    "idle" | "creating" | "done" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = React.useState("")

  async function create() {
    setStatus("creating")
    setErrorMsg("")
    try {
      await api.initVault()
      setStatus("done")
      toast.success("Vault created", {
        description: "Your private encrypted channel is ready.",
      })
      // Brief success moment, then transition to the dashboard.
      setTimeout(() => onDone(), 1100)
    } catch (e) {
      setStatus("error")
      const msg = e instanceof Error ? e.message : "Couldn't create vault"
      setErrorMsg(msg)
      if (isNetworkError(e)) {
        toast.error("Couldn't create vault", {
          description:
            "Couldn't reach Telegram servers. Check your connection and try again.",
          icon: <WifiOff className="size-4" />,
        })
      } else {
        toast.error("Couldn't create vault", { description: msg })
      }
    }
  }

  return (
    <VaultShell>
      <AnimatePresence mode="wait">
        {status === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="size-20 rounded-full bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-xl shadow-brand/40 mb-6"
            >
              <Check className="size-10" strokeWidth={3} />
            </motion.div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Vault ready
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Taking you to your dashboard…
            </p>
            <div className="mt-7">
              <TriVELoader size={36} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 rounded-2xl bg-brand/20 blur-2xl" />
              <BrandMark
                size={72}
                className="rounded-2xl drop-shadow-lg relative"
              />
            </motion.div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome to your{" "}
              <span className="text-gradient-brand">TriVE</span> Vault
            </h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-md">
              Your vault is a private, encrypted channel on your Telegram
              account where all your files are stored. Let&apos;s create it to
              get started.
            </p>

            <div className="mt-6 w-full space-y-2">
              <FeatureRow
                icon={<Lock className="size-4" />}
                title="Zero-knowledge AES-256-GCM encryption"
                desc="Files are encrypted before they ever leave your device."
              />
              <FeatureRow
                icon={<ShieldCheck className="size-4" />}
                title="Stored on your own Telegram account"
                desc="No third-party servers. You own your data."
              />
              <FeatureRow
                icon={<Sparkles className="size-4" />}
                title="Available from any device you sign in on"
                desc="Sign in elsewhere and your vault reappears instantly."
              />
            </div>

            <div className="mt-7 w-full">
              {status === "creating" ? (
                <Button
                  className="w-full h-12 rounded-xl bg-brand-gradient text-brand-foreground gap-2 shadow-lg shadow-brand/25"
                  disabled
                >
                  <Loader2 className="size-4 animate-spin" />
                  Creating your vault…
                </Button>
              ) : status === "error" ? (
                <div className="space-y-2.5">
                  <Button
                    className="w-full h-12 rounded-xl bg-brand-gradient text-brand-foreground gap-2 shadow-lg shadow-brand/25"
                    onClick={create}
                  >
                    <RefreshCw className="size-4" />
                    Try again
                  </Button>
                  <p className="text-xs text-destructive">{errorMsg}</p>
                </div>
              ) : (
                <Button
                  className="w-full h-12 rounded-xl bg-brand-gradient text-brand-foreground gap-2 shadow-lg shadow-brand/25 group"
                  onClick={create}
                >
                  Create vault
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              )}
            </div>

            {/* Loader shown below the button while creating */}
            <AnimatePresence>
              {status === "creating" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-7 flex flex-col items-center"
                >
                  <TriVELoader size={48} />
                  <p className="text-xs text-muted-foreground mt-3">
                    Creating your private channel on Telegram…
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </VaultShell>
  )
}

/* ---------- Vault scanning (login from new device → needsScan=true) ---------- */

const SCAN_TAGLINES = [
  "Scanning vault…",
  "Reading manifests…",
  "Found files…",
  "Restoring index…",
  "Almost there…",
]

export function VaultScanning({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = React.useState<
    "idle" | "scanning" | "done" | "error"
  >("idle")
  const [taglineIdx, setTaglineIdx] = React.useState(0)
  const [result, setResult] = React.useState<{
    added: number
    skipped: number
    errors: number
  } | null>(null)
  const [errorMsg, setErrorMsg] = React.useState("")

  // Rotate taglines while scanning.
  React.useEffect(() => {
    if (status !== "scanning") return
    const t = setInterval(
      () => setTaglineIdx((i) => (i + 1) % SCAN_TAGLINES.length),
      1400
    )
    return () => clearInterval(t)
  }, [status])

  const runScan = React.useCallback(async () => {
    setStatus("scanning")
    setTaglineIdx(0)
    setErrorMsg("")
    try {
      const res = await api.scanVault()
      setResult({
        added: res.added,
        skipped: res.skipped,
        errors: (res.errors || []).length,
      })
      setStatus("done")
      // No file-related toasts — just transition to dashboard
      setTimeout(() => onDone(), 1200)
    } catch (e) {
      setStatus("error")
      const msg = e instanceof Error ? e.message : "Couldn't scan vault"
      setErrorMsg(msg)
      // Silent error — no toast, just show error state in the UI
    }
  }, [onDone])

  // Auto-trigger scan on mount — no user interaction needed.
  React.useEffect(() => {
    void runScan()
  }, [runScan])

  return (
    <VaultShell>
      <AnimatePresence mode="wait">
        {status === "done" && result ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="size-20 rounded-full bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-xl shadow-brand/40 mb-6"
            >
              <Check className="size-10" strokeWidth={3} />
            </motion.div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {result.added > 0
                ? `Found ${result.added} file${result.added === 1 ? "" : "s"}!`
                : "Vault is empty"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {result.added > 0
                ? "Your vault has been restored. Taking you to your files…"
                : "No encrypted files were found in your vault yet. Taking you to your dashboard…"}
            </p>
            <div className="mt-7">
              <TriVELoader size={36} />
            </div>
          </motion.div>
        ) : status === "error" ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <div className="size-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-6">
              <RefreshCw className="size-9" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Scan failed
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {errorMsg}
            </p>
            <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
              <Button
                className="h-11 rounded-xl bg-brand-gradient text-brand-foreground gap-2 shadow-lg shadow-brand/25"
                onClick={runScan}
              >
                <RefreshCw className="size-4" />
                Retry scan
              </Button>
              <Button
                variant="ghost"
                className="text-xs h-9 rounded-xl"
                onClick={onDone}
              >
                Skip for now
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 rounded-2xl bg-brand/20 blur-2xl" />
              <BrandMark
                size={64}
                className="rounded-2xl drop-shadow-lg relative"
              />
            </motion.div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Restoring your{" "}
              <span className="text-gradient-brand">files</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-md">
              Scanning your Telegram vault for your encrypted files.
            </p>

            <div className="mt-8">
              <TriVELoader size={64} />
            </div>

            {/* Rotating tagline */}
            <div className="h-6 mt-6 relative overflow-hidden w-full max-w-xs">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={taglineIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="text-xs text-muted-foreground absolute inset-0 flex items-center justify-center"
                >
                  {SCAN_TAGLINES[taglineIdx]}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Idle state shows a "Scan now" button; otherwise the scan runs
                automatically on mount. */}
            {status === "idle" && (
              <Button
                className="mt-6 h-11 px-6 rounded-xl bg-brand-gradient text-brand-foreground gap-2 shadow-lg shadow-brand/25"
                onClick={runScan}
              >
                Scan now
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </VaultShell>
  )
}
