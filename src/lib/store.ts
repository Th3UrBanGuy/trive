"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { FileItem, Folder, User } from "./types"

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
    }),
    { name: "tc_auth" }
  )
)


type View = "myfiles" | "files" | "recent" | "starred" | "shared" | "trash" | "analytics" | "settings"

interface UIState {
  view: View
  setView: (v: View) => void
  sidebarOpen: boolean
  setSidebarOpen: (b: boolean) => void
  uploadOpen: boolean
  setUploadOpen: (b: boolean) => void
  newFolderOpen: boolean
  setNewFolderOpen: (b: boolean) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void
  contextItem: FileItem | Folder | null
  setContextItem: (i: FileItem | Folder | null) => void
  search: string
  setSearch: (s: string) => void
  sortKey: string
  sortDir: "asc" | "desc"
  setSort: (k: string) => void
  viewMode: "grid" | "list"
  setViewMode: (m: "grid" | "list") => void
  theme: "light" | "dark"
  toggleTheme: () => void
  isVaultScanning: boolean
  setVaultScanning: (b: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      view: "myfiles",
      setView: (view) => set({ view, selected: new Set() }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      uploadOpen: false,
      setUploadOpen: (uploadOpen) => set({ uploadOpen }),
      newFolderOpen: false,
      setNewFolderOpen: (newFolderOpen) => set({ newFolderOpen }),
      selected: new Set(),
      setSelected: (selected) => set({ selected }),
      toggleSelected: (id) => {
        const s = new Set(get().selected)
        if (s.has(id)) s.delete(id)
        else s.add(id)
        set({ selected: s })
      },
      clearSelected: () => set({ selected: new Set() }),
      contextItem: null,
      setContextItem: (contextItem) => set({ contextItem }),
      search: "",
      setSearch: (search) => set({ search }),
      sortKey: "name",
      sortDir: "asc",
      setSort: (k) => set({ sortKey: k, sortDir: get().sortKey === k ? (get().sortDir === "asc" ? "desc" : "asc") : "asc" }),
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),
      theme: "dark",
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      isVaultScanning: false,
      setVaultScanning: (isVaultScanning) => set({ isVaultScanning }),
    }),
    {
      name: "tc-ui",
      partialize: (s) => ({ viewMode: s.viewMode, theme: s.theme, sortKey: s.sortKey, sortDir: s.sortDir }) as any,
    }
  )
)

interface NavState {
  currentFolderId: string | null
  breadcrumbs: { id: string | null; name: string }[]
  navigateTo: (folderId: string | null, name?: string) => void
  descend: (folder: Folder) => void
  reset: () => void
}

export const useNavStore = create<NavState>()((set, get) => ({
  currentFolderId: null,
  breadcrumbs: [{ id: null, name: "My Files" }],
  navigateTo: (folderId) => set({ currentFolderId: folderId, breadcrumbs: [{ id: null, name: "My Files" }] }),
  descend: (folder) => {
    const crumbs = get().breadcrumbs
    const idx = crumbs.findIndex((c) => c.id === folder.id)
    if (idx >= 0) {
      set({ currentFolderId: folder.id, breadcrumbs: crumbs.slice(0, idx + 1) })
    } else {
      set({ currentFolderId: folder.id, breadcrumbs: [...crumbs, { id: folder.id, name: folder.name }] })
    }
  },
  reset: () => set({ currentFolderId: null, breadcrumbs: [{ id: null, name: "My Files" }] }),
}))

// Upload progress tracking
interface UploadItem {
  id: string
  name: string
  size: number
  progress: number
  status: "uploading" | "done" | "error"
  error?: string
}
interface UploadState {
  items: UploadItem[]
  add: (item: UploadItem) => void
  update: (id: string, patch: Partial<UploadItem>) => void
  remove: (id: string) => void
  clear: () => void
  isOpen: boolean
  setOpen: (b: boolean) => void
}
export const useUploadStore = create<UploadState>()((set, get) => ({
  items: [],
  isOpen: false,
  add: (item) => set({ items: [...get().items, item], isOpen: true }),
  update: (id, patch) => set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
  remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
  clear: () => set({ items: [] }),
  setOpen: (isOpen) => set({ isOpen }),
}))
