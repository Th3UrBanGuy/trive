import { db } from "./db"
import { telegramService } from "./telegram-service"
import { encryptBuffer, decryptBuffer, sha256, decryptSession, newSalt, deterministicChunkIv } from "./crypto"
import { CHUNK_SIZE, fileCategory } from "./file-utils"
import * as erasure from "./erasure-coding"
import { ZipArchive } from "archiver"
import { Readable } from "stream"
import type { FileItem } from "./types"
import sharp from "sharp"

export function mapFile(f: any): FileItem {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: Number(f.size),
    encrypted: f.encrypted,
    isChunked: f.isChunked,
    totalChunks: f.totalChunks,
    starred: f.starred,
    trashed: f.trashed,
    thumbnail: f.thumbnail,
    folderId: f.folderId,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

/**
 * Resolves the storage context for a user:
 * Supports Telegram Bot Inbox / Storage Channel or user MTProto channel.
 */
async function getUserStorageContext(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error("User not found")

  let salt = user.encSalt
  if (!salt) {
    salt = newSalt()
    await db.user.update({ where: { id: userId }, data: { encSalt: salt } }).catch(() => {})
  }

  // Use Bot storage if user has no personal MTProto session or bot is configured
  const isBot = !user.telegramSession || telegramService.isBotConfigured()
  const targetChatId = user.botChatId || user.telegramId || user.vaultChannelId || "me"
  const sessionString = user.telegramSession ? decryptSession(user.telegramSession) : ""
  const channelId = user.vaultChannelId || targetChatId
  const channelAccess = user.vaultChannelAccess || "0"

  return {
    user,
    isBot,
    targetChatId,
    sessionString,
    channelId,
    channelAccess,
    salt,
  }
}

/**
 * Upload a file buffer to the user's Telegram vault (Bot inbox or private vault channel).
 *
 * Encryption is PER-CHUNK (each chunk gets its own IV), enabling streaming decryption.
 */
export async function uploadFileToVault(opts: {
  userId: string
  fileName: string
  mimeType: string
  buffer: Buffer
  folderId: string | null
}): Promise<FileItem> {
  const { userId, fileName, mimeType, buffer, folderId } = opts
  const { user, isBot, targetChatId, sessionString, channelId, channelAccess, salt } =
    await getUserStorageContext(userId)

  const totalChunks = Math.max(1, Math.ceil(buffer.length / CHUNK_SIZE))
  const isChunked = totalChunks > 1

  // Erasure coding: only for files with 3+ data shards (>= 60MB)
  // For smaller files, the overhead isn't worth it
  const useErasure = totalChunks >= 3
  const numParity = useErasure ? erasure.calculateParityShards(totalChunks) : 0
  const totalShards = totalChunks + numParity

  // Thumbnail for images
  let thumbnail: string | null = null
  const cat = fileCategory(mimeType)
  if (cat === "image" && buffer.length < 15 * 1024 * 1024) {
    try {
      const t = await sharp(buffer).resize(320, 320, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer()
      thumbnail = `data:image/jpeg;base64,${t.toString("base64")}`
    } catch {}
  }

  // Create the file record
  const { iv: fileIv } = encryptBuffer(Buffer.alloc(0), salt)
  const file = await db.file.create({
    data: {
      userId,
      folderId: folderId || null,
      name: fileName,
      mimeType,
      size: BigInt(buffer.length),
      encrypted: true,
      encIv: fileIv,
      isChunked,
      chunkSize: BigInt(CHUNK_SIZE),
      totalChunks: totalShards,
      checksum: sha256(buffer),
      thumbnail,
      dataShards: useErasure ? totalChunks : 0,
      parityShards: numParity,
    },
  })

  // ---- Step 1: Encrypt each data chunk independently ----
  const encryptedChunks: { data: Buffer; iv: string; plainSize: number; checksum: string }[] = []
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const plainChunk = buffer.subarray(start, start + CHUNK_SIZE)
    const plainSize = plainChunk.length
    const plainBuf = Buffer.from(plainChunk)
    const chunkIvBytes = deterministicChunkIv(plainBuf, salt)
    const { data: encChunk, iv: chunkIv } = encryptBuffer(plainBuf, salt, chunkIvBytes)
    const checksum = sha256(encChunk)
    encryptedChunks.push({ data: encChunk, iv: chunkIv, plainSize, checksum })
  }

  // ---- Step 2: Deduplication — check if any encrypted chunk already exists ----
  let dedupedCount = 0
  const dedupResults: { deduped: boolean; telegramMessageId?: string; size?: number; checksum: string }[] = []
  for (const chunk of encryptedChunks) {
    // Look for an existing FileChunk with the same checksum for this user
    const existing = await db.fileChunk.findFirst({
      where: { checksum: chunk.checksum, file: { userId } },
      select: { telegramMessageId: true, size: true },
    })
    if (existing) {
      dedupedCount++
      dedupResults.push({ deduped: true, telegramMessageId: existing.telegramMessageId, size: Number(existing.size), checksum: chunk.checksum })
    } else {
      dedupResults.push({ deduped: false, checksum: chunk.checksum })
    }
  }

  // ---- Step 3: Upload only non-deduped data chunks to Telegram ----
  for (let i = 0; i < encryptedChunks.length; i++) {
    const chunk = encryptedChunks[i]
    const dedup = dedupResults[i]

    let telegramMessageId: string
    let uploadSize: number
    let uploadChecksum: string = chunk.checksum

    if (dedup.deduped && dedup.telegramMessageId) {
      // Deduped — reuse existing Telegram message, don't upload
      telegramMessageId = dedup.telegramMessageId
      uploadSize = dedup.size || chunk.data.length
    } else {
      // Upload to Telegram
      let attempt = 0
      let result
      while (attempt < 3) {
        try {
          if (isBot) {
            result = await telegramService.uploadChunkViaBot(
              targetChatId, chunk.data, i, `${fileName}.part${i}`,
            )
          } else {
            result = await telegramService.uploadChunk(
              sessionString, channelId, channelAccess, chunk.data, i, `${fileName}.part${i}`,
            )
          }
          break
        } catch (e: any) {
          attempt++
          const msg = String(e?.message || e)
          if (msg.toLowerCase().includes("flood")) {
            const m = msg.match(/(\d+)\s*(seconds|sec|s)/i)
            await new Promise((r) => setTimeout(r, ((m ? Number(m[1]) : 5) + 1) * 1000))
          } else if (attempt >= 3) {
            await db.file.delete({ where: { id: file.id } }).catch(() => {})
            throw new Error(`Chunk ${i} upload failed: ${msg}`)
          } else {
            await new Promise((r) => setTimeout(r, 1500 * attempt))
          }
        }
      }
      if (!result) {
        await db.file.delete({ where: { id: file.id } }).catch(() => {})
        throw new Error(`Chunk ${i} upload failed`)
      }
      telegramMessageId = result.telegramMessageId
      uploadSize = result.size
    }

    await db.fileChunk.create({
      data: {
        fileId: file.id,
        index: i,
        telegramMessageId,
        size: BigInt(uploadSize),
        checksum: uploadChecksum,
        encIv: chunk.iv,
        plainSize: BigInt(chunk.plainSize),
        localPath: null,
        isParity: false,
        deduped: dedup.deduped,
      },
    })
  }

  // ---- Step 4: Erasure coding — compute and upload parity shards ----
  if (useErasure && numParity > 0) {
    // Use the encrypted data chunks as input to erasure coding
    // All shards must be the same size — pad the last data chunk
    const shardSize = Math.max(...encryptedChunks.map((c) => c.data.length))
    const paddedDataShards = encryptedChunks.map((c) => {
      if (c.data.length < shardSize) {
        const padded = Buffer.alloc(shardSize)
        c.data.copy(padded)
        return padded
      }
      return c.data
    })

    // Encode: produce parity shards from data shards
    const allShards = erasure.encode(Buffer.concat(paddedDataShards), totalChunks, numParity)
    // allShards[0..N-1] = data shards (already uploaded above)
    // allShards[N..N+M-1] = parity shards (need to upload)

    for (let p = 0; p < numParity; p++) {
      const parityShard = allShards[totalChunks + p]
      const parityChecksum = sha256(parityShard)

      // Check dedup for parity too
      const existingParity = await db.fileChunk.findFirst({
        where: { checksum: parityChecksum, file: { userId } },
        select: { telegramMessageId: true, size: true },
      })

      let telegramMessageId: string
      let uploadSize: number

      if (existingParity) {
        telegramMessageId = existingParity.telegramMessageId
        uploadSize = Number(existingParity.size)
        dedupedCount++
      } else {
        let attempt = 0
        let result
        while (attempt < 3) {
          try {
            if (isBot) {
              result = await telegramService.uploadChunkViaBot(
                targetChatId, parityShard, totalChunks + p, `${fileName}.parity${p}`,
              )
            } else {
              result = await telegramService.uploadChunk(
                sessionString, channelId, channelAccess, parityShard,
                totalChunks + p, `${fileName}.parity${p}`,
              )
            }
            break
          } catch (e: any) {
            attempt++
            if (attempt >= 3) {
              // Parity upload failed — file is still usable without parity, just log
              console.error(`[upload] parity shard ${p} failed:`, e?.message)
              break
            }
            await new Promise((r) => setTimeout(r, 1500 * attempt))
          }
        }
        if (!result) continue // Skip this parity shard — file still works
        telegramMessageId = result.telegramMessageId
        uploadSize = result.size
      }

      await db.fileChunk.create({
        data: {
          fileId: file.id,
          index: totalChunks + p,
          telegramMessageId,
          size: BigInt(uploadSize),
          checksum: parityChecksum,
          encIv: fileIv, // Parity shards aren't separately encrypted (they're derived from encrypted data)
          plainSize: BigInt(shardSize),
          localPath: null,
          isParity: true,
          deduped: !!existingParity,
          shardSize: BigInt(shardSize),
        },
      })
    }
  }

  // Update file with dedup count
  if (dedupedCount > 0) {
    await db.file.update({ where: { id: file.id }, data: { dedupedChunks: dedupedCount } })
  }

  await db.activity.create({
    data: {
      userId,
      action: "upload",
      details: JSON.stringify({ name: fileName, size: buffer.length, chunks: totalChunks, fileId: file.id }),
    },
  })

  // Post a manifest message to the vault so the file index can be rebuilt
  // on any device when the user logs in. The manifest contains all metadata +
  // the chunk map (message IDs, IVs, sizes).
  try {
    const refreshed0 = await db.file.findUnique({ where: { id: file.id }, include: { chunks: { orderBy: { index: "asc" } } } })
    const manifest = {
      type: "trive-manifest",
      version: 1,
      fileId: file.id,
      name: fileName,
      mimeType,
      size: buffer.length,
      encrypted: true,
      isChunked,
      chunkSize: CHUNK_SIZE,
      totalChunks: totalShards,
      checksum: refreshed0?.checksum || null,
      thumbnail: thumbnail || null,
      folderId: folderId || null,
      encIv: fileIv,
      createdAt: refreshed0?.createdAt.toISOString() || new Date().toISOString(),
      // Erasure coding metadata
      dataShards: useErasure ? totalChunks : 0,
      parityShards: numParity,
      dedupedChunks: dedupedCount,
      chunks: (refreshed0?.chunks || []).map((c) => ({
        index: c.index,
        telegramMessageId: c.telegramMessageId,
        size: Number(c.size),
        checksum: c.checksum,
        encIv: c.encIv,
        plainSize: Number(c.plainSize),
        isParity: c.isParity,
        deduped: c.deduped,
        shardSize: Number(c.shardSize) || 0,
      })),
    }
    const manifestMsgId = isBot
      ? await telegramService.postManifestViaBot(targetChatId, JSON.stringify(manifest))
      : await telegramService.postManifest(sessionString, channelId, channelAccess, JSON.stringify(manifest))
    await db.file.update({ where: { id: file.id }, data: { manifestMessageId: manifestMsgId } })
  } catch (e) {
    // Manifest is best-effort — file is still usable without it on this device
    console.error("[upload] manifest post failed:", e)
  }

  const refreshed = await db.file.findUnique({ where: { id: file.id } })
  return mapFile(refreshed!)
}

/**
 * Scan the vault channel for manifest messages and rebuild the file index.
 * This makes files persistent across devices: log in from anywhere → scan →
 * all your files reappear. Only adds files that don't already exist in the DB
 * (dedup by manifestMessageId).
 *
 * Returns { scanned, added, skipped }.
 */
export async function scanVaultAndRebuild(userId: string): Promise<{ scanned: number; added: number; skipped: number; errors: string[] }> {
  const { user, isBot, targetChatId, sessionString, channelId, channelAccess } =
    await getUserStorageContext(userId)

  const messages = isBot
    ? await telegramService.scanBotMessages(targetChatId)
    : await telegramService.scanVaultMessages(sessionString, channelId, channelAccess)
  const errors: string[] = []
  let added = 0
  let skipped = 0

  // Collect existing manifestMessageIds to dedup (files + folders)
  const existingFileManifestIds = new Set(
    (await db.file.findMany({ where: { userId, manifestMessageId: { not: null } }, select: { manifestMessageId: true } }))
      .map((f) => f.manifestMessageId)
      .filter(Boolean) as string[]
  )
  const existingFolderIds = new Set(
    (await db.folder.findMany({ where: { userId }, select: { id: true } }))
      .map((f) => f.id)
  )

  // First pass: process folder manifests (so folders exist before files reference them)
  for (const msg of messages) {
    try {
      const manifest = JSON.parse(msg.text)
      if (manifest.type === "trive-folder-manifest" && manifest.version === 1) {
        if (existingFolderIds.has(manifest.folderId)) {
          skipped++
          continue
        }
        await db.folder.create({
          data: {
            id: manifest.folderId,
            userId,
            name: manifest.name,
            parentId: manifest.parentId || null,
            color: manifest.color || null,
            icon: manifest.icon || null,
            starred: manifest.starred || false,
            trashed: manifest.trashed || false,
            createdAt: manifest.createdAt ? new Date(manifest.createdAt) : msg.date,
          },
        })
        existingFolderIds.add(manifest.folderId)
        added++
      }
    } catch (e: any) {
      errors.push(`Failed to parse folder manifest ${msg.id}: ${e?.message || e}`)
    }
  }

  // Second pass: process file manifests
  // Collect all manifests grouped by fileId — only keep the newest one per file
  // (this handles renames: the newest manifest has the updated name)
  const manifestsByFileId = new Map<string, { msg: any; manifest: any }>()
  for (const msg of messages) {
    try {
      const manifest = JSON.parse(msg.text)
      if (manifest.type !== "trive-manifest" || manifest.version !== 1) continue
      const existing = manifestsByFileId.get(manifest.fileId)
      // Keep the newest manifest (messages are in descending order, so first = newest)
      if (!existing) {
        manifestsByFileId.set(manifest.fileId, { msg, manifest })
      }
    } catch {}
  }

  // Also collect existing file IDs in the DB (for upsert vs create decision)
  const existingFileIds = new Set(
    (await db.file.findMany({ where: { userId }, select: { id: true, manifestMessageId: true } }))
      .map((f) => f.id)
  )
  const existingManifestIdsByFileId = new Map<string, string | null>(
    (await db.file.findMany({ where: { userId }, select: { id: true, manifestMessageId: true } }))
      .map((f) => [f.id, f.manifestMessageId])
  )

  let updated = 0
  for (const [, { msg, manifest }] of manifestsByFileId) {
    try {
      // Skip if this exact manifest message is already tracked
      if (existingFileManifestIds.has(msg.id)) {
        skipped++
        continue
      }
      // Check if the file already exists (by fileId) — if so, UPDATE it
      // (this handles renames — the new manifest has the updated name)
      if (existingFileIds.has(manifest.fileId)) {
        // Update the existing file with the latest manifest data
        await db.file.update({
          where: { id: manifest.fileId },
          data: {
            name: manifest.name,
            folderId: manifest.folderId || null,
            starred: manifest.starred ?? false,
            trashed: manifest.trashed ?? false,
            thumbnail: manifest.thumbnail || null,
            manifestMessageId: msg.id,
            dataShards: manifest.dataShards || 0,
            parityShards: manifest.parityShards || 0,
            dedupedChunks: manifest.dedupedChunks || 0,
          },
        })
        // Update chunks if they changed
        await db.fileChunk.deleteMany({ where: { fileId: manifest.fileId } })
        for (const c of manifest.chunks || []) {
          await db.fileChunk.create({
            data: {
              fileId: manifest.fileId,
              index: c.index,
              telegramMessageId: c.telegramMessageId,
              size: BigInt(c.size || 0),
              checksum: c.checksum || null,
              encIv: c.encIv || manifest.encIv || "",
              plainSize: BigInt(c.plainSize || 0),
              isParity: c.isParity || false,
              deduped: c.deduped || false,
              shardSize: BigInt(c.shardSize || 0),
            },
          })
        }
        existingFileManifestIds.add(msg.id)
        updated++
        continue
      }
      // Create the file record (new file)
      const file = await db.file.create({
        data: {
          id: manifest.fileId,
          userId,
          folderId: manifest.folderId || null,
          name: manifest.name,
          mimeType: manifest.mimeType || "application/octet-stream",
          size: BigInt(manifest.size || 0),
          encrypted: manifest.encrypted ?? true,
          encIv: manifest.encIv || null,
          isChunked: manifest.isChunked ?? false,
          chunkSize: BigInt(manifest.chunkSize || 0),
          totalChunks: manifest.totalChunks || 1,
          checksum: manifest.checksum || null,
          thumbnail: manifest.thumbnail || null,
          starred: manifest.starred ?? false,
          trashed: manifest.trashed ?? false,
          manifestMessageId: msg.id,
          dataShards: manifest.dataShards || 0,
          parityShards: manifest.parityShards || 0,
          dedupedChunks: manifest.dedupedChunks || 0,
          createdAt: manifest.createdAt ? new Date(manifest.createdAt) : msg.date,
        },
      })
      // Create chunk records
      for (const c of manifest.chunks || []) {
        await db.fileChunk.create({
          data: {
            fileId: file.id,
            index: c.index,
            telegramMessageId: c.telegramMessageId,
            size: BigInt(c.size || 0),
            checksum: c.checksum || null,
            encIv: c.encIv || manifest.encIv || "",
            plainSize: BigInt(c.plainSize || 0),
            isParity: c.isParity || false,
            deduped: c.deduped || false,
            shardSize: BigInt(c.shardSize || 0),
          },
        })
      }
      added++
    } catch (e: any) {
      errors.push(`Failed to parse manifest ${msg.id}: ${e?.message || e}`)
    }
  }

  return { scanned: messages.length, added, skipped, updated, errors }
}

/**
 * Post a folder manifest to the vault so folders persist across devices.
 * Called when a folder is created or updated.
 */
export async function postFolderManifest(userId: string, folderId: string): Promise<void> {
  const { user, isBot, targetChatId, sessionString, channelId, channelAccess } =
    await getUserStorageContext(userId).catch(() => ({} as any))
  if (!user) return

  const folder = await db.folder.findUnique({ where: { id: folderId } })
  if (!folder) return

  const manifest = {
    type: "trive-folder-manifest",
    version: 1,
    folderId: folder.id,
    name: folder.name,
    parentId: folder.parentId || null,
    color: folder.color || null,
    icon: folder.icon || null,
    starred: folder.starred || false,
    trashed: folder.trashed || false,
    createdAt: folder.createdAt.toISOString(),
  }
  try {
    if (isBot) {
      await telegramService.postManifestViaBot(targetChatId, JSON.stringify(manifest))
    } else {
      await telegramService.postManifest(sessionString, channelId, channelAccess, JSON.stringify(manifest))
    }
  } catch (e) {
    console.error("[folder] manifest post failed:", e)
  }
}

/**
 * Re-post the file manifest after a rename/star/move so the change persists
 * across devices. Fetches the current file + chunks from the DB, builds the
 * manifest, and posts it to the vault. The old manifest message remains but
 * the vault scan will find the newest one (by date) and use that.
 */
export async function postFileManifestUpdate(userId: string, fileId: string): Promise<void> {
  const { user, isBot, targetChatId, sessionString, channelId, channelAccess } =
    await getUserStorageContext(userId).catch(() => ({} as any))
  if (!user) return

  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { chunks: { orderBy: { index: "asc" } } },
  })
  if (!file) return

  const manifest = {
    type: "trive-manifest",
    version: 1,
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size),
    encrypted: file.encrypted,
    isChunked: file.isChunked,
    chunkSize: Number(file.chunkSize),
    totalChunks: file.totalChunks,
    checksum: file.checksum || null,
    thumbnail: file.thumbnail || null,
    folderId: file.folderId || null,
    encIv: file.encIv || null,
    starred: file.starred,
    trashed: file.trashed,
    createdAt: file.createdAt.toISOString(),
    chunks: file.chunks.map((c) => ({
      index: c.index,
      telegramMessageId: c.telegramMessageId,
      size: Number(c.size),
      checksum: c.checksum,
      encIv: c.encIv,
      plainSize: Number(c.plainSize),
    })),
  }
  try {
    const manifestMsgId = isBot
      ? await telegramService.postManifestViaBot(targetChatId, JSON.stringify(manifest))
      : await telegramService.postManifest(sessionString, channelId, channelAccess, JSON.stringify(manifest))
    // Update the manifestMessageId so dedup works with the new manifest
    await db.file.update({ where: { id: fileId }, data: { manifestMessageId: manifestMsgId } })
  } catch (e) {
    console.error("[file-ops] manifest update failed:", e)
  }
}

