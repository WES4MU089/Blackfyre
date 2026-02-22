<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface DuelInfo {
  id: number
  status: string
  outcome: string | null
  total_rounds: number
  attacker_hp_start: number | null
  attacker_hp_end: number | null
  defender_hp_start: number | null
  defender_hp_end: number | null
  created_at: string
  completed_at: string | null
  attacker_name: string
  defender_name: string
  winner_name: string | null
}

interface DuelRound {
  id: number
  round_number: number
  attacker_initiative: number | null
  defender_initiative: number | null
  first_actor: string | null
  first_attack_roll: number | null
  first_defense_roll: number | null
  first_hit: boolean | null
  first_margin: number | null
  first_damage: number | null
  first_damage_label: string | null
  second_attack_roll: number | null
  second_defense_roll: number | null
  second_hit: boolean | null
  second_margin: number | null
  second_damage: number | null
  second_damage_label: string | null
  attacker_hp_after: number | null
  defender_hp_after: number | null
  yield_attempted_by: string | null
  yield_accepted: boolean | null
  desperate_stand: boolean
  round_narrative: string | null
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const duel = ref<DuelInfo | null>(null)
const rounds = ref<DuelRound[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const duelId = route.params.duelId
    const data = await apiFetch<{ duel: DuelInfo; rounds: DuelRound[] }>(
      `/api/staff/combat-log/duels/${duelId}/rounds`
    )
    duel.value = data.duel
    rounds.value = data.rounds
  } catch (e: any) {
    error.value = e.message || 'Failed to load duel'
  } finally {
    loading.value = false
  }
})

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function firstActorName(round: DuelRound): string {
  if (!duel.value || !round.first_actor) return '?'
  return round.first_actor === 'attacker' ? duel.value.attacker_name : duel.value.defender_name
}

function secondActorName(round: DuelRound): string {
  if (!duel.value || !round.first_actor) return '?'
  return round.first_actor === 'attacker' ? duel.value.defender_name : duel.value.attacker_name
}

const outcomeLabels: Record<string, string> = {
  victory: 'Victory',
  yield_accepted: 'Yield Accepted',
  yield_rejected_slain: 'Yield Rejected — Slain',
  desperate_stand_win: 'Desperate Stand Victory',
  draw: 'Draw',
  cancelled: 'Cancelled',
}

const statusColors: Record<string, string> = {
  pending: 'badge-gold',
  active: 'badge-gold',
  completed: 'badge-success',
  cancelled: 'badge-crimson',
}
</script>

