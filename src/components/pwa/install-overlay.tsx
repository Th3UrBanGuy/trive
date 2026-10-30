"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import {
  useInstallOverlay,
  useInstallPromptState,
  useInstallPrompt,
  InstallPromptContext,
} from "@/components/pwa/use-install-prompt"

/**
 * Mount the install-prompt hook exactly once at the app root and expose its
 * state via context. Lives here (rather than in use-install-prompt.ts) because
 * it needs JSX and that file is .ts.
 */
export function InstallPromptProvider({ children }: { children: React.ReactNode }) {
  const value = useInstallPrompt()
  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  )
}

type Phase = "installing" | "success" | "opening"

const TAGLINES = [
  "Preparing your vault…",
  "Adding to home screen…",
  "Almost there…",
]

/**
 * Full-screen premium install overlay. Triggered when the user clicks
 * "Install App" anywhere in the app (banner, navbar, install section).
 *
 * Flow:
 *   1. Overlay fades in — `.trive-loader` triangle (scaled to 120px) inside
 *      a soft glowing brand ring, with "Installing TriVE…" + brand-gradient
 *      shimmer progress bar + rotating taglines.
 *   2. `promptInstall()` is fired immediately; the native browser prompt
 *      appears above the overlay.
 *   3. On `accepted`: checkmark animation + "TriVE installed" → "Opening
 *      TriVE…" → fade out (~1.2s). The browser then reopens the PWA in
 *      standalone mode.
 *   4. On `dismissed`: fade out + toast
 *      "Maybe later — you can install anytime from the browser menu".
 */
