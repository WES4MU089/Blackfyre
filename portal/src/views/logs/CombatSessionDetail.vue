<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Combatant {
  character_id: number
  character_name: string
  team: number
  is_alive: boolean
  is_yielded: boolean
  current_health: number
  max_health: number
}

interface RollData {
  attackPoolSize: number
  defensePoolSize: number
  attackSuccesses: number
  defenseSuccesses: number
  netSuccesses: number
  hit: boolean
  defenseReversal?: boolean
  hitQuality: string | null
}

interface CombatAction {
  id: number
  round_number: number
  turn_number: number
  actor_character_id: number
  actor_name: string
  action_type: string
  target_character_id: number | null
  target_name: string | null
  roll_data: RollData | null
  damage_dealt: number
  damage_label: string | null
  crit: boolean
  crit_effect: string | null
  status_effects_applied: unknown[]
  narrative: string | null
  created_at: string
}

interface SessionData {
  id: number
  lobby_id: number | null
  lobby_region: string | null
  status: string
  winning_team: number | null
  current_round: number
  created_at: string
  completed_at: string | null
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const session = ref<SessionData | null>(null)
const combatants = ref<Combatant[]>([])
const actions = ref<CombatAction[]>([])
const loading = ref(true)
const error = ref('')

const team1 = computed(() => combatants.value.filter(c => c.team === 1))
const team2 = computed(() => combatants.value.filter(c => c.team === 2))

const actionsByRound = computed(() => {
  const grouped = new Map<number, CombatAction[]>()
  for (const a of actions.value) {
    const arr = grouped.get(a.round_number) || []
    arr.push(a)
    grouped.set(a.round_number, arr)
  }
  return [...grouped.entries()].sort((a, b) => a[0] - b[0])
})

onMounted(async () => {
  try {
    const sessionId = route.params.sessionId
    const data = await apiFetch<{
      session: SessionData
      combatants: Combatant[]
      actions: CombatAction[]
    }>(`/api/staff/combat-log/${sessionId}/actions`)

    session.value = data.session
    combatants.value = data.combatants
    actions.value = data.actions
  } catch (e: any) {
    error.value = e.message || 'Failed to load session'
  } finally {
    loading.value = false
  }
})

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatRoll(r: RollData): string {
  const atk = `Atk ${r.attackSuccesses}/${r.attackPoolSize}`
  const def = `Def ${r.defenseSuccesses}/${r.defensePoolSize}`
  const net = `Net ${r.netSuccesses >= 0 ? '+' : ''}${r.netSuccesses}`
  return `${atk} vs ${def} = ${net}`
}

const actionColors: Record<string, string> = {
  attack: 'badge-crimson',
  protect: 'badge-info',
  grapple: 'badge-gold',
  disengage: 'badge-gold',
  brace: 'badge-info',
  opportunity_attack: 'badge-crimson',
  skip: 'badge-gold',
  mend: 'badge-success',
}

const statusColors: Record<string, string> = {
  active: 'badge-gold',
  completed: 'badge-success',
  abandoned: 'badge-crimson',
}
</script>

<template>
  <div class="session-detail">
    <button class="btn-secondary back-btn" @click="router.push({ name: 'combat-log' })">
      &larr; Back to Combat Log
    </button>

    <div v-if="loading" class="dim">Loading session...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="session">
      <PageHeader
        :title="`Session #${session.id}`"
        :subtitle="session.lobby_region || 'No lobby'"
      />

      <!-- Session info -->
      <div class="session-meta">
        <span class="badge" :class="statusColors[session.status] || 'badge-gold'">{{ session.status }}</span>
        <span v-if="session.winning_team" class="muted">Winner: Team {{ session.winning_team }}</span>
        <span class="muted">{{ session.current_round }} rounds</span>
        <span class="muted">{{ formatTime(session.created_at) }}</span>
        <span v-if="session.completed_at" class="muted">&rarr; {{ formatTime(session.completed_at) }}</span>
      </div>

