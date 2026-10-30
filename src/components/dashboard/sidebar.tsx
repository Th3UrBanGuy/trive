"use client"

import * as React from "react"
import { v4 as uuid } from "uuid"
import {
  BarChart3,
  Clock,
  Files,
  FolderPlus,
  HardDrive,
  Home,
  Settings,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Wordmark } from "@/components/brand"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUIStore, useUploadStore, useNavStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/file-utils"
import { useStorage, useTelegramStatus } from "./use-storage"
import { enqueueUpload } from "./upload-panel"
import { WebdavDialog } from "./webdav-dialog"

type View = "myfiles" | "files" | "recent" | "starred" | "shared" | "trash" | "analytics" | "settings"

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "myfiles", label: "My Files", icon: Home },
  { id: "files", label: "Files", icon: Files },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "starred", label: "Starred", icon: Star },
  { id: "shared", label: "Shared", icon: Share2 },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "analytics", label: "Storage", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
]

function ConnectionBadge() {
  const { data } = useTelegramStatus()
  const connected = !!data?.connected
  return (
    <div className="glass relative rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      <span className="relative inline-flex shrink-0">
        <span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        {connected && <span className="absolute inset-0 rounded-full animate-ping opacity-60 bg-emerald-500" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium leading-tight">
          {connected ? "Connected" : "Disconnected"}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight">
          {connected ? "Vault active" : "Not connected"}
        </div>
      </div>
    </div>
  )
}

function StorageCard() {
  const { data } = useStorage()
  const used = data?.totalUsed ?? 0
  const files = data?.fileCount ?? 0
  // Visualize against a soft 50GB reference (since storage is "unlimited")
  const pct = Math.min(100, (used / (50 * 1024 * 1024 * 1024)) * 100)
  return (
    <div className="glass relative rounded-xl p-3.5">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="eyebrow inline-flex items-center gap-1.5">
          <HardDrive className="size-3.5" />
          Storage
        </span>
        <span className="font-medium tabular-nums">{formatBytes(used)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden">
        {/* Brand gradient fill with a slow shimmer for a "live" premium feel. */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full animate-shimmer"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {files} file{files === 1 ? "" : "s"} • of unlimited
      </div>
    </div>
  )
}

function NewButton() {
  const setUploadOpen = useUIStore((s) => s.setUploadOpen)
  const setNewFolderOpen = useUIStore((s) => s.setNewFolderOpen)
  const addUpload = useUploadStore((s) => s.add)
  const currentFolderId = useNavStore((s) => s.currentFolderId)
  const view = useUIStore((s) => s.view)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const startUploads = (files: File[]) => {
    // Upload to current folder only if view is myfiles; otherwise root.
    const folderId = view === "myfiles" ? currentFolderId : null
    for (const file of files) {
      const id = uuid()
      addUpload({
        id,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
      })
      enqueueUpload(file, folderId, id)
    }
    setUploadOpen(true)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length) startUploads(files)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="btn-premium relative w-full h-10 rounded-xl gap-1.5 bg-brand-gradient">
            <FolderPlus className="size-4" />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="size-4" />
            New folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const view = useUIStore((s) => s.view)
  const setView = useUIStore((s) => s.setView)
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      <div className="eyebrow px-3 mb-1">Library</div>
      {NAV.map((item) => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => {
              setView(item.id)
              onNavigate?.()
            }}
            className={cn(
              "group relative flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-sm transition-all text-left",
              active
                ? "bg-brand/10 text-brand font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            aria-current={active ? "page" : undefined}
          >
            {/* Left-edge brand gradient bar — slides in with expo-out on the active item. */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-gradient transition-all duration-300",
                active
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-1"
              )}
              style={{ transitionTimingFunction: "var(--ease-premium)" }}
            />
            <item.icon
              className={cn(
                "size-4 transition-colors",
                active
                  ? "text-brand"
                  : "text-muted-foreground/80 group-hover:text-foreground"
              )}
            />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function MountDriveButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-brand/25 bg-brand/5 hover:bg-brand/10 transition-all text-xs font-medium text-foreground group text-left"
      >
        <span className="flex items-center gap-2">
          <HardDrive className="size-4 text-brand group-hover:scale-110 transition-transform" />
          Mount as Drive (PC/Mac)
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand font-semibold">
          WebDAV
        </span>
      </button>
      <WebdavDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full gap-4 p-3">
      <div className="px-2 py-2">
        <Wordmark />
      </div>
      <NewButton />
      <div className="flex-1 overflow-y-auto scrollbar-thin -mx-1 px-1">
        <NavItems onNavigate={onNavigate} />
      </div>
      <MountDriveButton />
      <ConnectionBadge />
      <StorageCard />
    </div>
  )
}

export function Sidebar() {
  // Desktop-only static sidebar.
  //   - `hidden md:flex` so mobile uses the Sheet (MobileSidebar) instead.
  //   - `self-stretch` (instead of h-screen) so the sidebar matches the parent
  //     flex container's height — sticky top-0 then keeps it pinned on scroll.
  //   - `sticky top-0` keeps it in view as the page scrolls vertically.
  //   - `shrink-0` prevents flexbox from squishing it when the main panel grows.
  return (
    <aside
      className="hidden md:flex w-64 shrink-0 self-stretch sticky top-0 flex-col glass-strong bg-noise border-r h-screen"
      style={{ borderRightColor: "color-mix(in oklch, var(--brand) 10%, var(--border))" }}
      aria-label="Primary navigation"
    >
      <SidebarBody />
    </aside>
  )
}

export function MobileSidebar() {
  const open = useUIStore((s) => s.sidebarOpen)
  const setOpen = useUIStore((s) => s.setSidebarOpen)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 p-0 glass-strong bg-noise">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="relative pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="btn-premium absolute top-2 right-2 rounded-full size-8 z-10"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