export function InstallOverlay() {
  const { open, closeOverlay } = useInstallOverlay()
  const { promptInstall } = useInstallPromptState()

  const [phase, setPhase] = React.useState<Phase>("installing")
  const [taglineIdx, setTaglineIdx] = React.useState(0)
  const [progress, setProgress] = React.useState(0)

  // Reset internal state every time the overlay opens.
  React.useEffect(() => {
    if (!open) return
    setPhase("installing")
    setProgress(0)
    setTaglineIdx(0)

    let cancelled = false

    // Rotate taglines every ~1.6s while installing.
    const tagTimer = setInterval(() => {
      if (cancelled) return
      setTaglineIdx((i) => (i + 1) % TAGLINES.length)
    }, 1600)

    // Animate a fake progress bar 0 → 92% over ~2.5s (the native prompt
    // usually resolves in 1–3s).
    const start = Date.now()
    const DURATION = 2500
    let raf = 0
    const tick = () => {
      if (cancelled) return
      const elapsed = Date.now() - start
      const pct = Math.min(92, (elapsed / DURATION) * 92)
      setProgress(pct)
      if (pct < 92) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // Fire the native prompt. This blocks until the user picks accepted/dismissed.
    void (async () => {
      const accepted = await promptInstall()
      if (cancelled) return
      clearInterval(tagTimer)
      cancelAnimationFrame(raf)

      if (accepted) {
        // Snap progress to 100%, then transition to success.
        setProgress(100)
        setTimeout(() => {
          if (cancelled) return
          setPhase("success")
        }, 350)
        // After showing the checkmark, switch to "Opening TriVE…".
        setTimeout(() => {
          if (cancelled) return
          setPhase("opening")
        }, 1700)
        // Then fade out — the browser handles relaunching the PWA.
        setTimeout(() => {
          if (cancelled) return
          closeOverlay()
        }, 3000)
      } else {
        // Declined — fade out + toast.
        closeOverlay()
        toast("Maybe later — you can install anytime from the browser menu", {
          description: "Look for “Install app” or “Add to Home Screen” in your browser menu.",
        })
      }
    })()

    return () => {
      cancelled = true
      clearInterval(tagTimer)
      cancelAnimationFrame(raf)
    }
  }, [open, promptInstall, closeOverlay])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="install-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in oklch, var(--brand-deep) 55%, #050a14 92%), #050a14)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Installing TriVE"
        >
          {/* Subtle aurora glow behind everything */}
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 40%, color-mix(in oklch, var(--brand) 30%, transparent), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 70%, color-mix(in oklch, var(--brand-cyan) 22%, transparent), transparent 65%)",
            }}
          />

          {/* Top-right close (only meaningful while installing — gives the user
              an escape hatch if the native prompt never shows, e.g. iOS where
              we shouldn't have opened the overlay at all). */}
          {phase === "installing" && (
            <button
              type="button"
              onClick={closeOverlay}
              aria-label="Close"
              className="absolute top-5 right-5 size-10 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="size-5" />
            </button>
          )}

          <div className="relative flex flex-col items-center gap-8 max-w-md w-full text-center">
            {/* The triangle loader OR the success checkmark */}
            <AnimatePresence mode="wait" initial={false}>
              {phase === "installing" && (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative flex items-center justify-center"
                  style={{ width: 220, height: 220 }}
                >
                  {/* Glowing brand ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, color-mix(in oklch, var(--brand) 35%, transparent), transparent 70%)",
                      filter: "blur(28px)",
                    }}
                    animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Rotating conic ring */}
                  <motion.div
                    className="absolute inset-4 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklch, var(--brand) 60%, transparent) 90deg, transparent 180deg, color-mix(in oklch, var(--brand-cyan) 60%, transparent) 270deg, transparent 360deg)",
                      WebkitMask:
                        "radial-gradient(circle, transparent 58%, black 60%, black 64%, transparent 66%)",
                      mask: "radial-gradient(circle, transparent 58%, black 60%, black 64%, transparent 66%)",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
                  />
                  {/* The canonical TriVE triangle loader, scaled up to 120px */}
                  <div
                    className="trive-loader relative"
                    style={{ width: 120, height: "calc(120px * 0.866)" }}
                  />
                </motion.div>
              )}

              {phase !== "installing" && (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="relative flex items-center justify-center"
                  style={{ width: 220, height: 220 }}
                >
                  {/* Glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, color-mix(in oklch, var(--brand) 45%, transparent), transparent 70%)",
                      filter: "blur(28px)",
                    }}
                    animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Brand-gradient circle with check */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.05 }}
                    className="relative size-28 rounded-full bg-brand-gradient flex items-center justify-center shadow-2xl shadow-brand/40"
                  >
                    <motion.span
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                      className="text-white"
                    >
                      <Check className="size-12" strokeWidth={3} />
                    </motion.span>
                    {/* Expanding ring pulse */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-white/40"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Heading + sub-text */}
            <div className="space-y-2">
              <AnimatePresence mode="wait" initial={false}>
                {phase === "installing" && (
                  <motion.div
                    key="h-installing"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5"
                  >
                    <h2 className="text-2xl font-semibold tracking-tight text-white">
                      Installing TriVE…
                    </h2>
                    <div className="h-5 relative overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={taglineIdx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="text-sm text-white/70 absolute inset-0"
                        >
                          {TAGLINES[taglineIdx]}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {phase === "success" && (
                  <motion.div
                    key="h-success"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5"
                  >
                    <h2 className="text-2xl font-semibold tracking-tight text-white">
                      TriVE installed
                    </h2>
                    <p className="text-sm text-white/70">
                      Your vault is ready on this device.
                    </p>
                  </motion.div>
                )}

                {phase === "opening" && (
                  <motion.div
                    key="h-opening"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5"
                  >
                    <h2 className="text-2xl font-semibold tracking-tight text-white">
                      Opening TriVE…
                    </h2>
                    <p className="text-sm text-white/70">
                      Launching your secure vault in its own window.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Brand-gradient shimmer progress bar (only while installing) */}
            <AnimatePresence>
              {phase === "installing" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-64 max-w-[80vw]"
                >
                  <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient"
                      style={{ width: `${progress}%` }}
                      transition={{ duration: 0.1, ease: "linear" }}
                    />
                    {/* Shimmer */}
                    <motion.div
                      className="absolute inset-y-0 w-16"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                      }}
                      initial={{ left: "-25%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-white/50 text-center font-mono tabular-nums">
                    {Math.round(progress)}%
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer hint while installing */}
            {phase === "installing" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-[11px] text-white/40 max-w-xs"
              >
                If your browser didn&apos;t prompt you, find “Install app” or
                “Add to Home Screen” in your browser menu.
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
