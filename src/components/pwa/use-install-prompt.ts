"use client"

import * as React from "react"
import { create } from "zustand"

/**
 * Minimal type for the deferred beforeinstallprompt event.
 * (Not in standard TS DOM lib — Chromium-only.)
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export interface InstallPromptState {
  /** A native `beforeinstallprompt` is captured and ready to fire. */
  canInstall: boolean
  /** The PWA has already been installed (or is running standalone). */
  installed: boolean
  /** Running on iOS Safari — no beforeinstallprompt; needs manual A2HS instructions. */
  iosInstall: boolean
  /** Fire the native install prompt. Resolves true if the user accepted. */
  promptInstall: () => Promise<boolean>
}

/**
 * Detect iOS Safari. iOS Chrome/Firefox share the Safari WKWebView but don't
 * support Add-to-Home-Screen the same way, so we restrict to actual Safari.
 */
function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1)
  if (!isIosDevice) return false
  // Exclude Chrome / Firefox / Edge on iOS — they can't A2HS reliably.
  const isOtherIosBrowser = /CriOS|FxiOS|EdiOS|OptiOS|Mercury/i.test(ua)
  if (isOtherIosBrowser) return false
  return /Safari/i.test(ua) || /AppleWebKit/i.test(ua)
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false
  const mql = window.matchMedia?.("(display-mode: standalone)")
  if (mql?.matches) return true
  // iOS Safari exposes `navigator.standalone` (deprecated but still works).
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone
  return standalone === true
}

/**
 * The install-prompt hook. Mount ONCE at the app root (via InstallPromptProvider)
 * so the `beforeinstallprompt` event is captured globally.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = React.useState<boolean>(false)
  const [iosInstall] = React.useState<boolean>(() => detectIosSafari())

  // Capture beforeinstallprompt + appinstalled.
  React.useEffect(() => {
    if (typeof window === "undefined") return

    // Already running standalone — nothing to install.
    if (detectStandalone()) {
      setInstalled(true)
      return
    }

    const onBefore = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener("beforeinstallprompt", onBefore)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  // Standalone mode can also be detected later via the media query changing
  // (e.g. after the user A2HS's and reopens). Listen for that too.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia?.("(display-mode: standalone)")
    if (!mql) return
    const onChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) setInstalled(true)
    }
    mql.addEventListener?.("change", onChange)
    return () => mql.removeEventListener?.("change", onChange)
  }, [])

  const promptInstall = React.useCallback(async (): Promise<boolean> => {
    if (!deferred) return false
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      const accepted = choice.outcome === "accepted"
      if (accepted) setInstalled(true)
      // The event is single-use.
      setDeferred(null)
      return accepted
    } catch {
      return false
    }
  }, [deferred])

  // canInstall is true only when we have a deferred prompt AND we're not
  // already installed. iOS never gets a deferred prompt — handled separately.
  const canInstall = !!deferred && !installed

  return { canInstall, installed, iosInstall, promptInstall }
}

// ---- Context so the hook is mounted exactly once ----
// (The Provider component lives in install-overlay.tsx because it needs JSX,
//  and this file is .ts — no JSX allowed here.)

export const InstallPromptContext = React.createContext<InstallPromptState | null>(
  null
)

export function useInstallPromptState(): InstallPromptState {
  const ctx = React.useContext(InstallPromptContext)
  // Fall back to a no-op state if used outside the provider (defensive).
  return (
    ctx ?? {
      canInstall: false,
      installed: false,
      iosInstall: false,
      promptInstall: async () => false,
    }
  )
}

// ---- Overlay open/close (decoupled from the hook so any component can trigger) ----

interface InstallOverlayState {
  open: boolean
  openOverlay: () => void
  closeOverlay: () => void
}

export const useInstallOverlay = create<InstallOverlayState>((set) => ({
  open: false,
  openOverlay: () => set({ open: true }),
  closeOverlay: () => set({ open: false }),
}))