/**
 * Backward-compatible whole-buffer download. Handles erasure coding:
 * if data shards are missing/corrupted, uses parity shards to reconstruct.
 */
export async function downloadFileFromVault(fileId: string, userId: string): Promise<{ buffer: Buffer; name: string; mimeType: string }> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { chunks: { orderBy: { index: "asc" } } },
  })
  if (!file || file.userId !== userId) throw new Error("File not found")
  if (file.trashed) throw new Error("File is in trash")

  const { user, isBot, targetChatId, sessionString, channelId, channelAccess, salt } =
    await getUserStorageContext(userId)

  // Separate data shards from parity shards
  const dataShards = file.dataShards || 0
  const parityShards = file.parityShards || 0
  const useErasure = dataShards > 0 && parityShards > 0

  // Download all chunks, tracking which succeed/fail
  const shardBuffers: (Buffer | null)[] = []
  const dataChunkRecords = file.chunks.filter((c) => !c.isParity)
  const parityChunkRecords = file.chunks.filter((c) => c.isParity)

  for (const chunk of file.chunks) {
    try {
      const result = isBot
        ? await telegramService.downloadChunkViaBot(targetChatId, chunk.telegramMessageId)
        : await telegramService.downloadChunk(sessionString, channelId, channelAccess, chunk.telegramMessageId)
      const chunkBuf = result.buffer
      // Verify checksum
      if (chunk.checksum && sha256(chunkBuf) !== chunk.checksum) {
        console.warn(`[download] chunk ${chunk.index} checksum mismatch — will try erasure recovery`)
        shardBuffers[chunk.index] = null
      } else {
        shardBuffers[chunk.index] = chunkBuf
      }
    } catch (e) {
      console.warn(`[download] chunk ${chunk.index} download failed — will try erasure recovery:`, e)
      shardBuffers[chunk.index] = null
    }
  }

  // Check if all data shards are available
  const missingDataShards = dataChunkRecords.filter((c) => shardBuffers[c.index] === null)

  if (missingDataShards.length > 0 && useErasure) {
    // ---- Erasure decoding: reconstruct missing data shards from parity ----
    console.log(`[download] ${missingDataShards.length} data shards missing — using erasure coding to reconstruct`)
    const totalShards = dataShards + parityShards
    const shardSize = Number(parityChunkRecords[0]?.shardSize || 0)

    // Prepare shards array for erasure.decode()
    const erasureShards: (Buffer | null)[] = new Array(totalShards).fill(null)
    for (let i = 0; i < totalShards; i++) {
      if (shardBuffers[i]) {
        erasureShards[i] = shardBuffers[i]
      }
    }

    // Reconstruct using Reed-Solomon
    const allShardSize = shardSize || Math.max(...erasureShards.filter(Boolean).map((s) => s!.length))
    // Pad all available shards to the same size
    for (let i = 0; i < totalShards; i++) {
      if (erasureShards[i] && erasureShards[i]!.length < allShardSize) {
        const padded = Buffer.alloc(allShardSize)
        erasureShards[i]!.copy(padded)
        erasureShards[i] = padded
      }
    }

    const reconstructed = erasure.decode(erasureShards, dataShards, parityShards, allShardSize * dataShards)

    // Split reconstructed back into individual data shards
    for (let d = 0; d < dataShards; d++) {
      if (shardBuffers[d] === null) {
        shardBuffers[d] = reconstructed.subarray(d * allShardSize, (d + 1) * allShardSize)
        console.log(`[download] reconstructed data shard ${d} from parity`)
      }
    }
  }

  // Now decrypt all data shards and concatenate.
  //
  // CRITICAL: Each encrypted chunk is [ciphertext | GCM_tag(16 bytes)].
  // decryptBuffer() takes the LAST 16 bytes as the tag. If the buffer has
  // extra bytes (erasure-coding padding, or unexpected Telegram data), the
  // tag position shifts and decryption produces garbage or fails.
  //
  // Fix: truncate each chunk to its exact encrypted size (plainSize + 16)
  // before decrypting. This is safe for:
  //   - Downloaded chunks: size should already be plainSize+16 (no-op)
  //   - Erasure-reconstructed chunks: size is allShardSize (padded) — strips padding
  const parts: Buffer[] = []
  for (const chunk of dataChunkRecords) {
    let chunkBuf = shardBuffers[chunk.index]
    if (!chunkBuf) {
      throw new Error(`Chunk ${chunk.index} unavailable and could not be reconstructed`)
    }
    // AES-256-GCM: ciphertext length = plaintext length, tag = 16 bytes.
    // So the exact encrypted chunk size = plainSize + 16.
    const plainSizeNum = Number(chunk.plainSize)
    const expectedEncSize = plainSizeNum + 16
    if (chunkBuf.length > expectedEncSize) {
      // Strip trailing padding (erasure reconstruction) or extra bytes.
      chunkBuf = chunkBuf.subarray(0, expectedEncSize)
    }
    const iv = chunk.encIv || file.encIv!
    const plain = decryptBuffer(chunkBuf, iv, user.encSalt)
    parts.push(plain.subarray(0, plainSizeNum || plain.length))
  }
  const plaintext = Buffer.concat(parts)

  // File-level integrity check: verify the full decrypted buffer matches the
  // checksum stored at upload time. This catches any silent corruption that
  // might slip through chunk-level checks.
  if (file.checksum && sha256(plaintext) !== file.checksum) {
    throw new Error(`File integrity check failed: ${file.name} — decrypted data does not match original`)
  }

  await db.file.update({ where: { id: fileId }, data: { lastAccessedAt: new Date() } })
  await db.activity.create({
    data: { userId, action: "download", details: JSON.stringify({ name: file.name, fileId }) },
  })

  return { buffer: plaintext, name: file.name, mimeType: file.mimeType }
}

