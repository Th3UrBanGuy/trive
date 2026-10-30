"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * "Built by Tectonic" credit. Subtle muted text with the Tectonic name in the
 * TriVE brand gradient. Links to https://tect0nic.com in a new tab.
 *
 * Used in every footer (landing, dashboard, public share, legal pages).
 */
export function TectonicCredit({
  className,
  prefix = "Built by",
}: {
  className?: string
  prefix?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      <span className="opacity-80">{prefix}</span>
      <a
        href="https://tect0nic.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium hover:opacity-90 transition-opacity"
      >
        <span className="text-gradient-brand">Tectonic</span>
      </a>
    </span>
  )
}
