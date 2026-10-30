"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Cpu,
  Database,
  Eye,
  FileText,
  Files,
  HardDrive,
  Hash,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { BrandMark, Wordmark } from "@/components/brand"
import { QueryProvider } from "@/components/dashboard/query-provider"
import { TectonicCredit } from "@/components/legal/tectonic-credit"
import { formatBytes, formatDate } from "@/lib/file-utils"
import type {
  AdminActivity,
  AdminDbInfo,
  AdminFile,
  AdminShare,
  AdminStats,
  AdminTelegramHealth,
  AdminUser,
} from "@/lib/types"
import { cn } from "@/lib/utils"

/* ================================================================== */
/* Admin API client                                                   */
/* ================================================================== */

class AdminUnauthorizedError extends Error {
  constructor() {
    super("ADMIN_UNAUTHORIZED")
    this.name = "AdminUnauthorizedError"
  }
}

async function adminReq<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init?.headers as Record<string, string> | undefined)),
    },
  })
  if (res.status === 401) throw new AdminUnauthorizedError()
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = (await res.json()) as { error?: string; message?: string }
      msg = j.error || j.message || msg
    } catch {}
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

const adminApi = {
  login: (password: string) =>
    adminReq<{ ok: true }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    adminReq<void>("/api/admin/logout", { method: "POST" }),
  stats: () => adminReq<AdminStats>("/api/admin/stats"),
  users: (limit = 200) =>
    adminReq<AdminUser[]>(`/api/admin/users?limit=${limit}`),
  deleteUser: (id: string) =>
    adminReq<{ ok: true; deleted: string }>(`/api/admin/users/${id}`, {
      method: "DELETE",
    }),
  files: (limit = 200, trashed = true) =>
    adminReq<AdminFile[]>(
      `/api/admin/files?limit=${limit}${trashed ? "&trashed=1" : ""}`
    ),
  deleteFile: (id: string) =>
    adminReq<{ ok: true; deleted: string }>(`/api/admin/files/${id}`, {
      method: "DELETE",
    }),
  shares: (limit = 200) =>
    adminReq<AdminShare[]>(`/api/admin/shares?limit=${limit}`),
  revokeShare: (id: string) =>
    adminReq<{ ok: true; deleted: string }>(`/api/admin/shares/${id}`, {
      method: "DELETE",
    }),
  activity: (limit = 200) =>
    adminReq<AdminActivity[]>(`/api/admin/activity?limit=${limit}`),
  db: () => adminReq<AdminDbInfo>("/api/admin/db"),
  telegram: () => adminReq<AdminTelegramHealth>("/api/admin/telegram"),
}

/* ================================================================== */
/* Top-level <AdminPanel />                                            */
/* ================================================================== */

export function AdminPanel() {
  return (
    <QueryProvider>
      <AdminPanelInner />
    </QueryProvider>
  )
}

function AdminPanelInner() {
  const qc = useQueryClient()
  // We treat the admin authed state as "can we GET /api/admin/stats without
  // a 401?" If the first stats fetch 401s, we show the login screen. After a
  // successful login we invalidate the query so it refetches.
  const [authed, setAuthed] = React.useState<boolean | null>(null)

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: adminApi.stats,
    enabled: authed !== false, // pause polling on the login screen
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })

  // Watch for the 401 → flip to login screen.
  React.useEffect(() => {
    if (statsQuery.error instanceof AdminUnauthorizedError) {
      setAuthed(false)
    } else if (statsQuery.isSuccess) {
      setAuthed(true)
    }
  }, [statsQuery.error, statsQuery.isSuccess])

  // Initial authed check is "loading" until we know.
  if (authed === null) {
    return <AdminBootSplash />
  }
  if (authed === false) {
    return (
      <AdminLogin
        onSuccess={() => {
          // Force a fresh stats fetch; on success it'll flip authed → true.
          statsQuery.refetch()
        }}
      />
    )
  }
  return (
    <AdminDashboard
      statsQuery={statsQuery}
      onLogout={async () => {
        try {
          await adminApi.logout()
        } catch {}
        // Clear all cached admin queries so the next mount starts clean.
        qc.removeQueries({ queryKey: ["admin"] })
        setAuthed(false)
      }}
    />
  )
}