export interface RangeResult {
  start: number
  end: number
  total: number
  contentLength: number
}

export function parseRange(rangeHeader: string | null | undefined, totalSize: number): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null
  const matches = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!matches) return null

  const [, startStr, endStr] = matches
  let start: number
  let end: number

  if (startStr && endStr) {
    start = parseInt(startStr, 10)
    end = parseInt(endStr, 10)
  } else if (startStr) {
    start = parseInt(startStr, 10)
    end = totalSize - 1
  } else if (endStr) {
    const suffix = parseInt(endStr, 10)
    start = Math.max(0, totalSize - suffix)
    end = totalSize - 1
  } else {
    return null
  }

  if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
    return null
  }

  return { start, end: Math.min(end, totalSize - 1) }
}

/**
 * STREAMING download — returns a ReadableStream that fetches each chunk from
 * the vault, decrypts it independently (per-chunk IV), and pipes it to the
 * client immediately. Bytes start flowing before the whole file is fetched.
 * Supports RFC 7233 Byte-Range requests for seeking in video/audio players.
 * This is the "bullet fast" path: no buffering the entire file in memory.
 */
export function streamFileFromVault(
  fileId: string,
  userId: string,
  rangeHeader?: string | null
): Promise<{
  stream: ReadableStream<Uint8Array>
  name: string
  mimeType: string
  size: number
  rangeResult: RangeResult | null
}> {
  return (async () => {
    const file = await db.file.findUnique({
      where: { id: fileId },
      include: { chunks: { orderBy: { index: "asc" } } },
    })
    if (!file || file.userId !== userId) throw new Error("File not found")
    if (file.trashed) throw new Error("File is in trash")

    const totalSize = Number(file.size)
    const parsedRange = parseRange(rangeHeader, totalSize)
    const rangeResult: RangeResult | null = parsedRange
      ? {
          start: parsedRange.start,
          end: parsedRange.end,
          total: totalSize,
          contentLength: parsedRange.end - parsedRange.start + 1,
        }
      : null

    const { user, isBot, targetChatId, sessionString, channelId, channelAccess, salt } =
      await getUserStorageContext(userId)

    // Non-blocking activity log + lastAccessed update
    db.file.update({ where: { id: fileId }, data: { lastAccessedAt: new Date() } }).catch(() => {})
    db.activity.create({ data: { userId, action: "download", details: JSON.stringify({ name: file.name, fileId, range: rangeResult ? `${rangeResult.start}-${rangeResult.end}` : "full" }) } }).catch(() => {})

    // If file uses erasure coding, fall back to non-streaming download
    // (erasure decoding requires all shards before reconstruction)
    if (file.dataShards > 0 && file.parityShards > 0) {
      const { buffer, name, mimeType } = await downloadFileFromVault(fileId, userId)
      const dataToStream = rangeResult
        ? buffer.subarray(rangeResult.start, rangeResult.end + 1)
        : buffer

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(dataToStream))
          controller.close()
        },
      })
      return { stream, name, mimeType, size: totalSize, rangeResult }
    }

    // Only use data shards for streaming (no parity)
    const chunks = file.chunks.filter((c) => !c.isParity)
    const fileIv = file.encIv!

    // Compute byte offsets for each data chunk to select only relevant chunks for range requests
    const chunkByteMap: { chunk: typeof chunks[0]; startByte: number; endByte: number; index: number }[] = []
    let currentOffset = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkSize = Number(chunk.plainSize) || CHUNK_SIZE
      const startByte = currentOffset
      const endByte = currentOffset + chunkSize - 1
      chunkByteMap.push({ chunk, startByte, endByte, index: i })
      currentOffset += chunkSize
    }

    // Filter to chunks needed for the requested range (or all if no range)
    const targetMap = rangeResult
      ? chunkByteMap.filter((m) => m.endByte >= rangeResult.start && m.startByte <= rangeResult.end)
      : chunkByteMap

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const PARALLEL = 3
          const prefetch: Promise<{ data: Buffer; mapEntry: typeof chunkByteMap[0] }>[] = []
          let nextIdx = 0

          async function fetchChunk(mapIdx: number): Promise<{ data: Buffer; mapEntry: typeof chunkByteMap[0] }> {
            const entry = targetMap[mapIdx]
            const chunk = entry.chunk
            const result = isBot
              ? await telegramService.downloadChunkViaBot(targetChatId, chunk.telegramMessageId)
              : await telegramService.downloadChunk(sessionString, channelId, channelAccess, chunk.telegramMessageId)
            let chunkBuf = result.buffer
            if (chunk.checksum && sha256(chunkBuf) !== chunk.checksum) {
              throw new Error(`Chunk ${chunk.index} integrity check failed`)
            }
            // Truncate to exact encrypted size (plainSize + 16 GCM tag bytes)
            const plainSizeNum = Number(chunk.plainSize)
            const expectedEncSize = plainSizeNum + 16
            if (chunkBuf.length > expectedEncSize) {
              chunkBuf = chunkBuf.subarray(0, expectedEncSize)
            }
            const iv = chunk.encIv || fileIv
            const plain = decryptBuffer(chunkBuf, iv, salt)
            const plainChunk = plain.subarray(0, plainSizeNum || plain.length)
            return { data: plainChunk, mapEntry: entry }
          }

          // Prime the prefetch queue
          for (let i = 0; i < Math.min(PARALLEL, targetMap.length); i++) {
            prefetch.push(fetchChunk(nextIdx++))
          }

          // Stream chunks in order
          while (prefetch.length > 0) {
            const { data, mapEntry } = await prefetch.shift()!
            let payload: Buffer = data

            if (rangeResult) {
              const sliceStart = Math.max(0, rangeResult.start - mapEntry.startByte)
              const sliceEnd = Math.min(data.length, rangeResult.end - mapEntry.startByte + 1)
              payload = data.subarray(sliceStart, sliceEnd)
            }

            if (payload.length > 0) {
              controller.enqueue(new Uint8Array(payload))
            }

            // Prefetch next chunk
            if (nextIdx < targetMap.length) {
              prefetch.push(fetchChunk(nextIdx++))
            }
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })

    return { stream, name: file.name, mimeType: file.mimeType, size: totalSize, rangeResult }
  })()
}

