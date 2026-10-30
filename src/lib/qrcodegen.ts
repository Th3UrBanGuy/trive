/**
 * Pure TypeScript QR Code generator (zero external dependencies).
 * Generates standards-compliant QR Code (ISO/IEC 18004) Model 2 matrices.
 */

export const Ecc = {
  LOW: 0,
  MEDIUM: 1,
  QUARTILE: 2,
  HIGH: 3,
} as const
export type Ecc = (typeof Ecc)[keyof typeof Ecc]

export class QrSegment {
  public constructor(
    public readonly mode: Mode,
    public readonly numChars: number,
    public readonly bitData: number[]
  ) {}

  public static makeBytes(data: Uint8Array): QrSegment {
    const bb: number[] = []
    for (const b of data) {
      for (let i = 7; i >= 0; i--) {
        bb.push((b >>> i) & 1)
      }
    }
    return new QrSegment(Mode.BYTE, data.length, bb)
  }

  public static makeText(text: string): QrSegment {
    const enc = new TextEncoder().encode(text)
    return QrSegment.makeBytes(enc)
  }
}

export class Mode {
  public static readonly NUMERIC = new Mode(0x1, [10, 12, 14])
  public static readonly ALPHANUMERIC = new Mode(0x2, [9, 11, 13])
  public static readonly BYTE = new Mode(0x4, [8, 16, 16])
  public static readonly KANJI = new Mode(0x8, [8, 10, 12])

  private constructor(
    public readonly modeBits: number,
    private readonly numBitsCharCount: [number, number, number]
  ) {}

  public numCharCountBits(version: number): number {
    return this.numBitsCharCount[Math.floor((version + 7) / 17)]
  }
}

export class QrCodeModel {
    public readonly size: number
    private readonly modules: boolean[][] = []

    public constructor(
      public readonly version: number,
      public readonly errorCorrectionLevel: Ecc,
      dataCodewords: Uint8Array,
      msk: number
    ) {
      this.size = version * 4 + 17
      for (let y = 0; y < this.size; y++) {
        this.modules.push(new Array(this.size).fill(false))
      }
      const isFunction: boolean[][] = []
      for (let y = 0; y < this.size; y++) {
        isFunction.push(new Array(this.size).fill(false))
      }

      this.drawFunctionPatterns(isFunction)
      const allCodewords = this.addEccAndInterleave(dataCodewords)
      this.drawCodewords(allCodewords, isFunction)

      if (msk === -1) {
        let minPenalty = 1e9
        let bestMask = 0
        for (let i = 0; i < 8; i++) {
          this.applyMask(i, isFunction)
          this.drawFormatBits(i)
          const penalty = this.getPenaltyScore()
          if (penalty < minPenalty) {
            minPenalty = penalty
            bestMask = i
          }
          this.applyMask(i, isFunction)
        }
        msk = bestMask
      }
      this.applyMask(msk, isFunction)
      this.drawFormatBits(msk)
    }

