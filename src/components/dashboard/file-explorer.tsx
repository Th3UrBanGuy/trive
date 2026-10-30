"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowUpDown,
  Download,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Share2,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableHead as THead,
} from "@/components/ui/table"
import {
  useUIStore,
  useNavStore,
  useUploadStore,
} from "@/lib/store"
import { api } from "@/lib/api"
import { v4 as uuid } from "uuid"
import type { FileItem, Folder } from "@/lib/types"
import { sortItems, formatDate } from "@/lib/file-utils"
import { cn } from "@/lib/utils"
import { enqueueUpload } from "./upload-panel"
import { useShareDialog } from "./share-dialog"
import { useMoveDialog } from "./move-dialog"
import { usePreviewDialog } from "./file-preview-dialog"
import { FileCard, type FileCardAction, useLongPress, useIsTouchDevice } from "./file-card"
import { FileRow } from "./file-row"

// Rename dialog state — local to explorer
const RenameContext = React.createContext<{
  rename: (target: { kind: "file"; item: FileItem } | { kind: "folder"; item: Folder }) => void
}>({ rename: () => {} })

export function useRename() {
  return React.useContext(RenameContext)
}

export function FileExplorer({
  mode = "folder",
}: {
  mode?: "folder" | "recent" | "starred" | "trash"
}) {
  const qc = useQueryClient()
  const currentFolderId = useNavStore((s) => s.currentFolderId)
  const descend = useNavStore((s) => s.descend)
  const navigateTo = useNavStore((s) => s.navigateTo)
  const search = useUIStore((s) => s.search)
  const sortKey = useUIStore((s) => s.sortKey)
  const sortDir = useUIStore((s) => s.sortDir)
  const setSort = useUIStore((s) => s.setSort)
  const viewMode = useUIStore((s) => s.viewMode)
  const selected = useUIStore((s) => s.selected)
  const toggleSelected = useUIStore((s) => s.toggleSelected)
  const clearSelected = useUIStore((s) => s.clearSelected)
  const setSelected = useUIStore((s) => s.setSelected)
  const setNewFolderOpen = useUIStore((s) => s.setNewFolderOpen)
  const setUploadOpen = useUIStore((s) => s.setUploadOpen)
  const addUpload = useUploadStore((s) => s.add)

  const { setTarget: setShareTarget } = useShareDialog()
  const { setTarget: setMoveTarget } = useMoveDialog()
  const { setTarget: setPreviewTarget } = usePreviewDialog()

  const isTouch = useIsTouchDevice()

  const [renaming, setRenaming] = React.useState<
    | { kind: "file"; item: FileItem }
    | { kind: "folder"; item: Folder }
    | null
  >(null)
  const [dragOver, setDragOver] = React.useState(false)

  // Queries — when searching, fetch ALL files/folders globally (no folder filter).
  // When not searching, fetch only the current folder's contents.
  const isSearching = !!search && mode === "folder"

  const folderQuery = useQuery({
    queryKey: ["folders", mode === "folder" ? currentFolderId : "none", isSearching ? "search" : "normal"],
    queryFn: () => {
      if (mode !== "folder") return Promise.resolve([] as Folder[])
      // Global search — fetch ALL folders, not just current folder's children
      if (isSearching) return api.listFolders(undefined, search)
      return api.listFolders(currentFolderId)
    },
    enabled: mode === "folder",
    staleTime: 0,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  })

  const fileQuery = useQuery({
    queryKey: [
      "files",
      mode,
      currentFolderId,
      isSearching ? "search" : "normal",
    ],
    queryFn: () => {
      if (mode === "trash") return api.listFiles({ trashed: true })
      if (mode === "starred") return api.listFiles({ starred: true })
      if (mode === "recent") return api.listFiles({ all: true })
      // Global search — fetch ALL files matching the query
      if (isSearching) return api.listFiles({ search })
      return api.listFiles({ folderId: currentFolderId })
    },
    staleTime: 0,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  })

  const folders = folderQuery.data || []
  const files = fileQuery.data || []

  // When searching, results are already filtered server-side
  // When not searching, filter folders client-side (empty query = no filter)
  const filteredFolders = isSearching
    ? folders
    : mode === "folder"
    ? folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : []
  // For non-trash modes, only show non-trashed files
  let displayFiles = files
  if (mode !== "trash") {
    displayFiles = files.filter((f) => !f.trashed)
  }
  // When not searching server-side, apply client-side filter as fallback
  if (search && !isSearching) {
    displayFiles = displayFiles.filter((f) =>
      f.name.toLowerCase().includes(search.toLowerCase())
    )
  }

  // Combine for sort
  const combined: (FileItem | Folder)[] = sortItems(
    [...filteredFolders, ...displayFiles],
    sortKey,
    sortDir
  )

  // ---- Selection-mode (derived) ----
  // Selection mode is "active" whenever at least one item is selected.
  // In selection mode: taps toggle selection (no navigation/open).
  // Outside selection mode: taps open (touch) or single-select (mouse).
  const selectionMode = selected.size > 0

  // Escape key exits selection mode.
  React.useEffect(() => {
    if (!selectionMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelected()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectionMode, clearSelected])

  // Mutations
  const trashMut = useMutation({
    mutationFn: (id: string) => api.trashFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      qc.invalidateQueries({ queryKey: ["storage"] })
      toast.success("Moved to trash")
    },
    onError: (e) => toast.error("Couldn't trash", { description: e instanceof Error ? e.message : undefined }),
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.restoreFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      toast.success("Restored")
    },
  })
  void restoreMut

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      qc.invalidateQueries({ queryKey: ["storage"] })
      toast.success("Deleted forever")
    },
  })
  void deleteMut

  const starMut = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.toggleStar(id, starred),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
    },
  })

  const renameFileMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.renameFile(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      toast.success("Renamed")
    },
  })
  const renameFolderMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.renameFolder(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] })
      qc.invalidateQueries({ queryKey: ["folder-tree"] })
      toast.success("Renamed")
    },
  })

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] })
      qc.invalidateQueries({ queryKey: ["folder-tree"] })
      qc.invalidateQueries({ queryKey: ["storage"] })
      toast.success("Folder deleted")
    },
  })

  // ---- Action handlers ----
  function handleFileAction(file: FileItem, action: FileCardAction) {
    switch (action) {
      case "open":
        setPreviewTarget(file)
        break
      case "download": {
        const a = document.createElement("a")
        a.href = api.downloadUrl(file.id)
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        break
      }
      case "rename":
        setRenaming({ kind: "file", item: file })
        break
      case "star":
      case "unstar":
        starMut.mutate({ id: file.id, starred: action === "star" })
        break
      case "share":
        setShareTarget({ kind: "file", item: file })
        break
      case "move":
        setMoveTarget({ kind: "file", item: file })
        break
      case "trash":
        trashMut.mutate(file.id)
        clearSelected()
        break
    }
  }

  function handleFolderAction(folder: Folder, action: string) {
    switch (action) {
      case "open":
        descend(folder)
        clearSelected()
        break
      case "rename":
        setRenaming({ kind: "folder", item: folder })
        break
      case "share":
        setShareTarget({ kind: "folder", item: folder })
        break
      case "download-zip": {
        // Folder ZIP download — authenticated endpoint.
        const a = document.createElement("a")
        a.href = api.folderDownloadUrl(folder.id)
        a.download = `${folder.name || "folder"}.zip`
        document.body.appendChild(a)
        a.click()
        a.remove()
        toast.success("Preparing folder ZIP…")
        break
      }
      case "trash":
      case "delete":
        deleteFolderMut.mutate(folder.id)
        clearSelected()
        break
      case "star":
      case "unstar":
        // Star/unstar folder via PATCH endpoint
        fetch(`/api/folders/${folder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starred: action === "star" }),
        }).then(() => {
          qc.invalidateQueries({ queryKey: ["folders"] })
          toast.success(action === "star" ? "Starred" : "Unstarred")
        }).catch(() => toast.error("Couldn't update folder"))
        break
    }
  }

  // ---- Drag & drop upload ----
  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files || [])
      if (!files.length) return
      const folderId = mode === "folder" ? currentFolderId : null
      files.forEach((file) => {
        const id = uuid()
        addUpload({
          id,
          name: file.name,
          size: file.size,
          progress: 0,
          status: "uploading",
        })
        enqueueUpload(file, folderId, id)
      })
      setUploadOpen(true)
    },
    [addUpload, currentFolderId, mode, setUploadOpen]
  )

  // ---- Selection helpers ----
  function handleCardClick(e: React.MouseEvent, id: string, isFolder: boolean, item: FileItem | Folder) {
    // If the long-press just fired on a touch device, swallow the click.
    // (Long-press handler in file-card already prevents the touchend, but
    // some browsers still synthesize a click — guard here too.)
    // In selection mode, taps/clicks always toggle (no navigation).
    if (selectionMode) {
      toggleSelected(id)
      return
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      toggleSelected(id)
      return
    }
    if (isTouch) {
      // Touch tap outside selection mode → open immediately (no double-tap
      // required, since double-tap is unreliable on touch).
      if (isFolder) handleFolderAction(item as Folder, "open")
      else handleFileAction(item as FileItem, "open")
      return
    }
    // Mouse plain click → single-select (existing desktop behavior).
    setSelected(new Set([id]))
  }

  function handleLongPress(id: string) {
    // Enter selection mode with this item selected.
    if (selected.has(id)) {
      // Already selected — keep selection as-is (already in selection mode).
      return
    }
    const next = new Set(selected)
    next.add(id)
    setSelected(next)
  }

  const loading = fileQuery.isLoading || (mode === "folder" && folderQuery.isLoading)
  const isVaultScanning = useUIStore((s) => s.isVaultScanning)
  const isEmpty = combined.length === 0
  // Show scanning state instead of "empty" when vault scan is in progress OR
  // when files are still loading after login (prevents false "vault empty")
  const showScanning = (isVaultScanning || loading) && isEmpty && mode === "folder"

  return (
    <RenameContext.Provider
      value={{
        rename: (t) => setRenaming(t),
      }}
    >
      <div
        className={cn(
          "relative flex-1 min-h-0",
          selectionMode && "selection-mode-overlay"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={onDrop}
        // Click on empty space → exit selection mode (but only when the
        // click didn't originate from a card; we stop propagation on
        // cards themselves).
        onClick={(e) => {
          // Only fire if the click hit the container itself.
          if (e.target === e.currentTarget && selectionMode) {
            clearSelected()
          }
        }}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none rounded-2xl border-2 border-dashed border-brand bg-brand/10 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="text-center">
                <Upload className="size-10 mx-auto text-brand mb-2" />
                <div className="text-sm font-medium">
                  Drop to upload to{" "}
                  {mode === "folder"
                    ? currentFolderId
                      ? "this folder"
                      : "My Files"
                    : "My Files"}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selection-mode banner */}
        <AnimatePresence>
          {selectionMode && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <div className="relative glass-strong rounded-full px-3 py-1 text-[11px] font-medium text-brand inline-flex items-center gap-1.5 shadow-md shadow-brand/10">
                <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                Selection mode · {selected.size} selected
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanning state — show when vault scan is in progress (not "empty") */}
        <AnimatePresence mode="wait">
          {showScanning && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col items-center justify-center py-20 text-center p-4 min-h-[60vh]"
            >
              <div className="size-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
                <Loader2 className="size-8 animate-spin text-brand" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Restoring your files…</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Scanning your encrypted vault for your files. This only takes a moment —
                your files are safe and will appear here shortly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state — only show when NOT scanning */}
        <AnimatePresence mode="wait">
          {!loading && isEmpty && !showScanning && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <EmptyState
                mode={mode}
                onUpload={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.multiple = true
                  input.onchange = () => {
                    const files = Array.from(input.files || [])
                    if (files.length) {
                      const folderId = mode === "folder" ? currentFolderId : null
                      files.forEach((file) => {
                        const id = uuid()
                        addUpload({
                          id,
                          name: file.name,
                          size: file.size,
                          progress: 0,
                          status: "uploading",
                        })
                        enqueueUpload(file, folderId, id)
                      })
                      setUploadOpen(true)
                    }
                  }
                  input.click()
                }}
                onNewFolder={() => setNewFolderOpen(true)}
              />
            </motion.div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
              ))}
            </motion.div>
          )}

          {/* Grid view */}
          {!loading && !isEmpty && viewMode === "grid" && (
            <motion.div
              key={`grid-${mode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative z-10 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
            >
              {combined.map((item, i) => {
                const isFolder = "parentId" in item
                const id = item.id
                const isSel = selected.has(id)
                if (isFolder) {
                  const folder = item as Folder
                  return (
                    <FolderCard
                      key={id}
                      folder={folder}
                      selected={isSel}
                      selectionMode={selectionMode}
                      onClick={(e) => handleCardClick(e, id, true, folder)}
                      onOpen={() => handleFolderAction(folder, "open")}
                      onAction={(a) => handleFolderAction(folder, a)}
                      onLongPress={() => handleLongPress(id)}
                    />
                  )
                }
                const file = item as FileItem
                return (
                  <FileCard
                    key={id}
                    file={file}
                    selected={isSel}
                    selectionMode={selectionMode}
                    onClick={(e) => handleCardClick(e, id, false, file)}
                    onAction={(a) => handleFileAction(file, a)}
                    onLongPress={() => handleLongPress(id)}
                    index={i}
                  />
                )
              })}
            </motion.div>
          )}

          {/* List view */}
          {!loading && !isEmpty && viewMode === "list" && (
            <motion.div
              key={`list-${mode}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-4"
            >
              <div className="rounded-2xl overflow-hidden glass relative border border-border/40 shadow-sm">
                <div className="max-h-[calc(100vh-220px)] overflow-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent sticky top-0 z-10 glass-strong border-b border-border/60">
                        <THead className="w-10 pl-3" />
                        <THead className="w-12" />
                        <THead>
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            onClick={() => setSort("name")}
                          >
                            Name
                            <ArrowUpDown className="size-3 opacity-50" />
                          </button>
                        </THead>
                        <THead className="text-right">
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            onClick={() => setSort("size")}
                          >
                            Size
                            <ArrowUpDown className="size-3 opacity-50" />
                          </button>
                        </THead>
                        <THead className="text-right hidden md:table-cell">
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            onClick={() => setSort("modified")}
                          >
                            Modified
                            <ArrowUpDown className="size-3 opacity-50" />
                          </button>
                        </THead>
                        <THead className="w-9" />
                        <THead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combined.map((item) => {
                        const isFolder = "parentId" in item
                        const id = item.id
                        const isSel = selected.has(id)
                        return (
                          <FileRow
                            key={id}
                            row={
                              isFolder
                                ? { kind: "folder", item: item as Folder }
                                : { kind: "file", item: item as FileItem }
                            }
                            selected={isSel}
                            selectionMode={selectionMode}
                            onSelect={(c) => {
                              if (c) {
                                const next = new Set(selected)
                                next.add(id)
                                setSelected(next)
                              } else {
                                const next = new Set(selected)
                                next.delete(id)
                                setSelected(next)
                              }
                            }}
                            onOpen={() => {
                              if (selectionMode) {
                                toggleSelected(id)
                                return
                              }
                              if (isFolder) handleFolderAction(item as Folder, "open")
                              else handleFileAction(item as FileItem, "open")
                            }}
                            onAction={(a) =>
                              isFolder
                                ? handleFolderAction(item as Folder, a)
                                : handleFileAction(item as FileItem, a as FileCardAction)
                            }
                            onLongPress={() => handleLongPress(id)}
                          />
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rename dialog */}
        {renaming && (
          <RenameDialog
            target={renaming}
            onClose={() => setRenaming(null)}
            onSubmit={async (name) => {
              if (renaming.kind === "file") {
                renameFileMut.mutate({ id: renaming.item.id, name })
              } else {
                renameFolderMut.mutate({ id: renaming.item.id, name })
              }
              setRenaming(null)
            }}
          />
        )}
      </div>
    </RenameContext.Provider>
  )
}

function FolderCard({
  folder,
  selected,
  selectionMode,
  onClick,
  onOpen,
  onAction,
  onLongPress,
}: {
  folder: Folder
  selected: boolean
  selectionMode: boolean
  onClick: (e: React.MouseEvent) => void
  onOpen: () => void
  onAction: (a: string) => void
  onLongPress?: () => void
}) {
  const isTouch = useIsTouchDevice()
  const { bind, pressing, justFiredRef } = useLongPress(() => onLongPress?.())
  return (
    <motion.div
      layout
      {...(onLongPress ? bind : {})}
      whileHover={isTouch ? undefined : { y: -4 }}
      whileTap={isTouch ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
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
        onOpen()
      }}
      className={cn(
        "group relative rounded-2xl p-2.5 cursor-pointer select-none overflow-hidden",
        "glass border border-border/40 shadow-sm",
        !isTouch && "hover:shadow-xl hover:shadow-brand/10 hover:border-brand/30",
        isTouch && "touch-none",
        (selected || pressing) && "ring-2 ring-brand shadow-lg shadow-brand/15",
        pressing && "scale-[0.98]",
        selectionMode && !selected && "opacity-70"
      )}
    >
      <div
        className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2.5 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, var(--brand) 14%, transparent), color-mix(in oklch, var(--brand-cyan) 6%, transparent))`,
        }}
      >
        {/* Soft radial glow */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--brand) 22%, transparent), transparent 60%)",
          }}
        />
        <span
          className="relative text-5xl drop-shadow-lg"
          style={{
            filter: folder.color
              ? `drop-shadow(0 6px 18px ${folder.color})`
              : "drop-shadow(0 6px 18px color-mix(in oklch, var(--brand) 30%, transparent))",
          }}
        >
          📁
        </span>
        {selected && (
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="absolute bottom-2 left-2 size-9 rounded-full bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/40 ring-2 ring-background/60"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
        )}
        {pressing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-xl ring-2 ring-brand/60 bg-brand/10 pointer-events-none"
          />
        )}
        {/* Quick share button — appears on hover (desktop) or always (touch) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAction("share")
          }}
          className="absolute top-2 right-2 size-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand hover:text-brand-foreground"
          aria-label="Share folder"
        >
          <Share2 className="size-3.5" />
        </button>
        {/* ⋯ dropdown menu */}
        <div className="absolute bottom-2 right-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="size-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction("share")}>
                <Share2 className="size-4 mr-2" />
                Share folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("download-zip")}>
                <Download className="size-4 mr-2" />
                Download as ZIP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(folder.starred ? "unstar" : "star")}>
                <Star className="size-4 mr-2" />
                {folder.starred ? "Unstar" : "Star"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onAction("trash")}
              >
                <Trash2 className="size-4 mr-2" />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-0.5">
        <div className="text-sm font-medium truncate leading-tight">
          {folder.name}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {folder.fileCount || 0} file{(folder.fileCount || 0) === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums">{formatDate(folder.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({
  mode,
  onUpload,
  onNewFolder,
}: {
  mode: "folder" | "recent" | "starred" | "trash"
  onUpload: () => void
  onNewFolder: () => void
}) {
  const titles: Record<typeof mode, string> = {
    folder: "Your vault is loading",
    recent: "No recent files",
    starred: "Nothing starred yet",
    trash: "Trash is empty",
  }
  const descs: Record<typeof mode, string> = {
    folder:
      "Upload your first file to get started. It'll be encrypted and stored on your Telegram account.",
    recent: "Files you upload will appear here.",
    starred: "Star files to find them quickly later.",
    trash: "Items you delete will show up here.",
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center p-4 min-h-[60vh]">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mb-6"
      >
        {/* Soft gradient circle backdrop with layered depth */}
        <div className="size-32 rounded-full bg-gradient-to-br from-brand/15 to-brand-cyan/10 flex items-center justify-center ring-1 ring-brand/10 shadow-xl shadow-brand/10">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand/5 to-transparent" />
          {mode === "trash" ? (
            <FolderOpen className="size-14 text-brand/80 relative drop-shadow-md" />
          ) : mode === "starred" ? (
            <Star className="size-14 text-brand/80 relative drop-shadow-md" />
          ) : (
            <FolderOpen className="size-14 text-brand/80 relative drop-shadow-md" />
          )}
        </div>
        {/* Decorative brand dot accents */}
        <div className="absolute -top-1 -right-1 size-2.5 rounded-full bg-brand/60" />
        <div className="absolute -bottom-2 -left-2 size-2 rounded-full bg-brand-cyan/50" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      >
        <div className="text-xl font-semibold tracking-tight">{titles[mode]}</div>
        <div className="text-sm text-muted-foreground mt-2 mb-7 max-w-sm leading-relaxed">
          {descs[mode]}
        </div>

        {mode === "folder" && (
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              className="gap-1.5 h-11 px-5 rounded-xl bg-brand-gradient text-brand-foreground shadow-lg shadow-brand/25 hover:shadow-brand/40 transition-shadow"
              onClick={onUpload}
            >
              <Upload className="size-4" />
              Upload
            </Button>
            <Button
              variant="outline"
              className="gap-1.5 h-11 px-5 rounded-xl bg-background/60 backdrop-blur-md"
              onClick={onNewFolder}
            >
              <FolderPlus className="size-4" />
              New Folder
            </Button>
          </div>
        )}

        {mode === "trash" && (
          <div className="text-xs text-muted-foreground max-w-sm mt-2 leading-relaxed">
            Items here are still using your Telegram storage. Delete them
            permanently to free space.
          </div>
        )}

        {/* Encryption reassurance footer */}
        {mode === "folder" && (
          <div className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground/80">
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Every file is encrypted with AES-256-GCM before it leaves your device.
          </div>
        )}
      </motion.div>
    </div>
  )
}

function RenameDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: { kind: "file"; item: FileItem } | { kind: "folder"; item: Folder }
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = React.useState(target.item.name)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rename item"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative glass-strong rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium mb-3">Rename</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New name"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSubmit(name.trim())
            if (e.key === "Escape") onClose()
          }}
          className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => name.trim() && onSubmit(name.trim())}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
