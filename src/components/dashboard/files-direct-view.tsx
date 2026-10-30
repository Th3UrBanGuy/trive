"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code2,
  FileType,
  File,
  Loader2,
  Share2,
  Download,
  Star,
} from "lucide-react"
import { api } from "@/lib/api"
import { useUIStore } from "@/lib/store"
import { useShareDialog } from "./share-dialog"
import { FileIcon, CategoryColor, CopyButton } from "./_shared"
import { fileCategory, formatBytes, formatDate } from "@/lib/file-utils"
import type { FileItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { key: "image", label: "Images", icon: ImageIcon },
  { key: "video", label: "Videos", icon: Film },
  { key: "audio", label: "Audio", icon: Music },
  { key: "pdf", label: "PDFs", icon: FileText },
  { key: "code", label: "Code", icon: Code2 },
  { key: "document", label: "Documents", icon: FileType },
  { key: "archive", label: "Archives", icon: Archive },
  { key: "other", label: "Other", icon: File },
] as const

export function FilesDirectView() {
  const qc = useQueryClient()
  const { setTarget: setShareTarget } = useShareDialog()
  const selected = useUIStore((s) => s.selected)
  const setSelected = useUIStore((s) => s.setSelected)
  const toggleSelected = useUIStore((s) => s.toggleSelected)
  const clearSelected = useUIStore((s) => s.clearSelected)
  const [selectionMode, setSelectionMode] = React.useState(false)

  const { data: files, isLoading } = useQuery({
    queryKey: ["files", "all-direct"],
    queryFn: () => api.listFiles({ all: true }),
    staleTime: 0,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  })

  const allFiles = (files || []).filter((f) => !f.trashed)

  // Group by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, FileItem[]>()
    for (const f of allFiles) {
      const cat = fileCategory(f.mimeType)
      const arr = map.get(cat) || []
      arr.push(f)
      map.set(cat, arr)
    }
    return map
  }, [allFiles])

  const selectedFiles = allFiles.filter((f) => selected.has(f.id))

  const onShare = () => {
    if (selectedFiles.length === 0) {
      toast.message("Select at least one file to share.")
      return
    }
    setShareTarget({ kind: "batch", items: selectedFiles })
  }

  const onDownload = (file: FileItem) => {
    const a = document.createElement("a")
    a.href = api.downloadUrl(file.id)
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const toggleStar = async (file: FileItem) => {
    try {
      await api.toggleStar(file.id, !file.starred)
      qc.invalidateQueries({ queryKey: ["files"] })
    } catch {
      toast.error("Couldn't update star")
    }
  }

  // Exit selection mode when selection is cleared
  React.useEffect(() => {
    if (selected.size === 0 && selectionMode) {
      setSelectionMode(false)
    }
  }, [selected.size, selectionMode])

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-3 md:p-5" onClick={(e) => { if (e.target === e.currentTarget && selectionMode) { clearSelected() } }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">All Files</h2>
          <p className="text-sm text-muted-foreground">{allFiles.length} file{allFiles.length === 1 ? "" : "s"} across all folders</p>
        </div>
        {selectionMode && selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-brand">{selected.size} selected</span>
            <button onClick={onShare} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-gradient text-brand-foreground text-sm font-medium">
              <Share2 className="size-4" /> Share
            </button>
            <button onClick={clearSelected} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-brand" />
        </div>
      ) : allFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-20 rounded-full bg-brand/10 flex items-center justify-center mb-4">
            <File className="size-10 text-brand/40" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No files yet</h3>
          <p className="text-sm text-muted-foreground">Upload files to see them categorized here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const catFiles = grouped.get(key) || []
            if (catFiles.length === 0) return null
            return (
              <div key={key}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="size-8 rounded-lg flex items-center justify-center"
                    style={{ background: `color-mix(in oklch, ${CategoryColor(catFiles[0].mimeType)} 15%, transparent)` }}
                  >
                    <Icon className="size-4" style={{ color: CategoryColor(catFiles[0].mimeType) }} />
                  </div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide">{label}</h3>
                  <span className="text-xs text-muted-foreground">({catFiles.length})</span>
                </div>

                {/* File list for this category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {catFiles.map((file) => {
                    const isSel = selected.has(file.id)
                    const catColor = CategoryColor(file.mimeType)
                    return (
                      <motion.div
                        key={file.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          if (selectionMode) {
                            e.stopPropagation()
                            toggleSelected(file.id)
                          }
                        }}
                        onDoubleClick={() => {
                          if (!selectionMode) onDownload(file)
                        }}
                        className={cn(
                          "glass rounded-xl p-3 cursor-pointer transition-all group relative",
                          isSel && "ring-2 ring-brand",
                          !selectionMode && "hover:shadow-lg hover:shadow-brand/10 hover:border-brand/30"
                        )}
                      >
                        {/* Top row: icon + actions */}
                        <div className="flex items-start gap-2.5">
                          <div
                            className="size-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in oklch, ${catColor} 12%, transparent)` }}
                          >
                            <FileIcon mime={file.mimeType} size={18} className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" title={file.name}>{file.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {formatBytes(file.size)} · {formatDate(file.createdAt)}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleStar(file) }}
                              className={cn("size-7 rounded-full flex items-center justify-center hover:bg-accent", file.starred && "text-brand")}
                            >
                              <Star className={cn("size-3.5", file.starred && "fill-current")} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDownload(file) }}
                              className="size-7 rounded-full flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground"
                            >
                              <Download className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Long press hint / selection badge */}
                        {isSel && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-xs">
                            ✓
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
