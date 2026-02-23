/**
 * Gauntlet Engine — Client-side A* pathfinding on a sampled terrain grid.
 *
 * The terrain texture map is sampled into a coarse grid (default 8px cells).
 * Each cell stores a movement cost and per-unit-type passability flags derived
 * from the terrain + passability texture maps.  A* runs on this grid with
 * 8-directional movement, returning a list of world-pixel waypoints the unit
 * follows.
 *
 * Passability channels (from passability texture map):
 *   Green channel → Land + Dragon
 *   Blue  channel → Naval + Dragon
 *   Red   channel → Dragon only
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnitType = 'land' | 'naval' | 'dragon'

export interface GridCell {
  cost: number
  passable: boolean     // backward compat — true if any unit can pass
  passLand: boolean     // green channel
  passNaval: boolean    // green or blue channel
  passDragon: boolean   // green, blue, or red channel
}

export interface PathNode {
  gx: number      // grid x
  gy: number      // grid y
  worldX: number  // pixel x (center of cell)
  worldY: number  // pixel y (center of cell)
}

export interface TerrainDef {
  hex_color: string
  movement_cost: number
  is_passable: boolean
}

// ---------------------------------------------------------------------------
// Passability helpers
// ---------------------------------------------------------------------------

/** Check whether a cell is passable for a given unit type */
export function isPassableFor(cell: GridCell, unitType: UnitType): boolean {
  switch (unitType) {
    case 'dragon': return cell.passDragon
    case 'naval':  return cell.passNaval
    case 'land':   return cell.passLand
  }
}

/**
 * Detect channel distribution in a passability texture map.
 * Classifies each pixel by its dominant channel above the threshold.
 */
export function detectPassabilityChannels(
  imageData: ImageData,
  threshold = 128,
): { red: number; green: number; blue: number; black: number; total: number } {
  const data = imageData.data
  const total = imageData.width * imageData.height
  let red = 0, green = 0, blue = 0, black = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    if (g >= threshold && g >= r && g >= b) green++
    else if (b >= threshold && b >= r) blue++
    else if (r >= threshold) red++
    else black++
  }

  return { red, green, blue, black, total }
}

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

/** Parse "#RRGGBB" → [R, G, B] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/** Squared Euclidean distance between two RGB colors */
function colorDistSq(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
}

/**
 * Build the pathfinding grid from the terrain texture map ImageData.
 *
 * For each gridSize×gridSize block we sample the center pixel and match it
 * against the provided terrain definitions.  The closest color within
 * `tolerance` wins; unmatched pixels get cost=1, passable=true.
 *
 * All three passability flags default to match is_passable from terrain defs.
 * Call `applyPassability()` afterward to overlay channel-based unit access.
 */
export function buildGrid(
  imageData: ImageData,
  terrainDefs: TerrainDef[],
  mapWidth: number,
  mapHeight: number,
  gridSize: number,
  tolerance = 30,
): GridCell[][] {
  const cols = Math.ceil(mapWidth / gridSize)
  const rows = Math.ceil(mapHeight / gridSize)
  const tolSq = tolerance * tolerance * 3 // per-channel tolerance squared × 3 channels

  // Pre-parse terrain colors
  const parsed = terrainDefs.map(t => ({
    rgb: hexToRgb(t.hex_color),
    cost: t.movement_cost,
    passable: t.is_passable,
  }))

  const grid: GridCell[][] = new Array(rows)
  const data = imageData.data
  const imgW = imageData.width

  for (let gy = 0; gy < rows; gy++) {
    grid[gy] = new Array(cols)
    const py = Math.min(gy * gridSize + Math.floor(gridSize / 2), mapHeight - 1)

    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(gx * gridSize + Math.floor(gridSize / 2), mapWidth - 1)
      const idx = (py * imgW + px) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      // Find best matching terrain
      let bestDist = Infinity
      let bestTerrain: { cost: number; passable: boolean } | null = null

      for (const t of parsed) {
        const d = colorDistSq(r, g, b, t.rgb[0], t.rgb[1], t.rgb[2])
        if (d < bestDist) {
          bestDist = d
          bestTerrain = t
        }
      }

      if (bestTerrain && bestDist <= tolSq) {
        const p = bestTerrain.passable
        grid[gy][gx] = { cost: bestTerrain.cost, passable: p, passLand: p, passNaval: p, passDragon: p }
      } else {
        grid[gy][gx] = { cost: 1, passable: true, passLand: true, passNaval: true, passDragon: true }
      }
    }
  }

  return grid
}

/**
 * Overlay per-unit-type passability from a passability texture map onto an
 * existing terrain grid.  Mutates the grid in-place.
 *
 * Channel rules (pixel must exceed threshold):
 *   Green ≥ threshold & dominant → passLand=true, passDragon=true  (land + dragon)
 *   Blue  ≥ threshold & dominant → passNaval=true, passDragon=true (naval + dragon)
 *   Red   ≥ threshold            → passDragon=true                 (dragon only)
 *   All below threshold          → impassable to all
 */
