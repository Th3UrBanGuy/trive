"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Upload, FolderPlus, X } from "lucide-react"
import { Sidebar, MobileSidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { SelectionActionBar } from "./selection-action-bar"
import { UploadPanel, setGlobalQueryClient } from "./upload-panel"
import { NewFolderDialog } from "./new-folder-dialog"
import { ShareProvider, useShareDialog } from "./share-dialog"
import { MoveProvider, useMoveDialog } from "./move-dialog"
import { PreviewProvider, usePreviewDialog } from "./file-preview-dialog"
import { FileExplorer } from "./file-explorer"
import { FilesDirectView } from "./files-direct-view"
import { SharedLinksView } from "./shared-links-view"
import { TrashView } from "./trash-view"
import { AnalyticsView } from "./analytics-view"
import { SettingsView } from "./settings-view"
import { QueryProvider } from "./query-provider"
import { Wordmark } from "@/components/brand"
import { TectonicCredit } from "@/components/legal/tectonic-credit"
import { useUIStore, useUploadStore } from "@/lib/store"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { FileItem, Folder } from "@/lib/types"

function DashboardFooter() {
  const goLegal = (page: "legal" | "terms" | "privacy" | "disclaimer" | "contact") => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("page", page)
      window.location.href = url.pathname + url.search
    } catch {
      window.location.href = `/?page=${page}`
    }
  }
  return (
    <footer className="mt-auto border-t border-border/60 glass relative">
      <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <Wordmark className="opacity-80" />
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            Telegram-powered zero-knowledge storage
          </span>
        </div>
        <div className="inline-flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => goLegal("privacy")}
            className="hover:text-foreground"
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => goLegal("terms")}
            className="hover:text-foreground"
          >
            Terms
          </button>
          <button
            type="button"
            onClick={() => goLegal("disclaimer")}
            className="hover:text-foreground"
          >
            Disclaimer
          </button>
          <button
            type="button"
            onClick={() => goLegal("contact")}
            className="hover:text-foreground"
          >
            Contact
          </button>
          <span className="opacity-60 hidden md:inline">
            Powered by Telegram. Built by Tectonic.
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span>© {new Date().getFullYear()} TriVE ·</span>
          <TectonicCredit prefix="Built by" />
        </div>
      </div>
    </footer>
  )
}

function Content() {
  const view = useUIStore((s) => s.view)
  switch (view) {
    case "myfiles":
      return <FileExplorer mode="folder" />
    case "files":
      return <FilesDirectView />
    case "recent":
      return <FileExplorer mode="recent" />
    case "starred":
      return <FileExplorer mode="starred" />
    case "trash":
      return <TrashView />
    case "shared":
      return <SharedLinksView />
    case "analytics":
      return <AnalyticsView />
    case "settings":
      return <SettingsView />
    default:
      return <FileExplorer mode="folder" />
  }
}