/* ================================================================== */
/* Boot splash                                                        */
/* ================================================================== */

function AdminBootSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[oklch(0.12_0.03_261)] relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora opacity-50 pointer-events-none" />
      <Loader2 className="size-8 animate-spin text-brand mb-3" />
      <div className="text-xs text-muted-foreground">Verifying admin session…</div>
    </div>
  )
}

/* ================================================================== */
/* Admin login                                                        */
/* ================================================================== */

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = React.useState("")
  const loginMut = useMutation({
    mutationFn: (pwd: string) => adminApi.login(pwd),
    onSuccess: () => {
      toast.success("Admin authenticated")
      setPassword("")
      onSuccess()
    },
    onError: (e) => {
      if (e instanceof AdminUnauthorizedError) {
        toast.error("Invalid password", {
          description: "That password isn't right. Try again.",
        })
      } else {
        toast.error("Couldn't log in", {
          description: e instanceof Error ? e.message : undefined,
        })
      }
    },
  })

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[oklch(0.12_0.03_261)]">
      <div className="absolute inset-0 bg-aurora opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)] pointer-events-none" />

      <header className="relative z-10 p-4">
        <Wordmark className="opacity-70" />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-3xl p-7 shadow-2xl"
            style={{
              background:
                "color-mix(in oklch, oklch(0.18 0.04 261) 75%, transparent)",
              backdropFilter: "blur(28px) saturate(180%)",
              WebkitBackdropFilter: "blur(28px) saturate(180%)",
              border:
                "1px solid color-mix(in oklch, oklch(0.6 0.05 243) 25%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-2xl bg-brand/30 blur-xl" />
                <BrandMark size={44} className="rounded-2xl relative" />
              </div>
              <h1 className="text-base font-semibold tracking-tight text-foreground/90">
                TriVE <span className="text-gradient-brand">Admin</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Restricted access · Authorized personnel only
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!password) return
                loginMut.mutate(password)
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="admin-pwd" className="text-xs text-muted-foreground">
                  Admin password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="admin-pwd"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••••"
                    className="pl-9 h-10 bg-background/40 border-border/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loginMut.isPending || !password}
                className="w-full h-10 gap-1.5"
              >
                {loginMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Authenticate
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-border/30 text-center">
              <div className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-1">
                <Lock className="size-2.5" />
                No &quot;forgot password&quot; — admins are expected to know it.
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Strip ?admin=1 and return to the public app.
                const url = new URL(window.location.href)
                url.searchParams.delete("admin")
                window.location.href = url.pathname + (url.search || "")
              }}
            >
              <ArrowLeft className="size-3.5" />
              Exit admin
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

/* ================================================================== */
/* Admin dashboard                                                    */
/* ================================================================== */

type Tab = "overview" | "users" | "files" | "shares" | "activity" | "system"

const NAV_ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "files", label: "Files", icon: Files },
  { id: "shares", label: "Shares", icon: Share2 },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "system", label: "System", icon: Cpu },
]