/** Delete a file's chunks from Telegram then the DB record (cascade kills shares). */
export async function deleteFileFromVault(fileId: string, userId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { chunks: true },
  })
  if (!file || file.userId !== userId) throw new Error("File not found")
  const { user, isBot, targetChatId, sessionString, channelId, channelAccess } =
    await getUserStorageContext(userId).catch(() => ({} as any))

  for (const chunk of file.chunks) {
    try {
      if (isBot) {
        await telegramService.deleteMessageViaBot(targetChatId, chunk.telegramMessageId)
      } else if (sessionString) {
        await telegramService.deleteMessage(sessionString, channelId, channelAccess, chunk.telegramMessageId)
      }
    } catch {}
  }
  // Cascade: deleting the File row cascades to FileChunk AND ShareLink (fileId).
  // Any existing share token / custom slug instantly 404s — recipients see the
  // deletion on-the-spot via the public view's aggressive refetch.
  await db.file.delete({ where: { id: fileId } })
  await db.activity.create({ data: { userId, action: "delete", details: JSON.stringify({ name: file.name }) } })
}

/** Recursively delete a folder + all subfolders + all files within (cascade). */
export async function deleteFolderRecursive(folderId: string, userId: string) {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: { files: { select: { id: true } }, children: { select: { id: true } } },
  })
  if (!folder || folder.userId !== userId) throw new Error("Folder not found")
  // Recurse into children
  for (const child of folder.children) {
    await deleteFolderRecursive(child.id, userId)
  }
  // Delete all files in this folder
  for (const f of folder.files) {
    await deleteFileFromVault(f.id, userId).catch(() => {})
  }
  await db.folder.delete({ where: { id: folderId } })
  await db.activity.create({ data: { userId, action: "folder_delete", details: JSON.stringify({ name: folder.name }) } })
}

