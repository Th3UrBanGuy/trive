/**
 * TriVE Telegram engine — in-process, MTProto + Telegram Bot Inbox Storage Engine.
 *
 * Supports:
 * 1. Persistent Bot MTProto Client (2GB per chunk limit, persistent connection pool)
 * 2. Bot Inbox Storage (direct chat with user or designated bot storage channel)
 * 3. Telegram HTTP Bot API resilient fallback
 * 4. Zero-knowledge AES-256-GCM chunk storage
 * 5. Legacy user MTProto session operations (backward-compatibility)
 */

import { createHash, randomBytes } from "crypto"
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { join, resolve } from "path"

const API_ID = process.env.TELEGRAM_API_ID ? Number(process.env.TELEGRAM_API_ID) : undefined
const API_HASH = process.env.TELEGRAM_API_HASH
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_BOT_USERNAME
const STORAGE_CHAT_ID = process.env.TELEGRAM_STORAGE_CHAT_ID

export const REAL_MODE = !!(API_ID && API_HASH)
export const BOT_MODE = !!(BOT_TOKEN || REAL_MODE)
const VAULT_NAME = "TriVE_Storage_Vault"

/** A session string starting with SIM_SESSION_ was created in legacy simulation mode. */
function isSimSession(sessionString?: string | null): boolean {
  if (!sessionString) return false
  return sessionString.startsWith("SIM_SESSION_")
}

// Local storage for simulation-mode blobs (kept for backward compat and offline dev)
const STORAGE_DIR = resolve(process.cwd(), ".telecloud-vault-storage")
try {
  mkdirSync(STORAGE_DIR, { recursive: true })
} catch {}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex")
}

function simStoragePath(messageId: string): string {
  return join(STORAGE_DIR, `${messageId}.bin`)
}

function simMessageId(): string {
  return `sim_${Date.now()}_${randomBytes(4).toString("hex")}`
}

function floodWaitSeconds(e: any): number | null {
  const msg = String(e?.message || e)
  const m = msg.match(/(\d+)\s*(seconds|sec|s)/i) || msg.match(/A wait of (\d+)/i)
  if (m) return Number(m[1])
  if (e?.seconds) return Number(e.seconds)
  return null
}

function is2FA(e: any): boolean {
  const msg = String(e?.errorMessage || e?.message || e)
  return (
    msg.includes("SESSION_PASSWORD_NEEDED") ||
    msg.toLowerCase().includes("2fa") ||
    msg.toLowerCase().includes("password")
  )
}

// ---- GramJS client cache ----
let _gram: any = null
async function loadGram() {
  if (!_gram) {
    const t = await import("telegram")
    const sess = await import("telegram/sessions")
    _gram = {
      TelegramClient: t.TelegramClient,
      StringSession: sess.StringSession,
      Api: t.Api,
      Password: await import("telegram/Password"),
    }
  }
  return _gram
}

const clientCache = new Map<string, { client: any; ts: number }>()
const CLIENT_TTL = 5 * 60 * 1000

async function getClient(sessionString: string, apiId: number, apiHash: string) {
  const g = await loadGram()
  const key = sessionString.slice(0, 32)
  const cached = clientCache.get(key)
  if (cached && Date.now() - cached.ts < CLIENT_TTL) {
    cached.ts = Date.now()
    if (!cached.client.connected) await cached.client.connect()
    return cached.client
  }
  const client = new g.TelegramClient(
    new g.StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 5, useWSS: false }
  )
  await client.connect()
  clientCache.set(key, { client, ts: Date.now() })
  return client
}

// ---- Multi-Bot Worker Pool & Token Sharding ----
const BOT_TOKENS: string[] = [
  ...(process.env.TELEGRAM_BOT_POOL ? process.env.TELEGRAM_BOT_POOL.split(",").map(t => t.trim()).filter(Boolean) : []),
  ...(process.env.TELEGRAM_BOT_TOKEN ? [process.env.TELEGRAM_BOT_TOKEN.trim()] : [])
].filter((v, i, a) => a.indexOf(v) === i)

