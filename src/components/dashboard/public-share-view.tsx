"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileX2,
  Folder,
  FolderOpen,
  Loader2,
  Lock,
  Mail,
  Share2,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { BrandMark, Wordmark } from "@/components/brand"
import { TectonicCredit } from "@/components/legal/tectonic-credit"
import { FileIcon, CopyButton } from "./_shared"
import {
  FileViewerDispatcher,
  pickViewerKind,
  type ViewerMeta,
} from "./file-viewers"
import { api } from "@/lib/api"
import { formatBytes, formatDate } from "@/lib/file-utils"
import { cn } from "@/lib/utils"
import type { PublicShare } from "@/lib/types"

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "removed" }
  | { kind: "ready"; data: PublicShare }

type ShareBody = Partial<PublicShare> & { error?: string; message?: string }

export function PublicShareView({ token }: { token: string }) {
  const [state, setState] = React.useState<FetchState>({ kind: "loading" })
  const [password, setPassword] = React.useState("")
  const [email, setEmail] = React.useState("")
  // Held credentials — kept so we can re-fetch and pass to download URL.
  const [heldPassword, setHeldPassword] = React.useState<string | null>(null)
  const [heldEmail, setHeldEmail] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  // Core fetch helper — shared by the initial load and the live-poll loop.
  // `poll=true` is sent ONLY by the live-polling loop. When set, the server
  // skips incrementing viewCount — otherwise a share with maxViews=10 would
  // exhaust itself within 15 seconds of the recipient opening the link.
  const doFetch = React.useCallback(
    async (opts?: { password?: string; email?: string; poll?: boolean }): Promise<{
      ok: boolean
      status: number
      body: ShareBody
    }> => {
      const url = new URL("/api/share/public", window.location.origin)
      url.searchParams.set("token", token)
      if (opts?.password) url.searchParams.set("password", opts.password)
      if (opts?.email) url.searchParams.set("email", opts.email)
      if (opts?.poll) url.searchParams.set("poll", "1")
      const res = await fetch(url.toString())
      const j = (await res.json().catch(() => ({}))) as ShareBody
      return { ok: res.ok, status: res.status, body: j }
    },
    [token]
  )

  const fetchShare = React.useCallback(
    async (opts?: { password?: string; email?: string }) => {
      setState({ kind: "loading" })
      try {
        const { ok, status, body } = await doFetch(opts)
        if (!ok) {
          // For password/email gates the API may return 401/403 with a hint flag.
          // We treat them as soft errors so the UI can re-prompt.
          if (status === 401 && body.needsPassword) {
            setState({ kind: "ready", data: body as PublicShare })
            toast.error(body.error || "Incorrect password")
            return
          }
          if (status === 403 && body.needsEmail) {
            setState({ kind: "ready", data: body as PublicShare })
            toast.error(body.error || "This email isn't on the allowlist.")
            return
          }
          // 404 = file/share deleted by owner (cascade delete). Other non-ok
          // responses are also treated as "removed" so the recipient sees a
          // clear terminal state instead of a confusing error.
          if (status === 404 || status === 401 || status === 403) {
            setState({ kind: "removed" })
            return
          }
          throw new Error(body.error || body.message || "Couldn't load this share")
        }
        setState({ kind: "ready", data: body as PublicShare })
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Couldn't load this share",
        })
      }
    },
    [doFetch]
  )

  React.useEffect(() => {
    fetchShare()
  }, [fetchShare])

  // --- LIVE POLLING — instant delete detection ---
  // Once the share is granted (all gates passed, item present, not terminal),
  // poll the server every 1.5s. If the owner deletes the file or revokes the
  // link (DB cascade — share dies instantly), the next poll returns 404 and we
  // flip to the "removed" terminal state on the spot. Expired/exhausted
  // transitions are also picked up because we re-render with the fresh data.
  const isGranted = React.useMemo(() => {
    if (state.kind !== "ready") return false
    const s = state.data
    return (
      !s.expired &&
      !s.exhausted &&
      !s.needsPassword &&
      !s.needsEmail &&
      !!s.item
    )
  }, [state])

  // Compute container width based on the granted share contents — folder
  // shares get a slightly wider card (file list), and inline-viewer file
  // shares (PDF/code/docx/etc.) get a much wider canvas.
  const containerWidth = React.useMemo(() => {
    if (!isGranted || state.kind !== "ready" || !state.data.item) return "max-w-md"
    const item = state.data.item
    if (item.type === "folder") return "max-w-lg"
    const kind = pickViewerKind(item.name || "", item.mimeType || "")
    if (["pdf", "code", "text", "markdown", "docx", "image", "video", "audio"].includes(kind)) {
      return "max-w-3xl"
    }
    return "max-w-md"
  }, [isGranted, state])

  React.useEffect(() => {
    if (!isGranted) return
    let cancelled = false

    const poll = async () => {
      try {
        // poll=true tells the server NOT to increment viewCount (we're just
        // checking for cascade deletes / state changes, not a new view).
        const { ok, status, body } = await doFetch({
          password: heldPassword || undefined,
          email: heldEmail || undefined,
          poll: true,
        })
        if (cancelled) return
        if (!ok || status === 404) {
          // Owner deleted the file or revoked the link — terminal.
          setState({ kind: "removed" })
          return
        }
        // Refresh state with the latest data. ReadyBody will pick up
        // expired/exhausted terminal flags automatically.
        setState({ kind: "ready", data: body as PublicShare })
      } catch {
        // Network blip — keep current state, don't disturb the user.
      }
    }

    // Poll every 1.5s, but pause when the tab is hidden to avoid wasting
    // requests (and resume when visible again).
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (id) return
      poll() // immediate check on resume
      id = setInterval(poll, 1500)
    }
    const stop = () => {
      if (id) { clearInterval(id); id = null }
    }
    const onVis = () => {
      if (document.visibilityState === "visible") start()
      else stop()
    }
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      cancelled = true
      stop()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [isGranted, heldPassword, heldEmail, doFetch])

  const onUnlockPassword = async () => {
    if (!password) return
    setSubmitting(true)
    setHeldPassword(password)
    await fetchShare({ password })
    setSubmitting(false)
  }

  const onContinueEmail = async () => {
    if (!email) return
    setSubmitting(true)
    setHeldEmail(email)
    await fetchShare({
      password: heldPassword || undefined,
      email,
    })
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] pointer-events-none" />

      <header className="relative z-10 p-4">
        <Wordmark />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn("w-full page-transition", containerWidth)}
        >
          <div className="relative glass-strong bg-noise rounded-3xl p-7 md:p-8 shadow-2xl shadow-brand/15 ring-1 ring-brand/5">
            <div className="flex flex-col items-center text-center mb-5">
              <BrandMark size={44} className="rounded-2xl mb-3" />
              <h1 className="text-lg font-semibold">
                Shared via <span className="text-gradient-brand">TriVE</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Zero-knowledge file share
              </p>
            </div>

            <AnimatePresence mode="wait">
              {state.kind === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-10 gap-4"
                >
                  <BrandPulse />
                  {/* Premium skeleton rows — hint at the structure loading in. */}
                  <div className="w-full max-w-sm space-y-2.5">
                    <div className="skeleton-premium relative h-9 w-full rounded-xl" />
                    <div className="skeleton-premium relative h-3 w-2/3 rounded-full" />
                    <div className="skeleton-premium relative h-3 w-1/2 rounded-full" />
                  </div>
                  <div className="text-xs text-muted-foreground">Loading share…</div>
                </motion.div>
              )}

              {state.kind === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3 ring-1 ring-destructive/20">
                    <AlertCircle className="size-5" />
                  </div>
                  <div className="text-sm font-medium">
                    This share link doesn&apos;t exist or has been revoked.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{state.message}</div>
                </motion.div>
              )}

              {state.kind === "removed" && (
                <motion.div
                  key="removed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <div className="size-14 rounded-2xl bg-brand-deep/10 text-brand-deep flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-deep/15 dark:bg-brand-deep/15 dark:text-brand">
                    <FileX2 className="size-6" />
                  </div>
                  <div className="text-base font-semibold">
                    This file is no longer available
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                    The owner removed this file or revoked the link. If you
                    believe this is a mistake, please contact the person who
                    shared it with you.
                  </div>
                </motion.div>
              )}

              {state.kind === "ready" && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ReadyBody
                    share={state.data}
                    password={password}
                    email={email}
                    submitting={submitting}
                    heldPassword={heldPassword}
                    heldEmail={heldEmail}
                    setPassword={setPassword}
                    setEmail={setEmail}
                    onUnlockPassword={onUnlockPassword}
                    onContinueEmail={onContinueEmail}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <PublicShareFooter />
        </motion.div>
      </main>
    </div>
  )
}