/**
 * Recursively collect all files in a folder (and subfolders) with their paths.
 */
async function collectFolderFiles(folderId: string, basePath: string = ""): Promise<{ file: any; path: string }[]> {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: {
      files: { where: { trashed: false }, include: { chunks: { orderBy: { index: "asc" } } } },
      children: true,
    },
  })
  if (!folder) return []
  const result: { file: any; path: string }[] = []
  for (const f of folder.files) {
    result.push({ file: f, path: basePath ? `${basePath}/${f.name}` : f.name })
  }
  for (const child of folder.children) {
    if (child.trashed) continue
    const childPath = basePath ? `${basePath}/${child.name}` : child.name
    result.push(...await collectFolderFiles(child.id, childPath))
  }
  return result
}

/**
 * Stream a folder as a ZIP. Each file is fetched from the vault, decrypted
 * (with erasure-coding/parity handling via downloadFileFromVault), and appended
 * to the archive. The web stream is returned immediately and data flows to the
 * client as each file is processed — no buffering the whole folder in memory.
 */
export function streamFolderZipFromVault(folderId: string, userId: string): Promise<{
  stream: ReadableStream<Uint8Array>
  name: string
  size: number
}> {
  return (async () => {
    const folder = await db.folder.findUnique({ where: { id: folderId } })
    if (!folder || folder.userId !== userId) throw new Error("Folder not found")

    const files = await collectFolderFiles(folderId)
    if (files.length === 0) throw new Error("This folder is empty — nothing to download")

    const archive = new ZipArchive()
    const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>

    // Fill the archive asynchronously — data flows to the client as files are
    // downloaded + decrypted. If every file fails, destroy the stream with an
    // error so the user sees a real message instead of a blank zip.
    ;(async () => {
      let added = 0
      for (const { file, path } of files) {
        try {
          const { buffer } = await downloadFileFromVault(file.id, userId)
          archive.append(buffer, { name: path, date: file.createdAt })
          added++
        } catch (e) {
          console.error(`[folder-zip] failed to add ${path}:`, e)
        }
      }
      if (added === 0) {
        archive.destroy(new Error("Failed to download any files from this folder"))
        return
      }
      archive.finalize()
    })().catch((e) => archive.destroy(e))

    return { stream: webStream, name: folder.name, size: 0 }
  })()
}

