<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'
import { detectPassabilityChannels } from '@/utils/pathfinding'

interface TerrainType {
  id: number
  map_id: number
  name: string
  hex_color: string
  movement_cost: number
  is_passable: boolean
  attrition_rate: number
  defense_bonus: number
  ambush_bonus: number
  description: string | null
  sort_order: number
}

interface MapLayer {
  id: number
  map_id: number
  layer_type: 'terrain' | 'passability'
  image_path: string
}

interface GauntletMap {
  id: number
  name: string
  description: string | null
  width: number
  height: number
  grid_size: number
  base_image_path: string | null
  is_active: boolean
  terrainTypes: TerrainType[]
  layers: MapLayer[]
}

const route = useRoute()
const router = useRouter()
const { apiFetch, apiUpload } = useApi()

const mapId = computed(() => Number(route.params.id))
const map = ref<GauntletMap | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)

// Editable fields
const editName = ref('')
const editDesc = ref('')
const editGridSize = ref(8)
const editActive = ref(false)

// Terrain form
const showTerrainForm = ref(false)
const editingTerrain = ref<TerrainType | null>(null)
const terrainForm = ref({
  name: '',
  hex_color: '#00FF00',
  movement_cost: 1.0,
  is_passable: true,
  attrition_rate: 0,
  defense_bonus: 0,
  ambush_bonus: 0,
  description: '',
  sort_order: 0,
})
const terrainError = ref('')

// Auto-palette detection
const paletteDetecting = ref(false)
const paletteDetected = ref<string[]>([])

// Eyedropper canvas
const eyedropperCanvas = ref<HTMLCanvasElement | null>(null)
const terrainLayerUrl = computed(() => {
  const layer = map.value?.layers.find(l => l.layer_type === 'terrain')
  return layer ? `/${layer.image_path}` : null
})
const passabilityLayerUrl = computed(() => {
  const layer = map.value?.layers.find(l => l.layer_type === 'passability')
  return layer ? `/${layer.image_path}` : null
})
const passChannels = ref<{ red: number; green: number; blue: number; black: number; total: number } | null>(null)

onMounted(() => loadMap())

