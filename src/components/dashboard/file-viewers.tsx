"use client"

/**
 * File viewers — shared by the in-app preview dialog and the public share view.
 *
 * Each viewer fetches the file as a Blob, creates an object URL, and renders
 * the content. This prevents the browser from triggering a download (which
 * happens when using the API URL directly with certain content types).
 */

import * as React from "react"
import { motion } from "framer-motion"
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileIcon } from "./_shared"
import { fileCategory, formatBytes } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

// --- Types -----------------------------------------------------------------

export interface ViewerMeta {
  name: string
  mimeType: string
  size?: number
  downloadUrl?: string
}

export type ViewerKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "code"
  | "text"
  | "markdown"
  | "docx"
  | "doc"
  | "unknown"

/** Pick a viewer kind from a filename + mime. */
export function pickViewerKind(name: string, mime: string): ViewerKind {
  const category = fileCategory(mime)
  if (category === "image") return "image"
  if (category === "video") return "video"
  if (category === "audio") return "audio"
  if (category === "pdf" || mime === "application/pdf") return "pdf"
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.toLowerCase().endsWith(".docx"))
    return "docx"
  if (mime === "application/msword" || name.toLowerCase().endsWith(".doc"))
    return "doc"
  if (name.toLowerCase().endsWith(".md") || mime === "text/markdown")
    return "markdown"
  if (category === "code") return "code"
  if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml" || mime === "application/yaml")
    return "text"
  return "unknown"
}

// --- Shared chrome ---------------------------------------------------------

function ViewerShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-full h-full min-h-[280px] overflow-auto rounded-lg glass", className)}>
      {children}
    </div>
  )
}

function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Loader2 className="size-6 animate-spin text-brand" />
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function ErrorState({ message = "Couldn't load this file", onRetry, downloadUrl }: { message?: string; onRetry?: () => void; downloadUrl?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
      <div className="size-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
        <AlertCircle className="size-5" />
      </div>
      <div className="text-sm font-medium">{message}</div>
      <div className="flex gap-2 mt-1">
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
        {downloadUrl && (
          <Button asChild size="sm" className="gap-1.5">
            <a href={downloadUrl} download><Download className="size-3.5" />Download</a>
          </Button>
        )}
      </div>
    </div>
  )
}

// --- Blob fetcher: fetches URL → Blob → Object URL (prevents browser download) ---

const blobCache = new Map<string, string>() // url → objectUrl

function useBlobUrl(url: string): { objUrl: string | null; loading: boolean; error: string | null; reload: () => void } {
  const [objUrl, setObjUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    const cached = blobCache.get(url)
    if (cached) {
      setObjUrl(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        const obj = URL.createObjectURL(blob)
        blobCache.set(url, obj)
        setObjUrl(obj)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load")
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [url, reloadKey])

  return { objUrl, loading, error, reload: () => setReloadKey((k) => k + 1) }
}

// --- PDF viewer (iframe with blob URL) -------------------------------------

export function PdfViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const { objUrl, loading, error, reload } = useBlobUrl(url)

  if (loading) return <ViewerShell><LoadingState label="Loading PDF…" /></ViewerShell>
  if (error || !objUrl) {
    return (
      <ViewerShell>
        <ErrorState message="Couldn't load this PDF" onRetry={reload} downloadUrl={meta.downloadUrl} />
      </ViewerShell>
    )
  }
  return (
    <ViewerShell className="p-0">
      <iframe src={objUrl} title={meta.name} className="w-full h-full min-h-[60vh] border-0 bg-white" />
    </ViewerShell>
  )
}

// --- Code viewer -----------------------------------------------------------

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  mjs: "javascript", cjs: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  kt: "kotlin", swift: "swift", c: "c", h: "c", cpp: "cpp", cc: "cpp",
  hpp: "cpp", cs: "csharp", php: "php", sh: "bash", bash: "bash",
  zsh: "bash", fish: "bash", yml: "yaml", yaml: "yaml",
  json: "json", xml: "xml", html: "markup", htm: "markup",
  css: "css", scss: "scss", sass: "sass", less: "less",
  sql: "sql", graphql: "graphql", toml: "ini", ini: "ini",
  dockerfile: "docker", md: "markdown", txt: "text",
  lua: "lua", r: "r", dart: "dart", scala: "scala", ex: "elixir",
  exs: "elixir", erl: "erlang", clj: "clojure", cljs: "clojure",
  vim: "vim", ps1: "powershell", ps: "powershell",
  vue: "markup", svelte: "markup",
}

