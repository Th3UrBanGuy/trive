"use client"

import * as React from "react"
import * as Icons from "lucide-react"
import { Check, Copy, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  fileCategory,
  fileIcon,
  CATEGORY_COLORS,
} from "@/lib/file-utils"
import type { FileItem } from "@/lib/types"

/**
 * Maps a file's mime type to a colored lucide icon.
 */
export function FileIcon({
  mime,
  className,
  size = 20,
}: {
  mime: string
  className?: string
  size?: number
}) {
  const category = fileCategory(mime)
  const iconName = fileIcon(category)
  const Icon = (Icons as Record<string, Icons.LucideIcon>)[iconName] || Icons.File
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        className
      )}
      style={{
        background: `color-mix(in oklch, ${color} 22%, transparent)`,
        color,
        width: size + 12,
        height: size + 12,
      }}
    >
      <Icon size={size} />
    </span>
  )
}

export function CategoryColor(mime: string): string {
  const category = fileCategory(mime)
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.other
}

export function StarButton({
  starred,
  onToggle,
  className,
}: {
  starred: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-7 rounded-full hover:bg-accent",
        starred && "text-[oklch(0.78_0.19_75)]",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={starred ? "Remove from starred" : "Add to starred"}
    >
      <Star
        className={cn("size-4", starred && "fill-current")}
      />
    </Button>
  )
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "icon",
}: {
  value: string
  label?: string
  className?: string
  size?: "icon" | "sm"
}) {
  const [copied, setCopied] = React.useState(false)

  const doCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    let success = false

    // Method 1: navigator.clipboard (modern, works in secure contexts)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value)
        success = true
      } catch {}
    }

    // Method 2: textarea + execCommand (fallback for non-secure / older browsers)
    if (!success) {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = value
        textarea.style.position = "fixed"
        textarea.style.left = "0"
        textarea.style.top = "0"
        textarea.style.opacity = "0"
        textarea.setAttribute("readonly", "")
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        textarea.setSelectionRange(0, value.length)
        success = document.execCommand("copy")
        document.body.removeChild(textarea)
      } catch {}
    }

    if (success) {
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } else {
      // Last resort: show the link in a toast for manual copy
      toast.info("Copy this link:", { description: value, duration: 6000 })
    }
  }

  return (
    <Button
      variant="outline"
      size={size === "icon" ? "icon" : "sm"}
      className={cn("gap-1.5", className)}
      onClick={doCopy}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {size === "sm" && <span>{copied ? "Copied" : label}</span>}
    </Button>
  )
}

export function FileTypeBadge({ mime }: { mime: string }) {
  const category = fileCategory(mime)
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        color,
      }}
    >
      {category}
    </span>
  )
}

export function EncryptionPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-medium",
        className
      )}
    >
      <Icons.ShieldCheck className="size-3" />
      AES-256-GCM
    </span>
  )
}

export function isFileItem(item: unknown): item is FileItem {
  return !!item && typeof item === "object" && "mimeType" in item
}
