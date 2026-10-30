"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckSquare,
  Download,
  FolderInput,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function SelectionActionBar({
  onDownload,
  onDownloadZip,
  onMove,
  onShare,
  onStar,
  onTrash,
  onSelectAll,
  totalCount,
}: {
  onDownload?: () => void
  onDownloadZip?: () => void
  onMove?: () => void
  onShare?: () => void
  onStar?: () => void
  onTrash?: () => void
  onSelectAll?: () => void
  totalCount?: number
}) {
  const selected = useUIStore((s) => s.selected)
  const clearSelected = useUIStore((s) => s.clearSelected)
  const count = selected.size
  const allSelected = typeof totalCount === "number" && count > 0 && count >= totalCount

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed left-1/2 -translate-x-1/2 z-40 bottom-safe-lg w-[calc(100%-1rem)] max-w-2xl px-2 sm:px-0"
        >
          <div className="relative glass-strong rounded-2xl shadow-2xl shadow-brand/15 ring-1 ring-brand/10 overflow-hidden">
            {/* Row 1: count + actions */}
            <div className="flex items-center gap-1 p-1.5 overflow-x-auto no-scrollbar">
              <div className="px-3 py-1 text-sm font-medium tabular-nums whitespace-nowrap">
                <span className="text-gradient-brand font-semibold">{count}</span>
                <span className="text-muted-foreground ml-1">selected</span>
              </div>
              <div className="h-5 w-px bg-border/60 shrink-0" />
              {/* Select All */}
              {onSelectAll && (
                <BarButton
                  icon={CheckSquare}
                  label={allSelected ? "Deselect all" : "Select all"}
                  onClick={onSelectAll}
                  active={allSelected}
                />
              )}
              {/* Download */}
              {count === 1 ? (
                <BarButton icon={Download} label="Download" onClick={onDownload} />
              ) : (
                <BarButton icon={Download} label="Download ZIP" onClick={onDownloadZip || onDownload} />
              )}
              <BarButton icon={FolderInput} label="Move" onClick={onMove} />
              <BarButton icon={Share2} label="Share" onClick={onShare} highlight />
              <BarButton icon={Star} label="Star" onClick={onStar} />
              <BarButton
                icon={Trash2}
                label="Trash"
                onClick={onTrash}
                destructive
              />
              <div className="h-5 w-px bg-border/60 shrink-0" />
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full shrink-0"
                onClick={clearSelected}
                aria-label="Exit selection mode"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BarButton({
  icon: Icon,
  label,
  onClick,
  destructive,
  highlight,
  active,
}: {
  icon: React.ElementType
  label: string
  onClick?: () => void
  destructive?: boolean
  highlight?: boolean
  active?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      className={cn(
        "rounded-xl h-10 px-3 gap-1.5 text-xs shrink-0",
        destructive && "text-destructive hover:bg-destructive/10",
        highlight && !destructive && "text-brand hover:bg-brand/10",
        active && "bg-brand/10 text-brand"
      )}
      onClick={onClick}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  )
}