<template>
  <div class="duel-detail">
    <button class="btn-secondary back-btn" @click="router.push({ name: 'combat-log' })">
      &larr; Back to Combat Log
    </button>

    <div v-if="loading" class="dim">Loading duel...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="duel">
      <PageHeader
        :title="`Duel #${duel.id}`"
        :subtitle="`${duel.attacker_name} vs ${duel.defender_name}`"
      />

      <!-- Duel info -->
      <div class="duel-meta">
        <span class="badge" :class="statusColors[duel.status] || 'badge-gold'">{{ duel.status }}</span>
        <span v-if="duel.outcome" class="badge badge-info">{{ outcomeLabels[duel.outcome] || duel.outcome }}</span>
        <span v-if="duel.winner_name" class="muted">Winner: <strong style="color: var(--color-gold)">{{ duel.winner_name }}</strong></span>
        <span class="muted">{{ duel.total_rounds }} rounds</span>
        <span class="muted">{{ formatTime(duel.created_at) }}</span>
      </div>

      <!-- HP Summary -->
      <div class="hp-summary">
        <div class="hp-box">
          <div class="hp-label">{{ duel.attacker_name }}</div>
          <div class="hp-values">
            <span>{{ duel.attacker_hp_start ?? '?' }} HP</span>
            <span class="muted">&rarr;</span>
            <span :class="{ crimson: (duel.attacker_hp_end ?? 0) <= 0 }">{{ duel.attacker_hp_end ?? '?' }} HP</span>
          </div>
        </div>
        <div class="hp-box">
          <div class="hp-label">{{ duel.defender_name }}</div>
          <div class="hp-values">
            <span>{{ duel.defender_hp_start ?? '?' }} HP</span>
            <span class="muted">&rarr;</span>
            <span :class="{ crimson: (duel.defender_hp_end ?? 0) <= 0 }">{{ duel.defender_hp_end ?? '?' }} HP</span>
          </div>
        </div>
      </div>

      <!-- Round Log -->
      <h3 style="margin-top: var(--space-xl)">Round-by-Round</h3>
      <div v-if="rounds.length === 0" class="dim">No rounds recorded.</div>
      <div v-else class="rounds-table">
        <div class="round-row round-row-header">
          <span>Rnd</span>
          <span>First Strike</span>
          <span>Second Strike</span>
          <span>HP After</span>
          <span>Notes</span>
        </div>
        <div v-for="r in rounds" :key="r.id" class="round-row">
          <span class="round-num">{{ r.round_number }}</span>

          <!-- First strike -->
          <div class="strike-cell">
            <div class="strike-actor">{{ firstActorName(r) }}</div>
            <div v-if="r.first_attack_roll !== null" class="strike-rolls">
              Atk {{ r.first_attack_roll }} / Def {{ r.first_defense_roll }}
              <span v-if="r.first_hit" class="hit">HIT</span>
              <span v-else class="miss">MISS</span>
              <span v-if="r.first_margin" class="muted">({{ r.first_margin >= 0 ? '+' : '' }}{{ r.first_margin }})</span>
            </div>
            <div v-if="r.first_damage" class="strike-dmg">
              <span class="damage-amount">{{ r.first_damage }} dmg</span>
              <span v-if="r.first_damage_label" class="muted"> {{ r.first_damage_label }}</span>
            </div>
          </div>

          <!-- Second strike -->
          <div class="strike-cell">
            <div class="strike-actor">{{ secondActorName(r) }}</div>
            <div v-if="r.second_attack_roll !== null" class="strike-rolls">
              Atk {{ r.second_attack_roll }} / Def {{ r.second_defense_roll }}
              <span v-if="r.second_hit" class="hit">HIT</span>
              <span v-else class="miss">MISS</span>
              <span v-if="r.second_margin" class="muted">({{ r.second_margin >= 0 ? '+' : '' }}{{ r.second_margin }})</span>
            </div>
            <div v-if="r.second_damage" class="strike-dmg">
              <span class="damage-amount">{{ r.second_damage }} dmg</span>
              <span v-if="r.second_damage_label" class="muted"> {{ r.second_damage_label }}</span>
            </div>
          </div>

          <!-- HP After -->
          <div class="hp-cell">
            <div>{{ duel.attacker_name.split(' ')[0] }}: {{ r.attacker_hp_after ?? '?' }}</div>
            <div>{{ duel.defender_name.split(' ')[0] }}: {{ r.defender_hp_after ?? '?' }}</div>
          </div>

          <!-- Notes -->
          <div class="notes-cell">
            <span v-if="r.yield_attempted_by" class="badge badge-gold">
              Yield by {{ r.yield_attempted_by }}
              {{ r.yield_accepted ? '(accepted)' : '(rejected)' }}
            </span>
            <span v-if="r.desperate_stand" class="badge badge-crimson">Desperate Stand</span>
            <div v-if="r.round_narrative" class="narrative dim">{{ r.round_narrative }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.duel-detail {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-btn {
  margin-bottom: var(--space-md);
}

.duel-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: var(--font-size-sm);
}

.hp-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.hp-box {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  text-align: center;
}

.hp-label {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-gold);
  margin-bottom: var(--space-xs);
}

.hp-values {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
}

.rounds-table {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.round-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 120px 1fr;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border-dim);
  align-items: start;
}

.round-row:last-child {
  border-bottom: none;
}

.round-row:hover:not(.round-row-header) {
  background: var(--color-surface-hover);
}

.round-row-header {
  background: var(--color-surface);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-gold-dark);
  font-weight: 600;
}

.round-num {
  font-weight: 700;
  color: var(--color-text-dim);
  text-align: center;
}

.strike-actor {
  font-weight: 600;
  color: var(--color-gold);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
}

.strike-rolls {
  margin-top: 1px;
}

.strike-dmg {
  margin-top: 1px;
}

.damage-amount {
  font-weight: 700;
  color: var(--color-crimson);
}

.hit {
  font-weight: 700;
  color: var(--color-success);
}

.miss {
  color: var(--color-text-dim);
}

.hp-cell {
  font-size: 10px;
  color: var(--color-text-dim);
}

.notes-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.narrative {
  font-family: var(--font-body);
  font-style: italic;
  font-size: 10px;
  line-height: 1.3;
}

.crimson {
  color: var(--color-crimson);
}
</style>
