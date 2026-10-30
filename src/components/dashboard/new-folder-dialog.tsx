"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, FolderPlus, X } from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogClose,
  ResponsiveDialogContent,
} from "./responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUIStore, useNavStore } from "@/lib/store"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const SWATCHES = [
  "oklch(0.7 0.2 295)", // violet
  "oklch(0.65 0.18 162)", // green
  "oklch(0.7 0.19 70)", // amber
  "oklch(0.68 0.22 350)", // pink
  "oklch(0.6 0.18 25)", // orange
  "oklch(0.55 0.05 280)", // zinc
]

export function NewFolderDialog() {
  const open = useUIStore((s) => s.newFolderOpen)
  const setOpen = useUIStore((s) => s.setNewFolderOpen)
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<string>(SWATCHES[0])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName("")
      setColor(SWATCHES[0])
    }
  }, [open])

  async function onCreate() {
    if (!name.trim()) {
      toast.error("Enter a folder name")
      return
    }
    setBusy(true)
    try {
      // Create in the current folder (if in My Files view), else root
      const currentFolderId = useUIStore.getState().view === "myfiles"
        ? useNavStore.getState().currentFolderId
        : null
      await api.createFolder(name.trim(), currentFolderId, color)
      toast.success("Folder created", { description: name.trim() })
      setOpen(false)
    } catch (err) {
      toast.error("Couldn't create folder", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent desktopMaxWidth="sm:max-w-md">
        {/* Header (pinned) */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border/40 flex items-start gap-3">
          <span className="size-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <FolderPlus className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight">
              New folder
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              Create a new folder in your current location.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="btn-premium relative size-8 rounded-full shrink-0 -mr-1"
              aria-label="Close new folder dialog"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        {/* Body (scrollable, but content is short so rarely scrolls) */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              autoFocus
              placeholder="My new folder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    color === c ? "ring-foreground" : "ring-transparent"
                  )}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer (pinned) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
          <Button
            variant="outline"
            size="sm"
            className="btn-premium relative h-9"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="btn-premium relative bg-brand-gradient gap-1.5 h-9"
            onClick={onCreate}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create
          </Button>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