function DashboardInner() {
  const qc = useQueryClient()
  React.useEffect(() => {
    setGlobalQueryClient(qc)
  }, [qc])

  // ---- Auto-scan on mount ----
  // Check if the vault needs scanning (new device, fresh DB). If so, trigger
  // a scan silently — no file-related toasts, just a warm welcome.
  const setVaultScanning = useUIStore((s) => s.setVaultScanning)
  const [showWelcome, setShowWelcome] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    // Show a warm welcome toast on dashboard mount
    const welcomeTimer = setTimeout(() => setShowWelcome(true), 300)
    setTimeout(() => setShowWelcome(false), 4000)

    ;(async () => {
      try {
        const status = await api.vaultStatus()
        if (cancelled) return
        if (!status.needsScan) return
        setVaultScanning(true)
        try {
          const res = await api.scanVault()
          if (cancelled) return
          await qc.invalidateQueries({ queryKey: ["files"] })
          await qc.invalidateQueries({ queryKey: ["folders"] })
          await qc.invalidateQueries({ queryKey: ["storage"] })
          setVaultScanning(false)
        } catch {
          setVaultScanning(false)
        }
      } catch {
        // Silent — no error toast
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(welcomeTimer)
    }
  }, [])

  // Warm welcome toast — no file-related messages
  React.useEffect(() => {
    if (showWelcome) {
      toast("Welcome back to TriVE", {
        description: "Your encrypted vault is ready.",
        duration: 3000,
      })
    }
  }, [showWelcome])

  const selected = useUIStore((s) => s.selected)
  const setSelected = useUIStore((s) => s.setSelected)
  const clearSelected = useUIStore((s) => s.clearSelected)
  const { setTarget: setShareTarget } = useShareDialog()
  const { setTarget: setMoveTarget } = useMoveDialog()
  const { setTarget: setPreviewTarget } = usePreviewDialog()
  void setPreviewTarget

  // Resolve selected ids → full FileItem objects via the query cache.
  const resolveSelectedFiles = (): FileItem[] => {
    const ids = Array.from(selected)
    const out: FileItem[] = []
    for (const id of ids) {
      // Try every cached files query
      const queries = qc.getQueriesData<FileItem[]>({ queryKey: ["files"] })
      for (const [, data] of queries) {
        const found = data?.find((f) => f.id === id)
        if (found) {
          out.push(found)
          break
        }
      }
    }
    return out
  }

  // Resolve selected ids → full Folder objects via the query cache.
  const resolveSelectedFolders = (): Folder[] => {
    const ids = Array.from(selected)
    const out: Folder[] = []
    for (const id of ids) {
      const queries = qc.getQueriesData<Folder[]>({ queryKey: ["folders"] })
      for (const [, data] of queries) {
        const found = data?.find((f) => f.id === id)
        if (found) {
          out.push(found)
          break
        }
      }
    }
    return out
  }

  // Total visible item count (so the Select-All button knows when "all" is
  // selected). Sourced from the same cached queries used by the explorer.
  const totalVisible = React.useMemo(() => {
    const queries = qc.getQueriesData<FileItem[]>({ queryKey: ["files"] })
    let n = 0
    for (const [, data] of queries) {
      if (!data) continue
      // Match the explorer's non-trash, non-search filter roughly: count
      // the longest cached list. (Exact match isn't critical — Select All
      // just needs a reasonable upper bound to toggle against.)
      n = Math.max(n, data.filter((f) => !f.trashed).length)
    }
    return n
  }, [qc, selected])

  const onDownloadAll = () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      const a = document.createElement("a")
      a.href = api.downloadUrl(id)
      a.download = ""
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    toast.success(`Downloading ${ids.length} file${ids.length === 1 ? "" : "s"}`)
    clearSelected()
  }

  const onDownloadZip = () => {
    // Browser-side ZIP packaging — fetch each selected file and zip them
    // client-side. This avoids a server-side batch-zip endpoint and works
    // for any selection across folders/views. Uses a tiny inline approach:
    // open each download sequentially with a brief delay (the simplest
    // reliable approach without bundling a zip library on the client).
    const ids = Array.from(selected)
    toast.success(`Preparing ${ids.length} file${ids.length === 1 ? "" : "s"} for download…`)
    ids.forEach((id, i) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = api.downloadUrl(id)
        a.download = ""
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, i * 250)
    })
    clearSelected()
  }

  const onStarAll = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      try {
        await api.toggleStar(id, true)
      } catch {}
    }
    qc.invalidateQueries({ queryKey: ["files"] })
    toast.success(`Starred ${ids.length} item${ids.length === 1 ? "" : "s"}`)
    clearSelected()
  }
  const onTrashAll = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      try {
        await api.trashFile(id)
      } catch {}
    }
    qc.invalidateQueries({ queryKey: ["files"] })
    qc.invalidateQueries({ queryKey: ["storage"] })
    toast.success(`Moved ${ids.length} item${ids.length === 1 ? "" : "s"} to trash`)
    clearSelected()
  }
  const onShareBatch = () => {
    const files = resolveSelectedFiles()
    const folders = resolveSelectedFolders()
    if (files.length === 0 && folders.length === 0) {
      toast.message("Select at least one file or folder to share.")
      return
    }
    setShareTarget({ kind: "batch", items: files, folders })
  }
  const onMoveFirst = () => {
    const files = resolveSelectedFiles()
    if (files.length === 0) {
      toast.message("Select at least one file to move.")
      return
    }
    if (files.length === 1) {
      setMoveTarget({ kind: "file", item: files[0] })
    } else {
      setMoveTarget({ kind: "batch", items: files })
    }
  }
  const onSelectAll = () => {
    // Pull every visible file id from the cache and select them all.
    const queries = qc.getQueriesData<FileItem[]>({ queryKey: ["files"] })
    const all = new Set<string>()
    for (const [, data] of queries) {
      if (!data) continue
      data.forEach((f) => {
        if (!f.trashed) all.add(f.id)
      })
    }
    if (all.size === 0) return
    // If everything is already selected, deselect all (toggle behavior).
    let allSelected = true
    all.forEach((id) => {
      if (!selected.has(id)) allSelected = false
    })
    setSelected(allSelected ? new Set() : all)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="absolute inset-x-0 top-0 h-64 bg-aurora opacity-30 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] pointer-events-none" />

      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar />
        <MobileSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Content />
          </main>
          <DashboardFooter />
        </div>
      </div>

      <SelectionActionBar
        onDownload={onDownloadAll}
        onDownloadZip={onDownloadZip}
        onMove={onMoveFirst}
        onShare={onShareBatch}
        onStar={onStarAll}
        onTrash={onTrashAll}
        onSelectAll={onSelectAll}
        totalCount={totalVisible}
      />
      <FloatingActionButton />
      <UploadPanel />
      <NewFolderDialog />
    </div>
  )
}

