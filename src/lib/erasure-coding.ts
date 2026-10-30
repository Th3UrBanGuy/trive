/**
 * Reed-Solomon Erasure Coding over GF(2^8).
 *
 * Splits data into N data shards, computes M parity shards using Vandermonde
 * matrix over GF(2^8). Any N out of N+M shards can reconstruct the original.
 *
 * This provides fault tolerance: if some Telegram messages (chunks) are lost
 * or corrupted, the parity shards can reconstruct the missing data — without
 * the 300% overhead of full replication. Typical overhead is ~50% (M = N/2).
 *
 * Based on the standard GF(2^8) with generator polynomial 0x11d (x^8+x^4+x^3+x^2+1).
 */

// ---- GF(2^8) arithmetic tables ----

const GF_SIZE = 256
const PRIMITIVE_POLY = 0x11d // x^8 + x^4 + x^3 + x^2 + 1

const expTable = new Uint8Array(GF_SIZE * 2) // doubled for easy mod
const logTable = new Uint8Array(GF_SIZE)

;(function initGF() {
  let x = 1
  for (let i = 0; i < GF_SIZE - 1; i++) {
    expTable[i] = x
    logTable[x] = i
    x <<= 1
    if (x & GF_SIZE) x ^= PRIMITIVE_POLY
  }
  // Duplicate the exp table for easy modular arithmetic
  for (let i = GF_SIZE - 1; i < GF_SIZE * 2; i++) {
    expTable[i] = expTable[i - (GF_SIZE - 1)]
  }
})()

/** GF(2^8) multiply */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return expTable[logTable[a] + logTable[b]]
}

/** GF(2^8) divide */
function gfDiv(a: number, b: number): number {
  if (a === 0) return 0
  if (b === 0) throw new Error("GF division by zero")
  return expTable[(logTable[a] - logTable[b] + GF_SIZE - 1) % (GF_SIZE - 1)]
}

/** GF(2^8) inverse */
function gfInv(a: number): number {
  if (a === 0) throw new Error("GF inverse of zero")
  return expTable[(GF_SIZE - 1) - logTable[a]]
}

// ---- Matrix operations over GF(2^8) ----

function matrixMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length
  const cols = b[0].length
  const inner = b.length
  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0))
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0
      for (let k = 0; k < inner; k++) {
      sum ^= gfMul(a[i][k], b[k][j])
      }
      result[i][j] = sum
    }
  }
  return result
}

function matrixInverse(m: number[][]): number[][] {
  const n = m.length
  // Augment with identity
  const aug = m.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))])

  // Gaussian elimination over GF(2^8)
  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivot = -1
    for (let row = col; row < n; row++) {
      if (aug[row][col] !== 0) {
      pivot = row
      break
      }
    }
    if (pivot === -1) throw new Error("Matrix is singular")
    // Swap
    ;[aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    // Scale pivot row
    const scale = gfInv(aug[col][col])
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] = gfMul(aug[col][j], scale)
    }
    // Eliminate
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      if (factor === 0) continue
      for (let j = 0; j < 2 * n; j++) {
      aug[row][j] ^= gfMul(factor, aug[col][j])
      }
    }
  }

  return aug.map((row) => row.slice(n))
}

// ---- Vandermonde matrix for Reed-Solomon ----

function vandermonde(rows: number, cols: number): number[][] {
  const m: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0))
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      m[i][j] = i === 0 && j === 0 ? 1 : gfPow(i, j)
    }
  }
  return m
}

function gfPow(base: number, exp: number): number {
  if (exp === 0) return 1
  if (base === 0) return 0
  return expTable[(logTable[base] * exp) % (GF_SIZE - 1)]
}

// ---- Public API ----

export interface ErasureConfig {
  dataShards: number // N
  parityShards: number // M
}

export interface ErasureShard {
  index: number // 0..N-1 = data shard, N..N+M-1 = parity shard
  data: Buffer
  isParity: boolean
}

/**
 * Encode data into N data shards + M parity shards.
 * Returns all N+M shards as Buffers of equal size (padded with zeros if needed).
 *
 * @param data The original data to encode
 * @param dataShards Number of data shards (N)
 * @param parityShards Number of parity shards (M)
 * @returns Array of N+M shard Buffers
 */
