/** Client-side API helpers + the Telegram service proxy. */

import type { FileItem, Folder, ShareLink, StorageAnalytics, TelegramStatus, User, Activity } from "./types"

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init?.headers as Record<string, string>)),
    },
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j.error || j.message || msg
    } catch {}
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) return res.json() as Promise<T>
  return (await res.text()) as unknown as T
}

export const api = {
  // ---- auth ----
  createBotAuthLink: () =>
    req<{ authKey: string; botUsername: string; deepLink: string }>("/api/auth/bot-link/", {
      method: "POST",
    }),
  pollBotAuth: (authKey: string) =>
    req<{ confirmed: boolean; user?: User }>(`/api/auth/bot-link/?authKey=${encodeURIComponent(authKey)}`),
  telegramSSO: (widgetData: any) =>
    req<{ user: User; vaultReady: boolean; needsVault: boolean; needsScan: boolean }>("/api/auth/sso/", {
      method: "POST",
      body: JSON.stringify({ widgetData }),
    }),
  telegramWebApp: (initData: string) =>
    req<{ user: User; vaultReady: boolean; needsVault: boolean; needsScan: boolean }>("/api/auth/sso/", {
      method: "POST",
      body: JSON.stringify({ initData }),
    }),
  telegramDevLogin: (devUser: any) =>
    req<{ user: User; vaultReady: boolean; needsVault: boolean; needsScan: boolean }>("/api/auth/sso/", {
      method: "POST",
      body: JSON.stringify({ devUser }),
    }),
  sendCode: (phone: string) => req<{ phoneCodeHash: string; simulation: boolean }>("/api/auth/send-code", { method: "POST", body: JSON.stringify({ phone }) }),
  signIn: (phone: string, code: string, phoneCodeHash: string, password?: string) =>
    req<{ user: User; vaultReady: boolean }>("/api/auth/sign-in", { method: "POST", body: JSON.stringify({ phone, code, phoneCodeHash, password }) }),
  logout: () => req<void>("/api/auth/logout", { method: "POST" }),
  me: () => req<User | null>("/api/auth/me"),

  // ---- telegram ----
  telegramStatus: () => req<TelegramStatus>("/api/telegram/status"),
  initVault: () => req<{ vaultReady: boolean; channelId: string }>("/api/telegram/vault/init", { method: "POST" }),
  vaultStatus: () => req<{ vaultReady: boolean; vaultChannelId: boolean; fileCount: number; needsVault: boolean; needsScan: boolean }>("/api/telegram/vault/status"),
  scanVault: () => req<{ scanned: number; added: number; skipped: number; errors: string[] }>("/api/telegram/vault/scan", { method: "POST" }),

  // ---- folders ----
  listFolders: (parentId?: string | null, search?: string) => {
    const q = new URLSearchParams()
    if (parentId) q.set("parentId", parentId)
    if (search) q.set("q", search)
    const qs = q.toString()
    return req<Folder[]>(`/api/folders${qs ? `?${qs}` : ""}`)
  },
  folderTree: () => req<Folder[]>(`/api/folders/tree`),
  createFolder: (name: string, parentId?: string | null, color?: string) =>
    req<Folder>("/api/folders", { method: "POST", body: JSON.stringify({ name, parentId, color }) }),
  renameFolder: (id: string, name: string) => req<Folder>(`/api/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteFolder: (id: string) => req<void>(`/api/folders/${id}`, { method: "DELETE" }),

  // ---- files ----
  listFiles: (params: { folderId?: string | null; starred?: boolean; trashed?: boolean; search?: string; all?: boolean }) => {
    const q = new URLSearchParams()
    if (params.folderId !== undefined) q.set("folderId", params.folderId ?? "root")
    if (params.starred) q.set("starred", "1")
    if (params.trashed) q.set("trashed", "1")
    if (params.search) q.set("q", params.search)
    if (params.all) q.set("all", "1")
    return req<FileItem[]>(`/api/files?${q.toString()}`)
  },
  uploadFile: (file: File, folderId: string | null, onProgress?: (pct: number) => void) => {
    return new Promise<FileItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `/api/files/upload?folderId=${folderId ?? "root"}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch (e) { reject(e) }
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error || xhr.statusText)) } catch { reject(new Error(xhr.statusText)) }
        }
      }
      xhr.onerror = () => reject(new Error("Network error"))
      const fd = new FormData()
      fd.append("file", file)
      xhr.send(fd)
    })
  },
  downloadUrl: (id: string) => `/api/files/${id}/download`,
  renameFile: (id: string, name: string) => req<FileItem>(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  toggleStar: (id: string, starred: boolean) => req<FileItem>(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify({ starred }) }),
  trashFile: (id: string) => req<FileItem>(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }),
  restoreFile: (id: string) => req<FileItem>(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify({ trashed: false }) }),
  deleteFile: (id: string) => req<void>(`/api/files/${id}`, { method: "DELETE" }),
  moveFile: (id: string, folderId: string | null) => req<FileItem>(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify({ folderId }) }),

  // ---- share ----
  createShare: (data: {
    fileId?: string
    folderId?: string
    password?: string
    expiresAt?: string | null
    maxDownloads?: number | null
    customSlug?: string
    viewOnly?: boolean
    maxViews?: number | null
    emailGate?: boolean
    allowedEmails?: string
    accessIps?: string
  }) => req<ShareLink>("/api/share", { method: "POST", body: JSON.stringify(data) }),
  createBatchShare: (data: { fileIds?: string[]; folderIds?: string[]; customSlug?: string; password?: string; expiresAt?: string | null; maxDownloads?: number | null; viewOnly?: boolean; maxViews?: number | null; emailGate?: boolean; allowedEmails?: string }) =>
    req<ShareLink>("/api/share/batch", { method: "POST", body: JSON.stringify(data) }),
  listShares: () => req<ShareLink[]>("/api/share"),
  deleteShare: (id: string) => req<void>(`/api/share/${id}`, { method: "DELETE" }),
  checkSlug: (slug: string) =>
    req<{ available: boolean; reason: string }>(`/api/share/check-slug?slug=${encodeURIComponent(slug)}`),
  // Public share download URL (supports ?inline=1 for embedding in viewers, ?password=, ?email=)
  shareDownloadUrl: (token: string, opts?: { inline?: boolean; password?: string; email?: string }) => {
    const q = new URLSearchParams()
    if (opts?.inline) q.set("inline", "1")
    if (opts?.password) q.set("password", opts.password)
    if (opts?.email) q.set("email", opts.email)
    const qs = q.toString()
    return `/api/share/${token}/download${qs ? `?${qs}` : ""}`
  },
  // Public share: download an individual file from a shared folder
  shareFileDownloadUrl: (token: string, fileId: string, opts?: { inline?: boolean; password?: string; email?: string }) => {
    const q = new URLSearchParams()
    q.set("fileId", fileId)
    if (opts?.inline) q.set("inline", "1")
    if (opts?.password) q.set("password", opts.password)
    if (opts?.email) q.set("email", opts.email)
    return `/api/share/${token}/download?${q.toString()}`
  },
  folderDownloadUrl: (id: string) => `/api/folders/${id}/download`,

  // ---- analytics / activity ----
  storage: () => req<StorageAnalytics>("/api/storage"),
  activity: () => req<Activity[]>("/api/activity"),

  // ---- settings ----
  updateProfile: (name: string) => req<User>("/api/settings", { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteAccount: () => req<void>("/api/settings", { method: "DELETE" }),

  // ---- webdav ----
  getDavCredentials: () =>
    req<{
      username: string
      telegramUsername: string | null
      customUsername: string | null
      hasPassword: boolean
      davPath: string
    }>("/api/settings/dav"),
  updateDavCredentials: (data: { username?: string; password?: string; generateRandom?: boolean }) =>
    req<{
      success: boolean
      username: string
      customUsername: string | null
      hasPassword: boolean
      password?: string
    }>("/api/settings/dav", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