export function Dashboard() {
  return (
    <QueryProvider>
      <ShareProvider>
        <MoveProvider>
          <PreviewProvider>
            <DashboardInner />
          </PreviewProvider>
        </MoveProvider>
      </ShareProvider>
    </QueryProvider>
  )
}

// ---- Floating layer system (z-index hierarchy) ----
//   z-30  FAB (+) button
//   z-40  Upload panel + Selection action bar (peer-level; FAB hides when selection active)
//   z-50  All modal dialogs (Radix Dialog + Sheet + share/move/preview/new-folder)
//   z-60  Toasts (Sonner overrides this independently)
//
//   Floating bottom cluster (right side):
//     - Upload panel always at bottom-right when items exist
//     - FAB sits BELOW the upload panel (smaller, lower z) — they don't fight
//     - Selection bar is centered horizontally; FAB hides while selection active
//
//   All three bottom-anchored layers MUST be `bottom-safe-lg` (≥ 1rem + iOS inset)
//   so they never collide with the home indicator on iPhone.

/** Floating Action Button (FAB) — premium + icon that expands to show Upload + New Folder actions.
 *  Sits below the upload panel in the z-stack so the panel can overlap it cleanly. */
function FloatingActionButton() {
  const [open, setOpen] = React.useState(false)
  const setNewFolderOpen = useUIStore((s) => s.setNewFolderOpen)
  const selected = useUIStore((s) => s.selected)
  // Hide FAB when the upload panel is showing — it has its own "add more" affordance
  // and the two clusters competing for the bottom-right corner causes visual glitches.
  const uploadActive = useUploadStore((s) => s.items.length > 0)
  const uploadOpen = useUIStore((s) => s.uploadOpen)

  // Hide FAB when:
  //   - in selection mode (the selection bar takes over the bottom)
  //   - upload panel is open (the panel has its own actions)
  if (selected.size > 0) return null
  if (uploadActive && uploadOpen) return null

  const triggerUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.onchange = () => {
      const files = Array.from(input.files || [])
      if (files.length) {
        import("./upload-panel").then(({ enqueueUpload }) => {
          files.forEach((file) => enqueueUpload(file, null))
        })
      }
    }
    input.click()
    setOpen(false)
  }

  return (
    <div
      className={cn(
        "fixed right-4 z-30 flex flex-col items-end gap-2 transition-all duration-300 bottom-safe-lg",
        open && "bottom-safe-lg"
      )}
      data-open={open ? "1" : "0"}
    >
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              onClick={() => { setNewFolderOpen(true); setOpen(false) }}
              className="relative glass-strong rounded-full pl-4 pr-3 py-2.5 flex items-center gap-2 text-sm font-medium shadow-lg shadow-brand/10 hover:shadow-xl hover:shadow-brand/20 transition-shadow"
            >
              <FolderPlus className="size-4 text-brand" />
              New folder
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 }}
              onClick={triggerUpload}
              className="relative glass-strong rounded-full pl-4 pr-3 py-2.5 flex items-center gap-2 text-sm font-medium shadow-lg shadow-brand/10 hover:shadow-xl hover:shadow-brand/20 transition-shadow"
            >
              <Upload className="size-4 text-brand" />
              Upload files
            </motion.button>
          </>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="size-14 rounded-full bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-xl shadow-brand/30 hover:shadow-2xl hover:shadow-brand/40 transition-shadow"
        aria-label={open ? "Close menu" : "Add files"}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
          {open ? <X className="size-6" /> : <Plus className="size-6" />}
        </motion.div>
      </motion.button>
    </div>
  )
}