function ReadyBody({
  share,
  password,
  email,
  submitting,
  heldPassword,
  heldEmail,
  setPassword,
  setEmail,
  onUnlockPassword,
  onContinueEmail,
}: {
  share: PublicShare
  password: string
  email: string
  submitting: boolean
  heldPassword: string | null
  heldEmail: string | null
  setPassword: (v: string) => void
  setEmail: (v: string) => void
  onUnlockPassword: () => void
  onContinueEmail: () => void
}) {
  // Terminal states first (item is null)
  if (share.expired) {
    return (
      <TerminalState
        icon={<Clock className="size-6" />}
        title="This link has expired"
        description="The owner set an expiry on this share and it's no longer available."
        createdAt={share.createdAt}
      />
    )
  }
  if (share.exhausted) {
    return (
      <TerminalState
        icon={<Ban className="size-6" />}
        title="This link has reached its access limit"
        description={`Views: ${share.viewCount}${share.maxViews ? ` / ${share.maxViews}` : ""} · Downloads: ${share.downloadCount}${share.maxDownloads ? ` / ${share.maxDownloads}` : ""}`}
        createdAt={share.createdAt}
      />
    )
  }
  // Password gate
  if (share.needsPassword) {
    return (
      <PasswordGate
        share={share}
        password={password}
        setPassword={setPassword}
        submitting={submitting}
        onUnlock={onUnlockPassword}
      />
    )
  }
  // Email gate
  if (share.needsEmail) {
    return (
      <EmailGate
        share={share}
        email={email}
        setEmail={setEmail}
        submitting={submitting}
        onContinue={onContinueEmail}
      />
    )
  }
  // Granted
  if (share.item) {
    return (
      <GrantedView
        share={share}
        heldPassword={heldPassword}
        heldEmail={heldEmail}
      />
    )
  }
  // Fallback — shouldn't usually happen
  return (
    <TerminalState
      icon={<AlertCircle className="size-6" />}
      title="This share isn't available"
      description="Something went wrong loading this share."
      createdAt={share.createdAt}
    />
  )
}