export function applyPassability(
  grid: GridCell[][],
  passImageData: ImageData,
  mapWidth: number,
  mapHeight: number,
  gridSize: number,
  threshold = 128,
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const data = passImageData.data
  const imgW = passImageData.width

  for (let gy = 0; gy < rows; gy++) {
    const py = Math.min(gy * gridSize + Math.floor(gridSize / 2), mapHeight - 1)

    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(gx * gridSize + Math.floor(gridSize / 2), mapWidth - 1)
      const idx = (py * imgW + px) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      let land = false, naval = false, dragon = false

      if (g >= threshold && g >= r && g >= b) {
        // Green dominant → land + dragon (not naval)
        land = true; dragon = true
      } else if (b >= threshold && b >= r) {
        // Blue dominant → naval + dragon
        naval = true; dragon = true
      } else if (r >= threshold) {
        // Red dominant → dragon only
        dragon = true
      }
      // else: all below threshold → impassable

      const cell = grid[gy][gx]
      cell.passLand = land
      cell.passNaval = naval
      cell.passDragon = dragon
      cell.passable = land // backward compat: most restrictive
    }
  }
}

// ---------------------------------------------------------------------------
// Binary min-heap (for A* open set)
// ---------------------------------------------------------------------------

interface HeapNode {
  gx: number
  gy: number
  f: number
}

class MinHeap {
  private data: HeapNode[] = []

  get size() { return this.data.length }

  push(node: HeapNode) {
    this.data.push(node)
    this.bubbleUp(this.data.length - 1)
  }

  pop(): HeapNode | undefined {
    const top = this.data[0]
    const last = this.data.pop()
    if (this.data.length > 0 && last) {
      this.data[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.data[i].f >= this.data[parent].f) break
      ;[this.data[i], this.data[parent]] = [this.data[parent], this.data[i]]
      i = parent
    }
  }

  private sinkDown(i: number) {
    const n = this.data.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r
      if (smallest === i) break
      ;[this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]]
      i = smallest
    }
  }
}

// ---------------------------------------------------------------------------
// A* pathfinding
// ---------------------------------------------------------------------------

const SQRT2 = Math.SQRT2
const DIRS: [number, number][] = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
]

/**
 * Find a path from (startX, startY) to (endX, endY) on the grid.
 * Coordinates are in **grid** space.  Returns world-pixel waypoints.
 * Returns an empty array if no path exists.
 */
export function findPath(
  grid: GridCell[][],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  gridSize: number,
  unitType: UnitType = 'land',
): PathNode[] {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return []

  // Clamp to bounds
  startX = Math.max(0, Math.min(cols - 1, startX))
  startY = Math.max(0, Math.min(rows - 1, startY))
  endX = Math.max(0, Math.min(cols - 1, endX))
  endY = Math.max(0, Math.min(rows - 1, endY))

  if (!isPassableFor(grid[startY][startX], unitType) || !isPassableFor(grid[endY][endX], unitType)) return []
  if (startX === endX && startY === endY) {
    return [{ gx: startX, gy: startY, worldX: startX * gridSize + gridSize / 2, worldY: startY * gridSize + gridSize / 2 }]
  }

  // g-cost and parent tracking with flat arrays
  const gCost = new Float32Array(rows * cols).fill(Infinity)
  const parentIdx = new Int32Array(rows * cols).fill(-1)
  const closed = new Uint8Array(rows * cols)

  const key = (x: number, y: number) => y * cols + x
  const heuristic = (x: number, y: number) => {
    const dx = Math.abs(x - endX)
    const dy = Math.abs(y - endY)
    // Octile distance
    return Math.min(dx, dy) * SQRT2 + Math.abs(dx - dy)
  }

  const startKey = key(startX, startY)
  gCost[startKey] = 0

  const open = new MinHeap()
  open.push({ gx: startX, gy: startY, f: heuristic(startX, startY) })

  while (open.size > 0) {
    const current = open.pop()!
    const { gx, gy } = current
    const ck = key(gx, gy)

    if (closed[ck]) continue
    closed[ck] = 1

    if (gx === endX && gy === endY) {
      // Reconstruct path
      const path: PathNode[] = []
      let k = ck
      while (k !== -1) {
        const py = Math.floor(k / cols)
        const px = k % cols
        path.push({
          gx: px,
          gy: py,
          worldX: px * gridSize + gridSize / 2,
          worldY: py * gridSize + gridSize / 2,
        })
        k = parentIdx[k]
      }
      path.reverse()
      return path
    }

    const currentG = gCost[ck]

    for (const [dx, dy] of DIRS) {
      const nx = gx + dx
      const ny = gy + dy
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue

      const nk = key(nx, ny)
      if (closed[nk]) continue

      const cell = grid[ny][nx]
      if (!isPassableFor(cell, unitType)) continue

      // Diagonal movement: check that both cardinal neighbors are passable (no corner cutting)
      if (dx !== 0 && dy !== 0) {
        if (!isPassableFor(grid[gy][nx], unitType) || !isPassableFor(grid[ny][gx], unitType)) continue
      }

      const moveCost = (dx !== 0 && dy !== 0) ? cell.cost * SQRT2 : cell.cost
      const tentativeG = currentG + moveCost

      if (tentativeG < gCost[nk]) {
        gCost[nk] = tentativeG
        parentIdx[nk] = ck
        open.push({ gx: nx, gy: ny, f: tentativeG + heuristic(nx, ny) })
      }
    }
  }

  return [] // No path found
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert world pixel coordinates to grid coordinates */
export function worldToGrid(wx: number, wy: number, gridSize: number): [number, number] {
  return [Math.floor(wx / gridSize), Math.floor(wy / gridSize)]
}

/** Calculate total path cost (sum of segment costs) */
export function pathCost(path: PathNode[], grid: GridCell[][]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const cell = grid[curr.gy]?.[curr.gx]
    if (!cell) continue
    const diagonal = prev.gx !== curr.gx && prev.gy !== curr.gy
    total += diagonal ? cell.cost * SQRT2 : cell.cost
  }
  return total
}