    public getModule(x: number, y: number): boolean {
      return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x]
    }

    private drawFunctionPatterns(isFunction: boolean[][]): void {
      for (let i = 0; i < this.size; i++) {
        this.setFunctionModule(6, i, i % 2 === 0, isFunction)
        this.setFunctionModule(i, 6, i % 2 === 0, isFunction)
      }
      this.drawFinderPattern(3, 3, isFunction)
      this.drawFinderPattern(this.size - 4, 3, isFunction)
      this.drawFinderPattern(3, this.size - 4, isFunction)

      const alignPatPos = this.getAlignmentPatternPositions()
      for (let i = 0; i < alignPatPos.length; i++) {
        for (let j = 0; j < alignPatPos.length; j++) {
          if (
            (i === 0 && j === 0) ||
            (i === 0 && j === alignPatPos.length - 1) ||
            (i === alignPatPos.length - 1 && j === 0)
          ) {
            continue
          }
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j], isFunction)
        }
      }
      this.drawFormatBits(0)
      if (this.version >= 7) {
        this.drawVersion(isFunction)
      }
    }

    private drawFinderPattern(x: number, y: number, isFunction: boolean[][]): void {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy))
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
            this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4, isFunction)
          }
        }
      }
    }

    private drawAlignmentPattern(x: number, y: number, isFunction: boolean[][]): void {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, isFunction)
        }
      }
    }

    private setFunctionModule(x: number, y: number, isDark: boolean, isFunction: boolean[][]): void {
      this.modules[y][x] = isDark
      isFunction[y][x] = true
    }

    private drawFormatBits(mask: number): void {
      const eccBits = [1, 0, 3, 2][this.errorCorrectionLevel]
      let data = (eccBits << 3) | mask
      let rem = data
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
      const bits = ((data << 10) | rem) ^ 0x5412

      for (let i = 0; i <= 5; i++) this.modules[8][i] = ((bits >>> i) & 1) !== 0
      this.modules[8][7] = ((bits >>> 6) & 1) !== 0
      this.modules[8][8] = ((bits >>> 7) & 1) !== 0
      this.modules[7][8] = ((bits >>> 8) & 1) !== 0
      for (let i = 9; i < 15; i++) this.modules[14 - i][8] = ((bits >>> i) & 1) !== 0

      for (let i = 0; i < 8; i++) this.modules[this.size - 1 - i][8] = ((bits >>> i) & 1) !== 0
      for (let i = 8; i < 15; i++) this.modules[8][this.size - 15 + i] = ((bits >>> i) & 1) !== 0
      this.modules[this.size - 8][8] = true
    }

    private drawVersion(isFunction: boolean[][]): void {
      let rem = this.version
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
      const bits = (this.version << 12) | rem
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) !== 0
        const a = this.size - 11 + (i % 3)
        const b = Math.floor(i / 3)
        this.setFunctionModule(a, b, bit, isFunction)
        this.setFunctionModule(b, a, bit, isFunction)
      }
    }

    private getAlignmentPatternPositions(): number[] {
      if (this.version === 1) return []
      const num = Math.floor(this.version / 7) + 2
      const step =
        this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (num * 2 - 2)) * 2
      const result = [6]
      for (let pos = this.size - 7; result.length < num; pos -= step) {
        result.splice(1, 0, pos)
      }
      return result
    }

    private addEccAndInterleave(data: Uint8Array): Uint8Array {
      const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[this.errorCorrectionLevel][this.version]
      const blockEccLen = ECC_CODEWORDS_PER_BLOCK[this.errorCorrectionLevel][this.version]
      const rawCodewords = Math.floor(getNumRawDataModules(this.version) / 8)
      const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
      const shortBlockLen = Math.floor(rawCodewords / numBlocks)

      const blocks: Uint8Array[] = []
      const rsDiv = reedSolomonComputeDivisor(blockEccLen)
      for (let i = 0, k = 0; i < numBlocks; i++) {
        const datLen = shortBlockLen - blockEccLen + (i >= numShortBlocks ? 1 : 0)
        const dat = data.slice(k, k + datLen)
        k += datLen
        const ecc = reedSolomonComputeRemainder(dat, rsDiv)
        const block = new Uint8Array(dat.length + ecc.length)
        block.set(dat)
        block.set(ecc, dat.length)
        blocks.push(block)
      }

      const result = new Uint8Array(rawCodewords)
      let idx = 0
      for (let i = 0; i < blocks[0].length; i++) {
        for (let j = 0; j < blocks.length; j++) {
          if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
            result[idx++] = blocks[j][i]
          }
        }
      }
      return result
    }

    private drawCodewords(data: Uint8Array, isFunction: boolean[][]): void {
      let i = 0
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j
            const upwards = ((right + 1) & 2) === 0
            const y = upwards ? this.size - 1 - vert : vert
            if (!isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
              i++
            }
          }
        }
      }
    }

    private applyMask(mask: number, isFunction: boolean[][]): void {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (isFunction[y][x]) continue
          let invert: boolean
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break
            case 1: invert = y % 2 === 0; break
            case 2: invert = x % 3 === 0; break
            case 3: invert = (x + y) % 3 === 0; break
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
            default: throw new Error("Invalid mask")
          }
          if (invert) this.modules[y][x] = !this.modules[y][x]
        }
      }
    }

    private getPenaltyScore(): number {
      let result = 0
      for (let y = 0; y < this.size; y++) {
        let runColor = false
        let runVal = 0
        const runHistory = [0, 0, 0, 0, 0, 0, 0]
        for (let x = 0; x < this.size; x++) {
          if (this.modules[y][x] === runColor) {
            runVal++
            if (runVal === 5) result += 3
            else if (runVal > 5) result++
          } else {
            this.finderPenaltyAddHistory(runVal, runHistory)
            if (!runColor && this.finderPenaltyCountPatterns(runHistory)) result += 40
            runColor = this.modules[y][x]
            runVal = 1
          }
        }
        this.finderPenaltyAddHistory(runVal, runHistory)
        if (!runColor && this.finderPenaltyCountPatterns(runHistory)) result += 40
      }

      for (let x = 0; x < this.size; x++) {
        let runColor = false
        let runVal = 0
        const runHistory = [0, 0, 0, 0, 0, 0, 0]
        for (let y = 0; y < this.size; y++) {
          if (this.modules[y][x] === runColor) {
            runVal++
            if (runVal === 5) result += 3
            else if (runVal > 5) result++
          } else {
            this.finderPenaltyAddHistory(runVal, runHistory)
            if (!runColor && this.finderPenaltyCountPatterns(runHistory)) result += 40
            runColor = this.modules[y][x]
            runVal = 1
          }
        }
        this.finderPenaltyAddHistory(runVal, runHistory)
        if (!runColor && this.finderPenaltyCountPatterns(runHistory)) result += 40
      }

      let total = 0
      let black = 0
      for (const row of this.modules) {
        for (const color of row) {
          if (color) black++
          total++
        }
      }
      const k = Math.floor(Math.abs(black * 20 - total * 10) / total) - 1
      result += Math.max(0, k) * 10
      return result
    }

    private finderPenaltyAddHistory(currentRunLength: number, runHistory: number[]): void {
      if (runHistory[0] === 0) currentRunLength += this.size
      runHistory.pop()
      runHistory.unshift(currentRunLength)
    }

    private finderPenaltyCountPatterns(runHistory: number[]): boolean {
      const n = runHistory[1]
      return (
        n > 0 &&
        runHistory[2] === n &&
        runHistory[3] === n * 3 &&
        runHistory[4] === n &&
        runHistory[5] === n
      )
    }

    public static encodeText(text: string, ecl: Ecc): QrCodeModel {
      const seg = QrSegment.makeText(text)
      return QrCodeModel.encodeSegments([seg], ecl)
    }

    public static encodeSegments(segs: QrSegment[], ecl: Ecc): QrCodeModel {
      for (let version = 1; version <= 40; version++) {
        const dataCapacityBits = getNumDataCodewords(version, ecl) * 8
        const dataUsedBits = getTotalBits(segs, version)
        if (dataUsedBits !== -1 && dataUsedBits <= dataCapacityBits) {
          const bb: number[] = []
          for (const seg of segs) {
            appendBits(seg.mode.modeBits, 4, bb)
            appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb)
            for (const b of seg.bitData) bb.push(b)
          }
          appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb)
          appendBits(0, (8 - (bb.length % 8)) % 8, bb)
          const padByte = [0xec, 0x11]
          for (let padIdx = 0; bb.length < dataCapacityBits; padIdx++) {
            appendBits(padByte[padIdx % 2], 8, bb)
          }
          const bytes = new Uint8Array(bb.length / 8)
          for (let i = 0; i < bb.length; i += 8) {
            let val = 0
            for (let j = 0; j < 8; j++) val = (val << 1) | bb[i + j]
            bytes[i >>> 3] = val
          }
          return new QrCodeModel(version, ecl, bytes, -1)
        }
      }
      throw new Error("Data too long for QR Code")
    }
  }

  function appendBits(val: number, len: number, bb: number[]): void {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1)
  }

  function getTotalBits(segs: QrSegment[], version: number): number {
    let result = 0
    for (const seg of segs) {
      const cc = seg.mode.numCharCountBits(version)
      if (seg.numChars >= 1 << cc) return -1
      result += 4 + cc + seg.bitData.length
    }
    return result
  }

  function getNumRawDataModules(ver: number): number {
    let result = (16 * ver + 128) * ver + 64
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2
      result -= (25 * numAlign - 10) * numAlign - 55
      if (ver >= 7) result -= 36
    }
    return result
  }

  function getNumDataCodewords(ver: number, ecl: Ecc): number {
    return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
  }

  function reedSolomonComputeDivisor(degree: number): Uint8Array {
    const result = new Uint8Array(degree)
    result[degree - 1] = 1
    let root = 1
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = reedSolomonMultiply(result[j], root)
        if (j + 1 < result.length) result[j] ^= result[j + 1]
      }
      root = reedSolomonMultiply(root, 0x02)
    }
    return result
  }

  function reedSolomonComputeRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
    const result = new Uint8Array(divisor.length)
    for (const b of data) {
      const factor = b ^ result[0]
      result.copyWithin(0, 1)
      result[result.length - 1] = 0
      for (let i = 0; i < divisor.length; i++) {
        result[i] ^= reedSolomonMultiply(divisor[i], factor)
      }
    }
    return result
  }

  function reedSolomonMultiply(x: number, y: number): number {
    let z = 0
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d)
      z ^= ((y >>> i) & 1) * x
    }
    return z
  }

  const ECC_CODEWORDS_PER_BLOCK: number[][] = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ]

  const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ]
