"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { useUIStore, useAuthStore, useNavStore } from "@/lib/store"
import { api } from "@/lib/api"
import { avatarGradient } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function Topbar() {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const sortKey = useUIStore((s) => s.sortKey)
  const sortDir = useUIStore((s) => s.sortDir)
  const setSort = useUIStore((s) => s.setSort)
  const setSearch = useUIStore((s) => s.setSearch)
  const setView = useUIStore((s) => s.setView)
  const localSearch = useUIStore((s) => s.search)
  const [q, setQ] = React.useState(localSearch)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const debounced = useDebounced(q, 250)
  React.useEffect(() => setSearch(debounced), [debounced, setSearch])

  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const breadcrumbs = useNavStore((s) => s.breadcrumbs)
  const navigateTo = useNavStore((s) => s.navigateTo)

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  async function onSignOut() {
    try {
      await api.logout()
    } catch {}
    setUser(null)
  }

  return (
    <header className="sticky top-0 z-30 glass-strong bg-noise border-b border-border/60" style={{ borderColor: "color-mix(in oklch, var(--brand) 14%, var(--border))" }}>
      {/* Mobile search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden absolute top-0 left-0 right-0 z-50 glass-strong border-b border-border/60 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSearchOpen(false)}>
                <ArrowLeft className="size-5" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  placeholder="Search all files…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-10 pr-8 h-10 rounded-xl bg-background/50 border-border/50"
                />
                {q && (
                  <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop: single row (h-14) */}
      <div className="hidden md:flex items-center gap-2 px-5 h-14">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-0.5 text-sm min-w-0 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {breadcrumbs.map((c, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <motion.div key={`${c.id ?? "root"}-${i}`} layout initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />}
                  <button onClick={() => navigateTo(c.id, c.name)} className={cn("px-2.5 py-1 rounded-lg truncate max-w-[180px] transition-colors", last ? "text-foreground font-medium bg-brand/10" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")} aria-current={last ? "page" : undefined}>{c.name}</button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </nav>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative w-56 lg:w-72 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-brand" />
          <Input placeholder="Search all files…" value={q} onChange={(e) => setQ(e.target.value)} className={cn("pl-9 pr-8 h-9 rounded-xl bg-background/50 backdrop-blur-md border-border/50 transition-all", "focus-visible:border-brand/40 focus-visible:bg-background/80 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--brand)_8%,transparent)]")} aria-label="Search files" />
          {q && <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear search"><X className="size-3.5" /></button>}
        </div>
        {/* Sort */}
        <Select value={sortKey} onValueChange={(v) => setSort(v)}>
          <SelectTrigger size="sm" className="h-9 w-[130px] rounded-xl bg-background/50 backdrop-blur-md border-border/50 hover:bg-background/80 hover:border-brand/30 transition-colors shrink-0">
            <span className="text-muted-foreground text-xs">Sort:</span><SelectValue /><ChevronDown className="size-3.5 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="size">Size {sortKey === "size" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="createdAt">Created {sortKey === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="modified">Modified {sortKey === "modified" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle */}
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "grid" | "list")} className="inline-flex rounded-xl bg-background/50 backdrop-blur-md border border-border/50 p-0.5 shrink-0">
          <ToggleGroupItem value="grid" aria-label="Grid view" className={cn("size-8 rounded-lg border-0 transition-all", viewMode === "grid" ? "bg-brand-gradient text-brand-foreground shadow-sm shadow-brand/20" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="size-4" /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className={cn("size-8 rounded-lg border-0 transition-all", viewMode === "list" ? "bg-brand-gradient text-brand-foreground shadow-sm shadow-brand/20" : "text-muted-foreground hover:text-foreground")}><List className="size-4" /></ToggleGroupItem>
        </ToggleGroup>
        {mounted && <Button variant="ghost" size="icon" className="btn-premium relative rounded-full hover:bg-accent/50" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="btn-premium relative size-9 rounded-full ring-1 ring-border/60 overflow-hidden flex items-center justify-center text-xs font-semibold text-white shrink-0 hover:ring-brand/50 hover:ring-2" style={{ background: user ? avatarGradient(user.telegramId || user.phone || user.id) : undefined }} aria-label="User menu">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="size-full object-cover" />
              ) : (
                (user?.name || user?.telegramUsername || "U").slice(0, 1).toUpperCase()
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal"><div className="flex flex-col gap-1"><div className="text-sm font-medium leading-none">{user?.name || "TriVE user"}</div><div className="text-xs text-muted-foreground">{user?.telegramUsername ? `@${user.telegramUsername}` : (user?.phone || user?.telegramId)}</div></div></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("settings")}><UserIcon className="size-4" />Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("settings")}><SettingsIcon className="size-4" />Settings</DropdownMenuItem>
            {mounted && <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}Toggle theme</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} variant="destructive"><LogOut className="size-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile: 2-row layout */}
      {/* Row 1: menu / back / breadcrumb / search icon */}
      <div className="flex md:hidden items-center gap-1.5 px-3 h-12">
        <Button variant="ghost" size="icon" className="btn-premium relative rounded-full shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu className="size-5" /></Button>
        {breadcrumbs.length > 1 && (
          <Button variant="ghost" size="icon" className="btn-premium relative rounded-full shrink-0" onClick={() => { const prev = breadcrumbs[breadcrumbs.length - 2]; if (prev) navigateTo(prev.id, prev.name) }} aria-label="Go back"><ArrowLeft className="size-5" /></Button>
        )}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{breadcrumbs[breadcrumbs.length - 1]?.name || "My Files"}</span>
          {breadcrumbs.length > 1 && <span className="text-[10px] text-muted-foreground shrink-0">({breadcrumbs.length - 1})</span>}
        </div>
        <Button variant="ghost" size="icon" className="btn-premium relative rounded-full shrink-0" onClick={() => setSearchOpen(true)} aria-label="Search"><Search className="size-5" /></Button>
      </div>

      {/* Row 2: sort / view toggle / theme / profile */}
      <div className="flex md:hidden items-center gap-1.5 px-3 h-11 border-t border-border/40">
        {/* Sort — compact icon only */}
        <Select value={sortKey} onValueChange={(v) => setSort(v)}>
          <SelectTrigger size="sm" className="h-8 w-auto rounded-lg bg-background/50 backdrop-blur-md border-border/50 hover:bg-background/80 hover:border-brand/30 shrink-0">
            <ArrowUpDown className="size-3.5" />
            <ChevronDown className="size-3 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="size">Size {sortKey === "size" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="createdAt">Created {sortKey === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
            <SelectItem value="modified">Modified {sortKey === "modified" ? (sortDir === "asc" ? "↑" : "↓") : ""}</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle */}
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "grid" | "list")} className="inline-flex rounded-lg bg-background/50 backdrop-blur-md border border-border/50 p-0.5 shrink-0">
          <ToggleGroupItem value="grid" aria-label="Grid" className={cn("size-7 rounded-md border-0 transition-all", viewMode === "grid" ? "bg-brand-gradient text-brand-foreground shadow-sm shadow-brand/20" : "text-muted-foreground")}><LayoutGrid className="size-3.5" /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List" className={cn("size-7 rounded-md border-0 transition-all", viewMode === "list" ? "bg-brand-gradient text-brand-foreground shadow-sm shadow-brand/20" : "text-muted-foreground")}><List className="size-3.5" /></ToggleGroupItem>
        </ToggleGroup>
        <div className="flex-1" />
        {mounted && <Button variant="ghost" size="icon" className="btn-premium relative rounded-full hover:bg-accent/50 size-8 shrink-0" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="btn-premium relative size-8 rounded-full ring-1 ring-border/60 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-white shrink-0 hover:ring-brand/50 hover:ring-2" style={{ background: user ? avatarGradient(user.telegramId || user.phone || user.id) : undefined }} aria-label="User menu">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="size-full object-cover" />
              ) : (
                (user?.name || user?.telegramUsername || "U").slice(0, 1).toUpperCase()
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal"><div className="flex flex-col gap-1"><div className="text-sm font-medium leading-none">{user?.name || "TriVE user"}</div><div className="text-xs text-muted-foreground">{user?.telegramUsername ? `@${user.telegramUsername}` : (user?.phone || user?.telegramId)}</div></div></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("settings")}><UserIcon className="size-4" />Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("settings")}><SettingsIcon className="size-4" />Settings</DropdownMenuItem>
            {mounted && <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}Toggle theme</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} variant="destructive"><LogOut className="size-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
