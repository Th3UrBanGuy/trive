"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Download,
  Loader2,
  ShieldCheck,
  Scissors,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileIcon, EncryptionPill, FileTypeBadge } from "./_shared"
import {
  FileViewerDispatcher,
  pickViewerKind,
  type ViewerMeta,
} from "./file-viewers"
import { api } from "@/lib/api"
import type { FileItem } from "@/lib/types"
import { fileCategory, formatBytes, formatDate } from "@/lib/file-utils"

type Target = FileItem | null

const PreviewContext = React.createContext<{
  target: Target
  setTarget: (t: Target) => void
}>({ target: null, setTarget: () => {} })

export function usePreviewDialog() {
  return React.useContext(PreviewContext)
}

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<Target>(null)
  return (
    <PreviewContext.Provider value={{ target, setTarget }}>
      {children}
      <PreviewDialog target={target} setTarget={setTarget} />
    </PreviewContext.Provider>
  )
}

function PreviewDialog({
  target,
  setTarget,
}: {
  target: Target
  setTarget: (t: Target) => void
}) {
  const open = !!target
  if (!target) {
    return <Dialog open={open} onOpenChange={() => setTarget(null)} />
  }
  return <Inner target={target} open={open} onOpenChange={(o) => !o && setTarget(null)} />
}

function Inner({
  target,
  open,
  onOpenChange,
}: {
  target: FileItem
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const category = fileCategory(target.mimeType)
  const url = api.downloadUrl(target.id)
  const kind = pickViewerKind(target.name, target.mimeType)

  // Audio/video/PDF/code/text viewers render inline — the dialog should be
  // larger for those. For unknown / small text files, keep the sidebar layout.
  const isInline = ["image", "video", "audio", "pdf", "code", "text", "markdown", "docx"].includes(kind)
  void category

  const viewerMeta: ViewerMeta = {
    name: target.name,
    mimeType: target.mimeType,
    size: target.size,
    downloadUrl: url,
  }

  const downloadMut = useMutation({
    mutationFn: async () => {
      const a = document.createElement("a")
      a.href = url
      a.download = target.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] })
      toast.success("Download started")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-strong p-0 overflow-hidden max-w-5xl w-[95vw] md:w-auto h-[90vh] md:h-auto flex flex-col"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{target.name}</DialogTitle>
          <DialogDescription>File preview</DialogDescription>
        </DialogHeader>
        {/* Mobile: stacked (preview top, details bottom). Desktop: side-by-side */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_280px] flex-1 min-h-0">
          {/* Preview area — full width on mobile, left on desktop */}
          <div className="bg-background/40 min-h-[200px] md:min-h-[480px] flex-1 md:flex-none flex flex-col overflow-hidden">
            <FileViewerDispatcher url={url} meta={viewerMeta} />
          </div>

          {/* Sidebar — bottom on mobile, right on desktop */}
          <div className="border-t md:border-t-0 md:border-l border-border/60 p-4 md:p-5 flex flex-col gap-3 md:gap-4 overflow-y-auto max-h-[40vh] md:max-h-[90vh] shrink-0">
            <div>
              <div className="text-sm font-medium break-words">{target.name}</div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <FileTypeBadge mime={target.mimeType} />
                {target.encrypted && <EncryptionPill />}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <Row label="Size" value={formatBytes(target.size)} />
              <Row label="Uploaded" value={formatDate(target.createdAt)} />
              <Row label="Modified" value={formatDate(target.updatedAt)} />
              <Row
                label="Chunks"
                value={
                  target.isChunked
                    ? `${target.totalChunks} chunk${target.totalChunks === 1 ? "" : "s"}`
                    : "Single"
                }
                icon={target.isChunked ? Scissors : undefined}
              />
              <Row
                label="Encryption"
                value={target.encrypted ? "AES-256-GCM" : "None"}
                icon={target.encrypted ? ShieldCheck : undefined}
              />
            </div>

            <div className="mt-auto pt-3 border-t border-border/60">
              <Button
                className="w-full gap-1.5 h-11"
                onClick={() => downloadMut.mutate()}
                disabled={downloadMut.isPending}
              >
                {downloadMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download
              </Button>
              <div className="mt-2 text-[11px] text-muted-foreground text-center">
                Decrypted in your browser on download.
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium inline-flex items-center gap-1 text-right">
        {Icon && <Icon className="size-3" />}
        {value}
      </span>
    </div>
  )
}
