import type { FileItem, Folder } from "./types"

export const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB per chunk (Telegram allows up to 2GB/4GB; smaller = smoother UI streaming + safer rate limits)
export const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024 // 4GB hard ceiling

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes
  if (!n || n < 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const val = n / Math.pow(1024, i)
  return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(val < 10 ? 2 : 1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" })
}

export function fileCategory(mime: string): "image" | "video" | "audio" | "document" | "archive" | "code" | "pdf" | "spreadsheet" | "presentation" | "other" {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf") return "pdf"
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "spreadsheet"
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation"
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("gzip") || mime.includes("7z")) return "archive"
  if (mime.includes("json") || mime.includes("javascript") || mime.includes("typescript") || mime.includes("text/") || mime.includes("xml") || mime.includes("yaml") || mime.includes("x-python") || mime.includes("x-sh")) return "code"
  if (mime.includes("word") || mime.includes("document") || mime === "text/plain") return "document"
  return "other"
}

export function fileIcon(category: ReturnType<typeof fileCategory>): string {
  switch (category) {
    case "image": return "Image"
    case "video": return "Film"
    case "audio": return "Music"
    case "pdf": return "FileText"
    case "spreadsheet": return "Table"
    case "presentation": return "MonitorPlay"
    case "archive": return "Archive"
    case "code": return "Code2"
    case "document": return "FileType"
    default: return "File"
  }
}

export const CATEGORY_COLORS: Record<string, string> = {
  image: "oklch(0.65 0.18 162)",
  video: "oklch(0.6 0.22 350)",
  audio: "oklch(0.62 0.18 70)",
  pdf: "oklch(0.58 0.24 27)",
  spreadsheet: "oklch(0.6 0.16 162)",
  presentation: "oklch(0.6 0.2 25)",
  archive: "oklch(0.55 0.05 280)",
  code: "oklch(0.6 0.18 295)",
  document: "oklch(0.55 0.16 220)",
  other: "oklch(0.6 0.05 280)",
}

export function sortItems(items: (FileItem | Folder)[], key: string, dir: "asc" | "desc" = "asc"): (FileItem | Folder)[] {
  const mul = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    // folders always first
    const aFolder = "parentId" in a
    const bFolder = "parentId" in b
    if (aFolder !== bFolder) return aFolder ? -1 : 1
    let av: string | number, bv: string | number
    switch (key) {
      case "size":
        av = "size" in a ? Number(a.size) : 0
        bv = "size" in b ? Number(b.size) : 0
        break
      case "createdAt":
        av = new Date(a.createdAt).getTime()
        bv = new Date(b.createdAt).getTime()
        break
      case "modified":
        av = new Date(a.updatedAt).getTime()
        bv = new Date(b.updatedAt).getTime()
        break
      default:
        av = a.name.toLowerCase()
        bv = b.name.toLowerCase()
    }
    if (av < bv) return -1 * mul
    if (av > bv) return 1 * mul
    return 0
  })
}

export function avatarGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `linear-gradient(135deg, oklch(0.65 0.2 ${hue}), oklch(0.6 0.22 ${(hue + 50) % 360}))`
}