function detectLanguage(name: string, mime: string): string {
  const lower = name.toLowerCase()
  if (lower === "dockerfile") return "docker"
  if (lower === "makefile" || lower === "gnumakefile") return "makefile"
  const ext = lower.split(".").pop() || ""
  if (EXT_TO_LANG[ext]) return EXT_TO_LANG[ext]
  if (mime.includes("typescript")) return "typescript"
  if (mime.includes("javascript")) return "javascript"
  if (mime.includes("python")) return "python"
  if (mime.includes("json")) return "json"
  if (mime.includes("xml")) return "xml"
  if (mime.includes("yaml")) return "yaml"
  if (mime.includes("html")) return "markup"
  if (mime.includes("css")) return "css"
  if (mime.includes("shell") || mime.includes("bash")) return "bash"
  return "text"
}

export function CodeViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const [state, setState] = React.useState<{ kind: "loading" } | { kind: "ready"; text: string } | { kind: "error"; message: string }>({ kind: "loading" })
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    fetch(url)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text() })
      .then((text) => { if (!cancelled) setState({ kind: "ready", text }) })
      .catch((e) => { if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" }) })
    return () => { cancelled = true }
  }, [url, reloadKey])

  if (state.kind === "loading") return <ViewerShell><LoadingState label="Loading code…" /></ViewerShell>
  if (state.kind === "error") return <ViewerShell><ErrorState message={state.message} onRetry={() => setReloadKey((k) => k + 1)} downloadUrl={meta.downloadUrl} /></ViewerShell>

  const lang = detectLanguage(meta.name, meta.mimeType)
  return (
    <ViewerShell className="p-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/30">
        <span className="text-xs font-mono text-muted-foreground">{lang}</span>
        <span className="text-xs text-muted-foreground">{state.text.split("\n").length} lines</span>
      </div>
      <div className="max-h-[70vh] overflow-auto scrollbar-thin p-4 font-mono text-[13px] leading-relaxed bg-black/20">
        <pre className="grid grid-cols-[auto_1fr] gap-x-4">
          {state.text.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              <span className="text-right select-none opacity-40 text-xs">{i + 1}</span>
              <span className="whitespace-pre-wrap break-all">{line || " "}</span>
            </React.Fragment>
          ))}
        </pre>
      </div>
    </ViewerShell>
  )
}

// --- Text viewer -----------------------------------------------------------

export function TextViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const [state, setState] = React.useState<{ kind: "loading" } | { kind: "ready"; text: string } | { kind: "error"; message: string }>({ kind: "loading" })
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    fetch(url)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text() })
      .then((text) => { if (!cancelled) setState({ kind: "ready", text }) })
      .catch((e) => { if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" }) })
    return () => { cancelled = true }
  }, [url, reloadKey])

  if (state.kind === "loading") return <ViewerShell><LoadingState label="Loading text…" /></ViewerShell>
  if (state.kind === "error") return <ViewerShell><ErrorState message={state.message} onRetry={() => setReloadKey((k) => k + 1)} downloadUrl={meta.downloadUrl} /></ViewerShell>

  return (
    <ViewerShell className="p-6">
      <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">{state.text}</pre>
    </ViewerShell>
  )
}

// --- Markdown viewer -------------------------------------------------------

