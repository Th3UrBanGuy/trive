"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/store"
import { formatDistanceToNow } from "date-fns"
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Link2,
  Loader2,
  Lock,
  Mail,
  Share2,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { CopyButton, FileIcon } from "./_shared"
import { api } from "@/lib/api"
import type { ShareLink } from "@/lib/types"
import { formatDate } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

export function SharedLinksView() {
  const qc = useQueryClient()
  // Poll every 5s so the shared-links table stays live — newly created links
  // from the share dialog and revoked links both surface without a manual refresh.
  const { data: shares, isLoading } = useQuery({
    queryKey: ["shares"],
    queryFn: () => api.listShares(),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteShare(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] })
      toast.success("Link revoked")
    },
    onError: (e) =>
      toast.error("Couldn't revoke", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const items = shares || []

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Share2 className="size-5 text-brand" />
          Shared links
        </h2>
        <p className="text-sm text-muted-foreground">
          Anyone with the link can access — add a password, expiry, view-only, or
          email gate for more control.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="size-20 rounded-full bg-brand/10 flex items-center justify-center mb-4">
            <Link2 className="size-9 text-brand" />
          </div>
          <div className="text-lg font-semibold">No shared links</div>
          <div className="text-sm text-muted-foreground mt-1">
            Open the ⋯ menu on any file and choose{" "}
            <span className="text-brand font-medium">Share</span> to create a link.
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((s) => (
            <ShareCard
              key={s.id}
              share={s}
              onRevoke={() => deleteMut.mutate(s.id)}
              busy={deleteMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ShareCard({
  share,
  onRevoke,
  busy,
}: {
  share: ShareLink
  onRevoke: () => void
  busy: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const username = user?.telegramUsername || ""
  const slugOrToken = share.customSlug || share.token
  const key = username ? `${username}/${slugOrToken}` : slugOrToken
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?share=${key}`
  const itemName = share.item?.name || "Shared item"
  const mime = share.item?.mimeType || "other"
  const expired =
    share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()

  // Access-log panel is only meaningful when email gate is enabled (we only
  // record viewer emails for email-gated shares). Other shares show just the
  // aggregate view/download counts.
  const hasAccessLog = share.emailGate
  const [logOpen, setLogOpen] = React.useState(false)
  const viewerEmails = share.viewerEmails || []
  const allowedEmails = share.allowedEmails
    ? share.allowedEmails.split(",").map((e) => e.trim()).filter(Boolean)
    : []

  return (
    <div className="glass relative rounded-xl overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Item icon + name */}
        <FileIcon mime={mime} size={16} className="size-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium truncate max-w-[200px]">
              {itemName}
            </div>
            {share.customSlug && (
              <Badge className="h-5 text-[10px] gap-0.5 bg-brand/15 text-brand border-brand/30">
                <Link2 className="size-2.5" />
                /{share.customSlug}
              </Badge>
            )}
            {share.hasPassword && (
              <Badge variant="outline" className="h-5 text-[10px] gap-0.5">
                <Lock className="size-2.5" />
                Pwd
              </Badge>
            )}
            {share.viewOnly && (
              <Badge variant="outline" className="h-5 text-[10px] gap-0.5 text-brand border-brand/40">
                <Eye className="size-2.5" />
                View
              </Badge>
            )}
            {share.emailGate && (
              <Badge variant="outline" className="h-5 text-[10px] gap-0.5">
                <Mail className="size-2.5" />
                Email
              </Badge>
            )}
            {share.expiresAt && (
              <Badge
                variant={expired ? "destructive" : "outline"}
                className="h-5 text-[10px] gap-0.5"
              >
                <Calendar className="size-2.5" />
                {expired ? "Expired" : formatDate(share.expiresAt)}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" />
              {share.viewCount}
              {share.maxViews ? `/${share.maxViews}` : ""}
            </span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" />
              {share.downloadCount}
              {share.maxDownloads ? `/${share.maxDownloads}` : ""}
            </span>
            {share.lastAccessedAt && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDistanceToNow(new Date(share.lastAccessedAt), { addSuffix: true })}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Copy URL */}
        <CopyButton value={url} size="icon" className="btn-premium size-8 rounded-full shrink-0" aria-label="Copy share link" />
        {/* Revoke */}
        <Button
          variant="ghost"
          size="icon"
          className="btn-premium size-8 rounded-full text-destructive hover:bg-destructive/10 shrink-0"
          onClick={onRevoke}
          disabled={busy}
          aria-label="Revoke link"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>

      {/* URL strip — full width, copyable */}
      <div className="px-3 pb-2 -mt-1">
        <div className="font-mono text-[10px] text-muted-foreground truncate bg-muted/40 rounded-md px-2 py-1 border border-border/40">
          {url}
        </div>
      </div>

      {/* Access log toggle — only for email-gated shares */}
      {hasAccessLog && (
        <>
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 border-t border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            aria-expanded={logOpen}
            aria-label={logOpen ? "Hide access log" : "Show access log"}
          >
            {logOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <Users className="size-3.5" />
            <span className="font-medium">
              {viewerEmails.length > 0
                ? `${viewerEmails.length} viewer${viewerEmails.length === 1 ? "" : "s"} accessed`
                : "No viewers yet"}
            </span>
            {allowedEmails.length > 0 && (
              <span className="text-muted-foreground/70">
                · {allowedEmails.length} on allowlist
              </span>
            )}
            <span className="ml-auto text-[10px] opacity-70">
              {logOpen ? "Hide" : "View"}
            </span>
          </button>

          {logOpen && (
            <div className="border-t border-border/40 p-3 space-y-3 bg-muted/20">
              {/* Viewer access log */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Mail className="size-3" />
                  Who accessed
                </div>
                {viewerEmails.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-1">
                    No one has accessed this link yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {viewerEmails.map((email) => (
                      <Badge
                        key={email}
                        variant="secondary"
                        className="text-[11px] gap-1 h-6"
                      >
                        <Mail className="size-2.5 text-brand" />
                        {email}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Allowed emails (allowlist) */}
              {allowedEmails.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="size-3" />
                    Allowed emails ({allowedEmails.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allowedEmails.map((email) => {
                      const hasAccessed = viewerEmails.includes(email.toLowerCase())
                      return (
                        <Badge
                          key={email}
                          variant={hasAccessed ? "outline" : "secondary"}
                          className={cn(
                            "text-[11px] gap-1 h-6",
                            hasAccessed && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {hasAccessed ? <Eye className="size-2.5" /> : <Clock className="size-2.5" />}
                          {email}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Hint when allowlist is empty (any email accepted) */}
              {allowedEmails.length === 0 && (
                <div className="text-[11px] text-muted-foreground italic">
                  Email gate is on but no allowlist is set — any email address can access.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
