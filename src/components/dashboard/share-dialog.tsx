"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/lib/store"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Calendar,
  CalendarDays,
  Check,
  Clock3,
  Clock12,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Infinity as InfinityIcon,
  Link2,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Share2,
  Shield,
  Trash2,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogClose,
  ResponsiveDialogContent,
} from "./responsive-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CopyButton, FileIcon } from "./_shared"
import { api } from "@/lib/api"
import type { FileItem, Folder, ShareLink } from "@/lib/types"
import { formatDate, formatBytes } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

type Target =
  | { kind: "file"; item: FileItem }
  | { kind: "folder"; item: Folder }
  | { kind: "batch"; items: FileItem[]; folders?: Folder[] }
  | null

const ShareContext = React.createContext<{
  target: Target
  setTarget: (t: Target) => void
}>({
  target: null,
  setTarget: () => {},
})

export function useShareDialog() {
  const ctx = React.useContext(ShareContext)
  return ctx
}

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<Target>(null)
  return (
    <ShareContext.Provider value={{ target, setTarget }}>
      {children}
      <ShareDialogController target={target} setTarget={setTarget} />
    </ShareContext.Provider>
  )
}

function ShareDialogController({
  target,
  setTarget,
}: {
  target: Target
  setTarget: (t: Target) => void
}) {
  const open = !!target
  const onOpenChange = (o: boolean) => {
    if (!o) setTarget(null)
  }
  return (
    <ShareDialog target={target} open={open} onOpenChange={onOpenChange} />
  )
}

