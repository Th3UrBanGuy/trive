"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Globe,
  HardDrive,
  Key,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { useAuthStore } from "@/lib/store"
import { api } from "@/lib/api"
import { avatarGradient } from "@/lib/file-utils"
import { useTelegramStatus } from "./use-storage"
import { cn } from "@/lib/utils"

export function SettingsView() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const qc = useQueryClient()
  const { data: status, refetch, isFetching } = useTelegramStatus()

  const [name, setName] = React.useState(user?.name || "")
  React.useEffect(() => {
    setName(user?.name || "")
  }, [user?.name])

  const profileMut = useMutation({
    mutationFn: (n: string) => api.updateProfile(n),
    onSuccess: (u) => {
      setUser(u)
      toast.success("Profile updated")
    },
    onError: (e) =>
      toast.error("Couldn't update profile", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const vaultMut = useMutation({
    mutationFn: () => api.initVault(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-status"] })
      qc.invalidateQueries({ queryKey: ["storage"] })
      toast.success("Vault initialized")
    },
    onError: (e) =>
      toast.error("Couldn't initialize vault", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => {
      toast.success("Account deleted")
      setUser(null)
    },
    onError: (e) =>
      toast.error("Couldn't delete account", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  // WebDAV state & mutations
  const [davInfo, setDavInfo] = React.useState<{
    username: string
    customUsername: string | null
    telegramUsername: string | null
    hasPassword: boolean
    davPath: string
  } | null>(null)
  const [editingUsername, setEditingUsername] = React.useState(false)
  const [customUsernameInput, setCustomUsernameInput] = React.useState("")
  const [changingPassword, setChangingPassword] = React.useState(false)
  const [newPasswordInput, setNewPasswordInput] = React.useState("")
  const [revealedPassword, setRevealedPassword] = React.useState<string | null>(null)
  const [copiedField, setCopiedField] = React.useState<string | null>(null)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copied`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  React.useEffect(() => {
    api
      .getDavCredentials()
      .then((res) => {
        setDavInfo(res)
        setCustomUsernameInput(res.customUsername || res.telegramUsername || "")
      })
      .catch(() => {})
  }, [])

  const davPasswordMut = useMutation({
    mutationFn: (data: { password?: string; generateRandom?: boolean }) =>
      api.updateDavCredentials(data),
    onSuccess: (res) => {
      setDavInfo((prev) => (prev ? { ...prev, hasPassword: true, username: res.username } : null))
      if (res.password) {
        setRevealedPassword(res.password)
      }
      setChangingPassword(false)
      setNewPasswordInput("")
      toast.success(res.password ? "New WebDAV password generated" : "WebDAV password updated")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update WebDAV password"),
  })

  const davUsernameMut = useMutation({
    mutationFn: (username: string) => api.updateDavCredentials({ username }),
    onSuccess: (res) => {
      setDavInfo((prev) => (prev ? { ...prev, username: res.username, customUsername: res.customUsername } : null))
      setEditingUsername(false)
      toast.success("WebDAV username updated")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update WebDAV username"),
  })

  if (!user) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your profile, Telegram connection, and account.
        </p>
      </div>

      {/* Profile */}
      <Section
        icon={UserIcon}
        title="Profile"
        description="Your display name and account info."
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className="size-14 rounded-full text-white flex items-center justify-center text-lg font-semibold overflow-hidden shadow-md"
            style={{ background: avatarGradient(user.telegramId || user.phone || user.id) }}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="size-full object-cover" />
            ) : (
              (name || user.telegramUsername || user.phone || "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div className="text-sm font-medium">
              {name || "Telegram User"}
            </div>
            <div className="text-xs text-muted-foreground">
              {user.telegramUsername ? `@${user.telegramUsername}` : (user.phone || `Telegram ID: ${user.telegramId}`)}
            </div>
            <Badge className="mt-1 bg-brand/15 text-brand hover:bg-brand/20 border-transparent">
              Bot Inbox Ready
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5 max-w-sm">
          <Label htmlFor="name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Button
              onClick={() => name.trim() && profileMut.mutate(name.trim())}
              disabled={profileMut.isPending || !name.trim()}
              className="gap-1.5"
            >
              {profileMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </Section>

      {/* Vault connection */}
      <Section
        icon={ShieldCheck}
        title="Vault connection"
        description="Your encrypted vault status and connection state."
      >
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <InfoRow
            label="Storage Target"
            value="Telegram Bot Inbox"
            badge="brand"
          />
          <InfoRow
            label="Bot Account"
            value={status?.botUsername ? `@${status.botUsername}` : "Configured"}
            badge={status?.botConfigured ? "emerald" : "muted"}
          />
          <InfoRow
            label="Zero-Knowledge"
            value="AES-256-GCM"
            badge="emerald"
          />
          <InfoRow
            label="MTProto Engine"
            value={status?.apiIdPresent ? "Active (2GB Chunks)" : "Simulation"}
            badge={status?.apiIdPresent ? "brand" : "amber"}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh status
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => vaultMut.mutate()}
            disabled={vaultMut.isPending}
          >
            {vaultMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Verify Bot Inbox
          </Button>
        </div>
      </Section>

      {/* WebDAV */}
      <Section
        icon={HardDrive}
        title="WebDAV & Virtual Network Drive"
        description="Mount your TriVE vault as a real local hard drive on Windows, macOS, or Mobile."
      >
        <div className="space-y-4">
          {/* WebDAV Server URL */}
          <div className="glass-panel rounded-lg p-3 space-y-2 border border-brand/20 bg-brand/[0.02]">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-brand" />
                WebDAV Server URL
              </Label>
              <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.5 rounded font-mono">
                Port 443 (HTTPS)
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={typeof window !== "undefined" ? `${window.location.origin}/api/dav` : ""}
                className="font-mono text-xs h-9 bg-background/50 select-all"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5 shrink-0 hover:border-brand/40"
                onClick={() => {
                  const url = `${window.location.origin}/api/dav`
                  copyToClipboard(url, "WebDAV URL")
                }}
              >
                {copiedField === "WebDAV URL" ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedField === "WebDAV URL" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Credentials Grid */}
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Username Card */}
            <div className="glass-panel rounded-lg p-3 space-y-2 border border-border/60">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  WebDAV Username
                </div>
                {!editingUsername && (
                  <button
                    onClick={() => {
                      setCustomUsernameInput(davInfo?.username || user.telegramUsername || user.telegramId)
                      setEditingUsername(true)
                    }}
                    className="text-[11px] text-brand hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="size-3" /> Edit
                  </button>
                )}
              </div>

              {editingUsername ? (
                <div className="space-y-2 pt-1">
                  <Input
                    value={customUsernameInput}
                    onChange={(e) => setCustomUsernameInput(e.target.value)}
                    placeholder="Enter custom username"
                    className="text-xs h-8 font-mono"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setEditingUsername(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1"
                      disabled={davUsernameMut.isPending || !customUsernameInput.trim()}
                      onClick={() => davUsernameMut.mutate(customUsernameInput.trim())}
                    >
                      {davUsernameMut.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-sm font-semibold font-mono text-foreground tracking-tight">
                    {davInfo?.username || user.telegramUsername || user.telegramId}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const u = davInfo?.username || user.telegramUsername || user.telegramId
                      copyToClipboard(u, "Username")
                    }}
                  >
                    {copiedField === "Username" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Password Card */}
            <div className="glass-panel rounded-lg p-3 space-y-2 border border-border/60">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  WebDAV Password
                </div>
                {davInfo?.hasPassword && !changingPassword && (
                  <button
                    onClick={() => {
                      setNewPasswordInput("")
                      setChangingPassword(true)
                    }}
                    className="text-[11px] text-brand hover:underline flex items-center gap-1"
                  >
                    <Key className="size-3" /> Change
                  </button>
                )}
              </div>

              {changingPassword ? (
                <div className="space-y-2 pt-1">
                  <Input
                    type="text"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Min 6 characters"
                    className="text-xs h-8 font-mono"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setChangingPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1"
                      disabled={davPasswordMut.isPending || newPasswordInput.trim().length < 6}
                      onClick={() => davPasswordMut.mutate({ password: newPasswordInput.trim() })}
                    >
                      {davPasswordMut.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-sm font-semibold font-mono tracking-wider text-foreground">
                    {davInfo?.hasPassword ? "••••••••••••" : "Not Set"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 text-brand border-brand/30 hover:bg-brand/10"
                      disabled={davPasswordMut.isPending}
                      onClick={() => davPasswordMut.mutate({ generateRandom: true })}
                      title="Generate a new secure password"
                    >
                      {davPasswordMut.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3" />
                      )}
                      {davInfo?.hasPassword ? "Reset" : "Create"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Newly Generated Password Notification */}
          {revealedPassword && (
            <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/25 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  New WebDAV Password Generated
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setRevealedPassword(null)}
                >
                  Dismiss
                </Button>
              </div>
              <div className="flex items-center justify-between bg-background/80 p-2 rounded border border-emerald-500/20 font-mono text-sm text-foreground">
                <span className="select-all font-semibold">{revealedPassword}</span>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => copyToClipboard(revealedPassword, "WebDAV Password")}
                >
                  {copiedField === "WebDAV Password" ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedField === "WebDAV Password" ? "Copied" : "Copy Password"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Copy and save this password. You will use this to connect your PC or phone to TriVE.
              </p>
            </div>
          )}

          {/* Quick Mount Guide */}
          <div className="text-[11px] text-muted-foreground bg-brand/5 p-3 rounded-lg border border-brand/10 space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
              <ShieldCheck className="size-3.5 text-brand shrink-0" />
              <span>How to Mount as a Real Hard Drive</span>
            </div>
            <div className="grid gap-1.5 pl-5 list-disc text-[11px]">
              <div>
                <strong className="text-foreground">Windows PC:</strong> Open <em>File Explorer</em> &rarr; Right click <em>This PC</em> &rarr; <em>Map network drive</em> &rarr; Paste WebDAV URL &rarr; Enter your username & password.
              </div>
              <div>
                <strong className="text-foreground">macOS:</strong> Open <em>Finder</em> &rarr; Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Cmd + K</kbd> &rarr; Paste WebDAV URL &rarr; Connect as Registered User.
              </div>
              <div>
                <strong className="text-foreground">Android / iOS:</strong> In <em>Solid Explorer</em> or <em>Documents by Readdle</em> &rarr; <em>Add Storage</em> &rarr; <em>WebDAV</em> &rarr; Paste URL and credentials.
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section
        icon={Lock}
        title="Security"
        description="How your data is protected."
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Files are encrypted with AES-256-GCM in your browser before upload.",
            "Per-chunk IVs and authenticated encryption prevent tampering.",
            "Your session is encrypted at rest with a server-side key.",
            "No plaintext ever touches our servers — Telegram stores only ciphertext.",
          ].map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span className="size-5 rounded-full bg-brand/15 text-brand flex items-center justify-center mt-0.5 shrink-0">
                <ShieldCheck className="size-3" />
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Danger zone */}
      <Section
        icon={AlertTriangle}
        title="Danger zone"
        description="Sign out or permanently delete your account and vault."
        danger
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              try {
                await api.logout()
              } catch {}
              setUser(null)
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-1.5">
                <Trash2 className="size-4" />
                Delete account & wipe vault
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-strong">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account forever?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your TriVE account, all file
                  metadata, your encrypted session, and revokes access to your
                  vault channel. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ConfirmDelete
                onConfirm={() => deleteMut.mutate()}
                busy={deleteMut.isPending}
              />
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  )
}

function ConfirmDelete({
  onConfirm,
  busy,
}: {
  onConfirm: () => void
  busy: boolean
}) {
  const [typed, setTyped] = React.useState("")
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">
          Type <span className="font-mono">DELETE</span> to confirm
        </Label>
        <Input
          id="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-white hover:bg-destructive/90"
          disabled={typed !== "DELETE" || busy}
          onClick={onConfirm}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Delete forever
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  danger,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 md:p-6",
        danger && "border-destructive/30"
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={cn(
            "size-9 rounded-xl flex items-center justify-center shrink-0",
            danger
              ? "bg-destructive/15 text-destructive"
              : "bg-brand/15 text-brand"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string
  value: string
  badge?: "brand" | "amber" | "emerald" | "muted"
}) {
  const dotColor =
    badge === "brand"
      ? "var(--brand)"
      : badge === "amber"
      ? "oklch(0.7 0.15 75)"
      : badge === "emerald"
      ? "oklch(0.7 0.18 162)"
      : "var(--muted-foreground)"
  return (
    <div className="glass-panel rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium mt-1 inline-flex items-center gap-1.5">
        <span
          className="size-1.5 rounded-full"
          style={{ background: dotColor }}
        />
        {value}
      </div>
    </div>
  )
}
