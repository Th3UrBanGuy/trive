"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

/**
 * TriVE BrandMark — uses the actual uploaded TriVE logo mark (transparent PNG).
 * The triangle gradient (navy → blue → cyan) is the real logo, not a CSS approximation.
 * `/public/trive-mark-trimmed.png` is the cropped, bg-removed triangle mark.
 */
export function BrandMark({
  className,
  size = 32,
}: {
  className?: string
  size?: number
}) {
  const [hasError, setHasError] = React.useState(false)

  if (hasError) {
    return (
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        className={cn("inline-block drop-shadow-sm shrink-0", className)}
        aria-hidden
      >
        <defs>
          <linearGradient id="trive-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="#0b0f19" />
        <path
          d="M20 8L32 29H8L20 8Z"
          fill="url(#trive-brand-grad)"
        />
        <path
          d="M20 15L26 26H14L20 15Z"
          fill="#0b0f19"
        />
      </svg>
    )
  }

  return (
    <img
      src="/trive-mark-trimmed.png"
      alt="TriVE"
      width={size}
      height={size}
      onError={() => setHasError(true)}
      className={cn("inline-block object-contain drop-shadow-sm", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

/**
 * TriVE FullLogo — the complete logo (mark + "TriVE" wordmark + tagline).
 * Uses the transparent-bg PNG. In dark mode, swaps to the white-text variant
 * so the text stays legible on navy backgrounds.
 */
export function FullLogo({
  className,
  height = 40,
}: {
  className?: string
  height?: number
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  return (
    <img
      src={isDark ? "/trive-logo-light.png" : "/trive-logo.png"}
      alt="TriVE — Secure File Management"
      style={{ height, width: "auto" }}
      className={cn("inline-block object-contain", className)}
    />
  )
}

/**
 * TriVE Wordmark — mark + "TriVE" text. Uses the real logo mark image +
 * typographic "VE" gradient for a compact header lockup.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 select-none", className)}>
      <BrandMark size={26} />
      <span className="font-semibold tracking-tight text-base">
        Tri<span className="text-gradient-brand">VE</span>
      </span>
    </span>
  )
}
