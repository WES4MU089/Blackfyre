<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface DayEntry {
  date: string
  label: string
  message_count: number
}

const router = useRouter()
const { apiFetch } = useApi()

const days = ref<DayEntry[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const filterChannel = ref('')
const filterRegion = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')
const offset = ref(0)
const limit = 30

onMounted(() => loadDays())

async function loadDays() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (filterChannel.value) params.set('channelKey', filterChannel.value)
    if (filterRegion.value) params.set('region', filterRegion.value)
    if (filterStartDate.value) params.set('startDate', filterStartDate.value)
    if (filterEndDate.value) params.set('endDate', filterEndDate.value)

    const data = await apiFetch<{ days: DayEntry[]; total: number }>(
      `/api/staff/chat-log/days?${params}`
    )
    days.value = data.days
    total.value = data.total
  } catch (e: any) {
    error.value = e.message || 'Failed to load chat log days'
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  offset.value = 0
  loadDays()
}

function nextPage() {
  if (offset.value + limit < total.value) {
    offset.value += limit
    loadDays()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit)
    loadDays()
  }
}

function viewDay(date: string) {
  const query: Record<string, string> = {}
  if (filterChannel.value) query.channelKey = filterChannel.value
  if (filterRegion.value) query.region = filterRegion.value
  router.push({ name: 'chat-log-day', params: { date }, query })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="chat-log">
    <PageHeader title="Chat Log" subtitle="Daily chat message archives" />

    <!-- Filters -->
    <div class="filter-bar">
      <select v-model="filterChannel" @change="applyFilter">
        <option value="">All channels</option>
        <option value="ic">IC</option>
        <option value="ooc">OOC</option>
        <option value="whispers">Whispers</option>
        <option value="system">System</option>
      </select>
      <input v-model="filterRegion" placeholder="Region" @keyup.enter="applyFilter" />
      <input v-model="filterStartDate" type="date" @change="applyFilter" />
      <input v-model="filterEndDate" type="date" @change="applyFilter" />
      <button class="btn-secondary" @click="applyFilter">Filter</button>
    </div>

    <p v-if="error" class="crimson">{{ error }}</p>

    <!-- Daily file list -->
    <div class="log-table">
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div v-else-if="days.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No chat logs found.</div>
      <div v-else v-for="d in days" :key="d.date" class="day-row card-clickable" @click="viewDay(d.date)">
        <span class="day-label">{{ d.label }}</span>
        <span class="day-date muted">{{ formatDate(d.date) }}</span>
        <span class="badge badge-info">{{ d.message_count.toLocaleString() }} messages</span>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button class="btn-secondary" :disabled="offset === 0" @click="prevPage">Prev</button>
      <span class="muted">
        {{ offset + 1 }}&ndash;{{ Math.min(offset + limit, total) }} of {{ total }} days
      </span>
      <button class="btn-secondary" :disabled="offset + limit >= total" @click="nextPage">Next</button>
    </div>
  </div>
</template>

<style scoped>
.chat-log {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.filter-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.filter-bar input,
.filter-bar select {
  min-width: 120px;
}

.filter-bar input[type="date"] {
  width: 150px;
}

.log-table {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.day-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
  cursor: pointer;
}

.day-row:last-child {
  border-bottom: none;
}

.day-row:hover {
  background: var(--color-surface-hover);
}

.day-label {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  min-width: 200px;
}

.day-date {
  font-size: var(--font-size-sm);
  flex: 1;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
</style>