const _botClientPool = new Map<string, any>()
const _botConnectingPool = new Map<string, Promise<any>>()
let _botRoundRobin = 0

export function getBotTokens(): string[] {
  return BOT_TOKENS
}

export function getNextBotToken(): string | null {
  if (BOT_TOKENS.length === 0) return BOT_TOKEN || null
  const token = BOT_TOKENS[_botRoundRobin % BOT_TOKENS.length]
  _botRoundRobin++
  return token
}

async function getBotClient(targetToken?: string) {
  const token = targetToken || getNextBotToken() || BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  if (!API_ID || !API_HASH) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH are required for MTProto Bot engine")
  }

  const existing = _botClientPool.get(token)
  if (existing && existing.connected) return existing

  const connecting = _botConnectingPool.get(token)
  if (connecting) return connecting

  const promise = (async () => {
    const g = await loadGram()
    const client = new g.TelegramClient(new g.StringSession(""), API_ID, API_HASH, {
      connectionRetries: 5,
      useWSS: false,
      retryDelay: 1500,
    })

    await client.start({
      botAuthToken: token,
    })

    _botClientPool.set(token, client)
    _botConnectingPool.delete(token)
    return client
  })()

  _botConnectingPool.set(token, promise)
  try {
    return await promise
  } catch (err) {
    _botConnectingPool.delete(token)
    throw err
  }
}

/** Construct an InputPeerChannel from channelId + accessHash */
async function getVaultPeer(channelId: string, channelAccess: string): Promise<any> {
  const g = await loadGram()
  if (!channelId || !channelAccess || channelAccess === "0") {
    throw new Error("Vault channel not properly initialized — missing access hash.")
  }
  return new g.Api.InputPeerChannel({
    channelId: BigInt(channelId),
    accessHash: BigInt(channelAccess),
  })
}

// =====================================================================
//  HTTP Bot API Fallbacks (for resilience against MTProto disconnects)
// =====================================================================

