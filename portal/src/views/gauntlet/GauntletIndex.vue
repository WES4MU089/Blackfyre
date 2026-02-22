<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface GauntletMap {
  id: number
  name: string
  description: string | null
  width: number
  height: number
  grid_size: number
  base_image_path: string | null
  is_active: boolean
  created_at: string
}

const router = useRouter()
const { apiFetch, apiUpload } = useApi()
const maps = ref<GauntletMap[]>([])
const loading = ref(true)
const error = ref('')

// Create form
const showCreate = ref(false)
const createName = ref('')
const createDesc = ref('')
const createGridSize = ref(8)
const createFile = ref<File | null>(null)
const creating = ref(false)
const createError = ref('')

onMounted(() => loadMaps())

async function loadMaps() {
  loading.value = true
  try {
    maps.value = await apiFetch<GauntletMap[]>('/api/gauntlet/maps')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  createFile.value = input.files?.[0] ?? null
}

async function createMap() {
  if (!createFile.value) {
    createError.value = 'Please select a base map image'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    // Read image dimensions
    const dims = await getImageDimensions(createFile.value)

    const fd = new FormData()
    fd.append('name', createName.value)
    fd.append('description', createDesc.value)
    fd.append('width', String(dims.width))
    fd.append('height', String(dims.height))
    fd.append('grid_size', String(createGridSize.value))
    fd.append('baseImage', createFile.value)

    const map = await apiUpload<GauntletMap>('/api/gauntlet/maps', fd)
    maps.value.unshift(map)
    showCreate.value = false
    createName.value = ''
    createDesc.value = ''
    createGridSize.value = 8
    createFile.value = null
  } catch (e: any) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => reject(new Error('Failed to read image dimensions'))
    img.src = URL.createObjectURL(file)
  })
}

async function deleteMap(map: GauntletMap) {
  if (!confirm(`Delete map "${map.name}"? This cannot be undone.`)) return
  try {
    await apiFetch(`/api/gauntlet/maps/${map.id}`, { method: 'DELETE' })
    maps.value = maps.value.filter(m => m.id !== map.id)
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

<template>
  <div class="container">
    <PageHeader title="Gauntlet Engine" subtitle="Campaign map management" />

    <div class="toolbar">
      <button class="btn-primary" @click="showCreate = !showCreate">
        {{ showCreate ? 'Cancel' : 'Create Map' }}
      </button>
    </div>

    <!-- Create Form -->
    <div v-if="showCreate" class="card create-form">
      <h3 class="gold">New Campaign Map</h3>
      <div class="form-row">
        <label>Name</label>
        <input v-model="createName" type="text" placeholder="Westeros Campaign" maxlength="100" />
      </div>
      <div class="form-row">
        <label>Description</label>
        <textarea v-model="createDesc" rows="2" placeholder="Optional description..." maxlength="2000" />
      </div>
      <div class="form-row">
        <label>Grid Size (px)</label>
        <input v-model.number="createGridSize" type="number" min="1" max="64" />
        <span class="hint">Pathfinding sample resolution. Lower = more precise but slower.</span>
      </div>
      <div class="form-row">
        <label>Base Map Image</label>
        <input type="file" accept="image/*" @change="onFileChange" />
      </div>
      <p v-if="createError" class="error">{{ createError }}</p>
      <button class="btn-primary" :disabled="creating || !createName" @click="createMap">
        {{ creating ? 'Creating...' : 'Create Map' }}
      </button>
    </div>

    <!-- Loading / Error -->
    <p v-if="loading" class="dim">Loading maps...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="maps.length === 0" class="dim">No campaign maps yet. Create one to get started.</p>

    <!-- Maps Table -->
    <div v-else>
      <div class="table-header">
        <span>Name</span>
        <span>Dimensions</span>
        <span>Grid</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      <div v-for="map in maps" :key="map.id" class="table-row">
        <span class="map-name">{{ map.name }}</span>
        <span class="dim">{{ map.width }} x {{ map.height }}</span>
        <span class="dim">{{ map.grid_size }}px</span>
        <span>
          <span :class="['badge', map.is_active ? 'badge-success' : 'badge-info']">
            {{ map.is_active ? 'Active' : 'Inactive' }}
          </span>
        </span>
        <span class="actions">
          <button class="btn-secondary btn-sm" @click="router.push(`/gauntlet/${map.id}/edit`)">Edit</button>
          <button class="btn-secondary btn-sm" @click="router.push(`/gauntlet/${map.id}/test`)">Test</button>
          <button class="btn-danger btn-sm" @click="deleteMap(map)">Delete</button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.toolbar {
  margin-bottom: var(--space-lg);
}

.create-form {
  margin-bottom: var(--space-lg);
  padding: var(--space-lg);
}

.create-form h3 {
  margin-bottom: var(--space-md);
}

.form-row {
  margin-bottom: var(--space-md);
}

.form-row label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dim);
  margin-bottom: var(--space-xs);
}

.form-row input[type="text"],
.form-row input[type="number"],
.form-row textarea {
  width: 100%;
  max-width: 400px;
  padding: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.form-row textarea {
  max-width: 600px;
  resize: vertical;
}

.form-row input[type="file"] {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.hint {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 0.5fr 0.7fr 1.5fr;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-dim);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 0.5fr 0.7fr 1.5fr;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border-dim);
  align-items: center;
}

.table-row:hover {
  background: var(--color-surface-hover);
}

.map-name {
  font-weight: 600;
}

.actions {
  display: flex;
  gap: var(--space-xs);
}

.btn-sm {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
}

.error {
  color: var(--color-crimson-light);
}
</style>
