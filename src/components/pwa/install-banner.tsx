"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, Share, Plus, X, Smartphone } from "lucide-react"
import { BrandMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { useInstallOverlay, useInstallPromptState } from "@/components/pwa/use-install-prompt"

const DISMISS_KEY = "trive-install-dismissed"
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {}
}

/**
 * Non-intrusive install prompt. Slim bottom bar that slides up, doesn't block
 * content, and dismisses easily. Professional and subtle — doesn't force the user.
 */
export function InstallBanner() {
  const { canInstall, installed, iosInstall } = useInstallPromptState()
  const { openOverlay } = useInstallOverlay()

  const [visible, setVisible] = React.useState(false)
  const [iosExpanded, setIosExpanded] = React.useState(false)

  React.useEffect(() => {
    if (installed) { setVisible(false); return }
    if (!canInstall && !iosInstall) { setVisible(false); return }
    // Delay 2s so the page loads first — non-intrusive
    const timer = setTimeout(() => {
      setVisible(!isRecentlyDismissed())
    }, 2000)
    return () => clearTimeout(timer)
  }, [canInstall, installed, iosInstall])

  const dismiss = React.useCallback(() => {
    markDismissed()
    setVisible(false)
  }, [])

  const install = React.useCallback(() => {
    if (iosInstall) {
      setIosExpanded((v) => !v)
      return
    }
    openOverlay()
  }, [iosInstall, openOverlay])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-banner"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 200, damping: 26 }}
          className="fixed z-30 bottom-3 inset-x-3 md:bottom-4 md:left-4 md:right-auto md:max-w-sm"
          role="dialog"
          aria-label="Install TriVE"
        >
          <div className="glass-strong rounded-2xl p-3 shadow-xl shadow-brand/10 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-0.5 bg-brand-gradient" />

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-2 right-2 size-6 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors z-10"
            >
              <X className="size-3.5" />
            </button>

            <div className="flex items-center gap-3 pr-5">
              <div className="size-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-border/50">
                <BrandMark size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">Install TriVE</div>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  Add to your device for instant access
                </p>
              </div>
              <Button
                size="sm"
                onClick={install}
                className="rounded-full gap-1 h-8 px-3 text-xs bg-brand-gradient hover:opacity-90 shrink-0"
              >
                <Smartphone className="size-3.5" />
                Install
              </Button>
            </div>

            {/* iOS instructions — expandable, not forced */}
            <AnimatePresence>
              {iosExpanded && iosInstall && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 mt-2 border-t border-border/40 space-y-2">
                    <div className="text-xs font-medium">Add to Home Screen:</div>
                    <ol className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex items-center justify-center size-5 rounded-md bg-brand/15 text-brand flex-shrink-0">
                          <Share className="size-3" />
                        </span>
                        <span>Tap <span className="font-medium text-foreground">Share</span> in Safari</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex items-center justify-center size-5 rounded-md bg-brand/15 text-brand flex-shrink-0">
                          <Plus className="size-3" />
                        </span>
                        <span>Choose <span className="font-medium text-foreground">Add to Home Screen</span></span>
                      </li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