      <!-- Combatants -->
      <div class="teams-grid">
        <div class="team-box">
          <div class="team-label">Team 1</div>
          <div v-for="c in team1" :key="c.character_id" class="combatant-row">
            <span class="combatant-name">{{ c.character_name }}</span>
            <span class="combatant-hp muted">{{ c.current_health }}/{{ c.max_health }} HP</span>
            <span v-if="!c.is_alive" class="badge badge-crimson">Dead</span>
            <span v-else-if="c.is_yielded" class="badge badge-gold">Yielded</span>
          </div>
        </div>
        <div class="team-box">
          <div class="team-label">Team 2</div>
          <div v-for="c in team2" :key="c.character_id" class="combatant-row">
            <span class="combatant-name">{{ c.character_name }}</span>
            <span class="combatant-hp muted">{{ c.current_health }}/{{ c.max_health }} HP</span>
            <span v-if="!c.is_alive" class="badge badge-crimson">Dead</span>
            <span v-else-if="c.is_yielded" class="badge badge-gold">Yielded</span>
          </div>
        </div>
      </div>

      <!-- Action Log -->
      <h3 style="margin-top: var(--space-xl)">Action Log</h3>
      <div v-if="actions.length === 0" class="dim">No actions recorded.</div>
      <div v-else class="action-log">
        <template v-for="[round, roundActions] in actionsByRound" :key="round">
          <div class="round-header">Round {{ round }}</div>
          <div v-for="a in roundActions" :key="a.id" class="action-row">
            <div class="action-meta">
              <span class="round-turn muted">R{{ a.round_number }}T{{ a.turn_number }}</span>
              <span class="actor-name">{{ a.actor_name }}</span>
              <span class="badge" :class="actionColors[a.action_type] || 'badge-gold'">{{ a.action_type }}</span>
              <span v-if="a.target_name" class="muted">&rarr; {{ a.target_name }}</span>
            </div>

            <!-- Dice details -->
            <div v-if="a.roll_data" class="roll-details">
              <span class="roll-text">{{ formatRoll(a.roll_data) }}</span>
              <span v-if="a.roll_data.hit" class="hit-indicator hit">HIT</span>
              <span v-else class="hit-indicator miss">MISS</span>
              <span v-if="a.roll_data.defenseReversal" class="badge badge-info" style="font-size: 9px">Reversal</span>
            </div>

            <!-- Damage -->
            <div v-if="a.damage_dealt > 0" class="damage-line">
              <span class="damage-amount">{{ a.damage_dealt }} dmg</span>
              <span v-if="a.damage_label" class="muted">({{ a.damage_label }})</span>
              <span v-if="a.crit" class="badge badge-crimson">CRIT</span>
              <span v-if="a.crit_effect" class="crit-effects muted">&mdash; {{ a.crit_effect }}</span>
            </div>

            <!-- Status effects -->
            <div v-if="a.status_effects_applied && a.status_effects_applied.length" class="effects-line dim">
              Effects: {{ a.status_effects_applied.map((e: any) => e.type || e).join(', ') }}
            </div>

            <!-- Narrative -->
            <div v-if="a.narrative" class="narrative dim">{{ a.narrative }}</div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.session-detail {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-btn {
  margin-bottom: var(--space-md);
}

.session-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: var(--font-size-sm);
}

.teams-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.team-box {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.team-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-gold-dark);
  margin-bottom: var(--space-sm);
}

.combatant-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  font-size: var(--font-size-sm);
}

.combatant-name {
  font-weight: 600;
  color: var(--color-gold);
}

.combatant-hp {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.action-log {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-size: var(--font-size-sm);
}

.round-header {
  background: var(--color-surface);
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-gold-dark);
  border-bottom: 1px solid var(--color-border-dim);
}

.action-row {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.action-row:last-child {
  border-bottom: none;
}

.action-row:hover {
  background: var(--color-surface-hover);
}

.action-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.round-turn {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  min-width: 48px;
}

.actor-name {
  font-weight: 600;
  color: var(--color-gold);
}

.roll-details {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.roll-text {
  color: var(--color-text-dim);
}

.hit-indicator {
  font-weight: 700;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 2px;
}

.hit-indicator.hit {
  color: var(--color-success);
}

.hit-indicator.miss {
  color: var(--color-text-dim);
}

.damage-line {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: 2px;
  font-size: var(--font-size-xs);
}

.damage-amount {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-crimson);
}

.crit-effects {
  font-style: italic;
}

.effects-line {
  margin-top: 2px;
  font-size: var(--font-size-xs);
}

.narrative {
  margin-top: 4px;
  font-style: italic;
  font-size: var(--font-size-xs);
  line-height: 1.4;
}
</style>