async function httpBotApiSendDocument(
  chatId: string,
  buffer: Buffer,
  fileName: string
): Promise<{ messageId: string; size: number }> {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing for HTTP Bot API")
  const formData = new FormData()
  formData.append("chat_id", chatId)
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" })
  formData.append("document", blob, fileName)

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: formData,
  })

  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram Bot API error: ${json.description || "sendDocument failed"}`)
  }
  return { messageId: String(json.result.message_id), size: buffer.length }
}

async function httpBotApiDownloadFile(messageId: string, chatId?: string): Promise<Buffer> {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing for HTTP Bot API")
  throw new Error("Direct HTTP Bot download requires file_id. Use MTProto engine.")
}

// =====================================================================
//  Public API
// =====================================================================

export interface SendCodeResult {
  phoneCodeHash: string
  simulation: boolean
  message?: string
}

export interface SignInResult {
  userId: string
  phone: string
  name: string | null
  username: string | null
  sessionString: string
  vaultChannelId?: string
  vaultChannelAccess?: string
  simulation: boolean
}

export interface UploadChunkResult {
  telegramMessageId: string
  size: number
  checksum: string
  localPath?: string
}

export const telegramService = {
  getBotUsername(): string | null {
    return BOT_USERNAME || null
  },

  isBotConfigured(): boolean {
    return !!BOT_TOKEN
  },

  async health(): Promise<{
    ok: boolean
    simulation: boolean
    apiIdPresent: boolean
    botConfigured: boolean
    botUsername: string | null
    storageChatIdPresent: boolean
    realMode: boolean
  }> {
    return {
      ok: true,
      simulation: !REAL_MODE && !BOT_TOKEN,
      apiIdPresent: !!API_ID,
      botConfigured: !!BOT_TOKEN,
      botUsername: BOT_USERNAME || null,
      storageChatIdPresent: !!STORAGE_CHAT_ID,
      realMode: REAL_MODE || !!BOT_TOKEN,
    }
  },

  // -------------------------------------------------------------------
  //  BOT INBOX STORAGE OPERATIONS (Supercharged MTProto + 2GB limit)
  // -------------------------------------------------------------------

  /**
   * Upload an encrypted chunk to our Bot's Inbox or Bot Storage Channel.
   * If STORAGE_CHAT_ID is set, sends there. Otherwise sends to targetChatId (user's direct bot chat).
   */
  async uploadChunkViaBot(
    targetChatId: string,
    chunk: Buffer,
    index: number,
    fileName: string
  ): Promise<UploadChunkResult> {
    const destChatId = STORAGE_CHAT_ID || targetChatId

    // Offline / simulation mode when no bot token is set
    if (!BOT_TOKEN && !REAL_MODE) {
      const messageId = simMessageId()
      writeFileSync(simStoragePath(messageId), chunk)
      return {
        telegramMessageId: messageId,
        size: chunk.length,
        checksum: sha256(chunk),
        localPath: simStoragePath(messageId),
      }
    }

    try {
      const bot = await getBotClient()
      // GramJS accepts numeric chat id, BigInt, or string username/peer
      let peer: any
      try {
        const numId = Number(destChatId)
        peer = await bot.getInputEntity(!isNaN(numId) ? numId : destChatId)
      } catch {
        peer = destChatId
      }

      const sent = await bot.sendFile(peer, {
        file: chunk,
        fileName: fileName || `chunk_${index}`,
        forceDocument: true,
        silent: true,
      })

      return {
        telegramMessageId: String(sent.id),
        size: chunk.length,
        checksum: sha256(chunk),
      }
    } catch (e: any) {
      // If MTProto fails and chunk is under 50MB, fallback to HTTP Bot API
      if (BOT_TOKEN && chunk.length <= 48 * 1024 * 1024) {
        try {
          const res = await httpBotApiSendDocument(destChatId, chunk, fileName || `chunk_${index}`)
          return {
            telegramMessageId: res.messageId,
            size: res.size,
            checksum: sha256(chunk),
          }
        } catch (httpErr) {
          console.error("[telegram-service] HTTP Bot API fallback also failed:", httpErr)
        }
      }
      const fw = floodWaitSeconds(e)
      if (fw) throw Object.assign(new Error(`Flood wait: ${fw} seconds.`), { seconds: fw })
      throw new Error(`Bot upload failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  /**
   * Download a chunk from the Bot's Inbox / Storage Channel.
   */
  async downloadChunkViaBot(
    targetChatId: string,
    messageId: string
  ): Promise<{ buffer: Buffer; size: number }> {
    const destChatId = STORAGE_CHAT_ID || targetChatId

    // Offline / simulation mode
    if (!BOT_TOKEN && !REAL_MODE) {
      const p = simStoragePath(messageId)
      if (!existsSync(p)) throw new Error("Chunk not found in simulation storage")
      const buf = readFileSync(p)
      return { buffer: buf, size: buf.length }
    }

    try {
      const bot = await getBotClient()
      let peer: any
      try {
        const numId = Number(destChatId)
        peer = await bot.getInputEntity(!isNaN(numId) ? numId : destChatId)
      } catch {
        peer = destChatId
      }

      const messages = await bot.getMessages(peer, { ids: [Number(messageId)] })
      if (!messages || !messages.length || !messages[0]) {
        throw new Error(`Message ${messageId} not found in bot chat`)
      }

      const buf = await bot.downloadMedia(messages[0])
      const nodeBuf = Buffer.from(buf as any)
      return { buffer: nodeBuf, size: nodeBuf.length }
    } catch (e: any) {
      const fw = floodWaitSeconds(e)
      if (fw) throw Object.assign(new Error(`Flood wait: ${fw} seconds.`), { seconds: fw })
      throw new Error(`Bot download failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  /**
   * Delete a chunk message from the bot inbox.
   */
  async deleteMessageViaBot(targetChatId: string, messageId: string): Promise<void> {
    const destChatId = STORAGE_CHAT_ID || targetChatId
    if (!BOT_TOKEN && !REAL_MODE) {
      const p = simStoragePath(messageId)
      if (existsSync(p)) rmSync(p)
      return
    }

    try {
      const bot = await getBotClient()
      let peer: any
      try {
        const numId = Number(destChatId)
        peer = await bot.getInputEntity(!isNaN(numId) ? numId : destChatId)
      } catch {
        peer = destChatId
      }
      await bot.deleteMessages(peer, [Number(messageId)], { revoke: true })
    } catch {
      // Best effort
    }
  },

  /**
   * Post manifest text message to the Bot's Inbox / Storage Channel.
   */
  async postManifestViaBot(targetChatId: string, text: string): Promise<string> {
    const destChatId = STORAGE_CHAT_ID || targetChatId
    if (!BOT_TOKEN && !REAL_MODE) {
      return `sim_msg_${Date.now()}_${randomBytes(4).toString("hex")}`
    }

    try {
      const bot = await getBotClient()
      let peer: any
      try {
        const numId = Number(destChatId)
        peer = await bot.getInputEntity(!isNaN(numId) ? numId : destChatId)
      } catch {
        peer = destChatId
      }
      const sent = await bot.sendMessage(peer, { message: text, silent: true })
      return String(sent.id)
    } catch (e: any) {
      throw new Error(`Bot manifest post failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  /**
   * Scan all manifests from the Bot's Inbox / Storage Channel.
   */
  async scanBotMessages(
    targetChatId: string
  ): Promise<{ id: string; text: string; date: Date }[]> {
    const destChatId = STORAGE_CHAT_ID || targetChatId
    if (!BOT_TOKEN && !REAL_MODE) {
      return []
    }

    try {
      const bot = await getBotClient()
      let peer: any
      try {
        const numId = Number(destChatId)
        peer = await bot.getInputEntity(!isNaN(numId) ? numId : destChatId)
      } catch {
        peer = destChatId
      }

      const messages: { id: string; text: string; date: Date }[] = []
      let offsetId = 0
      for (;;) {
        const batch: any[] = await bot.getMessages(peer, {
          limit: 100,
          offsetId: offsetId || undefined,
        })
        if (!batch || !batch.length) break
        for (const msg of batch) {
          if (msg?.text) {
            messages.push({
              id: String(msg.id),
              text: msg.text,
              date: new Date((msg.date || 0) * 1000),
            })
          }
        }
        offsetId = batch[batch.length - 1].id
        if (batch.length < 100) break
      }
      return messages
    } catch (e: any) {
      throw new Error(`Bot scan failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  // -------------------------------------------------------------------
  //  LEGACY USER MTPROTO OPERATIONS (Preserved for compatibility)
  // -------------------------------------------------------------------

  async sendCode(phone: string, _apiId?: string, _apiHash?: string): Promise<SendCodeResult> {
    if (!REAL_MODE) {
      return { phoneCodeHash: "sim_hash", simulation: true, message: "Simulation mode" }
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const g = await loadGram()
    const client = new g.TelegramClient(new g.StringSession(""), aid, ahash, {
      connectionRetries: 5,
      useWSS: false,
      retryDelay: 2000,
    })
    try {
      await client.connect()
      const result = await client.sendCode({ apiId: aid, apiHash: ahash }, phone)
      clientCache.set(`auth:${phone}`, { client, ts: Date.now() })
      return { phoneCodeHash: result.phoneCodeHash, simulation: false }
    } catch (e: any) {
      try {
        await client.disconnect()
      } catch {}
      const msg = String(e?.errorMessage || e?.message || e)
      const fw = floodWaitSeconds(e)
      if (fw) {
        throw Object.assign(
          new Error(`Telegram flood wait: please wait ${fw} seconds before retrying.`),
          { seconds: fw }
        )
      }
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENETUNREACH") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("connect")
      ) {
        throw new Error(
          "Couldn't reach Telegram servers. Please check your network connection and try again."
        )
      }
      throw new Error(`Telegram error: ${msg}`)
    }
  },

  async signIn(
    phone: string,
    code: string,
    phoneCodeHash: string,
    password?: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<SignInResult> {
    if (!REAL_MODE) {
      return {
        userId: `sim_user_${Date.now()}`,
        phone,
        name: "Demo User",
        username: "demouser",
        sessionString: `SIM_SESSION_${Date.now()}`,
        simulation: true,
      }
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const g = await loadGram()
    const cached = clientCache.get(`auth:${phone}`)
    const client =
      cached?.client && Date.now() - cached.ts < 5 * 60 * 1000
        ? cached.client
        : new g.TelegramClient(new g.StringSession(""), aid, ahash, {
            connectionRetries: 5,
            useWSS: false,
          })
    if (!client.connected) {
      try {
        await client.connect()
      } catch {}
    }
    clientCache.delete(`auth:${phone}`)
    try {
      try {
        await client.invoke(
          new g.Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code })
        )
      } catch (e: any) {
        if (is2FA(e)) {
          if (!password) {
            throw Object.assign(
              new Error("2FA password required. Please enter your Telegram cloud password."),
              { needs2FA: true }
            )
          }
          const pwd = await client.invoke(new g.Api.account.GetPassword())
          const pwdCheck = await g.Password.computeCheck(pwd, password)
          await client.invoke(new g.Api.auth.CheckPassword({ password: pwdCheck }))
        } else {
          const fw = floodWaitSeconds(e)
          if (fw) throw Object.assign(new Error(`Flood wait: ${fw} seconds.`), { seconds: fw })
          if (String(e?.errorMessage || e?.message || "").includes("PHONE_CODE")) {
            throw new Error("Invalid verification code.")
          }
          throw e
        }
      }
      const sessionString = client.session.save()
      const me = await client.getMe()
      const username = (me as any).username || null
      const fullName = (me.firstName || "") + (me.lastName ? " " + me.lastName : "") || null
      return { userId: String(me.id), phone, name: fullName, username, sessionString, simulation: false }
    } finally {
      await client.disconnect?.().catch(() => {})
    }
  },

  async initVault(
    sessionString: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<{ channelId: string; channelAccess: string; simulation: boolean }> {
    if (isSimSession(sessionString)) {
      return {
        channelId: `SIM_CHANNEL_${randomBytes(6).toString("hex")}`,
        channelAccess: "0",
        simulation: true,
      }
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    let channelId: string | null = null
    let channelAccess: string | null = null
    for await (const dialog of client.iterDialogs({})) {
      const entity = dialog.entity
      if (
        entity &&
        (entity.className === "Channel" || entity.className === "Chat") &&
        (dialog.title === VAULT_NAME || entity.title === VAULT_NAME)
      ) {
        channelId = String(entity.id)
        channelAccess = entity.accessHash ? String(entity.accessHash) : "0"
        break
      }
    }
    if (!channelId) {
      const gram = await loadGram()
      const created = await client.invoke(
        new gram.Api.channels.CreateChannel({
          title: VAULT_NAME,
          about: "TriVE encrypted storage vault",
          broadcast: true,
          megagroup: false,
        })
      )
      const ch = created.chats?.[0]
      if (ch) {
        channelId = String(ch.id)
        channelAccess = ch.accessHash ? String(ch.accessHash) : "0"
      }
    }
    if (!channelId) throw new Error("Failed to initialize vault channel")
    return { channelId, channelAccess: channelAccess || "0", simulation: false }
  },

  async uploadChunk(
    sessionString: string,
    channelId: string,
    channelAccess: string,
    chunk: Buffer,
    index: number,
    fileName: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<UploadChunkResult> {
    if (isSimSession(sessionString)) {
      const messageId = simMessageId()
      writeFileSync(simStoragePath(messageId), chunk)
      return {
        telegramMessageId: messageId,
        size: chunk.length,
        checksum: sha256(chunk),
        localPath: simStoragePath(messageId),
      }
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    try {
      const peer = await getVaultPeer(channelId, channelAccess)
      const sent = await client.sendFile(peer, {
        file: chunk,
        fileName: fileName || `chunk_${index}`,
        forceDocument: true,
        silent: true,
      })
      return { telegramMessageId: String(sent.id), size: chunk.length, checksum: sha256(chunk) }
    } catch (e: any) {
      const fw = floodWaitSeconds(e)
      if (fw) throw Object.assign(new Error(`Flood wait: ${fw} seconds.`), { seconds: fw })
      throw new Error(`Upload failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  async downloadChunk(
    sessionString: string,
    channelId: string,
    channelAccess: string,
    messageId: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<{ buffer: Buffer; size: number }> {
    if (isSimSession(sessionString)) {
      const p = simStoragePath(messageId)
      if (!existsSync(p)) throw new Error("Chunk not found in storage")
      const buf = readFileSync(p)
      return { buffer: buf, size: buf.length }
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    try {
      const peer = await getVaultPeer(channelId, channelAccess)
      const messages = await client.getMessages(peer, { ids: [Number(messageId)] })
      if (!messages || !messages.length) throw new Error("Message not found")
      const buf = await client.downloadMedia(messages[0])
      const nodeBuf = Buffer.from(buf as any)
      return { buffer: nodeBuf, size: nodeBuf.length }
    } catch (e: any) {
      const fw = floodWaitSeconds(e)
      if (fw) throw Object.assign(new Error(`Flood wait: ${fw} seconds.`), { seconds: fw })
      throw new Error(`Download failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  async deleteMessage(
    sessionString: string,
    channelId: string,
    channelAccess: string,
    messageId: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<void> {
    if (isSimSession(sessionString)) {
      const p = simStoragePath(messageId)
      if (existsSync(p)) rmSync(p)
      return
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    try {
      const peer = await getVaultPeer(channelId, channelAccess)
      await client.deleteMessages(peer, [Number(messageId)], { revoke: true })
    } catch {}
  },

  async postManifest(
    sessionString: string,
    channelId: string,
    channelAccess: string,
    text: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<string> {
    if (isSimSession(sessionString)) {
      return `sim_msg_${Date.now()}_${randomBytes(4).toString("hex")}`
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    try {
      const peer = await getVaultPeer(channelId, channelAccess)
      const sent = await client.sendMessage(peer, { message: text, silent: true })
      return String(sent.id)
    } catch (e: any) {
      throw new Error(`Manifest post failed: ${e?.errorMessage || e?.message || e}`)
    }
  },

  async scanVaultMessages(
    sessionString: string,
    channelId: string,
    channelAccess: string,
    _apiId?: string,
    _apiHash?: string
  ): Promise<{ id: string; text: string; date: Date }[]> {
    if (isSimSession(sessionString)) {
      return []
    }
    const aid = _apiId ? Number(_apiId) : API_ID!
    const ahash = _apiHash || API_HASH!
    const client = await getClient(sessionString, aid, ahash)
    try {
      const peer = await getVaultPeer(channelId, channelAccess)
      const messages: { id: string; text: string; date: Date }[] = []
      let offsetId = 0
      for (;;) {
        const batch: any[] = await client.getMessages(peer, {
          limit: 100,
          offsetId: offsetId || undefined,
        })
        if (!batch || !batch.length) break
        for (const msg of batch) {
          if (msg?.text) {
            messages.push({
              id: String(msg.id),
              text: msg.text,
              date: new Date((msg.date || 0) * 1000),
            })
          }
        }
        offsetId = batch[batch.length - 1].id
        if (batch.length < 100) break
      }
      return messages
    } catch (e: any) {
      throw new Error(`Vault scan failed: ${e?.errorMessage || e?.message || e}`)
    }
  },
}
