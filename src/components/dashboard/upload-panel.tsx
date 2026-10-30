"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { v4 as uuid } from "uuid"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useUploadStore, useUIStore } from "@/lib/store"
import { api } from "@/lib/api"
import { formatBytes } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

// Track active uploads across components for sequential concurrency control
const uploadQueue: {
  file: File
  folderId: string | null
  itemId: string
}[] = []
let activeUploads = 0
const MAX_CONCURRENT = 3
type QueueListener = () => void
const listeners = new Set<QueueListener>()
function notify() {
  listeners.forEach((l) => l())
}

export function enqueueUpload(file: File, folderId: string | null, itemId: string) {
  uploadQueue.push({ file, folderId, itemId })
  pump()
}

function pump() {
  while (activeUploads < MAX_CONCURRENT && uploadQueue.length > 0) {
    const next = uploadQueue.shift()!
    activeUploads++
    runUpload(next)
      .finally(() => {
        activeUploads--
        pump()
      })
  }
  notify()
}

async function runUpload({
  file,
  folderId,
  itemId,
}: {
  file: File
  folderId: string | null
  itemId: string
}) {
  const store = useUploadStore.getState()
  store.update(itemId, { status: "uploading", progress: 0 })
  try {
    await api.uploadFile(file, folderId, (pct) => {
      useUploadStore.getState().update(itemId, { progress: pct })
    })
    useUploadStore.getState().update(itemId, { status: "done", progress: 100 })
    // Invalidate queries to refresh file lists
    useQueryClientGlobal?.invalidateQueries({ queryKey: ["files"] })
    useQueryClientGlobal?.invalidateQueries({ queryKey: ["folders"] })
    useQueryClientGlobal?.invalidateQueries({ queryKey: ["storage"] })
  } catch (err) {
    useUploadStore.getState().update(itemId, {
      status: "error",
      error: err instanceof Error ? err.message : "Upload failed",
    })
  }
}

// Global query client reference, set by the dashboard
let useQueryClientGlobal: ReturnType<typeof useQueryClient> | null = null
export function setGlobalQueryClient(c: ReturnType<typeof useQueryClient>) {
  useQueryClientGlobal = c
}

export function UploadPanel() {
  const isOpen = useUIStore((s) => s.uploadOpen)
  const setOpen = useUIStore((s) => s.setUploadOpen)
  const items = useUploadStore((s) => s.items)
  const remove = useUploadStore((s) => s.remove)
  const clear = useUploadStore((s) => s.clear)
  const addUpload = useUploadStore((s) => s.add)
  const [minimized, setMinimized] = React.useState(false)

  // Inline "Add more files" trigger — opens a hidden file picker and
  // enqueues into the same upload queue. This exists because the FAB
  // auto-hides when this panel is visible (to avoid z-index clashes),
  // so users need another way to add files while the panel is open.
  // NOTE: useRef MUST be called unconditionally (before any early return)
  // to satisfy the Rules of Hooks.
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Subscribe to queue listener so we re-render
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => {
    const l: QueueListener = () => force()
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const visible = isOpen && items.length > 0
  if (!visible) return null

  const active = items.filter((i) => i.status === "uploading").length
  const done = items.filter((i) => i.status === "done").length
  const errored = items.filter((i) => i.status === "error").length

  const handleAddMore = () => fileInputRef.current?.click()
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const id = uuid()
      addUpload({ id, name: file.name, size: file.size, progress: 0, status: "uploading" })
      enqueueUpload(file, null, id)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed right-4 sm:right-5 z-40 w-[calc(100vw-2rem)] max-w-[360px] bottom-safe-lg"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesPicked}
        />
        <div className="relative glass-strong rounded-2xl shadow-2xl shadow-brand/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 gap-2">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Upload className="size-4 text-brand shrink-0" />
              <span className="font-medium truncate">Uploads</span>
              {active > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  • {active} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Add more files — replaces the FAB while panel is open */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs rounded-full gap-1"
                onClick={handleAddMore}
                aria-label="Add more files to upload queue"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add</span>
              </Button>
              {done > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs rounded-full"
                  onClick={() => {
                    items
                      .filter((i) => i.status === "done")
                      .forEach((i) => remove(i.id))
                  }}
                >
                  Clear done
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => setMinimized((m) => !m)}
                aria-label={minimized ? "Expand" : "Collapse"}
              >
                {minimized ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-full"
                onClick={() => {
                  clear()
                  setOpen(false)
                }}
                aria-label="Close panel"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          {!minimized && (
            <div className="max-h-72 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
              {items.map((item) => (
                <UploadRow key={item.id} item={item} onRemove={() => remove(item.id)} />
              ))}
              {items.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">
                  No active uploads
                </div>
              )}
            </div>
          )}
          {!minimized && (errored > 0 || done > 0) && (
            <div className="px-4 py-2 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between">
              <span>{done} done</span>
              {errored > 0 && <span className="text-destructive">{errored} failed</span>}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function UploadRow({
  item,
  onRemove,
}: {
  item: { id: string; name: string; size: number; progress: number; status: "uploading" | "done" | "error"; error?: string }
  onRemove: () => void
}) {
  return (
    <div className="glass relative rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{item.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatBytes(item.size)}
            {item.status === "uploading" && ` • ${Math.round(item.progress)}%`}
            {item.status === "done" && " • Done"}
            {item.status === "error" && ` • ${item.error || "Failed"}`}
          </div>
        </div>
        <div className="shrink-0">
          {item.status === "uploading" && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {item.status === "done" && (
            <span className="size-5 rounded-full bg-brand/15 text-brand flex items-center justify-center">
              <Check className="size-3" />
            </span>
          )}
          {item.status === "error" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 rounded-full text-destructive"
              onClick={onRemove}
              aria-label="Dismiss"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>
      <Progress
        value={item.progress}
        className={cn("h-1 mt-2", item.status === "error" && "bg-destructive/20")}
      />
    </div>
  )
}