export function MarkdownViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const [state, setState] = React.useState<{ kind: "loading" } | { kind: "ready"; text: string } | { kind: "error"; message: string }>({ kind: "loading" })
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    fetch(url)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text() })
      .then((text) => { if (!cancelled) setState({ kind: "ready", text }) })
      .catch((e) => { if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" }) })
    return () => { cancelled = true }
  }, [url, reloadKey])

  if (state.kind === "loading") return <ViewerShell><LoadingState label="Loading markdown…" /></ViewerShell>
  if (state.kind === "error") return <ViewerShell><ErrorState message={state.message} onRetry={() => setReloadKey((k) => k + 1)} downloadUrl={meta.downloadUrl} /></ViewerShell>

  return (
    <ViewerShell className="p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{state.text}</ReactMarkdown>
      </div>
    </ViewerShell>
  )
}

// --- Docx viewer (mammoth) -------------------------------------------------

export function DocxViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const [state, setState] = React.useState<{ kind: "loading" } | { kind: "ready"; html: string } | { kind: "error"; message: string }>({ kind: "loading" })
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: "loading" })
    ;(async () => {
      try {
        const [mammothMod, buf] = await Promise.all([
          (Function('return import("mammoth")')() as Promise<any>).catch(() => null),
          fetch(url).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer() }),
        ])
        if (cancelled) return
        if (!mammothMod) throw new Error("Document preview unavailable. Please download the file to view.")
        const mammoth = mammothMod.default || mammothMod
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (cancelled) return
        setState({ kind: "ready", html: result.value })
      } catch (e) {
        if (!cancelled) setState({ kind: "error", message: e instanceof Error ? e.message : "Couldn't convert document" })
      }
    })()
    return () => { cancelled = true }
  }, [url, reloadKey])

  if (state.kind === "loading") {
    return (
      <ViewerShell className="p-0">
        <div className="bg-white m-4 rounded-md shadow-sm p-8 min-h-[60vh]">
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-11/12" /><Skeleton className="h-3 w-10/12" />
            <div className="h-3" /><Skeleton className="h-3 w-9/12" /><Skeleton className="h-3 w-10/12" />
          </div>
        </div>
        <div className="absolute inset-x-0 top-3 flex items-center justify-center pointer-events-none">
          <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full glass-strong text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />Converting document…
          </div>
        </div>
      </ViewerShell>
    )
  }
  if (state.kind === "error") return <ViewerShell><ErrorState message={state.message} onRetry={() => setReloadKey((k) => k + 1)} downloadUrl={meta.downloadUrl} /></ViewerShell>

  return (
    <ViewerShell className="p-0">
      <div className="bg-white m-4 rounded-md shadow-sm overflow-hidden">
        <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: state.html }} />
      </div>
    </ViewerShell>
  )
}

// --- Legacy .doc viewer (download fallback) --------------------------------

export function LegacyDocViewer({ meta }: { url: string; meta: ViewerMeta }) {
  return (
    <ViewerShell>
      <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
        <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
          <FileText className="size-5" />
        </div>
        <div className="text-sm font-medium">Legacy .doc format</div>
        <div className="text-xs text-muted-foreground max-w-xs">
          .doc files can&apos;t be previewed in the browser. Download to view.
        </div>
        <Button asChild size="sm" className="gap-1.5 mt-1">
          <a href={meta.downloadUrl} download><Download className="size-3.5" />Download to view</a>
        </Button>
      </div>
    </ViewerShell>
  )
}

// --- Image viewer with zoom/pan (uses blob URL) ----------------------------

export function ImageViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const { objUrl, loading, error, reload } = useBlobUrl(url)
  const [zoom, setZoom] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const dragRef = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  if (loading) return <ViewerShell><LoadingState label="Loading image…" /></ViewerShell>
  if (error || !objUrl) return <ViewerShell><ErrorState message="Couldn't load this image" onRetry={reload} downloadUrl={meta.downloadUrl} /></ViewerShell>

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom === 1) return
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    setOffset({ x: dragRef.current.ox + (e.clientX - dragRef.current.x), y: dragRef.current.oy + (e.clientY - dragRef.current.y) })
  }
  const onPointerUp = () => { dragRef.current = null }

  return (
    <ViewerShell className="p-0 bg-black/5 overflow-hidden">
      <div
        className={cn("relative w-full h-full min-h-[280px] flex items-center justify-center select-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default")}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        <motion.img
          src={objUrl} alt={meta.name} draggable={false}
          className="max-h-[70vh] max-w-full object-contain will-change-transform"
          animate={{ scale: zoom, x: offset.x, y: offset.y }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 glass-strong rounded-full px-1.5 py-1">
        <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="size-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors" aria-label="Zoom out">
          <ZoomOut className="size-3.5" />
        </button>
        <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} className="size-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors" aria-label="Zoom in">
          <ZoomIn className="size-3.5" />
        </button>
      </div>
    </ViewerShell>
  )
}