async function loadMap() {
  loading.value = true
  try {
    map.value = await apiFetch<GauntletMap>(`/api/gauntlet/maps/${mapId.value}`)
    editName.value = map.value.name
    editDesc.value = map.value.description ?? ''
    editGridSize.value = map.value.grid_size
    editActive.value = map.value.is_active
    loadEyedropperPreview()
    detectExistingPassability()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const updated = await apiFetch<GauntletMap>(`/api/gauntlet/maps/${mapId.value}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editName.value,
        description: editDesc.value,
        grid_size: editGridSize.value,
        is_active: editActive.value,
      }),
    })
    map.value = { ...map.value!, ...updated }
  } catch (e: any) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function uploadBaseImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const fd = new FormData()
    fd.append('baseImage', file)
    const result = await apiUpload<{ base_image_path: string }>(
      `/api/gauntlet/maps/${mapId.value}/base-image`,
      fd
    )
    map.value!.base_image_path = result.base_image_path
  } catch (e: any) {
    alert(e.message)
  }
}

async function uploadLayer(layerType: 'terrain' | 'passability', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const fd = new FormData()
    fd.append('layerImage', file)
    fd.append('layer_type', layerType)
    const layer = await apiUpload<MapLayer>(
      `/api/gauntlet/maps/${mapId.value}/layers`,
      fd
    )
    // Replace or add layer
    const idx = map.value!.layers.findIndex(l => l.layer_type === layerType)
    if (idx >= 0) map.value!.layers[idx] = layer
    else map.value!.layers.push(layer)

    if (layerType === 'terrain') {
      loadEyedropperPreview()
      autoDetectPalette(file)
    }
  } catch (e: any) {
    alert(e.message)
  }
}

/**
 * Extract distinct colors from a terrain texture map image file and create
 * new terrain palette entries for any colors not already in the palette.
 */
async function autoDetectPalette(file: File) {
  paletteDetecting.value = true
  paletteDetected.value = []
  try {
    // Load image from file
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })

    // Draw to offscreen canvas and read pixels
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Count pixel occurrences per color (ignore alpha)
    const colorCounts = new Map<string, number>()
    for (let i = 0; i < data.length; i += 4) {
      const hex = '#' + [data[i], data[i + 1], data[i + 2]]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
      colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1)
    }

    // Filter: only colors with at least 0.1% of total pixels (noise filter)
    const totalPixels = canvas.width * canvas.height
    const minPixels = Math.max(1, Math.floor(totalPixels * 0.001))
    const significantColors = [...colorCounts.entries()]
      .filter(([, count]) => count >= minPixels)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .map(([hex]) => hex)

    // Determine which colors are already in the palette (case-insensitive)
    const existingColors = new Set(
      map.value!.terrainTypes.map(t => t.hex_color.toUpperCase())
    )
    const newColors = significantColors.filter(hex => !existingColors.has(hex))
    paletteDetected.value = newColors

    if (newColors.length === 0) return

    // Create terrain entries for each new color
    const existingCount = map.value!.terrainTypes.length
    for (let i = 0; i < newColors.length; i++) {
      try {
        const created = await apiFetch<TerrainType>(
          `/api/gauntlet/maps/${mapId.value}/terrain`,
          {
            method: 'POST',
            body: JSON.stringify({
              name: `Terrain ${existingCount + i + 1}`,
              hex_color: newColors[i],
              movement_cost: 1.0,
              is_passable: true,
              sort_order: existingCount + i,
            }),
          }
        )
        map.value!.terrainTypes.push(created)
      } catch {
        // Skip duplicates or other errors silently
      }
    }
  } finally {
    paletteDetecting.value = false
  }
}

async function uploadPassabilityLayer(e: Event) {
  await uploadLayer('passability', e)
  analyzePassabilityImage(passabilityLayerUrl.value)
}

function analyzePassabilityImage(url: string | null) {
  if (!url) return
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    passChannels.value = detectPassabilityChannels(imageData)
  }
  img.src = url
}

function detectExistingPassability() {
  analyzePassabilityImage(passabilityLayerUrl.value)
}

function loadEyedropperPreview() {
  if (!terrainLayerUrl.value || !eyedropperCanvas.value) return
  const img = new Image()
  img.onload = () => {
    const canvas = eyedropperCanvas.value
    if (!canvas) return
    const maxW = 400
    const scale = Math.min(maxW / img.naturalWidth, 1)
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = terrainLayerUrl.value
}

function eyedropperClick(e: MouseEvent) {
  const canvas = eyedropperCanvas.value!
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
  const ctx = canvas.getContext('2d')!
  const pixel = ctx.getImageData(x, y, 1, 1).data
  const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()
  terrainForm.value.hex_color = hex
}

function openTerrainForm(terrain?: TerrainType) {
  if (terrain) {
    editingTerrain.value = terrain
    terrainForm.value = {
      name: terrain.name,
      hex_color: terrain.hex_color,
      movement_cost: terrain.movement_cost,
      is_passable: terrain.is_passable,
      attrition_rate: terrain.attrition_rate,
      defense_bonus: terrain.defense_bonus,
      ambush_bonus: terrain.ambush_bonus,
      description: terrain.description ?? '',
      sort_order: terrain.sort_order,
    }
  } else {
    editingTerrain.value = null
    terrainForm.value = {
      name: '',
      hex_color: '#00FF00',
      movement_cost: 1.0,
      is_passable: true,
      attrition_rate: 0,
      defense_bonus: 0,
      ambush_bonus: 0,
      description: '',
      sort_order: 0,
    }
  }
  terrainError.value = ''
  showTerrainForm.value = true
  nextTick(() => loadEyedropperPreview())
}

async function saveTerrain() {
  terrainError.value = ''
  try {
    if (editingTerrain.value) {
      const updated = await apiFetch<TerrainType>(
        `/api/gauntlet/terrain/${editingTerrain.value.id}`,
        { method: 'PATCH', body: JSON.stringify(terrainForm.value) }
      )
      const idx = map.value!.terrainTypes.findIndex(t => t.id === updated.id)
      if (idx >= 0) map.value!.terrainTypes[idx] = updated
    } else {
      const created = await apiFetch<TerrainType>(
        `/api/gauntlet/maps/${mapId.value}/terrain`,
        { method: 'POST', body: JSON.stringify(terrainForm.value) }
      )
      map.value!.terrainTypes.push(created)
    }
    showTerrainForm.value = false
  } catch (e: any) {
    terrainError.value = e.message
  }
}

async function deleteTerrain(terrain: TerrainType) {
  if (!confirm(`Delete terrain type "${terrain.name}"?`)) return
  try {
    await apiFetch(`/api/gauntlet/terrain/${terrain.id}`, { method: 'DELETE' })
    map.value!.terrainTypes = map.value!.terrainTypes.filter(t => t.id !== terrain.id)
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

<template>
  <div class="container">
    <PageHeader :title="map?.name ?? 'Map Editor'" subtitle="Configure terrain types and map layers">
      <div class="header-actions">
        <button class="btn-secondary btn-sm" @click="router.push('/gauntlet')">Back to Maps</button>
        <button v-if="map" class="btn-secondary btn-sm" @click="router.push(`/gauntlet/${mapId}/test`)">Open Tester</button>
      </div>
    </PageHeader>

    <p v-if="loading" class="dim">Loading...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-if="map">
      <div class="editor-grid">
        <!-- Left: Settings & Images -->
        <div class="panel">
          <h3 class="gold">Map Settings</h3>
          <div class="form-row">
            <label>Name</label>
            <input v-model="editName" type="text" maxlength="100" />
          </div>
          <div class="form-row">
            <label>Description</label>
            <textarea v-model="editDesc" rows="2" maxlength="2000" />
          </div>
          <div class="form-row">
            <label>Grid Size (px)</label>
            <input v-model.number="editGridSize" type="number" min="1" max="64" />
          </div>
          <div class="form-row">
            <label>
              <input v-model="editActive" type="checkbox" /> Active
            </label>
          </div>
          <button class="btn-primary btn-sm" :disabled="saving" @click="saveSettings">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>

          <hr class="divider" />

          <h3 class="gold">Base Map Image</h3>
          <p class="dim small">{{ map.width }} x {{ map.height }} pixels</p>
          <div v-if="map.base_image_path" class="image-preview">
            <img :src="'/' + map.base_image_path" alt="Base map" />
          </div>
          <div class="form-row">
            <label>Replace Base Image</label>
            <input type="file" accept="image/*" @change="uploadBaseImage" />
          </div>

          <hr class="divider" />

          <h3 class="gold">Terrain Texture Map</h3>
          <p class="dim small">Same resolution as base map. Pixel colors map to terrain types below.</p>
          <div v-if="terrainLayerUrl" class="image-preview">
            <img :src="terrainLayerUrl" alt="Terrain texture map" />
          </div>
          <div class="form-row">
            <label>{{ terrainLayerUrl ? 'Replace' : 'Upload' }} Terrain Map</label>
            <input type="file" accept="image/*" @change="(e: Event) => uploadLayer('terrain', e)" />
          </div>
          <div v-if="paletteDetecting" class="palette-status">
            <span class="dim small">Detecting terrain palette...</span>
          </div>
          <div v-else-if="paletteDetected.length > 0" class="palette-status">
            <span class="dim small">Added {{ paletteDetected.length }} color(s) to terrain palette:</span>
            <div class="palette-swatches">
              <span
                v-for="hex in paletteDetected"
                :key="hex"
                class="color-swatch"
                :style="{ background: hex }"
                :title="hex"
              />
            </div>
          </div>

          <hr class="divider" />

          <h3 class="gold">Passability Texture Map</h3>
          <p class="dim small">RGB channels define unit access. Red = Dragon, Blue = Naval + Dragon, Green = Land + Dragon.</p>
          <div v-if="passabilityLayerUrl" class="image-preview">
            <img :src="passabilityLayerUrl" alt="Passability texture map" />
          </div>
          <div class="form-row">
            <label>{{ passabilityLayerUrl ? 'Replace' : 'Upload' }} Passability Map</label>
            <input type="file" accept="image/*" @change="uploadPassabilityLayer" />
          </div>
          <div v-if="passChannels" class="channel-stats">
            <div class="channel-row">
              <span class="channel-swatch channel-green" />
              <span>Land + Dragon (Green): <strong>{{ passChannels.green.toLocaleString() }}</strong> pixels</span>
            </div>
            <div class="channel-row">
              <span class="channel-swatch channel-blue" />
              <span>Naval + Dragon (Blue): <strong>{{ passChannels.blue.toLocaleString() }}</strong> pixels</span>
            </div>
            <div class="channel-row">
              <span class="channel-swatch channel-red" />
              <span>Dragon Only (Red): <strong>{{ passChannels.red.toLocaleString() }}</strong> pixels</span>
            </div>
            <div class="channel-row">
              <span class="channel-swatch channel-black" />
              <span>Impassable (Black): <strong>{{ passChannels.black.toLocaleString() }}</strong> pixels</span>
            </div>
            <p class="dim small" style="margin-top: 4px;">Total: {{ passChannels.total.toLocaleString() }} pixels</p>
          </div>
        </div>

        <!-- Right: Terrain Palette -->
        <div class="panel">
          <div class="panel-header">
            <h3 class="gold">Terrain Palette</h3>
            <button class="btn-primary btn-sm" @click="openTerrainForm()">Add Terrain</button>
          </div>

          <!-- Terrain Form -->
          <div v-if="showTerrainForm" class="card terrain-form">
            <h4>{{ editingTerrain ? 'Edit' : 'New' }} Terrain Type</h4>
            <div class="form-grid">
              <div class="form-row">
                <label>Name</label>
                <input v-model="terrainForm.name" type="text" placeholder="Forest" maxlength="50" />
              </div>
              <div class="form-row">
                <label>Color</label>
                <div class="color-row">
                  <input v-model="terrainForm.hex_color" type="color" class="color-picker" />
                  <input v-model="terrainForm.hex_color" type="text" class="color-text" maxlength="7" />
                </div>
              </div>
              <div class="form-row">
                <label>Movement Cost</label>
                <input v-model.number="terrainForm.movement_cost" type="number" step="0.1" min="0" max="99" />
                <span class="hint">1.0 = normal, 2.0 = half speed, 0.7 = fast</span>
              </div>
              <div class="form-row">
                <label>
                  <input v-model="terrainForm.is_passable" type="checkbox" /> Passable
                </label>
              </div>
              <div class="form-row">
                <label>Attrition Rate</label>
                <input v-model.number="terrainForm.attrition_rate" type="number" step="0.01" min="0" max="99" />
              </div>
              <div class="form-row">
                <label>Defense Bonus</label>
                <input v-model.number="terrainForm.defense_bonus" type="number" min="-10" max="20" />
              </div>
              <div class="form-row">
                <label>Ambush Bonus</label>
                <input v-model.number="terrainForm.ambush_bonus" type="number" min="-10" max="20" />
              </div>
              <div class="form-row">
                <label>Sort Order</label>
                <input v-model.number="terrainForm.sort_order" type="number" min="0" />
              </div>
            </div>
            <p v-if="terrainError" class="error">{{ terrainError }}</p>
            <div class="form-actions">
              <button class="btn-primary btn-sm" @click="saveTerrain">Save</button>
              <button class="btn-secondary btn-sm" @click="showTerrainForm = false">Cancel</button>
            </div>
          </div>

          <!-- Eyedropper -->
          <div v-if="terrainLayerUrl && showTerrainForm" class="eyedropper-section">
            <p class="dim small">Click on the terrain map preview to pick a color:</p>
            <canvas
              ref="eyedropperCanvas"
              class="eyedropper-canvas"
              @click="eyedropperClick"
            />
          </div>

          <!-- Terrain Types Table -->
          <div v-if="map.terrainTypes.length > 0" class="terrain-table">
            <div class="terrain-header">
              <span>Color</span>
              <span>Name</span>
              <span>Move Cost</span>
              <span>Pass?</span>
              <span>Attrition</span>
              <span>Def</span>
              <span></span>
            </div>
            <div v-for="t in map.terrainTypes" :key="t.id" class="terrain-row">
              <span>
                <span class="color-swatch" :style="{ background: t.hex_color }" />
                <span class="dim small">{{ t.hex_color }}</span>
              </span>
              <span class="terrain-name">{{ t.name }}</span>
              <span>{{ t.movement_cost.toFixed(2) }}</span>
              <span>{{ t.is_passable ? 'Yes' : 'No' }}</span>
              <span>{{ t.attrition_rate.toFixed(2) }}</span>
              <span>{{ t.defense_bonus }}</span>
              <span class="actions">
                <button class="btn-secondary btn-xs" @click="openTerrainForm(t)">Edit</button>
                <button class="btn-danger btn-xs" @click="deleteTerrain(t)">Del</button>
              </span>
            </div>
          </div>
          <p v-else class="dim">No terrain types defined yet. Add one to get started.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
}

.header-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.panel h3 {
  margin-bottom: var(--space-md);
}

.panel-header h3 {
  margin-bottom: 0;
}

.divider {
  border: none;
  border-top: 1px solid var(--color-border-dim);
  margin: var(--space-lg) 0;
}

.form-row {
  margin-bottom: var(--space-sm);
}

.form-row label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dim);
  margin-bottom: 2px;
}

.form-row input[type="text"],
.form-row input[type="number"],
.form-row textarea {
  width: 100%;
  max-width: 300px;
  padding: 6px var(--space-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.form-row textarea {
  max-width: 100%;
  resize: vertical;
}

.form-row input[type="file"] {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.form-row input[type="checkbox"] {
  margin-right: var(--space-xs);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--space-md);
}

.color-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.color-picker {
  width: 40px;
  height: 32px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 0;
  cursor: pointer;
  background: none;
}

.color-text {
  max-width: 100px !important;
  font-family: var(--font-mono);
}

.hint {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.small {
  font-size: var(--font-size-xs);
}

.form-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.terrain-form {
  margin-bottom: var(--space-md);
  padding: var(--space-md);
}

.terrain-form h4 {
  margin-bottom: var(--space-sm);
  color: var(--color-gold);
}

.eyedropper-section {
  margin-bottom: var(--space-md);
}

.eyedropper-canvas {
  display: block;
  max-width: 100%;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: crosshair;
  margin-top: var(--space-xs);
}

.image-preview {
  margin-bottom: var(--space-sm);
}

.image-preview img {
  max-width: 100%;
  max-height: 200px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.terrain-table {
  margin-top: var(--space-md);
}

.terrain-header {
  display: grid;
  grid-template-columns: 120px 1fr 80px 50px 70px 40px 90px;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-dim);
  background: var(--color-bg);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.terrain-row {
  display: grid;
  grid-template-columns: 120px 1fr 80px 50px 70px 40px 90px;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-top: 1px solid var(--color-border-dim);
  align-items: center;
  font-size: var(--font-size-sm);
}

.terrain-row:hover {
  background: var(--color-surface-hover);
}

.color-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 4px;
}

.terrain-name {
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 4px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
}

.btn-xs {
  padding: 2px 8px;
  font-size: 11px;
}

.palette-status {
  margin-top: var(--space-sm);
}

.palette-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.channel-stats {
  margin-top: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.channel-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-xs);
  padding: 2px 0;
}

.channel-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  flex-shrink: 0;
}

.channel-green { background: #00FF00; }
.channel-blue { background: #0000FF; }
.channel-red { background: #FF0000; }
.channel-black { background: #000000; }

.error {
  color: var(--color-crimson-light);
}
</style>
