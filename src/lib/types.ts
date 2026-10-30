// Shared domain types for TriVE VFS

export interface User {
  id: string
  telegramId: string
  phone: string | null
  name: string | null
  telegramUsername: string | null
  customUsername?: string | null
  hasDavPassword?: boolean
  davUsername?: string
  avatarColor: string | null
  avatarUrl?: string | null
  authMethod?: string
  botChatId?: string | null
  vaultReady: boolean
  telegramConnected: boolean
  botConnected?: boolean
  createdAt: string
  needsVault?: boolean
  needsScan?: boolean
}

/** Full sign-in response shape (Task 24 — backend now returns these flags). */
export interface SignInResponse {
  user: User
  vaultReady: boolean
  needsVault: boolean
  needsScan: boolean
  fileCount: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  color: string | null
  icon: string | null
  starred: boolean
  trashed: boolean
  fileCount?: number
  folderCount?: number
  createdAt: string
  updatedAt: string
}

export interface FileItem {
  id: string
  name: string
  mimeType: string
  size: number
  encrypted: boolean
  isChunked: boolean
  totalChunks: number
  starred: boolean
  trashed: boolean
  thumbnail: string | null
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export type ItemType = "file" | "folder"
export type SortKey = "name" | "size" | "createdAt" | "modified"
export type ViewMode = "grid" | "list"

export interface ShareLink {
  id: string
  token: string
  customSlug: string | null
  fileId: string | null
  folderId: string | null
  hasPassword: boolean
  expiresAt: string | null
  downloadCount: number
  maxDownloads: number | null
  viewCount: number
  maxViews: number | null
  viewOnly: boolean
  emailGate: boolean
  accessIps: boolean // whether an IP allowlist is set (bool for safety)
  allowedEmails: string | null // raw allowlist (comma-separated emails) — null if not set
  viewerEmails: string[] // list of unique emails that have accessed (empty if emailGate=false or no accesses yet)
  lastAccessedAt: string | null
  createdAt: string
  item?: { name: string; size: number; mimeType: string }
}

export interface PublicShare {
  id?: string
  token: string
  customSlug?: string | null
  item: {
    type: "file" | "folder"
    name: string
    size?: number
    mimeType?: string
    fileCount?: number
    totalSize?: number
    files?: { id: string; name: string; size: number; mimeType: string }[]
  } | null
  hasPassword: boolean
  expiresAt: string | null
  downloadCount: number
  maxDownloads: number | null
  viewCount: number
  maxViews: number | null
  viewOnly: boolean
  emailGate: boolean
  needsPassword: boolean
  needsEmail: boolean
  emailAllowed: boolean
  expired: boolean
  exhausted: boolean
  viewOnlyEnforced: boolean
  createdAt: string
}

export interface Activity {
  id: string
  action: string
  details: string
  createdAt: string
}

export interface StorageAnalytics {
  totalUsed: number
  fileCount: number
  folderCount: number
  byType: { type: string; label: string; size: number; count: number; color: string }[]
  recentActivity: Activity[]
  uploadTrend: { date: string; size: number }[]
}

export interface TelegramStatus {
  connected: boolean
  vaultReady: boolean
  simulationMode: boolean
  realMode: boolean
  phone?: string | null
  apiIdPresent: boolean
  botConfigured?: boolean
  botUsername?: string | null
}

// ---- Admin (Task 19) ----

export interface AdminStats {
  users: number
  files: number
  folders: number
  shares: number
  chunks: number
  activities: number
  totalStorage: number
  recentUsers: number
  trashedFiles: number
  activeShares: number
}

export interface AdminUser {
  id: string
  phone: string
  name: string | null
  vaultReady: boolean
  telegramConnected: boolean
  hasVault: boolean
  createdAt: string
  updatedAt: string
  _count: {
    files: number
    folders: number
    shareLinks: number
    activities: number
  }
}

export interface AdminFile {
  id: string
  name: string
  mimeType: string
  size: number
  encrypted: boolean
  isChunked: boolean
  totalChunks: number
  starred: boolean
  trashed: boolean
  checksum: string | null
  createdAt: string
  updatedAt: string
  lastAccessedAt: string | null
  user: { id: string; phone: string; name: string | null }
  chunkCount: number
  shareCount: number
}

export interface AdminShare {
  id: string
  token: string
  customSlug: string | null
  hasPassword: boolean
  expiresAt: string | null
  downloadCount: number
  maxDownloads: number | null
  viewCount: number
  maxViews: number | null
  viewOnly: boolean
  emailGate: boolean
  accessIps: boolean
  lastAccessedAt: string | null
  createdAt: string
  user: { id: string; phone: string; name: string | null } | null
  file: { id: string; name: string; size: number; mimeType: string } | null
  expired: boolean
}

export interface AdminActivity {
  id: string
  userId: string | null
  action: string
  details: string | null
  createdAt: string
  user: { id: string; phone: string; name: string | null } | null
}

export interface AdminDbInfo {
  dbSize: number
  vaultDirSize: number
  telegramHealth: {
    ok?: boolean
    simulation?: boolean
    realMode?: boolean
    apiIdPresent?: boolean
    vaultName?: string
  } | null
  envInfo: Record<string, string>
  uptime: number
  memoryUsage: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    arrayBuffers: number
  }
  nodeVersion: string
  platform: string
  timestamp: string
}

export interface AdminTelegramHealth {
  ok?: boolean
  simulation?: boolean
  realMode?: boolean
  apiIdPresent?: boolean
  vaultName?: string
}
