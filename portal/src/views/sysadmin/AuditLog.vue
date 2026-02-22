<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface AuditEntry {
  id: number
  actor_id: number
  action_key: string
  description: string
  target_type: string | null
  target_id: number | null
  metadata: string | null
  created_at: string
  actor_name: string
  actor_role: string | null
}

const { apiFetch } = useApi()

const entries = ref<AuditEntry[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const filterAction = ref('')
const filterTarget = ref('')
const offset = ref(0)
const limit = 50

onMounted(async () => {
  await loadLog()
})

async function loadLog() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (filterAction.value) params.set('actionKey', filterAction.value)
    if (filterTarget.value) params.set('targetType', filterTarget.value)

    const data = await apiFetch<{ entries: AuditEntry[]; total: number }>(
      `/api/staff/audit-log?${params}`
    )
    entries.value = data.entries
    total.value = data.total
  } catch (e: any) {
    error.value = e.message || 'Failed to load audit log'
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  offset.value = 0
  loadLog()
}

function nextPage() {
  if (offset.value + limit < total.value) {
    offset.value += limit
    loadLog()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit)
    loadLog()
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
</script>

<template>
  <div class="audit-log">
    <PageHeader title="Audit Log" subtitle="Staff action history" />

    <!-- Filters -->
    <div class="filter-bar">
      <input v-model="filterAction" placeholder="Filter by action (e.g. application.approved)" @keyup.enter="applyFilter" />
      <select v-model="filterTarget" @change="applyFilter">
        <option value="">All targets</option>
        <option value="character">Character</option>
        <option value="player">Player</option>
        <option value="role">Role</option>
        <option value="organization">Organization</option>
        <option value="faction">Faction</option>
        <option value="family_tree">Family Tree</option>
      </select>
      <button class="btn-secondary" @click="applyFilter">Filter</button>
    </div>

    <p v-if="error" class="crimson">{{ error }}</p>

    <!-- Log Entries -->
    <div class="log-table">
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div v-else-if="entries.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No entries found.</div>
      <div v-else v-for="entry in entries" :key="entry.id" class="log-row">
        <span class="log-time muted">{{ formatTime(entry.created_at) }}</span>
        <span class="log-actor">
          {{ entry.actor_name }}
          <span v-if="entry.actor_role" class="badge badge-gold" style="font-size: 9px; padding: 1px 4px">{{ entry.actor_role }}</span>
        </span>
        <span class="log-action badge badge-info">{{ entry.action_key }}</span>
        <span class="log-desc dim">{{ entry.description }}</span>
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
.audit-log {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.filter-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.filter-bar input {
  flex: 1;
}

.filter-bar select {
  width: 160px;
}

.log-table {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.log-row {
  display: grid;
  grid-template-columns: 160px 140px auto 1fr;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  align-items: center;
  border-bottom: 1px solid var(--color-border-dim);
}

.log-row:last-child {
  border-bottom: none;
}

.log-row:hover {
  background: var(--color-surface-hover);
}

.log-time {
  font-size: 10px;
  white-space: nowrap;
}

.log-actor {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 600;
  color: var(--color-text);
}

.log-action {
  font-size: 9px;
  padding: 1px 6px;
  white-space: nowrap;
}

.log-desc {
  font-family: var(--font-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
</style>