function TerminalState({
  icon,
  title,
  description,
  createdAt,
}: {
  icon: React.ReactNode
  title: string
  description: string
  createdAt: string
}) {
  return (
    <div className="text-center py-6">
      <div className="size-14 rounded-2xl bg-brand-deep/10 text-brand-deep flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-deep/15 dark:bg-brand-deep/15 dark:text-brand">
        {icon}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
        {description}
      </div>
      <div className="text-[11px] text-muted-foreground/70 mt-3">
        Shared {formatDate(createdAt)}
      </div>
    </div>
  )
}

function PasswordGate({
  share,
  password,
  setPassword,
  submitting,
  onUnlock,
}: {
  share: PublicShare
  password: string
  setPassword: (v: string) => void
  submitting: boolean
  onUnlock: () => void
}) {
  return (
    <div>
      <div className="text-center mb-4">
        <div className="size-12 rounded-2xl bg-brand-gradient text-brand-foreground flex items-center justify-center mx-auto mb-3 shadow-md shadow-brand/25">
          <Lock className="size-5" />
        </div>
        <div className="text-sm font-medium">Password required</div>
        <div className="text-xs text-muted-foreground mt-1">
          {share.item
            ? "Enter the password to access this file."
            : "Enter the password to continue."}
        </div>
      </div>
      {share.item && (
        <div className="card-premium glass relative rounded-xl p-2.5 flex items-center gap-2 mb-3">
          <FileIcon mime={share.item.mimeType || ""} size={16} className="size-7" />
          <div className="text-xs font-medium truncate flex-1">{share.item.name}</div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="share-pw" className="sr-only">Password</Label>
        <Input
          id="share-pw"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) onUnlock()
          }}
          autoFocus
        />
        <Button
          className="btn-premium relative w-full bg-brand-gradient"
          disabled={!password || submitting}
          onClick={onUnlock}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          Unlock
        </Button>
      </div>
    </div>
  )
}

