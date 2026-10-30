"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ChevronRight, FolderInput, Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogClose,
  ResponsiveDialogContent,
} from "./responsive-dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { FileItem, Folder } from "@/lib/types"
import { cn } from "@/lib/utils"

type Target =
  | { kind: "file"; item: FileItem }
  | { kind: "folder"; item: Folder }
  | { kind: "batch"; items: FileItem[] }
  | null

const MoveContext = React.createContext<{
  target: Target
  setTarget: (t: Target) => void
}>({
  target: null,
  setTarget: () => {},
})

export function useMoveDialog() {
  return React.useContext(MoveContext)
}

export function MoveProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<Target>(null)
  return (
    <MoveContext.Provider value={{ target, setTarget }}>
      {children}
      <MoveDialog target={target} setTarget={setTarget} />
    </MoveContext.Provider>
  )
}

function MoveDialog({
  target,
  setTarget,
}: {
  target: Target
  setTarget: (t: Target) => void
}) {
  const qc = useQueryClient()
  const open = !!target
  const [selected, setSelected] = React.useState<string | null>(null)

  const { data: tree, isLoading } = useQuery({
    queryKey: ["folder-tree"],
    queryFn: () => api.folderTree(),
    enabled: open,
  })

  React.useEffect(() => {
    if (open) setSelected(null)
  }, [open])

  const moveMutation = useMutation({
    mutationFn: async (folderId: string | null) => {
      if (!target) throw new Error("Nothing to move")
      if (target.kind === "file") {
        return api.moveFile(target.item.id, folderId)
      }
      if (target.kind === "batch") {
        // Move ALL selected files to the destination
        const results = await Promise.all(
          target.items.map((f) => api.moveFile(f.id, folderId))
        )
        return results
      }
      throw new Error("Folders cannot be moved yet")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      qc.invalidateQueries({ queryKey: ["folders"] })
      const count = target?.kind === "batch" ? target.items.length : 1
      toast.success(`Moved ${count} item${count === 1 ? "" : "s"}`)
      setTarget(null)
    },
    onError: (err) => {
      toast.error("Couldn't move", {
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setTarget(null)}>
      <ResponsiveDialogContent desktopMaxWidth="sm:max-w-md">
        {/* Header (pinned) */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border/40 flex items-start gap-3">
          <span className="size-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <FolderInput className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight truncate">
              {target?.kind === "batch"
                ? `Move ${target.items.length} files`
                : target?.kind === "folder"
                ? `Move "${target.item.name}"`
                : `Move "${target?.kind === "file" ? target.item.name : ""}"`}
            </DialogTitle>
            <DialogDescription className="truncate mt-0.5 text-xs">
              Choose a destination folder
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="btn-premium relative size-8 rounded-full shrink-0 -mr-1"
              aria-label="Close move dialog"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 sm:p-4">
          <div className="border border-border/60 rounded-lg overflow-hidden">
            <FolderRow
              folder={null}
              name="My Files (root)"
              depth={0}
              selected={selected === null}
              onSelect={() => setSelected(null)}
            />
            {isLoading && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin inline-block" />
              </div>
            )}
            {(tree || []).map((f) => (
              <FolderTree
                key={f.id}
                folder={f}
                all={tree || []}
                depth={0}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>

        {/* Footer (pinned) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <Button variant="outline" size="sm" className="btn-premium relative h-9" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="btn-premium relative bg-brand-gradient gap-1.5 h-9"
            disabled={moveMutation.isPending}
            onClick={() => moveMutation.mutate(selected)}
          >
            {moveMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Move here
          </Button>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  )
}

function FolderTree({
  folder,
  all,
  depth,
  selected,
  onSelect,
}: {
  folder: Folder
  all: Folder[]
  depth: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const children = all.filter((c) => c.parentId === folder.id)
  const [expanded, setExpanded] = React.useState(depth < 1)
  return (
    <div>
      <FolderRow
        folder={folder}
        name={folder.name}
        depth={depth}
        selected={selected === folder.id}
        onSelect={() => onSelect(folder.id)}
        expandable={children.length > 0}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
      />
      {expanded &&
        children.map((c) => (
          <FolderTree
            key={c.id}
            folder={c}
            all={all}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

function FolderRow({
  folder,
  name,
  depth,
  selected,
  onSelect,
  expandable,
  expanded,
  onToggleExpand,
}: {
  folder: Folder | null
  name: string
  depth: number
  selected: boolean
  onSelect: () => void
  expandable?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md px-1.5 py-1.5 text-sm cursor-default",
        selected ? "bg-brand/10 text-brand" : "hover:bg-accent/50"
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
      onClick={onSelect}
    >
      {expandable ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand?.()
          }}
          className="size-5 flex items-center justify-center rounded hover:bg-accent"
          aria-label="Toggle"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <div className="size-5" />
      )}
      <span className="text-base">📁</span>
      <span className="truncate">{name}</span>
    </div>
  )
}