function AdminDashboard({
  statsQuery,
  onLogout,
}: {
  statsQuery: ReturnType<typeof useQuery<AdminStats>>
  onLogout: () => void
}) {
  const [tab, setTab] = React.useState<Tab>("overview")
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.13_0.032_261)] text-foreground/90 relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-10 [mask-image:radial-gradient(ellipse_at_top,white,transparent_70%)] pointer-events-none" />

      {/* Topbar */}
      <header className="relative z-30 h-14 border-b border-border/30 flex items-center justify-between px-4 glass-strong">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <BrandMark size={26} className="rounded-md" />
            <span className="font-semibold tracking-tight text-sm">
              TriVE <span className="text-gradient-brand">Admin</span>
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex ml-1 border-brand/40 text-brand"
            >
              <ShieldCheck className="size-3 mr-1" />
              {statsQuery.isLoading ? "—" : "live"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={(() => {
              const url = new URL(window.location.href)
              url.searchParams.delete("admin")
              return url.pathname + (url.search || "")
            })()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            Exit to app
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="gap-1.5 h-8"
          >
            <LogOut className="size-3.5" />
            Logout
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-56 flex-col border-r border-border/30 glass relative py-4">
          <AdminSidebar tab={tab} setTab={setTab} />
          <div className="mt-auto px-4 pt-4 border-t border-border/30">
            <TectonicCredit prefix="TriVE ·" />
          </div>
        </aside>

        {/* Sidebar — mobile drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNavOpen(false)}
                className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 26, stiffness: 240 }}
                className="md:hidden fixed left-0 top-14 bottom-0 z-50 w-64 flex flex-col border-r border-border/30 glass py-4"
              >
                <AdminSidebar
                  tab={tab}
                  setTab={(t) => {
                    setTab(t)
                    setMobileNavOpen(false)
                  }}
                />
                <div className="mt-auto px-4 pt-4 border-t border-border/30">
                  <TectonicCredit prefix="TriVE ·" />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {tab === "overview" && <OverviewTab statsQuery={statsQuery} />}
                {tab === "users" && <UsersTab />}
                {tab === "files" && <FilesTab />}
                {tab === "shares" && <SharesTab />}
                {tab === "activity" && <ActivityTab />}
                {tab === "system" && <SystemTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

function AdminSidebar({
  tab,
  setTab,
}: {
  tab: Tab
  setTab: (t: Tab) => void
}) {
  return (
    <nav className="px-3 flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = tab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
              active
                ? "bg-brand/15 text-brand font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

/* ================================================================== */
/* Shared admin UI atoms                                              */
/* ================================================================== */

function AdminCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 border border-border/30",
        "bg-[color-mix(in_oklch,oklch(0.18_0.04_261)_55%,transparent)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "brand",
}: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  hint?: string
  accent?: "brand" | "cyan" | "deep"
}) {
  const accentClass =
    accent === "cyan"
      ? "text-[var(--brand-cyan)]"
      : accent === "deep"
        ? "text-[var(--brand-deep)]"
        : "text-brand"
  return (
    <AdminCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums truncate">
            {value}
          </div>
          {hint && (
            <div className="text-[11px] text-muted-foreground/80 mt-1">{hint}</div>
          )}
        </div>
        <div
          className={cn(
            "size-9 rounded-xl flex items-center justify-center shrink-0",
            "bg-foreground/5"
          )}
        >
          <Icon className={cn("size-4", accentClass)} />
        </div>
      </div>
    </AdminCard>
  )
}

function TabHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </div>
      {actions}
    </div>
  )
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
        {label}
      </TableCell>
    </TableRow>
  )
}

function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-8">
        <Loader2 className="size-4 animate-spin inline-block text-muted-foreground" />
      </TableCell>
    </TableRow>
  )
}

/* ================================================================== */
/* Overview tab                                                       */
/* ================================================================== */

