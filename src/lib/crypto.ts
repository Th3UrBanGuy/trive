import crypto from "crypto"

/**
 * Server-side crypto helpers.
 * - Session strings (MTProto) are encrypted at rest with AES-256-GCM using a
 *   key derived from APP_SECRET.
 * - File chunks are encrypted with AES-256-GCM using a per-user key. In
 *   production the key is derived client-side from the user's password
 *   (zero-knowledge). Here we provide a server-side fallback that derives a
 *   key from APP_SECRET + userId so the system is functional end-to-end.
 */

const ALGO = "aes-256-gcm"

function appKey(): Buffer {
  const secret = process.env.APP_SECRET || "telecloud-dev-fallback"
  return crypto.createHash("sha256").update(secret).digest()
}

function deriveKey(salt: string): Buffer {
  const secret = process.env.APP_SECRET || "telecloud-dev-fallback"
  return crypto.scryptSync(secret, salt, 32)
}

/** Encrypt an MTProto session string for storage. */
export function encryptSession(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, appKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`
}

export function decryptSession(stored: string): string {
  const [ver, ivB64, tagB64, encB64] = stored.split(":")
  if (ver !== "v1") throw new Error("Unsupported session format")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const enc = Buffer.from(encB64, "base64")
  const decipher = crypto.createDecipheriv(ALGO, appKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString("utf8")
}

/** Derive a per-user encryption salt. */
export function newSalt(): string {
  return crypto.randomBytes(16).toString("hex")
}

/**
 * Derive a deterministic IV for a chunk buffer using HMAC-SHA-256(userSalt, sha256(chunk)).
 * This ensures identical content uploaded by the same user produces identical ciphertexts,
 * enabling 100% deduplication without sacrificing zero-knowledge isolation across users.
 */
export function deterministicChunkIv(buf: Buffer, userSalt: string): Buffer {
  const contentHash = crypto.createHash("sha256").update(buf).digest()
  const hmac = crypto.createHmac("sha256", userSalt)
  hmac.update(contentHash)
  return hmac.digest().subarray(0, 12)
}

/**
 * Encrypt a Buffer for a user. Returns { data, iv }.
 * Uses a key derived from APP_SECRET + userSalt (server-side zero-knowledge fallback).
 * Accepts an optional custom IV (e.g. deterministicChunkIv) for deduplication.
 */
export function encryptBuffer(buf: Buffer, userSalt: string, customIv?: Buffer): { data: Buffer; iv: string } {
  const key = deriveKey(userSalt)
  const iv = customIv || crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()
  return { data: Buffer.concat([enc, tag]), iv: iv.toString("base64") }
}

export function decryptBuffer(data: Buffer, ivB64: string, userSalt: string): Buffer {
  const key = deriveKey(userSalt)
  const iv = Buffer.from(ivB64, "base64")
  const tag = data.subarray(data.length - 16)
  const enc = data.subarray(0, data.length - 16)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()])
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex")
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(8).toString("hex")
  const hash = crypto.scryptSync(password, salt, 32).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  const test = crypto.scryptSync(password, salt, 32).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test))
}
