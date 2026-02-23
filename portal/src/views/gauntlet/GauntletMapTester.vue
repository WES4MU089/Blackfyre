<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'
import {
  buildGrid,
  findPath,
  worldToGrid,
  pathCost,
  applyPassability,
  isPassableFor,
  type GridCell,
  type PathNode,
  type TerrainDef,
  type UnitType,
} from '@/utils/pathfinding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerrainType {
  id: number
  name: string
  hex_color: string
  movement_cost: number
  is_passable: boolean
  attrition_rate: number
  defense_bonus: number
  ambush_bonus: number
}

interface MapLayer {
  id: number
  layer_type: 'terrain' | 'passability'
  image_path: string
}

interface GauntletMap {
  id: number
  name: string
  width: number
  height: number
  grid_size: number
  base_image_path: string | null
  terrainTypes: TerrainType[]
  layers: MapLayer[]
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const mapId = computed(() => Number(route.params.id))
const mapData = ref<GauntletMap | null>(null)
const loading = ref(true)
const error = ref('')

// Canvas refs
const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)

// Images
let baseImage: HTMLImageElement | null = null
let terrainImage: HTMLImageElement | null = null

// Pathfinding grid
let grid: GridCell[][] = []
const gridCols = ref(0)
const gridRows = ref(0)

// Camera
const camera = ref({ x: 0, y: 0, zoom: 1 })
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

// Unit state
const unitPos = ref({ x: 100, y: 100 })
const unitPath = ref<PathNode[]>([])
const unitMoving = ref(false)
let pathIndex = 0
let lastFrameTime = 0

// Settings
const unitType = ref<UnitType>('land')
const baseSpeed = ref(0.0025) // pixels per second (land default)
const unitRadius = ref(6)
const visibilityRadius = ref(75)
const influenceRadius = ref(30)
const showGrid = ref(false)

// ETA tracking
const unitEta = ref(0) // seconds remaining
function formatEta(totalSeconds: number): string {
  const units: [string, number][] = [
    ['y', 31536000], ['mo', 2592000], ['w', 604800],
    ['d', 86400], ['h', 3600], ['m', 60],
  ]
  const parts: string[] = []
  let rem = Math.floor(totalSeconds)
  for (const [label, size] of units) {
    if (rem >= size) {
      const count = Math.floor(rem / size)
      parts.push(count + label)
      rem %= size
    }
  }
  if (rem > 0 || parts.length === 0) parts.push(rem + 's')
  return parts.join(' ')
}

// Debug / passability stats
const passApplied = ref(false)
const passStats = ref({ land: 0, naval: 0, dragon: 0, total: 0 })
const pathStatus = ref('')

// Mouse hover info
const hoverTerrain = ref<{ name: string; cost: number; passable: boolean; passLand: boolean; passNaval: boolean; passDragon: boolean } | null>(null)
const hoverWorldPos = ref({ x: 0, y: 0 })

// Pan state
let isPanning = false
let panStartX = 0
let panStartY = 0
let camStartX = 0
let camStartY = 0

// Animation frame id
let animFrameId = 0

// ---------------------------------------------------------------------------
// Load map data & images
// ---------------------------------------------------------------------------

