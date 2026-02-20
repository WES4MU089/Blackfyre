/**
 * Generates a 32x32 PNG tray icon for Blackfyre HUD.
 * Uses only Node.js built-ins (no external image libraries).
 *
 * Design: Gold flame/dragon silhouette on dark background with gold border.
 * Theme colors: gold #c9a84c, dark #0a0a0f
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const W = 32, H = 32

// RGBA pixel buffer
const pixels = Buffer.alloc(W * H * 4, 0)

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a
}

function fillRect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      set(x, y, r, g, b, a)
}

// Background: dark with slight transparency
fillRect(0, 0, 31, 31, 10, 10, 15, 0) // transparent bg

// Rounded border in dark gold
const borderColor = [130, 105, 45, 200]
// Top/bottom edges
for (let x = 3; x <= 28; x++) { set(x, 0, ...borderColor); set(x, 31, ...borderColor) }
// Left/right edges
for (let y = 3; y <= 28; y++) { set(0, y, ...borderColor); set(31, y, ...borderColor) }
// Corner pixels for rounding
const crnr = [130, 105, 45, 140]
set(1, 1, ...crnr); set(30, 1, ...crnr); set(1, 30, ...crnr); set(30, 30, ...crnr)
set(2, 0, ...crnr); set(29, 0, ...crnr); set(0, 2, ...crnr); set(31, 2, ...crnr)
set(2, 31, ...crnr); set(29, 31, ...crnr); set(0, 29, ...crnr); set(31, 29, ...crnr)
set(1, 2, ...borderColor); set(2, 1, ...borderColor)
set(30, 2, ...borderColor); set(29, 1, ...borderColor)
set(1, 29, ...borderColor); set(2, 30, ...borderColor)
set(30, 29, ...borderColor); set(29, 30, ...borderColor)

// Fill inside border with dark bg
fillRect(1, 3, 30, 28, 10, 10, 15, 230)
fillRect(2, 2, 29, 29, 10, 10, 15, 230)
fillRect(3, 1, 28, 30, 10, 10, 15, 230)

// Draw a stylized flame shape (dragon fire)
// Outer flame: gold gradient from bright at top to darker at base
const flame = [
  // [y, xStart, xEnd] - inclusive ranges
  // Flame tip (bright gold)
  [4, 15, 16],
  [5, 14, 17],
  [6, 14, 17],
  [7, 13, 18],
  // Flame body (standard gold)
  [8, 12, 19],
  [9, 12, 19],
  [10, 11, 20],
  [11, 11, 20],
  [12, 10, 21],
  [13, 10, 21],
  [14, 10, 21],
  [15, 10, 21],
  // Flame base (wider, darker)
  [16, 9, 22],
  [17, 9, 22],
  [18, 9, 22],
  // Flame tongues splitting at bottom
  [19, 9, 14],
  [19, 17, 22],
  [20, 10, 13],
  [20, 18, 21],
  [21, 11, 12],
  [21, 19, 20],
]

// Gold gradient: bright at top, darker at base
for (const [y, x0, x1] of flame) {
  const t = (y - 4) / 17 // 0 at top, 1 at bottom
  const r = Math.round(240 - t * 80)
  const g = Math.round(210 - t * 90)
  const b = Math.round(110 - t * 70)
  for (let x = x0; x <= x1; x++) set(x, y, r, g, b)
}

// Inner bright core (white-gold center)
const core = [
  [6, 15, 16],
  [7, 14, 17],
  [8, 14, 17],
  [9, 14, 17],
  [10, 13, 18],
  [11, 13, 18],
  [12, 13, 18],
  [13, 13, 18],
  [14, 14, 17],
  [15, 14, 17],
  [16, 14, 17],
  [17, 13, 18],
]

for (const [y, x0, x1] of core) {
  const t = (y - 6) / 11
  const r = Math.round(255 - t * 30)
  const g = Math.round(240 - t * 50)
  const b = Math.round(170 - t * 80)
  for (let x = x0; x <= x1; x++) set(x, y, r, g, b)
}

// Small ember dots below flame
set(12, 23, 180, 140, 50, 180)
set(19, 23, 180, 140, 50, 180)
set(15, 24, 160, 120, 40, 140)
set(16, 24, 160, 120, 40, 140)

// --- Encode PNG ---
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeData))
  return Buffer.concat([len, typeData, crc])
}

// IHDR: width, height, bit depth 8, color type 6 (RGBA), compression 0, filter 0, interlace 0
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8   // bit depth
ihdr[9] = 6   // RGBA
ihdr[10] = 0  // compression
ihdr[11] = 0  // filter
ihdr[12] = 0  // interlace

// Raw image data: each row has a filter byte (0 = None) followed by RGBA pixels
const rawRows = []
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 4)
  row[0] = 0 // filter: None
  pixels.copy(row, 1, y * W * 4, (y + 1) * W * 4)
  rawRows.push(row)
}
const rawData = Buffer.concat(rawRows)
const compressed = deflateSync(rawData)

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const png = Buffer.concat([
  signature,
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', compressed),
  makeChunk('IEND', Buffer.alloc(0))
])

const outDir = join(__dirname, '..', 'resources')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'tray-icon.png')
writeFileSync(outPath, png)

// Also output as base64 for inline use
const b64 = png.toString('base64')
console.log(`Wrote ${png.length} bytes to ${outPath}`)
console.log(`Base64 (${b64.length} chars):`)
console.log(b64)