// --- Audio viewer ----------------------------------------------------------

export function AudioViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const { objUrl, loading, error } = useBlobUrl(url)
  if (loading) return <ViewerShell><LoadingState label="Loading audio…" /></ViewerShell>
  if (error || !objUrl) return <ViewerShell><ErrorState message="Couldn't load this audio" downloadUrl={meta.downloadUrl} /></ViewerShell>

  return (
    <ViewerShell className="p-8 bg-background/40">
      <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
        <div className="size-16 rounded-2xl bg-brand/15 text-brand flex items-center justify-center">
          <FileIcon mime={meta.mimeType} size={32} />
        </div>
        <div className="text-sm font-medium truncate max-w-full">{meta.name}</div>
        <audio controls src={objUrl} className="w-full">Your browser does not support audio playback.</audio>
      </div>
    </ViewerShell>
  )
}

// --- Video viewer ----------------------------------------------------------

export function VideoViewer({ url, meta }: { url: string; meta: ViewerMeta }) {
  const { objUrl, loading, error } = useBlobUrl(url)
  if (loading) return <ViewerShell><LoadingState label="Loading video…" /></ViewerShell>
  if (error || !objUrl) return <ViewerShell><ErrorState message="Couldn't load this video" downloadUrl={meta.downloadUrl} /></ViewerShell>

  return (
    <ViewerShell className="p-0 bg-black/40">
      <video controls src={objUrl} className="w-full max-h-[72vh] object-contain">Your browser does not support video playback.</video>
    </ViewerShell>
  )
}

// --- Unknown file viewer ---------------------------------------------------

export function UnknownViewer({ meta }: { url: string; meta: ViewerMeta }) {
  return (
    <ViewerShell>
      <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
        <div className="size-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
          <FileIcon mime={meta.mimeType} size={32} />
        </div>
        <div className="text-sm font-medium truncate max-w-full">{meta.name}</div>
        {meta.size !== undefined && <div className="text-xs text-muted-foreground">{formatBytes(meta.size)}</div>}
        <div className="text-xs text-muted-foreground max-w-xs">
          This file type can&apos;t be previewed in the browser.
        </div>
        {meta.downloadUrl && (
          <Button asChild size="sm" className="gap-1.5 mt-1">
            <a href={meta.downloadUrl} download><Download className="size-3.5" />Download to view</a>
          </Button>
        )}
      </div>
    </ViewerShell>
  )
}

// --- Dispatcher ------------------------------------------------------------

export function FileViewerDispatcher({ url, meta }: { url: string; meta: ViewerMeta }) {
  const kind = pickViewerKind(meta.name, meta.mimeType)
  switch (kind) {
    case "image": return <ImageViewer url={url} meta={meta} />
    case "video": return <VideoViewer url={url} meta={meta} />
    case "audio": return <AudioViewer url={url} meta={meta} />
    case "pdf": return <PdfViewer url={url} meta={meta} />
    case "code": return <CodeViewer url={url} meta={meta} />
    case "text": return <TextViewer url={url} meta={meta} />
    case "markdown": return <MarkdownViewer url={url} meta={meta} />
    case "docx": return <DocxViewer url={url} meta={meta} />
    case "doc": return <LegacyDocViewer url={url} meta={meta} />
    default: return <UnknownViewer url={url} meta={meta} />
  }
}