function ShareDialog({
  target,
  open,
  onOpenChange,
}: {
  target: Target
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  // Always render the Dialog root so open/close animations work even when
  // `target` is null (the inner content is conditionally rendered).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {target && (
        <ShareDialogInner target={target} open={open} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  )
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
type ExpiryPreset = "1h" | "24h" | "7d" | "30d" | "never" | "custom"

const EXPIRY_PRESETS: { value: ExpiryPreset; label: string; icon: React.ReactNode }[] = [
  { value: "1h", label: "1h", icon: <Clock3 className="size-3" /> },
  { value: "24h", label: "24h", icon: <Clock12 className="size-3" /> },
  { value: "7d", label: "7d", icon: <Calendar className="size-3" /> },
  { value: "30d", label: "30d", icon: <CalendarDays className="size-3" /> },
  { value: "never", label: "Never", icon: <InfinityIcon className="size-3" /> },
  { value: "custom", label: "Custom", icon: <Pencil className="size-3" /> },
]

function computeExpiryIso(preset: ExpiryPreset, custom: string): string | null {
  if (preset === "never") return null
  if (preset === "custom") {
    if (!custom) return null
    const d = new Date(custom)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  }
  const ms =
    preset === "1h" ? 3600_000 :
    preset === "24h" ? 86_400_000 :
    preset === "7d" ? 7 * 86_400_000 :
    30 * 86_400_000
  return new Date(Date.now() + ms).toISOString()
}

function expiryHuman(preset: ExpiryPreset, custom: string): string {
  if (preset === "never") return "Never expires"
  if (preset === "custom") {
    const iso = computeExpiryIso(preset, custom)
    if (!iso) return "Pick a date and time"
    return `Expires ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
  }
  const iso = computeExpiryIso(preset, custom)
  if (!iso) return ""
  return `Expires ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
}

function ShareDialogInner({
  target,
  open,
  onOpenChange,
}: {
  target: NonNullable<Target>
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const username = currentUser?.telegramUsername || ""
  const isBatch = target.kind === "batch"
  const isFolder = target.kind === "folder"
  const itemId = !isBatch ? target.item.id : undefined
  const batchFolderCount = isBatch ? (target.folders?.length || 0) : 0
  const batchFileCount = isBatch ? target.items.length : 0
  const itemName = isBatch
    ? batchFolderCount > 0
      ? `${batchFileCount} file${batchFileCount === 1 ? "" : "s"} + ${batchFolderCount} folder${batchFolderCount === 1 ? "" : "s"}`
      : `${batchFileCount} file${batchFileCount === 1 ? "" : "s"}`
    : target.item.name
  const mime = isBatch
    ? "batch"
    : target.kind === "file"
      ? target.item.mimeType
      : "folder"
  const batchTotalSize = isBatch
    ? target.items.reduce((sum, f) => sum + f.size, 0)
    : 0
  const batchTotalLinks = isBatch ? batchFileCount + batchFolderCount : 0

  // ---- Form state ----
  const [customSlug, setCustomSlug] = React.useState("")
  const [expiryPreset, setExpiryPreset] = React.useState<ExpiryPreset>("7d")
  const [customDate, setCustomDate] = React.useState("")
  const [passwordEnabled, setPasswordEnabled] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [viewOnly, setViewOnly] = React.useState(false)
  const [maxViewsEnabled, setMaxViewsEnabled] = React.useState(false)
  const [maxViews, setMaxViews] = React.useState("100")
  const [maxDownloadsEnabled, setMaxDownloadsEnabled] = React.useState(false)
  const [maxDownloads, setMaxDownloads] = React.useState("10")
  const [emailGate, setEmailGate] = React.useState(false)
  const [allowedEmails, setAllowedEmails] = React.useState("")
  const [lastCreated, setLastCreated] = React.useState<ShareLink | null>(null)

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setCustomSlug("")
      setExpiryPreset("7d")
      setCustomDate("")
      setPasswordEnabled(false)
      setPassword("")
      setViewOnly(false)
      setMaxViewsEnabled(false)
      setMaxViews("100")
      setMaxDownloadsEnabled(false)
      setMaxDownloads("10")
      setEmailGate(false)
      setAllowedEmails("")
      setLastCreated(null)
    }
  }, [open, itemId])

  // ---- Slug validation (debounced) ----
  const slugState = useSlugValidation(customSlug)

  // ---- Existing shares (single-item only — hidden in batch mode) ----
  const { data: allShares } = useQuery({
    queryKey: ["shares"],
    queryFn: () => api.listShares(),
    enabled: open && !isBatch,
  })
  const existing = (allShares || []).filter((s) => {
    if (isBatch || !itemId) return false
    if (target.kind === "file") return s.fileId === itemId
    return s.folderId === itemId
  })

  // ---- Build shared options object (used by both single + batch) ----
  const buildOpts = () => {
    const expiresAt = computeExpiryIso(expiryPreset, customDate)
    const opts: {
      password?: string
      expiresAt?: string | null
      maxViews?: number | null
      maxDownloads?: number | null
      viewOnly?: boolean
      emailGate?: boolean
      allowedEmails?: string
    } = {}
    if (expiresAt) opts.expiresAt = expiresAt
    if (passwordEnabled && password) opts.password = password
    if (viewOnly) opts.viewOnly = true
    if (maxViewsEnabled && maxViews) opts.maxViews = Number(maxViews)
    if (maxDownloadsEnabled && maxDownloads) opts.maxDownloads = Number(maxDownloads)
    if (emailGate) {
      opts.emailGate = true
      if (allowedEmails.trim()) opts.allowedEmails = allowedEmails.trim()
    }
    return opts
  }

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: async () => {
      if (isBatch) {
        const fileIds = target.items.map((f) => f.id)
        const folderIds = target.folders?.map((f) => f.id) || []
        const opts: any = { fileIds, folderIds, ...buildOpts() }
        if (customSlug.trim() && slugState.kind === "available") {
          opts.customSlug = customSlug.trim().toLowerCase()
        }
        const share = await api.createBatchShare(opts)
        return Array.isArray(share) ? share : [share]
      }
      const payload: Parameters<typeof api.createShare>[0] = buildOpts()
      if (target.kind === "file") payload.fileId = itemId!
      else if (target.kind === "folder") payload.folderId = itemId!
      if (customSlug.trim() && slugState.kind === "available") {
        payload.customSlug = customSlug.trim().toLowerCase()
      }
      const share = await api.createShare(payload)
      return [share]
    },
    onSuccess: (shares) => {
      qc.invalidateQueries({ queryKey: ["shares"] })
      const share = shares[0]
      if (share) {
        setLastCreated(share)
        toast.success("Share link created", {
          description: "Copy it and share with anyone.",
        })
      }
    },
    onError: (err) => {
      toast.error("Couldn't create link", {
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteShare(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] })
      toast.success("Link revoked")
    },
    onError: (err) => {
      toast.error("Couldn't revoke", {
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  const canCreate = !createMutation.isPending && (
    isBatch ||
    !customSlug.trim() ||
    slugState.kind === "available"
  )

  const createLabel = isBatch
    ? `Create ${batchTotalLinks} link${batchTotalLinks === 1 ? "" : "s"}`
    : "Create link"

  // ---- Layout: bottom-sheet on mobile, centered modal on >= sm ----
  // The ResponsiveDialogContent wrapper handles all the positioning +
  // max-height + slide animation. We just provide the flex column children:
  //   shrink-0 header + flex-1 min-h-0 scroll body + shrink-0 footer
  return (
    <ResponsiveDialogContent
      desktopMaxWidth={isBatch ? "sm:max-w-3xl" : "sm:max-w-2xl"}
    >
      {/* Header (pinned) */}
      <div className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border/40 flex items-start gap-3">
        <span className="size-9 rounded-xl bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-md shadow-brand/25 shrink-0">
          <Share2 className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold leading-tight truncate">
            {isBatch ? "Share multiple files" : isFolder ? "Share folder" : "Share file"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 mt-0.5 text-xs truncate">
            {isBatch ? (
              <>
                <span className="size-5 rounded-md bg-brand/10 text-brand inline-flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {batchTotalLinks}
                </span>
                <span className="truncate">{itemName}</span>
                <span className="text-muted-foreground/70 shrink-0">· {formatBytes(batchTotalSize)}</span>
              </>
            ) : isFolder ? (
              <>
                <span className="text-base shrink-0">📁</span>
                <span className="truncate">{itemName}</span>
                <span className="text-muted-foreground/70 shrink-0">· ZIP</span>
              </>
            ) : (
              <>
                <FileIcon mime={mime} size={12} className="rounded-md shrink-0" />
                <span className="truncate">{itemName}</span>
                <span className="text-muted-foreground/70 shrink-0">· {formatBytes(target.kind === "file" ? target.item.size : 0)}</span>
              </>
            )}
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="btn-premium relative size-8 rounded-full shrink-0 -mr-1"
            aria-label="Close share dialog"
          >
            <X className="size-4" />
          </Button>
        </DialogClose>
      </div>

      {/* Scrollable body — min-h-0 + flex-1 are REQUIRED so flexbox can shrink
          this child below its content size, enabling overflow-y-auto and
          keeping the footer pinned below. Without them the body grows past
          max-h and the footer is pushed off-screen. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 sm:px-5 py-4 space-y-4">
        {/* Folder ZIP notice */}
        {isFolder && (
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="size-3.5 text-brand mt-0.5 shrink-0" />
            <span>
              Recipients see the folder name, file count, and total size. The download button streams a <span className="text-brand font-medium">.zip</span> of all files (decrypted server-side, then zipped).
            </span>
          </div>
        )}

        {/* Batch notice */}
        {isBatch && (
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="size-3.5 text-brand mt-0.5 shrink-0" />
            <span>
              Creates <span className="text-brand font-medium">one share link</span> containing all {batchTotalLinks} item{batchTotalLinks === 1 ? "" : "s"}. Recipients see everything in one view.
            </span>
          </div>
        )}

        {/* Last created banner — replaces the Configure form briefly */}
        <AnimatePresence>
          {lastCreated && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-brand/30 bg-brand/[0.06] px-3.5 py-3"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-brand mb-2">
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 }}
                  className="size-4 rounded-full bg-brand text-brand-foreground inline-flex items-center justify-center shrink-0"
                >
                  <Check className="size-3" strokeWidth={3} />
                </motion.span>
                Link ready to share
              </div>
              <ShareUrlBlock share={lastCreated} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section A — Custom link */}
        <Section
          icon={<Link2 className="size-4" />}
          title="Custom link"
          description="Optional — pick a memorable slug, or leave blank for random."
        >
          <div className="flex items-stretch h-10 rounded-lg border border-input bg-transparent overflow-hidden focus-within:ring-2 focus-within:ring-ring/50">
            <span className="px-2.5 inline-flex items-center text-[11px] text-muted-foreground bg-muted/50 font-mono border-r border-input whitespace-nowrap">
              ?share={username ? `${username}/` : ""}
            </span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase())}
              placeholder="my-report"
              className="flex-1 min-w-0 px-2.5 bg-transparent text-sm outline-none font-mono lowercase"
              autoComplete="off"
              spellCheck={false}
              aria-label="Custom share slug"
            />
            <SlugStatus state={slugState} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            2–64 chars: letters, numbers, hyphens. Start and end with a letter or number.
          </p>
        </Section>

        <Divider />

        {/* Section B — Expiry */}
        <Section
          icon={<Calendar className="size-4" />}
          title="Expiry"
          description="Pick how long this link stays live."
        >
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
            {EXPIRY_PRESETS.map((p) => {
              const active = expiryPreset === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setExpiryPreset(p.value)}
                  aria-label={`Expiry: ${p.label}`}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "sm:rounded-full",
                    active
                      ? "border-brand bg-brand-gradient text-brand-foreground shadow-sm shadow-brand/25"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:border-brand/30"
                  )}
                  style={{ transitionTimingFunction: "var(--ease-premium)" }}
                >
                  <span className={active ? "text-brand-foreground" : "text-muted-foreground"}>
                    {p.icon}
                  </span>
                  {p.label}
                </button>
              )
            })}
          </div>

          {expiryPreset === "custom" && (
            <input
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2.5 w-full h-10 px-3 rounded-lg border border-input bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Custom expiry date and time"
            />
          )}

          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock3 className="size-3 shrink-0" />
            {expiryHuman(expiryPreset, customDate)}
          </div>
        </Section>

        <Divider />

        {/* Section C — Access control */}
        <Section
          icon={<Shield className="size-4" />}
          title="Access control"
          description={isBatch ? "Applied to every link created in this batch." : "Restrict who can view and download."}
        >
          <div className="space-y-2">
            <ToggleRow
              icon={<Lock className="size-4" />}
              title="Password protect"
              description="Require a password to view."
              checked={passwordEnabled}
              onCheckedChange={setPasswordEnabled}
            >
              <Input
                type="text"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 mt-2"
                autoComplete="new-password"
              />
            </ToggleRow>

            <ToggleRow
              icon={<Eye className="size-4" />}
              title="View-only"
              description="Recipients can preview but not download."
              checked={viewOnly}
              onCheckedChange={setViewOnly}
            />

            <ToggleRow
              icon={<Eye className="size-4" />}
              title="Max views"
              description="Link stops working after N views."
              checked={maxViewsEnabled}
              onCheckedChange={setMaxViewsEnabled}
            >
              <Input
                type="number"
                min={1}
                placeholder="100"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="h-9 mt-2 w-full sm:w-40"
              />
            </ToggleRow>

            <ToggleRow
              icon={<Download className="size-4" />}
              title="Max downloads"
              description="Block downloads after N pulls."
              checked={maxDownloadsEnabled}
              onCheckedChange={setMaxDownloadsEnabled}
            >
              <Input
                type="number"
                min={1}
                placeholder="10"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                className="h-9 mt-2 w-full sm:w-40"
              />
            </ToggleRow>

            <ToggleRow
              icon={<Mail className="size-4" />}
              title="Email gate"
              description="Require an email to view. Add addresses to restrict."
              checked={emailGate}
              onCheckedChange={setEmailGate}
            >
              <Textarea
                placeholder="alice@example.com, bob@example.com — leave empty to accept any email"
                value={allowedEmails}
                onChange={(e) => setAllowedEmails(e.target.value)}
                className="mt-2 min-h-16 text-xs"
              />
            </ToggleRow>
          </div>
        </Section>

        {/* Existing links for this item (single-item only) */}
        {!isBatch && existing.length > 0 && (
          <>
            <Divider />
            <Section
              icon={<Link2 className="size-4" />}
              title={`Active links (${existing.length})`}
              description="All share links currently live for this item."
            >
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin -mx-1 px-1">
                {existing.map((s) => (
                  <ShareLinkRow
                    key={s.id}
                    share={s}
                    onRevoke={() => deleteMutation.mutate(s.id)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Footer — shrink-0 keeps it pinned at the bottom of the flex column */}
      <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-border/40 flex items-center gap-2 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <Button
          variant="outline"
          size="sm"
          className="btn-premium relative mr-auto h-9"
          onClick={() => onOpenChange(false)}
        >
          {lastCreated ? "Done" : "Cancel"}
        </Button>
        <Button
          size="sm"
          className="btn-premium relative bg-brand-gradient gap-1.5 h-9"
          disabled={!canCreate}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
          {createLabel}
        </Button>
      </div>
    </ResponsiveDialogContent>
  )
}

// ============== Sub-components ==============

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-start gap-2.5 mb-3">
        <span className="size-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center mt-0.5 ring-1 ring-brand/10 shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          <div className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</div>
        </div>
      </div>
      {children}
    </section>
  )
}

function Divider() {
  return <div className="h-px bg-border/40" aria-hidden />
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 p-3 transition-all",
        checked && "border-brand/40 bg-brand/[0.04] shadow-sm shadow-brand/5"
      )}
      style={{ transitionTimingFunction: "var(--ease-premium)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={cn(
              "size-7 rounded-md flex items-center justify-center mt-0.5 transition-colors shrink-0",
              checked ? "bg-brand/15 text-brand" : "bg-muted/60 text-muted-foreground"
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">{title}</div>
            <div className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</div>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-1 shrink-0" aria-label={title} />
      </div>
      {checked && children && <div className="mt-1">{children}</div>}
    </div>
  )
}