onMounted(async () => {
  loading.value = true
  try {
    mapData.value = await apiFetch<GauntletMap>(`/api/gauntlet/maps/${mapId.value}`)
    await nextTick()
    await initCanvas()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
})

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

async function initCanvas() {
  const map = mapData.value
  if (!map) return

  const canvas = canvasRef.value
  if (!canvas) return

  // Resize canvas to fill wrapper
  resizeCanvas()

  // Load base image
  if (map.base_image_path) {
    baseImage = await loadImage('/' + map.base_image_path)
  }

  // Load terrain texture and build grid
  const terrainLayer = map.layers.find(l => l.layer_type === 'terrain')
  if (terrainLayer) {
    terrainImage = await loadImage('/' + terrainLayer.image_path)

    // Build pathfinding grid from terrain texture
    const offscreen = document.createElement('canvas')
    offscreen.width = terrainImage.naturalWidth
    offscreen.height = terrainImage.naturalHeight
    const ctx = offscreen.getContext('2d')!
    ctx.drawImage(terrainImage, 0, 0)
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)

    const defs: TerrainDef[] = map.terrainTypes.map(t => ({
      hex_color: t.hex_color,
      movement_cost: t.movement_cost,
      is_passable: t.is_passable,
    }))

    grid = buildGrid(imageData, defs, map.width, map.height, map.grid_size)
    gridRows.value = grid.length
    gridCols.value = grid[0]?.length ?? 0
  }

  // Load passability texture and overlay onto grid
  const passLayer = map.layers.find(l => l.layer_type === 'passability')
  if (passLayer) {
    // If no terrain grid exists yet, build a default one (all cost=1, all passable)
    if (gridRows.value === 0 || gridCols.value === 0) {
      const cols = Math.ceil(map.width / map.grid_size)
      const rows = Math.ceil(map.height / map.grid_size)
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
          cost: 1, passable: true, passLand: true, passNaval: true, passDragon: true,
        }))
      )
      gridRows.value = rows
      gridCols.value = cols
    }

    const passImg = await loadImage('/' + passLayer.image_path)
    const offscreen2 = document.createElement('canvas')
    offscreen2.width = passImg.naturalWidth
    offscreen2.height = passImg.naturalHeight
    const ctx2 = offscreen2.getContext('2d')!
    ctx2.drawImage(passImg, 0, 0)
    const passData = ctx2.getImageData(0, 0, offscreen2.width, offscreen2.height)
    applyPassability(grid, passData, map.width, map.height, map.grid_size)
    passApplied.value = true

    // Count passability stats
    let land = 0, naval = 0, dragon = 0, total = 0
    for (let gy = 0; gy < gridRows.value; gy++) {
      for (let gx = 0; gx < gridCols.value; gx++) {
        total++
        if (grid[gy][gx].passLand) land++
        if (grid[gy][gx].passNaval) naval++
        if (grid[gy][gx].passDragon) dragon++
      }
    }
    passStats.value = { land, naval, dragon, total }
    console.log('[Gauntlet] Passability applied:', { land, naval, dragon, total, gridCols: gridCols.value, gridRows: gridRows.value, passImgW: passImg.naturalWidth, passImgH: passImg.naturalHeight, mapW: map.width, mapH: map.height })
  }

  // Center camera on map
  if (canvas.width && map.width) {
    camera.value.x = (canvas.width / 2 - map.width / 2)
    camera.value.y = (canvas.height / 2 - map.height / 2)
  }

  // Place unit at center
  unitPos.value = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) }

  // Start render loop
  lastFrameTime = performance.now()
  renderLoop(lastFrameTime)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrapper = wrapperRef.value
  if (!canvas || !wrapper) return
  canvas.width = wrapper.clientWidth
  canvas.height = wrapper.clientHeight
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function renderLoop(timestamp: number) {
  const dt = (timestamp - lastFrameTime) / 1000
  lastFrameTime = timestamp

  updateUnit(dt)
  draw()

  animFrameId = requestAnimationFrame(renderLoop)
}

