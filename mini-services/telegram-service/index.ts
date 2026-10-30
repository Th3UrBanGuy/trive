/**
 * TeleCloud Telegram MTProto mini-service.
 *
 * Runs on port 3001. Provides the storage primitives for the zero-knowledge VFS:
 *   - MTProto auth (send-code / sign-in / 2FA) via GramJS
 *   - Vault channel creation/lookup
 *   - Opaque blob upload / download / delete (the Next.js layer encrypts before
 *     sending; this service — like Telegram itself — only ever sees ciphertext)
 *
 * SIMULATION MODE: when TELEGRAM_API_ID is not set, the service runs fully
 * locally. Auth accepts code "12345", vault returns a fake channel id, and
 * blobs are stored on disk under ./storage. This makes the entire app
 * demonstrable end-to-end without real Telegram credentials. The moment real
 * api_id/api_hash are provided, the exact same HTTP contract is served by real
 * GramJS MTProto calls.
 */

import { createHash, randomBytes } from "crypto"
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "fs"
import { join, resolve } from "path"
import { fileURLToPath } from "url"

// Log + survive crashes so the supervisor isn't needed
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e))
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e))
process.on("SIGTERM", () => { console.log("[SIGTERM] received, exiting"); process.exit(0) })

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const STORAGE_DIR = resolve(__dirname, "storage")
mkdirSync(STORAGE_DIR, { recursive: true })

const PORT = Number(process.env.TELEGRAM_SERVICE_PORT) || 3001
const API_ID = process.env.TELEGRAM_API_ID ? Number(process.env.TELEGRAM_API_ID) : undefined
const API_HASH = process.env.TELEGRAM_API_HASH
const SIMULATION = !API_ID || !API_HASH

const VAULT_NAME = "TeleCloud_Storage_Vault"

// ---- GramJS lazy import (only loaded in real mode so simulation stays light) ----
let TelegramClient: any, StringSession: any, Api: any, Password: any
async function loadGram() {
  if (!TelegramClient) {
    const t = await import("telegram")
    TelegramClient = t.TelegramClient
    StringSession = (await import("telegram/sessions")).StringSession
    Api = await import("telegram")
    Password = await import("telegram/Password")
  }
}

// ---- In-flight auth state (phone -> { phoneCodeHash, code }) ----
interface PendingAuth {
  phoneCodeHash: string
  code: string
  ts: number
}
const pending = new Map<string, PendingAuth>()

// ---- GramJS client cache (sessionString -> connected client) ----
const clientCache = new Map<string, { client: any; ts: number }>()
const CLIENT_TTL = 5 * 60 * 1000

async function getClient(sessionString: string, apiId: number, apiHash: string) {
  await loadGram()
  const key = sessionString.slice(0, 32)
  const cached = clientCache.get(key)
  if (cached && Date.now() - cached.ts < CLIENT_TTL) {
    cached.ts = Date.now()
    if (!cached.client.connected) await cached.client.connect()
    return cached.client
  }
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
  })
  await client.connect()
  clientCache.set(key, { client, ts: Date.now() })
  return client
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex")
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
  })
}

function err(message: string, status = 400, extra: any = {}) {
  return json({ error: message, ...extra }, status)
}

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

// Parse a Telegram error for FloodWait seconds
function floodWaitSeconds(e: any): number | null {
  const msg = String(e?.message || e)
  const m = msg.match(/(\d+)\s*(seconds|sec|s)/i) || msg.match(/A wait of (\d+)/i)
  if (m) return Number(m[1])
  if (e?.seconds) return Number(e.seconds)
  return null
}

function is2FA(e: any): boolean {
  const msg = String(e?.errorMessage || e?.message || e)
  return msg.includes("SESSION_PASSWORD_NEEDED") || msg.toLowerCase().includes("2fa") || msg.toLowerCase().includes("password")
}

// =====================================================================
//  Simulation helpers
// =====================================================================
function simStoragePath(messageId: string): string {
  return join(STORAGE_DIR, `${messageId}.bin`)
}

function simMessageId(): string {
  return `sim_${Date.now()}_${randomBytes(4).toString("hex")}`
}