type SlugValidation =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "invalid"; reason: string }

function useSlugValidation(slug: string): SlugValidation {
  const [state, setState] = React.useState<SlugValidation>({ kind: "idle" })

  React.useEffect(() => {
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed) {
      setState({ kind: "idle" })
      return
    }
    if (!SLUG_RE.test(trimmed)) {
      setState({ kind: "invalid", reason: "Invalid format" })
      return
    }
    setState({ kind: "checking" })
    const t = setTimeout(async () => {
      try {
        const r = await api.checkSlug(trimmed)
        setState(
          r.available
            ? { kind: "available" }
            : { kind: "invalid", reason: r.reason || "Unavailable" }
        )
      } catch {
        setState({ kind: "invalid", reason: "Couldn't check" })
      }
    }, 380)
    return () => clearTimeout(t)
  }, [slug])

  return state
}

function SlugStatus({ state }: { state: SlugValidation }) {
  return (
    <div className="px-2.5 flex items-center justify-center min-w-[28px]">
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "checking" && (
          <motion.span
            key="checking"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          </motion.span>
        )}
        {state.kind === "available" && (
          <motion.span
            key="ok"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-emerald-500"
            title="Available"
          >
            <Check className="size-3.5" />
          </motion.span>
        )}
        {state.kind === "invalid" && (
          <motion.span
            key="bad"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-destructive"
            title={state.reason}
          >
            <X className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function ShareUrlBlock({ share }: { share: ShareLink }) {
  const user = useAuthStore((s) => s.user)
  const username = user?.telegramUsername || ""
  const slugOrToken = share.customSlug || share.token
  const key = username ? `${username}/${slugOrToken}` : slugOrToken
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?share=${key}`
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background/70 border border-border/60 font-mono text-[11px] truncate shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--brand)_6%,transparent)]">
        {url}
      </div>
      <CopyButton value={url} size="sm" className="btn-premium relative h-9 px-2.5 shrink-0" />
      <Button asChild variant="outline" size="icon" className="btn-premium relative size-9 shrink-0" aria-label="Open in new tab">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  )
}

function ShareLinkRow({
  share,
  onRevoke,
  label,
}: {
  share: ShareLink
  onRevoke: () => void
  label?: string
}) {
  const user = useAuthStore((s) => s.user)
  const username = user?.telegramUsername || ""
  const slugOrToken = share.customSlug || share.token
  const key = username ? `${username}/${slugOrToken}` : slugOrToken
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?share=${key}`
  const expired = share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()
  return (
    <div className="card-premium glass relative rounded-xl p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {label && (
            <div className="text-xs font-medium truncate mb-1">{label}</div>
          )}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {share.customSlug && (
              <Badge className="text-[10px] py-0 h-5 gap-0.5 bg-brand/15 text-brand border-brand/30">
                <Link2 className="size-2.5" />
                /{share.customSlug}
              </Badge>
            )}
            {share.hasPassword && (
              <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5">
                <Lock className="size-2.5" />
                Password
              </Badge>
            )}
            {share.viewOnly && (
              <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5 text-brand border-brand/40">
                <Eye className="size-2.5" />
                View-only
              </Badge>
            )}
            {share.emailGate && (
              <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5">
                <Mail className="size-2.5" />
                Email
              </Badge>
            )}
            {share.expiresAt && (
              <Badge
                variant={expired ? "destructive" : "outline"}
                className="text-[10px] py-0 h-5 gap-0.5"
              >
                <Calendar className="size-2.5" />
                {expired ? "Expired" : formatDate(share.expiresAt)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] py-0 h-5 gap-0.5">
              <Eye className="size-2.5" />
              {share.viewCount}
              {share.maxViews ? `/${share.maxViews}` : ""}
            </Badge>
            <Badge variant="secondary" className="text-[10px] py-0 h-5 gap-0.5">
              <Download className="size-2.5" />
              {share.downloadCount}
              {share.maxDownloads ? `/${share.maxDownloads}` : ""}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground truncate font-mono">
            {url}
          </div>
        </div>
        <CopyButton value={url} size="icon" className="btn-premium relative size-8 shrink-0" aria-label="Copy share link" />
        <Button
          variant="ghost"
          size="icon"
          className="btn-premium relative size-8 rounded-full text-destructive hover:bg-destructive/10 shrink-0"
          onClick={onRevoke}
          aria-label="Revoke link"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