function OverviewTab({
  statsQuery,
}: {
  statsQuery: ReturnType<typeof useQuery<AdminStats>>
}) {
  const stats = statsQuery.data
  const loading = statsQuery.isLoading && !stats

  return (
    <div>
      <TabHeader
        title="Overview"
        subtitle="System-wide snapshot · auto-refreshes every 10s"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total users"
          value={loading ? "—" : stats?.users ?? 0}
          icon={Users}
          hint={stats ? `${stats.recentUsers} new (7d)` : undefined}
        />
        <StatCard
          label="Total files"
          value={loading ? "—" : stats?.files ?? 0}
          icon={Files}
          hint={stats ? `${stats.trashedFiles} trashed` : undefined}
          accent="cyan"
        />
        <StatCard
          label="Storage used"
          value={loading ? "—" : stats ? formatBytes(stats.totalStorage) : "—"}
          icon={HardDrive}
          hint={stats ? `${stats.chunks} chunks` : undefined}
          accent="deep"
        />
        <StatCard
          label="Share links"
          value={loading ? "—" : stats?.shares ?? 0}
          icon={Share2}
          hint={stats ? `${stats.activeShares} active` : undefined}
        />
        <StatCard
          label="Folders"
          value={loading ? "—" : stats?.folders ?? 0}
          icon={FileText}
        />
        <StatCard
          label="Chunks"
          value={loading ? "—" : stats?.chunks ?? 0}
          icon={Hash}
          accent="cyan"
        />
        <StatCard
          label="Activities"
          value={loading ? "—" : stats?.activities ?? 0}
          icon={ActivityIcon}
          accent="deep"
        />
        <StatCard
          label="Trashed files"
          value={loading ? "—" : stats?.trashedFiles ?? 0}
          icon={Trash2}
        />
      </div>

      {/* Storage breakdown bar */}
      {stats && (
        <AdminCard className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Storage distribution</div>
            <div className="text-xs text-muted-foreground">
              {formatBytes(stats.totalStorage)} total
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-foreground/5 overflow-hidden flex">
            <div
              className="h-full bg-brand-gradient"
              style={{
                width: `${stats.files > 0 ? 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand" />
              Encrypted file bytes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-foreground/15" />
              {stats.files} files · {stats.chunks} chunks · {stats.folders} folders
            </span>
          </div>
        </AdminCard>
      )}
    </div>
  )
}

/* ================================================================== */
/* Users tab                                                          */
/* ================================================================== */

function UsersTab() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.users(200),
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: (_d, id) => {
      toast.success("User deleted", { description: `Removed user ${id}` })
      qc.invalidateQueries({ queryKey: ["admin"] })
    },
    onError: (e) =>
      toast.error("Couldn't delete user", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const users = usersQuery.data ?? []
  const loading = usersQuery.isLoading && !usersQuery.data

  return (
    <div>
      <TabHeader
        title="Users"
        subtitle={`${users.length} user${users.length === 1 ? "" : "s"} · auto-refreshes every 10s`}
      />
      <AdminCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Phone</TableHead>
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Vault</TableHead>
                <TableHead className="text-muted-foreground text-right">Files</TableHead>
                <TableHead className="text-muted-foreground text-right">Shares</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="text-muted-foreground">Updated</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={8} />
              ) : users.length === 0 ? (
                <EmptyRow colSpan={8} label="No users yet." />
              ) : (
                users.map((u) => (
                  <React.Fragment key={u.id}>
                    <TableRow
                      className="border-border/20 cursor-pointer hover:bg-foreground/5"
                      onClick={() =>
                        setExpanded((cur) => (cur === u.id ? null : u.id))
                      }
                    >
                      <TableCell className="font-mono text-xs">{u.phone}</TableCell>
                      <TableCell className="font-medium">
                        {u.name || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {u.vaultReady ? (
                            <Badge
                              variant="outline"
                              className="border-brand/40 text-brand gap-1"
                            >
                              <ShieldCheck className="size-2.5" />
                              ready
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground gap-1"
                            >
                              <AlertTriangle className="size-2.5" />
                              pending
                            </Badge>
                          )}
                          {u.hasVault && (
                            <Badge
                              variant="outline"
                              className="text-[var(--brand-cyan)] gap-1"
                            >
                              channel
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u._count.files}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u._count.shareLinks}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.updatedAt)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              aria-label="Delete user"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently deletes{" "}
                                <span className="font-mono">{u.phone}</span>{" "}
                                ({u.name || "unnamed"}), all {u._count.files}{" "}
                                file{u._count.files === 1 ? "" : "s"}, share
                                links, and activities. Files in their Telegram
                                vault channel are also removed from the vault
                                API. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(u.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Delete user
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                    {expanded === u.id && (
                      <TableRow className="border-border/20 bg-foreground/[0.02]">
                        <TableCell colSpan={8} className="py-3">
                          <UserExpand user={u} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AdminCard>
    </div>
  )
}

function UserExpand({ user }: { user: AdminUser }) {
  const filesQuery = useQuery({
    queryKey: ["admin", "users", user.id, "files"],
    queryFn: () => adminApi.files(50, true),
    // We don't know which files belong to this user without filtering; the
    // admin files endpoint lists across all users, so we filter client-side.
    // We deliberately keep staleTime: 0 + 30s interval to keep it light.
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
    select: (data: AdminFile[]) => data.filter((f) => f.user.id === user.id),
  })

  const files = filesQuery.data ?? []
  return (
    <div className="pl-4 pr-2">
      <div className="text-xs text-muted-foreground mb-2">
        {filesQuery.isLoading
          ? "Loading user files…"
          : `${files.length} file${files.length === 1 ? "" : "s"}`}
        {user._count.folders > 0 && ` · ${user._count.folders} folders`}
        {user._count.activities > 0 && ` · ${user._count.activities} activities`}
      </div>
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
          {files.map((f) => (
            <div
              key={f.id}
              className="glass-panel rounded-lg p-2.5 flex items-center gap-2"
            >
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatBytes(f.size)} · {formatDate(f.createdAt)}
                  {f.trashed && " · trashed"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Files tab                                                          */
/* ================================================================== */

function FilesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = React.useState<"all" | "active" | "trashed">("all")

  const filesQuery = useQuery({
    queryKey: ["admin", "files"],
    queryFn: () => adminApi.files(300, true),
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteFile,
    onSuccess: (_d, id) => {
      toast.success("File deleted", { description: `Removed file ${id}` })
      qc.invalidateQueries({ queryKey: ["admin"] })
    },
    onError: (e) =>
      toast.error("Couldn't delete file", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const all = filesQuery.data ?? []
  const files = React.useMemo(() => {
    if (filter === "active") return all.filter((f) => !f.trashed)
    if (filter === "trashed") return all.filter((f) => f.trashed)
    return all
  }, [all, filter])
  const loading = filesQuery.isLoading && !filesQuery.data

  return (
    <div>
      <TabHeader
        title="Files"
        subtitle={`${all.length} total · auto-refreshes every 10s`}
        actions={
          <div className="flex items-center gap-1 glass-panel rounded-full p-1">
            {(["all", "active", "trashed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs capitalize transition-colors",
                  filter === f
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />
      <AdminCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground text-right">Size</TableHead>
                <TableHead className="text-muted-foreground">Owner</TableHead>
                <TableHead className="text-muted-foreground text-right">Chunks</TableHead>
                <TableHead className="text-muted-foreground text-right">Shares</TableHead>
                <TableHead className="text-muted-foreground">State</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={8} />
              ) : files.length === 0 ? (
                <EmptyRow colSpan={8} label="No files match this filter." />
              ) : (
                files.map((f) => (
                  <TableRow key={f.id} className="border-border/20 hover:bg-foreground/5">
                    <TableCell className="font-medium max-w-[280px] truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{f.name}</span>
                        {f.starred && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            ★
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate ml-5">
                        {f.mimeType || "file"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatBytes(f.size)}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono">{f.user.phone}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {f.user.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {f.chunkCount}
                      <span className="text-muted-foreground"> / {f.totalChunks}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {f.shareCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {f.trashed ? (
                          <Badge
                            variant="outline"
                            className="text-destructive border-destructive/40 gap-1"
                          >
                            <Trash2 className="size-2.5" />
                            trashed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-brand/40 text-brand gap-1"
                          >
                            <ShieldCheck className="size-2.5" />
                            active
                          </Badge>
                        )}
                        {f.encrypted && (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="size-2.5" />
                            enc
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(f.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            aria-label="Delete file"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes{" "}
                              <span className="font-medium">{f.name}</span> ({formatBytes(f.size)})
                              and all its share links. The encrypted chunks are
                              also removed from the owner&apos;s Telegram vault.
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMut.mutate(f.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Delete file
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AdminCard>
    </div>
  )
}

/* ================================================================== */
/* Shares tab                                                         */
/* ================================================================== */

function SharesTab() {
  const qc = useQueryClient()
  const sharesQuery = useQuery({
    queryKey: ["admin", "shares"],
    queryFn: () => adminApi.shares(300),
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })
  const revokeMut = useMutation({
    mutationFn: adminApi.revokeShare,
    onSuccess: () => {
      toast.success("Share revoked")
      qc.invalidateQueries({ queryKey: ["admin"] })
    },
    onError: (e) =>
      toast.error("Couldn't revoke share", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  const shares = sharesQuery.data ?? []
  const loading = sharesQuery.isLoading && !sharesQuery.data

  return (
    <div>
      <TabHeader
        title="Share links"
        subtitle={`${shares.length} total · auto-refreshes every 10s`}
      />
      <AdminCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Token / slug</TableHead>
                <TableHead className="text-muted-foreground">Owner</TableHead>
                <TableHead className="text-muted-foreground">File</TableHead>
                <TableHead className="text-muted-foreground">Protections</TableHead>
                <TableHead className="text-muted-foreground text-right">Views</TableHead>
                <TableHead className="text-muted-foreground text-right">Downloads</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Last access</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={9} />
              ) : shares.length === 0 ? (
                <EmptyRow colSpan={9} label="No share links." />
              ) : (
                shares.map((s) => (
                  <TableRow key={s.id} className="border-border/20 hover:bg-foreground/5">
                    <TableCell>
                      <div className="font-mono text-xs truncate max-w-[160px]">
                        {s.customSlug || s.token}
                      </div>
                      {!s.customSlug && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {s.token}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.user ? (
                        <>
                          <div className="text-xs font-mono">{s.user.phone}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {s.user.name || "—"}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {s.file ? (
                        <>
                          <div className="text-xs truncate">{s.file.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatBytes(s.file.size)}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {s.hasPassword && (
                          <Badge variant="outline" className="gap-1 text-[10px] py-0">
                            <Lock className="size-2.5" />
                            pwd
                          </Badge>
                        )}
                        {s.viewOnly && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[10px] py-0 text-brand border-brand/40"
                          >
                            <Eye className="size-2.5" />
                            view
                          </Badge>
                        )}
                        {s.emailGate && (
                          <Badge variant="outline" className="gap-1 text-[10px] py-0">
                            <Mail className="size-2.5" />
                            email
                          </Badge>
                        )}
                        {s.expiresAt && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[10px] py-0"
                          >
                            exp
                          </Badge>
                        )}
                        {s.accessIps && (
                          <Badge variant="outline" className="gap-1 text-[10px] py-0">
                            IP
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {s.viewCount}
                      {s.maxViews ? (
                        <span className="text-muted-foreground"> / {s.maxViews}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {s.downloadCount}
                      {s.maxDownloads ? (
                        <span className="text-muted-foreground"> / {s.maxDownloads}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {s.expired ? (
                        <Badge
                          variant="outline"
                          className="text-destructive border-destructive/40 gap-1"
                        >
                          expired
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-brand/40 text-brand gap-1"
                        >
                          active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastAccessedAt ? formatDate(s.lastAccessedAt) : "never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            aria-label="Revoke share"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke this share link?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This immediately disables the share link. Anyone
                              trying to open it will see &quot;removed&quot;.
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revokeMut.mutate(s.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AdminCard>
    </div>
  )
}

/* ================================================================== */
/* Activity tab                                                       */
/* ================================================================== */

function ActivityTab() {
  const activityQuery = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => adminApi.activity(300),
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })
  const items = activityQuery.data ?? []
  const loading = activityQuery.isLoading && !activityQuery.data

  return (
    <div>
      <TabHeader
        title="Activity"
        subtitle={`${items.length} event${items.length === 1 ? "" : "s"} · auto-refreshes every 10s`}
      />
      <AdminCard className="p-0">
        <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="size-4 animate-spin inline-block text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No activity logged.
            </div>
          ) : (
            <ul className="divide-y divide-border/20">
              {items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-foreground/5">
                  <div className="size-8 rounded-lg bg-brand/12 text-brand flex items-center justify-center shrink-0 mt-0.5">
                    <ActivityIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.action}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </span>
                    </div>
                    {a.details && (
                      <div className="text-xs text-muted-foreground mt-0.5 break-words">
                        {a.details}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {a.user ? (
                        <span className="font-mono">
                          {a.user.phone} {a.user.name ? `· ${a.user.name}` : ""}
                        </span>
                      ) : (
                        <span className="italic">system</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminCard>
    </div>
  )
}

/* ================================================================== */
/* System tab                                                         */
/* ================================================================== */

function SystemTab() {
  const dbQuery = useQuery({
    queryKey: ["admin", "db"],
    queryFn: adminApi.db,
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })
  const tgQuery = useQuery({
    queryKey: ["admin", "telegram"],
    queryFn: adminApi.telegram,
    staleTime: 0,
    refetchInterval: 10_000,
    retry: false,
  })

  const db = dbQuery.data
  const tg = tgQuery.data

  return (
    <div>
      <TabHeader
        title="System"
        subtitle="Runtime health, storage, and environment"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Telegram engine */}
        <AdminCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-brand" />
              <h3 className="text-sm font-semibold">Telegram engine</h3>
            </div>
            {tg && (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1",
                  tg.realMode
                    ? "border-brand/40 text-brand"
                    : "text-amber-500 border-amber-500/40"
                )}
              >
                {tg.realMode ? "active" : "inactive"}
              </Badge>
            )}
          </div>
          <div className="space-y-2 text-xs">
            <SystemRow
              label="Mode"
              value={
                tg
                  ? tg.realMode
                    ? "Active"
                    : "Inactive"
                  : "—"
              }
            />
            <SystemRow
              label="API ID"
              value={
                tg
                  ? tg.apiIdPresent
                    ? "present"
                    : "missing"
                  : "—"
              }
              valueClass={
                tg && !tg.apiIdPresent ? "text-amber-500" : undefined
              }
            />
            <SystemRow
              label="Vault name"
              value={tg?.vaultName || "—"}
              mono
            />
            <SystemRow
              label="Health"
              value={tg ? (tg.ok ? "ok" : "degraded") : "—"}
              valueClass={
                tg && !tg.ok ? "text-amber-500" : undefined
              }
            />
          </div>
        </AdminCard>

        {/* Storage sizes */}
        <AdminCard>
          <div className="flex items-center gap-2 mb-3">
            <Database className="size-4 text-brand" />
            <h3 className="text-sm font-semibold">Storage</h3>
          </div>
          <div className="space-y-2 text-xs">
            <SystemRow
              label="SQLite DB size"
              value={db ? formatBytes(db.dbSize) : "—"}
              mono
            />
            <SystemRow
              label="Vault dir size"
              value={db ? formatBytes(db.vaultDirSize) : "—"}
              mono
            />
            <SystemRow
              label="Heap used"
              value={
                db ? formatBytes(db.memoryUsage.heapUsed) : "—"
              }
              mono
            />
            <SystemRow
              label="RSS"
              value={db ? formatBytes(db.memoryUsage.rss) : "—"}
              mono
            />
          </div>
        </AdminCard>

        {/* Runtime */}
        <AdminCard>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="size-4 text-brand" />
            <h3 className="text-sm font-semibold">Runtime</h3>
          </div>
          <div className="space-y-2 text-xs">
            <SystemRow
              label="Uptime"
              value={db ? formatUptime(db.uptime) : "—"}
              mono
            />
            <SystemRow
              label="Node version"
              value={db?.nodeVersion || "—"}
              mono
            />
            <SystemRow
              label="Platform"
              value={db?.platform || "—"}
              mono
            />
            <SystemRow
              label="Timestamp"
              value={db ? new Date(db.timestamp).toLocaleString() : "—"}
              mono
            />
          </div>
        </AdminCard>

        {/* Environment */}
        <AdminCard>
          <div className="flex items-center gap-2 mb-3">
            <Settings className="size-4 text-brand" />
            <h3 className="text-sm font-semibold">Environment</h3>
          </div>
          {db ? (
            <div className="space-y-2 text-xs">
              {Object.entries(db.envInfo).map(([k, v]) => (
                <SystemRow
                  key={k}
                  label={k}
                  value={v}
                  mono
                  valueClass={
                    v === "unset"
                      ? "text-amber-500"
                      : k.includes("API_ID") && v === "unset"
                        ? "text-amber-500"
                        : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Loading…</div>
          )}
        </AdminCard>
      </div>
    </div>
  )
}

function SystemRow({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string
  value: string
  mono?: boolean
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right truncate",
          mono && "font-mono",
          valueClass
        )}
      >
        {value}
      </span>
    </div>
  )
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
