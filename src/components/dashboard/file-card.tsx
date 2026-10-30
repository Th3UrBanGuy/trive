"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Check,
  Download,
  FolderInput,
  Lock,
  MoreHorizontal,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileIcon, CategoryColor } from "./_shared"
import type { FileItem } from "@/lib/types"
import { formatBytes, formatDate } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

export type FileCardAction =
  | "open"
  | "download"
  | "rename"
  | "star"
  | "unstar"
  | "share"
  | "move"
  | "trash"

/**
 * Long-press + tap-to-toggle hook, tuned for native-app feel.
 *
 * Returns:
 *   - bind: spread on the target element (handles touchstart/move/end +
 *     contextmenu suppression during a long-press)
 *   - pressing: true while the long-press timer is armed (for visual hint)
 *   - justFiredRef: ref that's set to true the moment a long-press fires.
 *     Consumers should check `justFiredRef.current` in their click handler
 *     and reset it to false to suppress the synthetic click that follows.
 *
 * Cancels if the user scrolls more than 10px (touchmove), so it never
 * triggers during a scroll gesture. Also cancels if the touch ends
 * before the 500ms threshold.
 */
export function useLongPress(callback: () => void, delay = 500) {
  const [pressing, setPressing] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null)
  // Stable ref — set to true the instant a long-press fires; the consumer
  // reads it in their click handler and resets it to false. Using a ref
  // (not state) means the click handler always sees the latest value
  // without needing a re-render.
  const justFiredRef = React.useRef(false)
  const cbRef = React.useRef(callback)
  React.useEffect(() => {
    cbRef.current = callback
  }, [callback])

  const clear = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPressing(false)
  }, [])

  const bind = React.useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return
        const t = e.touches[0]
        startPosRef.current = { x: t.clientX, y: t.clientY }
        justFiredRef.current = false
        setPressing(true)
        timerRef.current = setTimeout(() => {
          justFiredRef.current = true
          cbRef.current()
          // Light haptic-style feedback (where supported).
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try { navigator.vibrate(15) } catch {}
          }
          setPressing(false)
        }, delay)
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (!startPosRef.current) return
        const t = e.touches[0]
        const dx = t.clientX - startPosRef.current.x
        const dy = t.clientY - startPosRef.current.y
        if (Math.hypot(dx, dy) > 10) clear()
      },
      onTouchEnd: (e: React.TouchEvent) => {
        clear()
        // If a long-press just fired, suppress the synthetic click that
        // would otherwise toggle/preview the just-selected item.
        if (justFiredRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
      onTouchCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        // On touch devices, Android Chrome fires a contextmenu event
        // right after a long-press. Suppress it so the OS context menu
        // doesn't pop up over our selection UI.
        if (justFiredRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
    }),
    [clear, delay]
  )

  return { bind, pressing, justFiredRef, clear }
}

/** True on touch-primary devices (no hover capability). */
export function useIsTouchDevice(): boolean {
  const [touch, setTouch] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)")
    const update = () => setTouch(mq.matches)
    update()
    mq.addEventListener?.("change", update)
    return () => mq.removeEventListener?.("change", update)
  }, [])
  return touch
}

/**
 * Premium glass-pill star button. Refined from the raw icon — a subtle
 * backdrop with a soft ring, filled-amber when active.
 */
function StarPillButton({
  starred,
  onToggle,
}: {
  starred: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={starred ? "Remove from starred" : "Add to starred"}
      aria-pressed={starred}
      className={cn(
        "size-9 rounded-full flex items-center justify-center",
        "backdrop-blur-md border transition-all",
        "hover:scale-105 active:scale-95",
        starred
          ? "bg-[oklch(0.78_0.19_75)]/15 border-[oklch(0.78_0.19_75)]/40 text-[oklch(0.7_0.18_75)]"
          : "bg-background/70 border-border/40 text-muted-foreground hover:text-foreground"
      )}
    >
      <Star className={cn("size-3.5", starred && "fill-current")} />
    </button>
  )
}