function EmailGate({
  share,
  email,
  setEmail,
  submitting,
  onContinue,
}: {
  share: PublicShare
  email: string
  setEmail: (v: string) => void
  submitting: boolean
  onContinue: () => void
}) {
  return (
    <div>
      <div className="text-center mb-4">
        <div className="size-12 rounded-2xl bg-brand-gradient text-brand-foreground flex items-center justify-center mx-auto mb-3 shadow-md shadow-brand/25">
          <Mail className="size-5" />
        </div>
        <div className="text-sm font-medium">Email required</div>
        <div className="text-xs text-muted-foreground mt-1">
          {share.emailAllowed === false
            ? "This email isn't on the allowlist for this link."
            : "Enter your email to access this file."}
        </div>
      </div>
      {share.item && (
        <div className="card-premium glass relative rounded-xl p-2.5 flex items-center gap-2 mb-3">
          <FileIcon mime={share.item.mimeType || ""} size={16} className="size-7" />
          <div className="text-xs font-medium truncate flex-1">{share.item.name}</div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="share-email" className="sr-only">Email</Label>
        <Input
          id="share-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email) onContinue()
          }}
          autoFocus
        />
        <Button
          className="btn-premium relative w-full bg-brand-gradient"
          disabled={!email || submitting}
          onClick={onContinue}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Continue
        </Button>
      </div>
    </div>
  )
}