export function encode(data: Buffer, dataShards: number, parityShards: number): Buffer[] {
  const totalShards = dataShards + parityShards
  if (dataShards < 1) throw new Error("dataShards must be >= 1")
  if (parityShards < 0) throw new Error("parityShards must be >= 0")

  // Calculate shard size (pad data to be divisible by dataShards)
  const shardSize = Math.ceil(data.length / dataShards)
  const paddedLength = shardSize * dataShards
  const padded = Buffer.alloc(paddedLength)
  data.copy(padded)

  // Split into data shards
  const dataShardBuffers: Buffer[] = []
  for (let i = 0; i < dataShards; i++) {
    dataShardBuffers.push(padded.subarray(i * shardSize, (i + 1) * shardSize))
  }

  if (parityShards === 0) {
    return dataShardBuffers
  }

  // Build Vandermonde coding matrix: totalShards × dataShards
  const vdm = vandermonde(totalShards, dataShards)

  // The top dataShards × dataShards portion should be identity (for systematic encoding)
  // Invert the top portion and multiply to get a systematic generator matrix
  const topMatrix = vdm.slice(0, dataShards)
  const topInverse = matrixInverse(topMatrix)
  const generatorMatrix = matrixMul(vdm, topInverse)

  // Verify: top of generator should be identity
  // (it will be due to the inverse multiplication)

  // Compute parity shards
  const parityBuffers: Buffer[] = []
  for (let p = 0; p < parityShards; p++) {
    const parityBuf = Buffer.alloc(shardSize)
    const row = generatorMatrix[dataShards + p]
    for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
      let val = 0
      for (let d = 0; d < dataShards; d++) {
      val ^= gfMul(row[d], dataShardBuffers[d][byteIdx])
      }
      parityBuf[byteIdx] = val
    }
    parityBuffers.push(parityBuf)
  }

  return [...dataShardBuffers, ...parityBuffers]
}

/**
 * Reconstruct missing shards from available ones using Reed-Solomon decoding.
 *
 * @param shards Array of N+M shards (null for missing ones)
 * @param dataShards N
 * @param parityShards M
 * @param originalLength The original data length (to trim padding)
 * @returns The reconstructed original data
 */
export function decode(
  shards: (Buffer | null)[],
  dataShards: number,
  parityShards: number,
  originalLength: number
): Buffer {
  const totalShards = dataShards + parityShards

  // Find available shards
  const availableIndices: number[] = []
  const availableShards: Buffer[] = []
  for (let i = 0; i < totalShards; i++) {
    if (shards[i] !== null) {
      availableIndices.push(i)
      availableShards.push(shards[i]!)
    }
  }

  if (availableShards.length < dataShards) {
    throw new Error(
      `Not enough shards to reconstruct: have ${availableShards.length}, need ${dataShards}`
    )
  }

  // If all data shards are available, just concatenate
  const allDataAvailable = availableIndices.slice(0, dataShards).every((idx, i) => idx === i)
  if (allDataAvailable && availableIndices.length >= dataShards) {
    // Use only the first dataShards available data shards
    const shardSize = availableShards[0].length
    const result = Buffer.alloc(shardSize * dataShards)
    for (let i = 0; i < dataShards; i++) {
      availableShards[i].copy(result, i * shardSize)
    }
    return result.subarray(0, originalLength)
  }

  // Need to reconstruct: build the decoding matrix
  // Take the first `dataShards` available shards
  const useIndices = availableIndices.slice(0, dataShards)
  const useShards = availableShards.slice(0, dataShards)

  const shardSize = useShards[0].length

  // Build the GENERATOR matrix (same as encode): vdm * topInverse
  // The generator's top N rows are identity (systematic encoding),
  // and its bottom M rows are the parity coding rows.
  // The relationship is: all_shards = generator * data_shards
  // So to decode: data_shards = generator_sub^(-1) * available_shards
  // (NOT vdm_sub^(-1) — using the raw Vandermonde is a bug that produces wrong data)
  const vdm = vandermonde(totalShards, dataShards)
  const topMatrix = vdm.slice(0, dataShards)
  const topInverse = matrixInverse(topMatrix)
  const generatorMatrix = matrixMul(vdm, topInverse)

  // Build the submatrix of the GENERATOR matrix for the available shards
  const subMatrix: number[][] = []
  for (const idx of useIndices) {
    subMatrix.push(generatorMatrix[idx])
  }

  // Invert the submatrix
  const decodeMatrix = matrixInverse(subMatrix)

  // Reconstruct data shards
  const result = Buffer.alloc(shardSize * dataShards)
  for (let dataIdx = 0; dataIdx < dataShards; dataIdx++) {
    const row = decodeMatrix[dataIdx]
    for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
      let val = 0
      for (let s = 0; s < dataShards; s++) {
      val ^= gfMul(row[s], useShards[s][byteIdx])
      }
      result[dataIdx * shardSize + byteIdx] = val
    }
  }

  return result.subarray(0, originalLength)
}

/**
 * Calculate optimal parity shards for a given number of data shards.
 * Targets ~150% storage overhead (50% parity overhead).
 * Minimum 2 parity shards for meaningful fault tolerance.
 */
export function calculateParityShards(dataShards: number): number {
  return Math.max(2, Math.ceil(dataShards * 0.5))
}

/**
 * Check if erasure coding can recover from the given number of missing shards.
 */
export function canRecover(missingShards: number, parityShards: number): boolean {
  return missingShards <= parityShards
}
