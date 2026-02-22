<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Combatant {
  character_id: number
  character_name: string
  team: number
  is_alive: boolean
  is_yielded: boolean
}

interface CombatSession {
  id: number
  lobby_id: number | null
  lobby_region: string | null
  status: string
  winning_team: number | null
  current_round: number
  created_at: string
  completed_at: string | null
  combatants: Combatant[]
}

interface Duel {
  id: number
  attacker_name: string
  defender_name: string
  winner_name: string | null
  status: string
  outcome: string | null
  total_rounds: number
  created_at: string
  completed_at: string | null
}

const router = useRouter()
const { apiFetch } = useApi()

const activeTab = ref<'sessions' | 'duels'>('sessions')
const sessions = ref<CombatSession[]>([])
const duels = ref<Duel[]>([])
const total = ref(0)
const duelsTotal = ref(0)
const loading = ref(true)
const error = ref('')

const filterRegion = ref('')
const filterStatus = ref('')
const filterCharacter = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')
const offset = ref(0)
const limit = 50

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset.value) })
    if (filterRegion.value) params.set('region', filterRegion.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterCharacter.value) params.set('characterName', filterCharacter.value)
    if (filterStartDate.value) params.set('startDate', filterStartDate.value)
    if (filterEndDate.value) params.set('endDate', filterEndDate.value)

    const data = await apiFetch<{
      sessions: CombatSession[]
      total: number
      duels: Duel[]
      duelsTotal: number
    }>(`/api/staff/combat-log?${params}`)

    sessions.value = data.sessions
    total.value = data.total
    duels.value = data.duels
    duelsTotal.value = data.duelsTotal
  } catch (e: any) {
    error.value = e.message || 'Failed to load combat log'
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  offset.value = 0
  loadData()
}

function nextPage() {
  const currentTotal = activeTab.value === 'sessions' ? total.value : duelsTotal.value
  if (offset.value + limit < currentTotal) {
    offset.value += limit
    loadData()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit)
    loadData()
  }
}

function viewSession(id: number) {
  router.push({ name: 'combat-session-detail', params: { sessionId: id } })
}

function viewDuel(id: number) {
  router.push({ name: 'duel-detail', params: { duelId: id } })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function teamNames(combatants: Combatant[], team: number): string {
  return combatants.filter(c => c.team === team).map(c => c.character_name).join(', ') || '—'
}

const statusColors: Record<string, string> = {
  active: 'badge-gold',
  completed: 'badge-success',
  abandoned: 'badge-crimson',
  pending: 'badge-gold',
  cancelled: 'badge-crimson',
}

const outcomeLabels: Record<string, string> = {
  victory: 'Victory',
  yield_accepted: 'Yield',
  yield_rejected_slain: 'Slain',
  desperate_stand_win: 'Desperate Stand',
  draw: 'Draw',
  cancelled: 'Cancelled',
}
</script>

<template>
  <div class="combat-log">
    <PageHeader title="Combat Log" subtitle="Combat sessions and duel history" />

    <!-- Filters -->
    <div class="filter-bar">
      <input v-model="filterRegion" placeholder="Region" @keyup.enter="applyFilter" />
      <select v-model="filterStatus" @change="applyFilter">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="abandoned">Abandoned</option>
      </select>
      <input v-model="filterCharacter" placeholder="Character name" @keyup.enter="applyFilter" />
      <input v-model="filterStartDate" type="date" @change="applyFilter" />
      <input v-model="filterEndDate" type="date" @change="applyFilter" />
      <button class="btn-secondary" @click="applyFilter">Filter</button>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button :class="['tab', { active: activeTab === 'sessions' }]" @click="activeTab = 'sessions'; offset = 0">
        Sessions ({{ total }})
      </button>
      <button :class="['tab', { active: activeTab === 'duels' }]" @click="activeTab = 'duels'; offset = 0">
        Duels ({{ duelsTotal }})
      </button>
    </div>

    <p v-if="error" class="crimson">{{ error }}</p>

    <!-- Sessions -->
    <div v-if="activeTab === 'sessions'" class="log-table">
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div v-else-if="sessions.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No combat sessions found.</div>
      <div v-else v-for="s in sessions" :key="s.id" class="session-row card-clickable" @click="viewSession(s.id)">
        <div class="session-header">
          <span class="session-id muted">#{{ s.id }}</span>
          <span v-if="s.lobby_region" class="session-region">{{ s.lobby_region }}</span>
          <span class="badge" :class="statusColors[s.status] || 'badge-gold'">{{ s.status }}</span>
          <span class="muted">R{{ s.current_round }}</span>
          <span class="session-time muted">{{ formatTime(s.created_at) }}</span>
        </div>
        <div class="session-teams">
          <span class="team">{{ teamNames(s.combatants, 1) }}</span>
          <span class="vs muted">vs</span>
          <span class="team">{{ teamNames(s.combatants, 2) }}</span>
        </div>
      </div>
    </div>

    <!-- Duels -->
    <div v-if="activeTab === 'duels'" class="log-table">
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div v-else-if="duels.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No duels found.</div>
      <div v-else v-for="d in duels" :key="d.id" class="session-row card-clickable" @click="viewDuel(d.id)">
        <div class="session-header">
          <span class="session-id muted">#{{ d.id }}</span>
          <span class="badge" :class="statusColors[d.status] || 'badge-gold'">{{ d.status }}</span>
          <span v-if="d.outcome" class="badge badge-info">{{ outcomeLabels[d.outcome] || d.outcome }}</span>
          <span class="muted">{{ d.total_rounds }} rounds</span>
          <span class="session-time muted">{{ formatTime(d.created_at) }}</span>
        </div>
        <div class="session-teams">
          <span class="team">{{ d.attacker_name }}</span>
          <span class="vs muted">vs</span>
          <span class="team">{{ d.defender_name }}</span>
          <span v-if="d.winner_name" class="winner muted">&mdash; Winner: <strong>{{ d.winner_name }}</strong></span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button class="btn-secondary" :disabled="offset === 0" @click="prevPage">Prev</button>
      <span class="muted">
        {{ offset + 1 }}&ndash;{{ Math.min(offset + limit, activeTab === 'sessions' ? total : duelsTotal) }}
        of {{ activeTab === 'sessions' ? total : duelsTotal }}
      </span>
      <button class="btn-secondary" :disabled="offset + limit >= (activeTab === 'sessions' ? total : duelsTotal)" @click="nextPage">Next</button>
    </div>
  </div>
</template>

<style scoped>
.combat-log {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.filter-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.filter-bar input,
.filter-bar select {
  min-width: 120px;
}

.filter-bar input[type="date"] {
  width: 150px;
}

.tab-bar {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border-dim);
}

.tab {
  padding: var(--space-xs) var(--space-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-dim);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text);
}

.tab.active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.log-table {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.session-row {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
  cursor: pointer;
}

.session-row:last-child {
  border-bottom: none;
}

.session-row:hover {
  background: var(--color-surface-hover);
}

.session-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
}

.session-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  min-width: 40px;
}

.session-region {
  font-weight: 600;
  color: var(--color-text);
}

.session-time {
  margin-left: auto;
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.session-teams {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
}

.team {
  color: var(--color-gold);
  font-weight: 500;
}

.vs {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
}

.winner {
  font-size: var(--font-size-xs);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
</style>