// =====================================================================
//  HTTP routing
// =====================================================================
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // CORS preflight
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "*", "access-control-allow-headers": "*" } })

    try {
      // ---------- health ----------
      if (path === "/health" && method === "GET") {
        return json({ ok: true, simulation: SIMULATION, apiIdPresent: !!API_ID, vaultName: VAULT_NAME })
      }

      // ---------- send-code ----------
      if (path === "/auth/send-code" && method === "POST") {
        const { phone, apiId, apiHash } = await readBody(req)
        if (!phone) return err("Phone required")

        if (SIMULATION) {
          const code = "12345"
          const phoneCodeHash = randomBytes(16).toString("hex")
          pending.set(phone, { phoneCodeHash, code, ts: Date.now() })
          console.log(`[sim] send-code ${phone} → code ${code} (hash ${phoneCodeHash.slice(0, 8)}…)`)
          return json({ phoneCodeHash, simulation: true, message: `Simulation: demo code is ${code}` })
        }

        // Real MTProto
        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        await loadGram()
        const client = new TelegramClient(new StringSession(""), aid, ahash, { connectionRetries: 5, useWSS: false })
        await client.connect()
        try {
          const result = await client.sendCode({ apiId: aid, apiHash: ahash }, phone)
          const phoneCodeHash = result.phoneCodeHash
          // keep client for sign-in by caching under phoneCodeHash-derived key is complex;
          // we re-create in sign-in. Store phoneCodeHash.
          pending.set(phone, { phoneCodeHash, code: "", ts: Date.now() })
          return json({ phoneCodeHash, simulation: false })
        } catch (e: any) {
          const fw = floodWaitSeconds(e)
          if (fw) return err(`Flood wait: Telegram asked to wait ${fw} seconds before retrying.`, 429, { seconds: fw })
          return err(`Telegram error: ${e?.errorMessage || e?.message || e}`, 400)
        } finally {
          // disconnect temp client; sign-in will create a fresh one with stored code hash
          await client.disconnect?.().catch(() => {})
        }
      }

      // ---------- sign-in ----------
      if (path === "/auth/sign-in" && method === "POST") {
        const { phone, code, phoneCodeHash, password, apiId, apiHash } = await readBody(req)
        if (!phone || !code || !phoneCodeHash) return err("phone, code, phoneCodeHash required")

        if (SIMULATION) {
          const p = pending.get(phone)
          if (!p || p.phoneCodeHash !== phoneCodeHash) return err("Invalid or expired code session. Please request a new code.")
          if (code !== p.code) return err("Invalid verification code. (Simulation code: 12345)")
          pending.delete(phone)
          const sessionString = `SIM_SESSION_${Buffer.from(phone).toString("hex")}_${randomBytes(8).toString("hex")}`
          const channelId = `SIM_CHANNEL_${randomBytes(6).toString("hex")}`
          return json({
            userId: `sim_${createHash("md5").update(phone).digest("hex").slice(0, 12)}`,
            phone,
            name: null,
            sessionString,
            vaultChannelId: channelId,
            vaultChannelAccess: "0",
            simulation: true,
          })
        }

        // Real MTProto
        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        await loadGram()
        const client = new TelegramClient(new StringSession(""), aid, ahash, { connectionRetries: 5, useWSS: false })
        await client.connect()
        try {
          try {
            await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }))
          } catch (e: any) {
            if (is2FA(e)) {
              if (!password) return err("2FA password required. Please enter your Telegram cloud password.", 401, { needs2FA: true })
              const pwd = await client.invoke(new Api.account.GetPassword())
              const pwdCheck = await Password.computeCheck(pwd, password)
              await client.invoke(new Api.auth.CheckPassword({ password: pwdCheck }))
            } else {
              const fw = floodWaitSeconds(e)
              if (fw) return err(`Flood wait: Telegram asked to wait ${fw} seconds.`, 429, { seconds: fw })
              if (String(e?.errorMessage || e?.message || "").includes("PHONE_CODE")) return err("Invalid verification code.")
              throw e
            }
          }
          const sessionString = client.session.save()
          const me = await client.getMe()
          return json({
            userId: String(me.id),
            phone,
            name: (me.firstName || "") + (me.lastName ? " " + me.lastName : "") || null,
            sessionString,
            simulation: false,
          })
        } finally {
          await client.disconnect?.().catch(() => {})
        }
      }

      // ---------- vault init ----------
      if (path === "/vault/init" && method === "POST") {
        const { sessionString, apiId, apiHash } = await readBody(req)
        if (!sessionString) return err("sessionString required")

        if (SIMULATION) {
          return json({ channelId: `SIM_CHANNEL_${randomBytes(6).toString("hex")}`, channelAccess: "0", simulation: true })
        }

        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        const client = await getClient(sessionString, aid, ahash)
        try {
          // look for existing vault channel
          let channelId: string | null = null
          let channelAccess: string | null = null
          for await (const dialog of client.iterDialogs({})) {
            const entity = dialog.entity
            if (entity && (entity.className === "Channel" || entity.className === "Chat") && (dialog.title === VAULT_NAME || entity.title === VAULT_NAME)) {
              channelId = String(entity.id)
              channelAccess = entity.accessHash ? String(entity.accessHash) : "0"
              break
            }
          }
          if (!channelId) {
            const created = await client.invoke(
              new Api.channels.CreateChannel({
                title: VAULT_NAME,
                about: "TeleCloud encrypted storage vault",
                broadcast: true,
                megagroup: false,
              })
            )
            const ch = created.changes?.[0] || created.updates?.chats?.[0] || created.chats?.[0]
            if (ch) {
              channelId = String(ch.id)
              channelAccess = ch.accessHash ? String(ch.accessHash) : "0"
            }
          }
          if (!channelId) return err("Failed to initialize vault channel", 500)
          return json({ channelId, channelAccess: channelAccess || "0", simulation: false })
        } catch (e: any) {
          const fw = floodWaitSeconds(e)
          if (fw) return err(`Flood wait: ${fw} seconds.`, 429, { seconds: fw })
          return err(`Vault init failed: ${e?.errorMessage || e?.message || e}`, 500)
        }
      }

      // ---------- upload chunk ----------
      if (path === "/files/upload" && method === "POST") {
        const { sessionString, channelId, channelAccess, index, fileName, data, apiId, apiHash } = await readBody(req)
        if (!data) return err("data (base64) required")
        const buf = Buffer.from(data, "base64")

        if (SIMULATION) {
          const messageId = simMessageId()
          writeFileSync(simStoragePath(messageId), buf)
          return json({ telegramMessageId: messageId, size: buf.length, checksum: sha256(buf), localPath: simStoragePath(messageId) })
        }

        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        const client = await getClient(sessionString, aid, ahash)
        try {
          const peer = await client.getEntity(channelId)
          const sent = await client.sendFile(peer, {
            file: buf,
            fileName: fileName || `chunk_${index}`,
            forceDocument: true,
            silent: true,
          })
          const msgId = String(sent.id)
          return json({ telegramMessageId: msgId, size: buf.length, checksum: sha256(buf) })
        } catch (e: any) {
          const fw = floodWaitSeconds(e)
          if (fw) return err(`Flood wait: ${fw} seconds.`, 429, { seconds: fw })
          return err(`Upload failed: ${e?.errorMessage || e?.message || e}`, 500)
        }
      }

      // ---------- download chunk ----------
      if (path === "/files/download" && method === "POST") {
        const { sessionString, channelId, channelAccess, messageId, apiId, apiHash } = await readBody(req)
        if (!messageId) return err("messageId required")

        if (SIMULATION) {
          const p = simStoragePath(messageId)
          if (!existsSync(p)) return err("Chunk not found in simulation storage", 404)
          const buf = readFileSync(p)
          return json({ data: buf.toString("base64"), size: buf.length })
        }

        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        const client = await getClient(sessionString, aid, ahash)
        try {
          const peer = await client.getEntity(channelId)
          const messages = await client.getMessages(peer, { ids: [Number(messageId)] })
          if (!messages || !messages.length) return err("Message not found", 404)
          const buf = await client.downloadMedia(messages[0])
          const nodeBuf = Buffer.from(buf as any)
          return json({ data: nodeBuf.toString("base64"), size: nodeBuf.length })
        } catch (e: any) {
          const fw = floodWaitSeconds(e)
          if (fw) return err(`Flood wait: ${fw} seconds.`, 429, { seconds: fw })
          return err(`Download failed: ${e?.errorMessage || e?.message || e}`, 500)
        }
      }

      // ---------- delete message ----------
      if (path === "/files/delete" && method === "POST") {
        const { sessionString, channelId, channelAccess, messageId, apiId, apiHash } = await readBody(req)
        if (!messageId) return err("messageId required")

        if (SIMULATION) {
          const p = simStoragePath(messageId)
          if (existsSync(p)) rmSync(p)
          return json({ ok: true })
        }

        const aid = apiId ? Number(apiId) : API_ID!
        const ahash = apiHash || API_HASH!
        const client = await getClient(sessionString, aid, ahash)
        try {
          const peer = await client.getEntity(channelId)
          await client.deleteMessages(peer, [Number(messageId)], { revoke: true })
          return json({ ok: true })
        } catch (e: any) {
          return err(`Delete failed: ${e?.errorMessage || e?.message || e}`, 500)
        }
      }

      return err("Not found", 404)
    } catch (e: any) {
      console.error("[telegram-service] unhandled:", e)
      return err(`Internal error: ${e?.message || e}`, 500)
    }
  },
})

console.log(`\n  ⛅  TeleCloud Telegram service on http://localhost:${PORT}`)
console.log(`     mode: ${SIMULATION ? "SIMULATION (local storage, demo code 12345)" : "REAL MTProto (GramJS)"}`)
console.log(`     vault name: ${VAULT_NAME}\n`)

// Periodic cleanup of expired pending auths and stale clients
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pending) if (now - v.ts > 10 * 60 * 1000) pending.delete(k)
  for (const [k, v] of clientCache) {
    if (now - v.ts > CLIENT_TTL) {
      v.client.disconnect?.().catch(() => {})
      clientCache.delete(k)
    }
  }
}, 60 * 1000)