export function FileCard({
  file,
  selected,
  selectionMode,
  onAction,
  onClick,
  onLongPress,
  index = 0,
}: {
  file: FileItem
  selected: boolean
  selectionMode: boolean
  onAction: (action: FileCardAction) => void
  onClick: (e: React.MouseEvent) => void
  onLongPress?: () => void
  index?: number
}) {
  const isTouch = useIsTouchDevice()
  const { bind, pressing, justFiredRef } = useLongPress(() => onLongPress?.())

  const categoryColor = CategoryColor(file.mimeType)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
          {...(onLongPress ? bind : {})}
          whileHover={isTouch ? undefined : { y: -3 }}
          whileTap={isTouch ? { scale: 0.98 } : undefined}
          onClick={(e) => {
            if (justFiredRef.current) {
              justFiredRef.current = false
              return
            }
            onClick(e)
          }}
          onDoubleClick={() => {
            if (justFiredRef.current) {
              justFiredRef.current = false
              return
            }
            onAction("open")
          }}
          className={cn(
            "group card-premium relative rounded-2xl p-2.5 cursor-pointer select-none overflow-hidden",
            !isTouch && "hover:border-brand/30",
            isTouch && "touch-none",
            (selected || pressing) && "ring-2 ring-brand shadow-lg shadow-brand/15 border-brand/40",
            pressing && "scale-[0.98]",
            selectionMode && !selected && "opacity-70"
          )}
          style={{ transitionTimingFunction: "var(--ease-premium)" }}
        >
          {/* Thumbnail / icon tile — larger, more prominent */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2.5 flex items-center justify-center">
            {file.thumbnail ? (
              <>
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  draggable={false}
                  loading="lazy"
                />
                {/* Subtle bottom gradient overlay for image thumbnails */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, color-mix(in oklch, black 35%, transparent), transparent)",
                  }}
                />
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center relative transition-colors duration-300 group-hover:bg-brand/[0.04]"
                style={{
                  background: `linear-gradient(135deg, color-mix(in oklch, ${categoryColor} 18%, transparent), color-mix(in oklch, ${categoryColor} 6%, transparent))`,
                }}
              >
                {/* Soft radial glow behind the icon */}
                <div
                  className="absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-80"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, color-mix(in oklch, ${categoryColor} 25%, transparent), transparent 60%)`,
                  }}
                />
                <FileIcon
                  mime={file.mimeType}
                  size={44}
                  className="relative backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
                />
              </div>
            )}

            {/* Encrypted badge (top-left) — reassures the user */}
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-md border border-border/40 px-1.5 py-0.5 text-[9px] font-medium text-brand shadow-sm">
              <Lock className="size-2.5" />
              <span className="uppercase tracking-wide hidden xs:inline">AES</span>
            </div>

            {/* Top-right action cluster */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {/* Quick share icon button — appears on hover (desktop) or always (touch) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAction("share")
                }}
                className={cn(
                  "btn-premium size-9 rounded-full flex items-center justify-center",
                  "backdrop-blur-md border border-border/40",
                  "bg-background/70 hover:bg-brand hover:text-brand-foreground hover:border-brand",
                  isTouch ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
                aria-label="Share file"
                title="Share"
              >
                <Share2 className="size-3.5" />
              </button>
              <StarPillButton
                starred={file.starred}
                onToggle={() => onAction(file.starred ? "unstar" : "star")}
              />
            </div>

            {/* Selection check — premium glass circle with brand check */}
            {selected && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="absolute bottom-2 left-2 size-9 rounded-full bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/40 ring-2 ring-background/60"
              >
                <Check className="size-4" strokeWidth={3} />
              </motion.div>
            )}

            {/* Long-press hint pulse */}
            {pressing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-xl ring-2 ring-brand/60 bg-brand/10 pointer-events-none"
              />
            )}

            {/* More-actions dropdown — bottom-right */}
            <div className="absolute bottom-2 right-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "btn-premium size-9 rounded-full flex items-center justify-center",
                      "backdrop-blur-md border border-border/40",
                      "bg-background/70 hover:bg-background",
                      isTouch ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="relative glass-strong w-44"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={() => onAction("open")}>
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("download")}>
                    <Download className="size-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("rename")}>
                    <Pencil className="size-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onAction(file.starred ? "unstar" : "star")
                    }
                  >
                    <Star className="size-4" />
                    {file.starred ? "Unstar" : "Star"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAction("share")}
                    className="text-brand focus:text-brand focus:bg-brand/10"
                  >
                    <Share2 className="size-4" />
                    Share
                    <span className="ml-auto text-[10px] tracking-wide text-brand/70 uppercase">
                      link
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("move")}>
                    <FolderInput className="size-4" />
                    Move to…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onAction("trash")}
                  >
                    <Trash2 className="size-4" />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Name + metadata — well-spaced, premium */}
          <div className="px-0.5">
            <div className="text-sm font-medium truncate leading-tight" title={file.name}>
              {file.name}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">{formatBytes(file.size)}</span>
              <span className="tabular-nums">{formatDate(file.updatedAt)}</span>
            </div>
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAction("open")}>Open</ContextMenuItem>
        <ContextMenuItem onClick={() => onAction("download")}>
          Download
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction("rename")}>
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction(file.starred ? "unstar" : "star")}>
          {file.starred ? "Unstar" : "Star"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction("share")}>Share</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onAction("move")}>Move to…</ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => onAction("trash")}
        >
          Move to trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
