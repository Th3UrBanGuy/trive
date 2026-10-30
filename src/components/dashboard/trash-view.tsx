"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { FolderOpen, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FileIcon } from "./_shared"
import { api } from "@/lib/api"
import type { FileItem } from "@/lib/types"
import { formatDate, formatBytes } from "@/lib/file-utils"

export function TrashView() {
  const qc = useQueryClient()
  const { data: files, isLoading } = useQuery({
    queryKey: ["files", "trash"],
    queryFn: () => api.listFiles({ trashed: true }),
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.restoreFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      toast.success("Restored")
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] })
      qc.invalidateQueries({ queryKey: ["storage"] })
      toast.success("Deleted forever")
    },
  })

  const items = files || []

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold">Trash</h2>
          <p className="text-sm text-muted-foreground">
            Items here are kept until you delete them forever.
          </p>
        </div>
        {items.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-1.5 text-destructive">
                <Trash2 className="size-4" />
                Empty trash
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-strong">
              <AlertDialogHeader>
                <AlertDialogTitle>Empty trash?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes {items.length} item
                  {items.length === 1 ? "" : "s"} from your vault. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    for (const f of items) {
                      await deleteMut.mutateAsync(f.id)
                    }
                    toast.success("Trash emptied")
                  }}
                >
                  Empty trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="size-20 rounded-full bg-brand/10 flex items-center justify-center mb-4">
            <FolderOpen className="size-9 text-brand" />
          </div>
          <div className="text-lg font-semibold">Trash is empty</div>
          <div className="text-sm text-muted-foreground mt-1">
            Items you delete will show up here.
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence>
            {items.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="glass relative rounded-xl p-2.5 group"
              >
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-2 bg-background/40 flex items-center justify-center">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.name}
                      className="w-full h-full object-cover opacity-70"
                    />
                  ) : (
                    <FileIcon mime={file.mimeType} size={36} className="rounded-xl opacity-70" />
                  )}
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-10 rounded-full"
                      onClick={() => restoreMut.mutate(file.id)}
                      aria-label="Restore"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="size-10 rounded-full text-destructive"
                          aria-label="Delete forever"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-strong">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete forever?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{file.name}&quot; will be permanently removed from
                            your vault. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => deleteMut.mutate(file.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatBytes(file.size)}</span>
                  <span>{formatDate(file.updatedAt)}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
