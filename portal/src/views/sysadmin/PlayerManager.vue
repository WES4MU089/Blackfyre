<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Player {
  id: number
  discord_id: string
  discord_username: string
  sl_name: string | null
  is_active: boolean
  is_banned: boolean
  is_super_admin: boolean
  role_id: number | null
  created_at: string
  last_seen: string
  role_name: string | null
  role_color: string | null
}

interface Role {
  id: number
  name: string
  color: string | null
}

const { apiFetch } = useApi()

const players = ref<Player[]>([])
const roles = ref<Role[]>([])
const total = ref(0)
const search = ref('')
const offset = ref(0)
const limit = 50
const loading = ref(true)
const error = ref('')

const editingPlayer = ref<Player | null>(null)
const editRoleId = ref<number | null>(null)
const actionLoading = ref(false)

onMounted(async () => {
  await Promise.all([loadPlayers(), loadRoles()])
})

async function loadPlayers() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (search.value) params.set('search', search.value)
    const data = await apiFetch<{ players: Player[]; total: number }>(
      `/api/sysadmin/players?${params}`
    )
    players.value = data.players
    total.value = data.total
  } catch (e: any) {
    error.value = e.message || 'Failed to load players'
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    const data = await apiFetch<{ roles: Role[] }>('/api/sysadmin/roles')
    roles.value = data.roles
  } catch { /* optional */ }
}

function doSearch() {
  offset.value = 0
  loadPlayers()
}

function nextPage() {
  if (offset.value + limit < total.value) {
    offset.value += limit
    loadPlayers()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit)
    loadPlayers()
  }
}

function startEdit(player: Player) {
  editingPlayer.value = player
  editRoleId.value = player.role_id
}

function cancelEdit() {
  editingPlayer.value = null
}

async function savePlayer() {
  if (!editingPlayer.value || actionLoading.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/sysadmin/players/${editingPlayer.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role_id: editRoleId.value }),
    })
    editingPlayer.value.role_id = editRoleId.value
    editingPlayer.value.role_name = roles.value.find((r) => r.id === editRoleId.value)?.name || null
    editingPlayer.value.role_color = roles.value.find((r) => r.id === editRoleId.value)?.color || null
    editingPlayer.value = null
  } catch (e: any) {
    error.value = e.message || 'Failed to update player'
  } finally {
    actionLoading.value = false
  }
}

async function toggleBan(player: Player) {
  if (actionLoading.value) return
  actionLoading.value = true
  try {
    await apiFetch(`/api/sysadmin/players/${player.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_banned: !player.is_banned }),
    })
    player.is_banned = !player.is_banned
  } catch (e: any) {
    error.value = e.message || 'Failed to update ban status'
  } finally {
    actionLoading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="player-manager">
    <PageHeader title="Players" subtitle="Manage player roles and access" />

    <!-- Search -->
    <div class="search-bar">
      <input
        v-model="search"
        placeholder="Search by Discord name, SL name, or Discord ID..."
        @keyup.enter="doSearch"
      />
      <button class="btn-primary" @click="doSearch">Search</button>
    </div>

    <p v-if="error" class="crimson">{{ error }}</p>

    <!-- Player List -->
    <div class="players-table">
      <div class="table-header">
        <span>Player</span>
        <span>Role</span>
        <span>Status</span>
        <span>Last Seen</span>
        <span>Actions</span>
      </div>
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div
        v-else
        v-for="player in players"
        :key="player.id"
        class="table-row"
        :class="{ 'row-banned': player.is_banned }"
      >
        <div class="player-info">
          <span class="player-name">{{ player.discord_username }}</span>
          <span v-if="player.sl_name" class="dim" style="font-size: var(--font-size-xs)">{{ player.sl_name }}</span>
        </div>
        <div>
          <!-- Edit mode for this player -->
          <template v-if="editingPlayer?.id === player.id">
            <select v-model="editRoleId" style="width: 140px">
              <option :value="null">No role</option>
              <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </template>
          <template v-else>
            <span v-if="player.role_name" class="badge badge-gold" :style="player.role_color ? { borderColor: player.role_color, color: player.role_color } : {}">
              {{ player.role_name }}
            </span>
            <span v-if="player.is_super_admin" class="badge badge-crimson">SA</span>
            <span v-if="!player.role_name && !player.is_super_admin" class="muted">-</span>
          </template>
        </div>
        <div>
          <span v-if="player.is_banned" class="badge badge-crimson">Banned</span>
          <span v-else-if="!player.is_active" class="badge badge-info">Inactive</span>
          <span v-else class="badge badge-success">Active</span>
        </div>
        <span class="muted" style="font-size: var(--font-size-xs)">{{ formatDate(player.last_seen) }}</span>
        <div class="row-actions">
          <template v-if="editingPlayer?.id === player.id">
            <button class="btn-primary" style="padding: 4px 8px; font-size: 10px" @click="savePlayer">Save</button>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 10px" @click="cancelEdit">Cancel</button>
          </template>
          <template v-else>
            <button class="btn-secondary" style="padding: 4px 8px; font-size: 10px" @click="startEdit(player)">Edit</button>
            <button
              class="btn-danger"
              style="padding: 4px 8px; font-size: 10px"
              @click="toggleBan(player)"
            >
              {{ player.is_banned ? 'Unban' : 'Ban' }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button class="btn-secondary" :disabled="offset === 0" @click="prevPage">Prev</button>
      <span class="muted">
        {{ offset + 1 }}&ndash;{{ Math.min(offset + limit, total) }} of {{ total }}
      </span>
      <button class="btn-secondary" :disabled="offset + limit >= total" @click="nextPage">Next</button>
    </div>
  </div>
</template>

<style scoped>
.player-manager {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.search-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.search-bar input {
  flex: 1;
}

.players-table {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  align-items: center;
  border-top: 1px solid var(--color-border-dim);
  font-size: var(--font-size-sm);
}

.table-row:hover {
  background: var(--color-surface-hover);
}

.row-banned {
  opacity: 0.5;
}

.player-info {
  display: flex;
  flex-direction: column;
}

.player-name {
  font-weight: 600;
}

.row-actions {
  display: flex;
  gap: var(--space-xs);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
</style>
