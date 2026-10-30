// TriVE Service Worker — PWA offline support + native app feel
// Caches the app shell for instant loads and offline use.

const CACHE_NAME = "trive-v1"
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/trive-mark-trimmed.png",
  "/trive-logo.png",
  "/trive-logo-light.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
]

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
// - Navigation requests: network-first, fall back to cached "/" for offline
// - Static assets (_next/static, images): cache-first
// - API requests: network-only (never cache — live data)
self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Skip non-GET
  if (req.method !== "GET") return

  // Skip cross-origin
  if (url.origin !== self.location.origin) return

  // API requests: network-only
  if (url.pathname.startsWith("/api/")) return

  // Navigation requests: network-first with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match("/").then((r) => r || caches.match("/")))
    )
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => cached)
    })
  )
})
