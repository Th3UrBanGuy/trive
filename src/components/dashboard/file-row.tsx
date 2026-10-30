"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Download,
  FolderInput,
  FolderArchive,
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
import { Checkbox } from "@/components/ui/checkbox"
import { FileIcon } from "./_shared"
import { useLongPress, useIsTouchDevice } from "./file-card"
import type { FileItem, Folder } from "@/lib/types"
import { formatBytes, formatDate, fileCategory } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

type Row = { kind: "file"; item: FileItem } | { kind: "folder"; item: Folder }

export function FileRow({
  row,
  selected,
  selectionMode,
  onSelect,
  onAction,
  onOpen,
  onLongPress,
  sortableHeader,
}: {
  row: Row
  selected: boolean
  selectionMode: boolean
  onSelect: (checked: boolean) => void
  onAction: (a: string) => void
  onOpen: () => void
  onLongPress?: () => void
  sortableHeader?: React.ReactNode
}) {
  void sortableHeader
  const isFolder = row.kind === "folder"
  const item = row.item
  const starred = !isFolder && (row.item as FileItem).starred
  const isTouch = useIsTouchDevice()
  const { bind, pressing, justFiredRef } = useLongPress(() => onLongPress?.())

  const category = !isFolder ? fileCategory((row.item as FileItem).mimeType) : null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.tr
          layout
          {...(onLongPress ? bind : {})}
          onClick={(e) => {
            // Suppress the synthetic click that fires right after a long-press.
            if (justFiredRef.current) {
              justFiredRef.current = false
              return
            }
            onOpen()
          }}
          onDoubleClick={() => {
            if (justFiredRef.current) {
              justFiredRef.current = false
              return
            }
            onOpen()
          }}
          className={cn(
            "group border-b border-border/40 transition-colors cursor-default select-none h-14",
            (selected || pressing)
              ? "bg-brand/10"
              : "hover:bg-brand/[0.04]",
            pressing && "scale-[0.998]",
            selectionMode && !selected && "opacity-70"
          )}
          style={{ transitionTimingFunction: "var(--ease-smooth)" }}
        >
          {/* Checkbox */}
          <td
            className="w-10 pl-3 text-center align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(c) => onSelect(!!c)}
              aria-label="Select"
              className="transition-all duration-200 data-[state=checked]:bg-brand-gradient data-[state=checked]:border-brand data-[state=checked]:text-brand-foreground data-[state=checked]:shadow-sm data-[state=checked]:shadow-brand/30 hover:border-brand/50"
            />
          </td>

          {/* Icon */}
          <td className="py-2 pr-2 align-middle">
            {isFolder ? (
              <div className="size-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-lg shadow-sm shadow-brand/10 transition-transform duration-300 group-hover:scale-105">
                📁
              </div>
            ) : (
              <FileIcon
                mime={(row.item as FileItem).mimeType}
                size={18}
                className="size-9 shadow-sm transition-transform duration-300 group-hover:scale-105"
              />
            )}
          </td>

          {/* Name + metadata */}
          <td className="py-2 pr-2 min-w-0 align-middle">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-sm font-medium">{item.name}</span>
              {/* Encrypted badge — for files only */}
              {!isFolder && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 rounded-full bg-brand/8 text-brand px-1.5 py-0.5 text-[9px] font-medium shrink-0"
                  title="AES-256-GCM encrypted"
                >
                  <Lock className="size-2.5" />
                  <span className="uppercase tracking-wide">AES</span>
                </span>
              )}
              {starred && (
                <Star className="size-3.5 text-[oklch(0.7_0.18_75)] fill-current shrink-0" />
              )}
              {/* Mobile-only size/metadata inline */}
              <span className="sm:hidden text-[11px] text-muted-foreground ml-auto shrink-0 tabular-nums">
                {!isFolder
                  ? formatBytes((row.item as FileItem).size)
                  : `${(row.item as Folder).fileCount ?? 0} item${
                      ((row.item as Folder).fileCount ?? 0) === 1 ? "" : "s"
                    }`}
              </span>
            </div>
            {/* Sub-metadata line — category for files */}
            {!isFolder && (
              <div className="text-[11px] text-muted-foreground mt-0.5 capitalize hidden sm:block">
                {category}
              </div>
            )}
          </td>

          {/* Size */}
          {!isFolder && (
            <td className="text-xs text-muted-foreground text-right pr-4 align-middle tabular-nums hidden sm:table-cell">
              {formatBytes((row.item as FileItem).size)}
            </td>
          )}
          {isFolder && (
            <td className="text-xs text-muted-foreground text-right pr-4 align-middle tabular-nums hidden sm:table-cell">
              {(row.item as Folder).fileCount ?? 0} item{((row.item as Folder).fileCount ?? 0) === 1 ? "" : "s"}
            </td>
          )}

          {/* Modified */}
          <td className="text-xs text-muted-foreground text-right pr-4 hidden md:table-cell align-middle tabular-nums">
            {formatDate(item.updatedAt)}
          </td>

          {/* Star toggle */}
          <td
            className="w-9 text-right pr-1 align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            {!isFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAction(starred ? "unstar" : "star")
                }}
                aria-label={starred ? "Remove from starred" : "Add to starred"}
                aria-pressed={starred}
                className={cn(
                  "btn-premium size-8 rounded-lg inline-flex items-center justify-center",
                  starred
                    ? "text-[oklch(0.7_0.18_75)] hover:bg-[oklch(0.78_0.19_75)]/15"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/50",
                  // Slide in from the right + fade — feels alive, not abrupt.
                  isTouch || selected || starred
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                )}
                style={{ transitionTimingFunction: "var(--ease-premium)" }}
              >
                <Star className={cn("size-4", starred && "fill-current")} />
              </button>
            )}
          </td>

          {/* Actions */}
          <td
            className="w-10 text-right pr-3 align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "btn-premium size-8 rounded-lg hover:bg-accent hover:text-brand inline-flex items-center justify-center",
                    isTouch || selected
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 focus:opacity-100 focus:translate-x-0"
                  )}
                  style={{ transitionTimingFunction: "var(--ease-premium)" }}
                  aria-label="More actions"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="relative glass-strong w-44"
              >
                <DropdownMenuItem onClick={onOpen}>
                  {isFolder ? "Open" : "Preview"}
                </DropdownMenuItem>
                {!isFolder && (
                  <DropdownMenuItem onClick={() => onAction("download")}>
                    <Download className="size-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {isFolder && (
                  <DropdownMenuItem onClick={() => onAction("download-zip")}>
                    <FolderArchive className="size-4" />
                    Download as ZIP
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAction("rename")}>
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                {!isFolder && (
                  <DropdownMenuItem
                    onClick={() => onAction(starred ? "unstar" : "star")}
                  >
                    <Star className="size-4" />
                    {starred ? "Unstar" : "Star"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onAction("share")}
                  className="text-brand focus:text-brand focus:bg-brand/10"
                >
                  <Share2 className="size-4" />
                  Share
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
                  {isFolder ? "Delete folder" : "Move to trash"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </motion.tr>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpen}>
          {isFolder ? "Open" : "Preview"}
        </ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem onClick={() => onAction("download")}>
            Download
          </ContextMenuItem>
        )}
        {isFolder && (
          <ContextMenuItem onClick={() => onAction("download-zip")}>
            <FolderArchive className="size-4" />
            Download as ZIP
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onAction("rename")}>Rename</ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem
            onClick={() => onAction(starred ? "unstar" : "star")}
          >
            {starred ? "Unstar" : "Star"}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onAction("share")}>Share</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onAction("move")}>Move to…</ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => onAction("trash")}
        >
          {isFolder ? "Delete folder" : "Move to trash"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