function updateUnit(dt: number) {
  if (!unitMoving.value || unitPath.value.length === 0) {
    unitEta.value = 0
    return
  }

  const path = unitPath.value
  if (pathIndex >= path.length) {
    unitMoving.value = false
    unitPath.value = []
    unitEta.value = 0
    return
  }

  const target = path[pathIndex]
  const dx = target.worldX - unitPos.value.x
  const dy = target.worldY - unitPos.value.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Get terrain cost at current position
  const gs = mapData.value!.grid_size
  const [gx, gy] = worldToGrid(unitPos.value.x, unitPos.value.y, gs)
  const cell = grid[gy]?.[gx]
  const terrainCost = unitType.value === 'dragon' ? 1 : (cell?.cost ?? 1)

  const speed = baseSpeed.value / terrainCost
  const step = speed * dt

  if (dist <= step) {
    unitPos.value.x = target.worldX
    unitPos.value.y = target.worldY
    pathIndex++
    if (pathIndex >= path.length) {
      unitMoving.value = false
      unitPath.value = []
      unitEta.value = 0
    }
  } else {
    unitPos.value.x += (dx / dist) * step
    unitPos.value.y += (dy / dist) * step
  }

  // Calculate ETA: time to traverse remaining path segments
  if (unitMoving.value) {
    let eta = 0
    // Current segment: unit → next waypoint
    const curCost = terrainCost
    eta += dist / (baseSpeed.value / curCost)

    // Remaining segments: waypoint → waypoint
    for (let i = pathIndex; i < path.length - 1; i++) {
      const ax = path[i].worldX
      const ay = path[i].worldY
      const bx = path[i + 1].worldX
      const by = path[i + 1].worldY
      const segDist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
      const [sgx, sgy] = worldToGrid(bx, by, gs)
      const segCell = grid[sgy]?.[sgx]
      const segCost = unitType.value === 'dragon' ? 1 : (segCell?.cost ?? 1)
      eta += segDist / (baseSpeed.value / segCost)
    }
    unitEta.value = eta
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)

  ctx.save()
  ctx.translate(camera.value.x, camera.value.y)
  ctx.scale(camera.value.zoom, camera.value.zoom)

  // Draw base map
  if (baseImage) {
    ctx.drawImage(baseImage, 0, 0)
  }

  // Optional grid overlay
  if (showGrid.value && mapData.value) {
    const gs = mapData.value.grid_size
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= mapData.value.width; x += gs) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, mapData.value.height)
      ctx.stroke()
    }
    for (let y = 0; y <= mapData.value.height; y += gs) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(mapData.value.width, y)
      ctx.stroke()
    }
  }

  // Draw path
  if (unitPath.value.length > 1) {
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    const start = pathIndex > 0 ? pathIndex - 1 : 0
    ctx.moveTo(unitPos.value.x, unitPos.value.y)
    for (let i = pathIndex; i < unitPath.value.length; i++) {
      ctx.lineTo(unitPath.value[i].worldX, unitPath.value[i].worldY)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Draw destination marker
    const dest = unitPath.value[unitPath.value.length - 1]
    ctx.fillStyle = 'rgba(201, 168, 76, 0.5)'
    ctx.beginPath()
    ctx.arc(dest.worldX, dest.worldY, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw visibility sphere
  ctx.fillStyle = 'rgba(201, 168, 76, 0.04)'
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(unitPos.value.x, unitPos.value.y, visibilityRadius.value, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Draw influence sphere
  ctx.fillStyle = 'rgba(139, 26, 26, 0.08)'
  ctx.strokeStyle = 'rgba(139, 26, 26, 0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(unitPos.value.x, unitPos.value.y, influenceRadius.value, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Draw unit
  ctx.fillStyle = '#c9a84c'
  ctx.strokeStyle = '#1a1410'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(unitPos.value.x, unitPos.value.y, unitRadius.value, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Unit direction indicator (small triangle)
  if (unitMoving.value && pathIndex < unitPath.value.length) {
    const target = unitPath.value[pathIndex]
    const angle = Math.atan2(target.worldY - unitPos.value.y, target.worldX - unitPos.value.x)
    const tipDist = unitRadius.value + 4
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(
      unitPos.value.x + Math.cos(angle) * tipDist,
      unitPos.value.y + Math.sin(angle) * tipDist,
    )
    ctx.lineTo(
      unitPos.value.x + Math.cos(angle + 2.5) * (tipDist - 6),
      unitPos.value.y + Math.sin(angle + 2.5) * (tipDist - 6),
    )
    ctx.lineTo(
      unitPos.value.x + Math.cos(angle - 2.5) * (tipDist - 6),
      unitPos.value.y + Math.sin(angle - 2.5) * (tipDist - 6),
    )
    ctx.fill()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Mouse event handlers
// ---------------------------------------------------------------------------

function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - camera.value.x) / camera.value.zoom,
    y: (sy - camera.value.y) / camera.value.zoom,
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 2 || e.button === 1) {
    // Right or middle click → pan
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    camStartX = camera.value.x
    camStartY = camera.value.y
    e.preventDefault()
  }
}

function onMouseUp(e: MouseEvent) {
  if (isPanning) {
    isPanning = false
    return
  }

  if (e.button === 0 && mapData.value) {
    // Left click → set movement destination
    const rect = canvasRef.value!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy)

    // Clamp to map bounds
    world.x = Math.max(0, Math.min(mapData.value.width - 1, world.x))
    world.y = Math.max(0, Math.min(mapData.value.height - 1, world.y))

    if (gridCols.value > 0 && gridRows.value > 0) {
      const gs = mapData.value.grid_size
      const [sx2, sy2] = worldToGrid(unitPos.value.x, unitPos.value.y, gs)
      const [ex, ey] = worldToGrid(world.x, world.y, gs)

      const startCell = grid[sy2]?.[sx2]
      const endCell = grid[ey]?.[ex]
      console.log(`[Gauntlet] Click: unit=${unitType.value} start=(${sx2},${sy2}) end=(${ex},${ey})`, {
        startPass: startCell ? { land: startCell.passLand, naval: startCell.passNaval, dragon: startCell.passDragon } : 'OOB',
        endPass: endCell ? { land: endCell.passLand, naval: endCell.passNaval, dragon: endCell.passDragon } : 'OOB',
      })

      const path = findPath(grid, sx2, sy2, ex, ey, gs, unitType.value)
      if (path.length > 0) {
        unitPath.value = path
        pathIndex = 1 // skip first node (current position)
        unitMoving.value = true
        pathStatus.value = `Path: ${path.length} nodes`
      } else {
        pathStatus.value = `No path for ${unitType.value}`
      }
    } else {
      // No grid — animate straight line to destination
      unitPath.value = [
        { gx: 0, gy: 0, worldX: unitPos.value.x, worldY: unitPos.value.y },
        { gx: 0, gy: 0, worldX: world.x, worldY: world.y },
      ]
      pathIndex = 1
      unitMoving.value = true
      pathStatus.value = 'Straight line (no grid)'
    }
  }
}

function onMouseMove(e: MouseEvent) {
  if (isPanning) {
    camera.value.x = camStartX + (e.clientX - panStartX)
    camera.value.y = camStartY + (e.clientY - panStartY)
    return
  }

  // Hover terrain info
  if (canvasRef.value && mapData.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy)
    hoverWorldPos.value = { x: Math.round(world.x), y: Math.round(world.y) }

    if (world.x >= 0 && world.y >= 0 && world.x < mapData.value.width && world.y < mapData.value.height) {
      const [gx, gy] = worldToGrid(world.x, world.y, mapData.value.grid_size)
      const cell = grid[gy]?.[gx]
      if (cell) {
        // Find matching terrain type by reading pixel color from terrain texture
        const terrainLayer = mapData.value.layers.find(l => l.layer_type === 'terrain')
        if (terrainLayer && terrainImage) {
          // Read color from offscreen canvas approach
          const offscreen = document.createElement('canvas')
          offscreen.width = 1
          offscreen.height = 1
          const octx = offscreen.getContext('2d')!
          octx.drawImage(terrainImage, Math.floor(world.x), Math.floor(world.y), 1, 1, 0, 0, 1, 1)
          const px = octx.getImageData(0, 0, 1, 1).data
          const hexColor = '#' + [px[0], px[1], px[2]].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()

          const match = mapData.value.terrainTypes.find(t => {
            const tr = parseInt(t.hex_color.slice(1, 3), 16)
            const tg = parseInt(t.hex_color.slice(3, 5), 16)
            const tb = parseInt(t.hex_color.slice(5, 7), 16)
            return Math.abs(tr - px[0]) < 30 && Math.abs(tg - px[1]) < 30 && Math.abs(tb - px[2]) < 30
          })

          hoverTerrain.value = match
            ? { name: match.name, cost: Number(match.movement_cost), passable: match.is_passable, passLand: cell.passLand, passNaval: cell.passNaval, passDragon: cell.passDragon }
            : { name: 'Unknown', cost: cell.cost, passable: cell.passable, passLand: cell.passLand, passNaval: cell.passNaval, passDragon: cell.passDragon }
        } else {
          hoverTerrain.value = { name: 'No terrain map', cost: cell.cost, passable: cell.passable, passLand: cell.passLand, passNaval: cell.passNaval, passDragon: cell.passDragon }
        }
      } else {
        hoverTerrain.value = null
      }
    } else {
      hoverTerrain.value = null
    }
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = canvasRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const oldZoom = camera.value.zoom
  const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor))

  // Zoom toward mouse position
  camera.value.x = mx - (mx - camera.value.x) * (newZoom / oldZoom)
  camera.value.y = my - (my - camera.value.y) * (newZoom / oldZoom)
  camera.value.zoom = newZoom
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
}

