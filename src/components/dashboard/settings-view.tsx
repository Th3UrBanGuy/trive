"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  Globe,
  HardDrive,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
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
        title="WebDAV Access"
        description="Mount your vault as a local drive on Windows, macOS, or Linux."
      >
        <div className="space-y-4">
          <div className="glass-panel rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Universal WebDAV URL</Label>
            <div className="flex gap-2">
              <Input 
                readOnly 
                value={typeof window !== 'undefined' ? `${window.location.origin}/api/dav` : ''} 
                className="font-mono text-xs h-8"
              />
              <Button size="sm" variant="ghost" className="h-8" onClick={() => {
                const url = `${window.location.origin}/api/dav`
                navigator.clipboard.writeText(url)
                toast.success("WebDAV URL copied")
              }}>Copy</Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
             <div className="glass-panel rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Username</div>
                <div className="text-sm font-medium mt-1 font-mono">{user.telegramUsername || user.telegramId || user.phone || user.id}</div>
             </div>
             <div className="glass-panel rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Password</div>
                <div className="text-sm font-medium mt-1">Your Admin Password</div>
             </div>
          </div>
          <div className="text-[11px] text-muted-foreground bg-brand/5 p-2.5 rounded-lg flex items-start gap-2 border border-brand/10">
            <ShieldCheck className="size-3.5 mt-0.5 text-brand shrink-0" />
            <span>Mount as native drive in Windows File Explorer (Map Network Drive), macOS Finder (Cmd+K), or Mobile (Solid Explorer). Files stream & decrypt on-the-fly.</span>
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