function GrantedView({
  share,
  heldPassword,
  heldEmail,
}: {
  share: PublicShare
  heldPassword: string | null
  heldEmail: string | null
}) {
  const item = share.item
  if (!item) return null
  const viewOnly = share.viewOnly || share.viewOnlyEnforced
  const downloadUrl = api.shareDownloadUrl(share.token, {
    password: heldPassword || undefined,
    email: heldEmail || undefined,
  })
  // Inline-viewer URL — same endpoint, but ?inline=1 so the server streams
  // with Content-Disposition: inline, allowing the bytes to be embedded
  // (PDF iframe, fetch() → text, fetch() → arrayBuffer for docx, etc.).
  // Works for view-only links too — view-only blocks the download (default
  // disposition) but inline preview is always allowed.
  const inlineUrl = api.shareDownloadUrl(share.token, {
    inline: true,
    password: heldPassword || undefined,
    email: heldEmail || undefined,
  })

  const onDownload = async () => {
    if (viewOnly) {
      toast.error("This link is view-only. Downloads are disabled.")
      return
    }
    try {
      const res = await fetch(downloadUrl, { method: "GET" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        if (j.viewOnly) {
          toast.error("This link is view-only. Downloads are disabled.")
          return
        }
        if (j.needsPassword) {
          toast.error("Password required — please reload.")
          return
        }
        if (j.needsEmail) {
          toast.error("Email required — please reload.")
          return
        }
        throw new Error(j.error || res.statusText)
      }
      const blob = await res.blob()
      // Derive the filename from the content-disposition header (server is
      // authoritative). Fall back to the item name (+ .zip for batch shares).
      const cd = res.headers.get("content-disposition") || ""
      let dlName = item.name || "download"
      const match = cd.match(/filename="?([^"]+)"?/)
      if (match) dlName = decodeURIComponent(match[1])
      else if (item.type === "batch") dlName = `${item.name || "trive-share"}.zip`
      const a = document.createElement("a")
      const objUrl = URL.createObjectURL(blob)
      a.href = objUrl
      a.download = dlName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
      toast.success("Download started")
    } catch (e) {
      toast.error("Couldn't download", {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  // Folder share — render folder view (file list + ZIP download).
  if (item.type === "folder") {
    return (
      <FolderGrantedView
        share={share}
        item={item}
        viewOnly={viewOnly}
        onDownload={onDownload}
        heldPassword={heldPassword}
        heldEmail={heldEmail}
      />
    )
  }

  // Batch share (multiple files + folders) — render batch view
  if (item.type === "batch") {
    return (
      <BatchGrantedView
        share={share}
        item={item}
        viewOnly={viewOnly}
        onDownload={onDownload}
        heldPassword={heldPassword}
        heldEmail={heldEmail}
      />
    )
  }

  // File share — choose inline viewer kind from filename + mime.
  const viewerKind = pickViewerKind(item.name || "", item.mimeType || "")
  const inlineViewers = ["image", "video", "audio", "pdf", "code", "text", "markdown", "docx"]
  const canInline = inlineViewers.includes(viewerKind)
  const viewerMeta: ViewerMeta = {
    name: item.name || "file",
    mimeType: item.mimeType || "application/octet-stream",
    size: item.size,
    downloadUrl,
  }

  const expiryCountdown = share.expiresAt
    ? new Date(share.expiresAt).getTime() - Date.now()
    : null

  return (
    <div>
      {/* Inline viewer (when supported). Renders above the metadata tile. */}
      {canInline && (
        <div className="card-premium relative mb-4 rounded-2xl overflow-hidden border border-border/60 bg-background/40 max-h-[60vh] flex">
          <div className="flex-1 min-h-0 min-h-[280px] overflow-auto scrollbar-thin">
            <FileViewerDispatcher url={inlineUrl} meta={viewerMeta} />
          </div>
        </div>
      )}

      {/* File tile */}
      <div className="card-premium glass relative rounded-2xl p-5 flex items-center gap-3 mb-4">
        <FileIcon mime={item.mimeType || ""} size={24} className="size-12" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            {item.size !== undefined ? formatBytes(item.size) : ""} · {item.mimeType || "file"}
          </div>
        </div>
      </div>

      {/* Protection badges — premium pill style */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4 justify-center">
        {share.hasPassword && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Lock className="size-2.5 text-brand" />
            Password protected
          </Badge>
        )}
        {viewOnly && (
          <Badge variant="outline" className="gap-1 text-brand border-brand/40 bg-brand/[0.06] rounded-full py-1 px-2.5">
            <Eye className="size-2.5" />
            View-only
          </Badge>
        )}
        {share.emailGate && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Mail className="size-2.5 text-brand" />
            Email gated
          </Badge>
        )}
        {share.expiresAt && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Calendar className="size-2.5 text-brand" />
            {expiryCountdown !== null && expiryCountdown > 0
              ? `Expires ${formatDistanceToNowSafe(share.expiresAt)}`
              : "Expired"}
          </Badge>
        )}
        {share.maxViews && (
          <Badge variant="secondary" className="gap-1 rounded-full py-1 px-2.5">
            <Eye className="size-2.5" />
            {share.viewCount} / {share.maxViews} views
          </Badge>
        )}
        {share.maxDownloads && !viewOnly && (
          <Badge variant="secondary" className="gap-1 rounded-full py-1 px-2.5">
            <Download className="size-2.5" />
            {share.downloadCount} / {share.maxDownloads} downloads
          </Badge>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
        <Meta label="Shared" value={formatDate(share.createdAt)} />
        <Meta
          label="Expires"
          value={share.expiresAt ? formatDate(share.expiresAt) : "Never"}
        />
        {!viewOnly && (
          <Meta
            label="Downloads"
            value={`${share.downloadCount}${
              share.maxDownloads ? ` / ${share.maxDownloads}` : ""
            }`}
          />
        )}
        <Meta label="Encryption" value="AES-256-GCM" />
      </div>

      {/* Download / view-only CTA */}
      {viewOnly ? (
        <div
          className="w-full h-11 rounded-xl border border-brand/40 bg-brand/10 text-brand flex items-center justify-center gap-1.5 text-sm font-medium cursor-not-allowed"
          aria-disabled="true"
        >
          <Eye className="size-4" />
          View-only — downloads disabled
        </div>
      ) : (
        <Button className="btn-premium relative w-full h-11 gap-1.5 bg-brand-gradient" onClick={onDownload}>
          <Download className="size-4" />
          Download file
        </Button>
      )}

      <div className="mt-3 text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
        <ShieldCheck className="size-3" />
        End-to-end encrypted · Decrypted on download · Built by Tectonic
      </div>
    </div>
  )
}

function FolderGrantedView({
  share,
  item,
  viewOnly,
  onDownload,
  heldPassword,
  heldEmail,
}: {
  share: PublicShare
  item: NonNullable<PublicShare["item"]>
  viewOnly: boolean
  onDownload: () => void
  heldPassword: string | null
  heldEmail: string | null
}) {
  const files = item.files || []
  const subfolders = (item as any).subfolders || []
  const totalSize = item.totalSize ?? files.reduce((s, f) => s + f.size, 0)
  const totalFileCount = item.fileCount ?? files.length
  const expiryCountdown = share.expiresAt
    ? new Date(share.expiresAt).getTime() - Date.now()
    : null

  // Individual file download handler — fetches the file, gets correct filename from headers
  const downloadFile = async (fileId: string, fileName?: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    // Use fetch to get the response with proper headers (filename, content-type)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        toast.error("Couldn't download file")
        return
      }
      // Extract filename from Content-Disposition header
      const cd = res.headers.get("content-disposition") || ""
      let name = fileName || "download"
      const match = cd.match(/filename="?([^"]+)"?/)
      if (match) name = decodeURIComponent(match[1])
      // Convert to blob and trigger download with correct filename
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      // Fallback: direct link download (less reliable for filename)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName || ""
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  // Preview file inline (for view-only or preview)
  const previewFile = (fileId: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      inline: true,
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    window.open(url, "_blank")
  }

  return (
    <div>
      {/* Folder header — premium tile */}
      <div className="relative card-premium glass-strong rounded-2xl p-5 flex items-center gap-4 mb-4">
        <div
          className="size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-brand/25"
          style={{ background: "linear-gradient(135deg, var(--brand-deep), var(--brand), var(--brand-cyan))" }}
        >
          <FolderOpen className="size-7 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalFileCount} file{totalFileCount === 1 ? "" : "s"}
            {subfolders.length > 0 && ` · ${subfolders.length} subfolder${subfolders.length === 1 ? "" : "s"}`}
            {` · ${formatBytes(totalSize)}`}
          </div>
        </div>
      </div>

      {/* Protection badges — premium pill style */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4 justify-center">
        {share.hasPassword && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Lock className="size-2.5 text-brand" />
            Password protected
          </Badge>
        )}
        {viewOnly && (
          <Badge variant="outline" className="gap-1 text-brand border-brand/40 bg-brand/[0.06] rounded-full py-1 px-2.5">
            <Eye className="size-2.5" />
            View-only
          </Badge>
        )}
        {share.emailGate && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Mail className="size-2.5 text-brand" />
            Email gated
          </Badge>
        )}
        {share.expiresAt && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5">
            <Calendar className="size-2.5 text-brand" />
            {expiryCountdown !== null && expiryCountdown > 0
              ? `Expires ${formatDistanceToNowSafe(share.expiresAt)}`
              : "Expired"}
          </Badge>
        )}
      </div>

      {/* Subfolders — expandable tree view */}
      {subfolders.length > 0 && (
        <div className="mb-4">
          <div className="eyebrow mb-2 px-1">
            Subfolders (click to expand)
          </div>
          <div className="space-y-1.5">
            {subfolders.map((sf: any) => (
              <ExpandableFolder key={sf.id} folder={sf} viewOnly={viewOnly} share={share} heldPassword={heldPassword} heldEmail={heldEmail} depth={0} />
            ))}
          </div>
        </div>
      )}

      {/* File list — browsable with individual downloads */}
      <div className="mb-5">
        <div className="eyebrow mb-2 px-1">
          Files ({files.length})
        </div>
        <div className="glass relative rounded-xl overflow-hidden max-h-80 overflow-y-auto scrollbar-thin">
          {files.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <FolderOpen className="size-8 mx-auto mb-2 opacity-40" />
              This folder is empty.
            </div>
          ) : (
            files.map((f: any) => (
              <div
                key={f.id}
                className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-brand/[0.05] transition-colors group"
                style={{ transitionTimingFunction: "var(--ease-smooth)" }}
              >
                <FileIcon mime={f.mimeType} size={16} className="size-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatBytes(f.size)} · {f.mimeType || "file"}
                  </div>
                </div>
                {/* Individual file actions */}
                {!viewOnly ? (
                  <button
                    onClick={() => downloadFile(f.id, f.name)}
                    className="btn-premium relative size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0"
                    title="Download this file"
                  >
                    <Download className="size-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => previewFile(f.id)}
                    className="btn-premium relative size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0"
                    title="Preview this file"
                  >
                    <Eye className="size-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Download all / view-only CTA */}
      {viewOnly ? (
        <div
          className="w-full h-11 rounded-xl border border-brand/40 bg-brand/10 text-brand flex items-center justify-center gap-1.5 text-sm font-medium cursor-not-allowed"
          aria-disabled="true"
        >
          <Eye className="size-4" />
          View-only — folder download disabled
        </div>
      ) : (
        <Button className="btn-premium relative w-full h-11 gap-1.5 bg-brand-gradient" onClick={onDownload}>
          <Download className="size-4" />
          Download all ({formatBytes(totalSize)} · ZIP)
        </Button>
      )}

      <div className="mt-3 text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
        <ShieldCheck className="size-3" />
        End-to-end encrypted · Decrypted on download · Built by Tectonic
      </div>
    </div>
  )
}

/** Expandable folder tree node — shows files + nested subfolders when expanded. */
function ExpandableFolder({
  folder,
  viewOnly,
  share,
  heldPassword,
  heldEmail,
  depth,
}: {
  folder: any
  viewOnly: boolean
  share: PublicShare
  heldPassword: string | null
  heldEmail: string | null
  depth: number
}) {
  const [expanded, setExpanded] = React.useState(false)
  const files = folder.files || []
  const subfolders = folder.subfolders || []

  const downloadFile = async (fileId: string, fileName?: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    try {
      const res = await fetch(url)
      if (!res.ok) { toast.error("Couldn't download file"); return }
      const cd = res.headers.get("content-disposition") || ""
      let name = fileName || "download"
      const match = cd.match(/filename="?([^"]+)"?/)
      if (match) name = decodeURIComponent(match[1])
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      const a = document.createElement("a")
      a.href = url
      a.download = fileName || ""
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  const previewFile = (fileId: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      inline: true,
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    window.open(url, "_blank")
  }

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-brand/[0.05] transition-colors text-left group"
        style={{ transitionTimingFunction: "var(--ease-smooth)" }}
      >
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-90")}
        />
        <span
          className="size-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: folder.color ? `${folder.color}20` : "var(--brand-muted)" }}
        >
          {expanded ? <FolderOpen className="size-4" style={{ color: folder.color || "var(--brand)" }} /> : <Folder className="size-4" style={{ color: folder.color || "var(--brand)" }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{folder.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {folder.fileCount} file{folder.fileCount === 1 ? "" : "s"}
            {subfolders.length > 0 && ` · ${subfolders.length} subfolder${subfolders.length === 1 ? "" : "s"}`}
            {` · ${formatBytes(folder.totalSize)}`}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-6 pt-1 space-y-0.5">
              {files.length === 0 && subfolders.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground italic">Empty folder</div>
              ) : (
                <>
                  {files.map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-brand/[0.05] transition-colors"
                      style={{ transitionTimingFunction: "var(--ease-smooth)" }}
                    >
                      <FileIcon mime={f.mimeType} size={14} className="size-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</div>
                      </div>
                      {!viewOnly ? (
                        <button
                          onClick={() => downloadFile(f.id, f.name)}
                          className="btn-premium relative size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0"
                          title="Download"
                        >
                          <Download className="size-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => previewFile(f.id)}
                          className="btn-premium relative size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0"
                          title="Preview"
                        >
                          <Eye className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {subfolders.map((sf: any) => (
                    <ExpandableFolder
                      key={sf.id}
                      folder={sf}
                      viewOnly={viewOnly}
                      share={share}
                      heldPassword={heldPassword}
                      heldEmail={heldEmail}
                      depth={depth + 1}
                    />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Batch share view — shows standalone files + folders (with their contents) */
function BatchGrantedView({
  share,
  item,
  viewOnly,
  onDownload,
  heldPassword,
  heldEmail,
}: {
  share: PublicShare
  item: NonNullable<PublicShare["item"]>
  viewOnly: boolean
  onDownload: () => void
  heldPassword: string | null
  heldEmail: string | null
}) {
  const files = item.files || []
  const folders = (item as any).folders || []
  const totalSize = item.totalSize ?? 0
  const totalFileCount = item.fileCount ?? files.length
  const totalFolderCount = (item as any).folderCount ?? folders.length
  const expiryCountdown = share.expiresAt ? new Date(share.expiresAt).getTime() - Date.now() : null

  const downloadFile = async (fileId: string, fileName?: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    try {
      const res = await fetch(url)
      if (!res.ok) { toast.error("Couldn't download file"); return }
      const cd = res.headers.get("content-disposition") || ""
      let name = fileName || "download"
      const match = cd.match(/filename="?([^"]+)"?/)
      if (match) name = decodeURIComponent(match[1])
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      const a = document.createElement("a")
      a.href = url
      a.download = fileName || ""
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  const previewFile = (fileId: string) => {
    const url = api.shareFileDownloadUrl(share.token, fileId, {
      inline: true,
      password: heldPassword || undefined,
      email: heldEmail || undefined,
    })
    window.open(url, "_blank")
  }

  return (
    <div>
      {/* Batch header */}
      <div className="relative card-premium glass-strong rounded-2xl p-5 flex items-center gap-4 mb-4">
        <div className="size-14 rounded-2xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-md shadow-brand/25">
          <Share2 className="size-7 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalFileCount} file{totalFileCount === 1 ? "" : "s"}
            {totalFolderCount > 0 && ` · ${totalFolderCount} folder${totalFolderCount === 1 ? "" : "s"}`}
            {` · ${formatBytes(totalSize)}`}
          </div>
        </div>
      </div>

      {/* Protection badges — premium pill style */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4 justify-center">
        {share.hasPassword && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5"><Lock className="size-2.5 text-brand" />Password</Badge>
        )}
        {viewOnly && (
          <Badge variant="outline" className="gap-1 text-brand border-brand/40 bg-brand/[0.06] rounded-full py-1 px-2.5"><Eye className="size-2.5" />View-only</Badge>
        )}
        {share.emailGate && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5"><Mail className="size-2.5 text-brand" />Email gated</Badge>
        )}
        {share.expiresAt && (
          <Badge variant="outline" className="gap-1 rounded-full border-brand/20 bg-brand/[0.04] py-1 px-2.5"><Calendar className="size-2.5 text-brand" />{expiryCountdown && expiryCountdown > 0 ? `Expires ${formatDistanceToNowSafe(share.expiresAt)}` : "Expired"}</Badge>
        )}
      </div>

      {/* Folders with their contents (expandable) */}
      {folders.length > 0 && (
        <div className="mb-4">
          <div className="eyebrow mb-2 px-1">
            Folders ({folders.length})
          </div>
          <div className="space-y-1.5">
            {folders.map((sf: any) => (
              <ExpandableFolder key={sf.id} folder={sf} viewOnly={viewOnly} share={share} heldPassword={heldPassword} heldEmail={heldEmail} depth={0} />
            ))}
          </div>
        </div>
      )}

      {/* Standalone files */}
      {files.length > 0 && (
        <div className="mb-5">
          <div className="eyebrow mb-2 px-1">
            Files ({files.length})
          </div>
          <div className="glass relative rounded-xl overflow-hidden max-h-80 overflow-y-auto scrollbar-thin">
            {files.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-brand/[0.05] transition-colors group" style={{ transitionTimingFunction: "var(--ease-smooth)" }}>
                <FileIcon mime={f.mimeType} size={16} className="size-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)} · {f.mimeType || "file"}</div>
                </div>
                {!viewOnly ? (
                  <button onClick={() => downloadFile(f.id, f.name)} className="btn-premium relative size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0" title="Download">
                    <Download className="size-3.5" />
                  </button>
                ) : (
                  <button onClick={() => previewFile(f.id)} className="btn-premium relative size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand/10 shrink-0" title="Preview">
                    <Eye className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download all */}
      {viewOnly ? (
        <div className="w-full h-11 rounded-xl border border-brand/40 bg-brand/10 text-brand flex items-center justify-center gap-1.5 text-sm font-medium cursor-not-allowed" aria-disabled="true">
          <Eye className="size-4" />View-only — downloads disabled
        </div>
      ) : (
        <Button className="btn-premium relative w-full h-11 gap-1.5 bg-brand-gradient" onClick={onDownload}>
          <Download className="size-4" />Download all ({formatBytes(totalSize)})
        </Button>
      )}

      <div className="mt-3 text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
        <ShieldCheck className="size-3" />End-to-end encrypted · Built by Tectonic
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  )
}

function PublicShareFooter() {
  return (
    <div className="mt-4 text-center text-xs text-muted-foreground">
      <Wordmark className="justify-center opacity-70" />
      <div className="mt-1.5 inline-flex items-center gap-1.5">
        <ShieldCheck className="size-3" />
        <span>End-to-end encrypted · Built by Tectonic</span>
      </div>
      <div className="mt-2">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-brand hover:underline"
        >
          <ArrowLeft className="size-3" />
          Create your own free vault
        </a>
      </div>
      <div className="mt-3">
        <span>© {new Date().getFullYear()} TriVE · </span>
        <TectonicCredit prefix="Built by" />
      </div>
    </div>
  )
}

function BrandPulse() {
  return (
    <div className="relative size-12">
      <motion.div
        className="absolute inset-0 rounded-2xl bg-brand/30"
        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <BrandMark size={48} className="rounded-2xl" />
      </motion.div>
    </div>
  )
}

function formatDistanceToNowSafe(iso: string): string {
  try {
    // Inline lightweight relative formatter to avoid date-fns bundle bloat on public page.
    const diff = new Date(iso).getTime() - Date.now()
    const abs = Math.abs(diff)
    const min = 60_000, hr = 60 * min, day = 24 * hr
    let val: string
    if (abs < hr) val = `${Math.round(abs / min)}m`
    else if (abs < day) val = `${Math.round(abs / hr)}h`
    else val = `${Math.round(abs / day)}d`
    return diff > 0 ? `in ${val}` : `${val} ago`
  } catch {
    return "soon"
  }
}