function resetCamera() {
  if (!mapData.value || !canvasRef.value) return
  camera.value.zoom = 1
  camera.value.x = canvasRef.value.width / 2 - mapData.value.width / 2
  camera.value.y = canvasRef.value.height / 2 - mapData.value.height / 2
}

// Handle window resize
let resizeTimeout = 0
function onWindowResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = window.setTimeout(() => resizeCanvas(), 100)
}

onMounted(() => window.addEventListener('resize', onWindowResize))
onUnmounted(() => window.removeEventListener('resize', onWindowResize))
</script>

<template>
  <div class="tester-container">
    <!-- Top bar -->
    <div class="tester-header">
      <div class="header-left">
        <button class="btn-secondary btn-sm" @click="router.push('/gauntlet')">Maps</button>
        <button class="btn-secondary btn-sm" @click="router.push(`/gauntlet/${mapId}/edit`)">Edit</button>
        <span class="map-title gold">{{ mapData?.name ?? 'Loading...' }}</span>
      </div>
      <div class="header-right">
        <button class="btn-secondary btn-sm" @click="resetCamera">Reset View</button>
        <label class="toggle-label">
          <input v-model="showGrid" type="checkbox" /> Grid
        </label>
      </div>
    </div>

    <div class="tester-body">
      <!-- Canvas -->
      <div ref="wrapperRef" class="canvas-wrapper">
        <p v-if="loading" class="overlay-msg dim">Loading map...</p>
        <p v-else-if="error" class="overlay-msg error">{{ error }}</p>
        <canvas
          v-show="!loading && !error"
          ref="canvasRef"
          @mousedown="onMouseDown"
          @mouseup="onMouseUp"
          @mousemove="onMouseMove"
          @wheel="onWheel"
          @contextmenu="onContextMenu"
        />
      </div>

      <!-- Side panel -->
      <div class="side-panel">
        <div class="panel-section">
          <h4 class="gold">Unit Info</h4>
          <div class="info-row">
            <span class="label">Position</span>
            <span class="value">{{ Math.round(unitPos.x) }}, {{ Math.round(unitPos.y) }}</span>
          </div>
          <div class="info-row">
            <span class="label">Status</span>
            <span class="value">{{ unitMoving ? 'Moving' : 'Idle' }}</span>
          </div>
          <div v-if="unitPath.length > 0" class="info-row">
            <span class="label">Path nodes</span>
            <span class="value">{{ unitPath.length - pathIndex }} remaining</span>
          </div>
          <div v-if="unitMoving && unitEta > 0" class="info-row">
            <span class="label">ETA</span>
            <span class="value">{{ formatEta(unitEta) }}</span>
          </div>
        </div>

        <div class="panel-section">
          <h4 class="gold">Hover Info</h4>
          <template v-if="hoverTerrain">
            <div class="info-row">
              <span class="label">Terrain</span>
              <span class="value">{{ hoverTerrain.name }}</span>
            </div>
            <div class="info-row">
              <span class="label">Move Cost</span>
              <span class="value">{{ hoverTerrain.cost.toFixed(2) }}</span>
            </div>
            <div class="info-row">
              <span class="label">Land</span>
              <span class="value">{{ hoverTerrain.passLand ? 'Yes' : 'No' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Naval</span>
              <span class="value">{{ hoverTerrain.passNaval ? 'Yes' : 'No' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Dragon</span>
              <span class="value">{{ hoverTerrain.passDragon ? 'Yes' : 'No' }}</span>
            </div>
          </template>
          <p v-else class="dim small">Hover over map</p>
          <div class="info-row">
            <span class="label">World pos</span>
            <span class="value">{{ hoverWorldPos.x }}, {{ hoverWorldPos.y }}</span>
          </div>
        </div>

        <div class="panel-section">
          <h4 class="gold">Settings</h4>
          <div class="setting-row">
            <label>Unit Type</label>
            <select v-model="unitType" class="unit-select">
              <option value="land">Land</option>
              <option value="naval">Naval</option>
              <option value="dragon">Dragon</option>
            </select>
          </div>
          <div class="setting-row">
            <label>Speed (px/s)</label>
            <input v-model.number="baseSpeed" type="number" min="0.0001" max="10" step="0.0005" />
          </div>
          <div class="setting-row">
            <label>Visibility</label>
            <input v-model.number="visibilityRadius" type="number" min="0" max="1000" step="10" />
          </div>
          <div class="setting-row">
            <label>Influence</label>
            <input v-model.number="influenceRadius" type="number" min="0" max="500" step="5" />
          </div>
          <div class="setting-row">
            <label>Unit Size</label>
            <input v-model.number="unitRadius" type="number" min="4" max="50" />
          </div>
        </div>

        <div class="panel-section">
          <h4 class="gold">Camera</h4>
          <div class="info-row">
            <span class="label">Zoom</span>
            <span class="value">{{ (camera.zoom * 100).toFixed(0) }}%</span>
          </div>
          <p class="dim small">Left-click: move unit</p>
          <p class="dim small">Right-drag: pan</p>
          <p class="dim small">Scroll: zoom</p>
        </div>

        <div class="panel-section">
          <h4 class="gold">Terrain Legend</h4>
          <div v-if="mapData?.terrainTypes.length" class="legend">
            <div v-for="t in mapData.terrainTypes" :key="t.id" class="legend-item">
              <span class="color-swatch" :style="{ background: t.hex_color }" />
              <span>{{ t.name }}</span>
              <span class="dim small">{{ Number(t.movement_cost).toFixed(1) }}x</span>
            </div>
          </div>
          <p v-else class="dim small">No terrain types defined</p>
        </div>

        <div class="panel-section">
          <h4 class="gold">Debug</h4>
          <div class="info-row">
            <span class="label">Grid</span>
            <span class="value">{{ gridCols }} x {{ gridRows }}</span>
          </div>
          <div class="info-row">
            <span class="label">Passability</span>
            <span class="value">{{ passApplied ? 'Applied' : 'None' }}</span>
          </div>
          <template v-if="passApplied">
            <div class="info-row">
              <span class="label">Land cells</span>
              <span class="value">{{ passStats.land }} / {{ passStats.total }}</span>
            </div>
            <div class="info-row">
              <span class="label">Naval cells</span>
              <span class="value">{{ passStats.naval }} / {{ passStats.total }}</span>
            </div>
            <div class="info-row">
              <span class="label">Dragon cells</span>
              <span class="value">{{ passStats.dragon }} / {{ passStats.total }}</span>
            </div>
          </template>
          <div v-if="pathStatus" class="info-row">
            <span class="label">Last click</span>
            <span class="value">{{ pathStatus }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tester-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--nav-height));
  margin: calc(-1 * var(--space-lg));
  overflow: hidden;
}

.tester-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.map-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
}

.toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tester-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  background: #0a0810;
  overflow: hidden;
}

.canvas-wrapper canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.overlay-msg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-size-lg);
}

.side-panel {
  width: 240px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border-dim);
  overflow-y: auto;
  padding: var(--space-sm);
}

.panel-section {
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.panel-section + .panel-section {
  border-top: 1px solid var(--color-border-dim);
  padding-top: var(--space-sm);
}

.panel-section h4 {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-xs);
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  padding: 2px 0;
}

.info-row .label {
  color: var(--color-text-dim);
}

.info-row .value {
  font-family: var(--font-mono);
  color: var(--color-text);
}

.setting-row {
  margin-bottom: var(--space-xs);
}

.setting-row label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  margin-bottom: 1px;
}

.setting-row input,
.setting-row select {
  width: 100%;
  padding: 4px 6px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
}

.color-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  flex-shrink: 0;
}

.small {
  font-size: var(--font-size-xs);
}

.error {
  color: var(--color-crimson-light);
}

.btn-sm {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
}
</style>