/**
 * Stream a BATCH share (multiple standalone files + multiple folders) as a
 * single ZIP. Each standalone file is placed at the zip root; each folder's
 * contents are placed under a "<folder-name>/" prefix (preserving the tree).
 *
 * Uses downloadFileFromVault per file so erasure coding, parity shards, and
 * checksums are all handled correctly. Errors are NOT swallowed — if every
 * file fails, the request errors out instead of silently producing an empty zip.
 *
 * Used by the "Download all" button on a batch share page.
 */
export function streamBatchZipFromVault(
  items: { fileId?: string | null; folderId?: string | null }[],
  userId: string,
  zipName: string
): Promise<{
  stream: ReadableStream<Uint8Array>
  name: string
  size: number
}> {
  return (async () => {
    // Collect every (fileId, zip-path) pair in the batch.
    // - Standalone files → root of the zip, using the file's own name.
    // - Folders → recursively collected, prefixed with "<folder-name>/".
    const entries: { fileId: string; path: string }[] = []
    const usedPaths = new Set<string>()

    // Standalone files first.
    const standaloneFileIds = items
      .filter((it) => it.fileId)
      .map((it) => it.fileId!) as string[]
    if (standaloneFileIds.length > 0) {
      const files = await db.file.findMany({
        where: { id: { in: standaloneFileIds }, trashed: false },
        select: { id: true, name: true, createdAt: true },
      })
      for (const f of files) {
        entries.push({ fileId: f.id, path: uniquePath(f.name, usedPaths) })
      }
    }

    // Then each folder (recursively).
    const folderIds = items
      .filter((it) => it.folderId)
      .map((it) => it.folderId!) as string[]
    for (const folderId of folderIds) {
      const folder = await db.folder.findUnique({ where: { id: folderId } })
      if (!folder || folder.trashed) continue
      const baseName = uniquePath(folder.name, usedPaths, true)
      const folderFiles = await collectFolderFiles(folderId, baseName)
      for (const ff of folderFiles) {
        entries.push({ fileId: ff.file.id, path: uniquePath(ff.path, usedPaths) })
      }
    }

    if (entries.length === 0) throw new Error("No files to download in this share")

    const archive = new ZipArchive()
    const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>

    // Fill the archive asynchronously — data flows to the client as files are
    // downloaded + decrypted. If every file fails, destroy the stream with an
    // error so the user sees a real message instead of a blank zip.
    ;(async () => {
      let added = 0
      const failures: string[] = []
      for (const { fileId, path } of entries) {
        try {
          const { buffer } = await downloadFileFromVault(fileId, userId)
          archive.append(buffer, { name: path })
          added++
        } catch (e) {
          console.error(`[batch-zip] failed to add ${path}:`, e)
          failures.push(path)
        }
      }
      if (added === 0) {
        archive.destroy(new Error(`Failed to download any files. ${failures.length} file(s) failed.`))
        return
      }
      archive.finalize()
    })().catch((e) => archive.destroy(e))

    return { stream: webStream, name: zipName, size: 0 }
  })()
}

/** Ensure a zip entry path doesn't collide with one already added. */
function uniquePath(name: string, used: Set<string>, isDir: false): string
function uniquePath(name: string, used: Set<string>, isDir: true): string
function uniquePath(name: string, used: Set<string>, isDir = false): string {
  let candidate = name
  let n = 1
  while (used.has(candidate)) {
    const dot = name.lastIndexOf(".")
    if (isDir || dot <= 0) {
      candidate = `${name} (${n})`
    } else {
      candidate = `${name.slice(0, dot)} (${n})${name.slice(dot)}`
    }
    n++
  }
  used.add(candidate)
  return candidate
}

