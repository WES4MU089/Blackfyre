<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useCombatStore, type ActionResultView } from '@/stores/combat'
import { useCharacterStore } from '@/stores/character'

const combatStore = useCombatStore()
const characterStore = useCharacterStore()

const logContainer = ref<HTMLElement | null>(null)
const verboseMode = ref(false)

const myCharId = computed(() => characterStore.character?.id ?? null)

// Auto-scroll to bottom when new entries arrive
watch(
  () => combatStore.combatLog.length,
  async () => {
    await nextTick()
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  }
)

function getEntryTeam(entry: ActionResultView): number | null {
  const actor = combatStore.combatants.find(c => c.characterId === entry.actorCharacterId)
  return actor?.team ?? null
}

function isMyAction(entry: ActionResultView): boolean {
  return entry.actorCharacterId === myCharId.value
}

/** Map of combatant name → team number for highlighting. */
const nameTeamMap = computed(() => {
  const map = new Map<string, number>()
  for (const c of combatStore.combatants) {
    map.set(c.characterName, c.team)
  }
  return map
})

function formatNarrative(entry: ActionResultView): string {
  // Use the narrative from the server, or build a fallback
  let text: string
  if (entry.narrative) {
    text = entry.narrative
  } else {
    const atk = entry.attackResult
    text = `${entry.actorName} uses ${entry.actionType}`
    if (entry.targetName) text += ` on ${entry.targetName}`
    if (atk?.hit) {
      text += ` — ${atk.damage} damage`
      if (atk.hitQuality === 'critical') text += ' (CRIT!)'
      else if (atk.hitQuality === 'strong') text += ' (STRONG!)'
    } else if (atk?.defenseReversal) {
      text += ' — REVERSED'
    } else if (entry.actionType === 'attack') {
      text += ' — MISS'
    }
  }

  return highlightNames(text)
}

/** Wrap character names in team-colored spans. */
function highlightNames(text: string): string {
  const map = nameTeamMap.value
  if (map.size === 0) return escapeHtml(text)

  // Sort names longest-first so "Ser Rodrik the Bold" matches before "Ser Rodrik"
  const names = Array.from(map.keys()).sort((a, b) => b.length - a.length)
  // Build regex that matches any combatant name
  const pattern = new RegExp(`(${names.map(escapeRegex).join('|')})`, 'g')

  // Split on name boundaries and rebuild with spans
  const parts = text.split(pattern)
  return parts.map(part => {
    const team = map.get(part)
    if (team != null) {
      return `<span class="name-team-${team}">${escapeHtml(part)}</span>`
    }
    return escapeHtml(part)
  }).join('')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatDice(dice: number[], threshold: number = 4): string {
  return dice.map(d => d >= threshold ? `<span class="die-success">${d}</span>` : `<span class="die-fail">${d}</span>`).join(' ')
}

function formatVerbose(entry: ActionResultView): string | null {
  const atk = entry.attackResult
  if (!atk) return null

  const lines: string[] = []

  // Attack pool (success on 4+)
  const atkDice = atk.attackDice?.length ? formatDice(atk.attackDice, 4) : '—'
  lines.push(`<span class="verbose-label">ATK</span> ${atkDice} <span class="verbose-dim">→ ${atk.attackSuccesses} hit${atk.attackSuccesses !== 1 ? 's' : ''} (${atk.attackPoolSize}d6, 4+)</span>`)

  // Defense pool (success on 5+)
  if (atk.defenseDice?.length) {
    const defDice = formatDice(atk.defenseDice, 5)
    lines.push(`<span class="verbose-label">DEF</span> ${defDice} <span class="verbose-dim">→ ${atk.defenseSuccesses} hit${atk.defenseSuccesses !== 1 ? 's' : ''} (${atk.defensePoolSize}d6, 5+)</span>`)
  }

  // Net successes + outcome
  const sign = atk.netSuccesses >= 0 ? '+' : ''
  let outcome = 'Miss'
  if (atk.hit && atk.hitQuality === 'critical') outcome = 'Critical Hit'
  else if (atk.hit && atk.hitQuality === 'strong') outcome = 'Strong Hit'
  else if (atk.hit) outcome = 'Hit'
  else if (atk.defenseReversal && atk.dodged) outcome = 'Dodged + Riposte'
  else if (atk.defenseReversal) outcome = 'Reversal + Counter'
  lines.push(`<span class="verbose-label">NET</span> <span class="verbose-dim">${sign}${atk.netSuccesses} →</span> ${outcome}`)

  // Damage line
  if (atk.hit && atk.damage > 0) {
    let dmgLine = `<span class="verbose-label">DMG</span> ${atk.damage} <span class="verbose-dim">(${atk.damageLabel})</span>`
    if (atk.bonuses.length > 0) {
      dmgLine += ` <span class="verbose-dim">| ${atk.bonuses.join(', ')}</span>`
    }
    if (atk.critEffectsApplied.length > 0) {
      dmgLine += ` <span class="verbose-crit">| ${atk.critEffectsApplied.join(', ')}</span>`
    }
    lines.push(dmgLine)
  }

  // Counter-attack
  if (atk.counterAttack && atk.counterAttack.damage > 0) {
    lines.push(`<span class="verbose-label">CTR</span> <span class="verbose-dim">Counter-attack deals</span> ${atk.counterAttack.damage} <span class="verbose-dim">damage</span>`)
  }

  // Dodge riposte
  if (atk.dodgeRiposte && atk.dodgeRiposte.damage > 0) {
    lines.push(`<span class="verbose-label">RIP</span> <span class="verbose-dim">Riposte deals</span> ${atk.dodgeRiposte.damage} <span class="verbose-dim">damage</span>`)
  }

  return lines.join('<br>')
}

function entryClasses(entry: ActionResultView): Record<string, boolean> {
  const team = getEntryTeam(entry)
  const hitQuality = entry.attackResult?.hitQuality ?? null
  return {
    'log-entry': true,
    'team-1': team === 1,
    'team-2': team === 2,
    'is-crit': hitQuality === 'critical',
    'is-strong': hitQuality === 'strong',
    'is-mine': isMyAction(entry),
    'is-dot': entry.actionType === 'bleeding',
  }
}
</script>

<template>
  <div class="combat-log">
    <div class="log-header">
      <span class="log-title">Combat Log</span>
      <div class="log-header-right">
        <button
          class="verbose-toggle"
          :class="{ active: verboseMode }"
          title="Toggle dice math"
          @click="verboseMode = !verboseMode"
        >d6</button>
        <span class="log-count">{{ combatStore.combatLog.length }}</span>
      </div>
    </div>
    <div ref="logContainer" class="log-entries">
      <div v-if="combatStore.combatLog.length === 0" class="log-empty">
        Awaiting first action...
      </div>
      <div
        v-for="(entry, i) in combatStore.combatLog"
        :key="i"
        :class="entryClasses(entry)"
      >
        <span class="log-round">R{{ entry.roundNumber }}</span>
        <div class="log-content">
          <div class="log-narrative-row">
            <span class="log-narrative" v-html="formatNarrative(entry)"></span>
            <span v-if="entry.attackResult?.hitQuality === 'critical'" class="log-crit-badge">CRIT</span>
            <span v-else-if="entry.attackResult?.hitQuality === 'strong'" class="log-strong-badge">STRONG</span>
          </div>
          <div
            v-if="verboseMode && entry.attackResult"
            class="log-verbose"
            v-html="formatVerbose(entry)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-log {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.log-title {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.log-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.log-count {
  font-size: 9px;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
}

.verbose-toggle {
  font-size: 8px;
  font-family: var(--font-mono);
  color: var(--color-text-dim);
  background: transparent;
  border: 1px solid var(--color-border-dim);
  border-radius: 2px;
  padding: 1px 4px;
  cursor: pointer;
  letter-spacing: 0.05em;
  transition: all 0.15s ease;
}
.verbose-toggle:hover {
  color: var(--color-text-muted);
  border-color: var(--color-border);
}
.verbose-toggle.active {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

.log-entries {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-xs);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Custom scrollbar */
.log-entries::-webkit-scrollbar {
  width: 4px;
}
.log-entries::-webkit-scrollbar-track {
  background: transparent;
}
.log-entries::-webkit-scrollbar-thumb {
  background: var(--color-border-dim);
  border-radius: 2px;
}
.log-entries::-webkit-scrollbar-thumb:hover {
  background: var(--color-border);
}

.log-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  text-align: center;
  padding: var(--space-md) 0;
  font-style: italic;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  padding: 2px var(--space-xs);
  border-radius: 1px;
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.log-entry.is-mine {
  background: rgba(201, 168, 76, 0.04);
}

/* Team color coding for left accent */
.log-entry.team-1 {
  border-left: 2px solid rgba(91, 155, 213, 0.4);
}
.log-entry.team-2 {
  border-left: 2px solid rgba(224, 108, 117, 0.4);
}

.log-entry.is-crit {
  background: rgba(201, 168, 76, 0.06);
}

.log-entry.is-strong {
  background: rgba(201, 168, 76, 0.03);
}

.log-round {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
  flex-shrink: 0;
  min-width: 20px;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-narrative-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
}

.log-narrative {
  color: var(--color-text);
  flex: 1;
}

.log-verbose {
  margin-top: 2px;
  padding: 3px 0 2px var(--space-xs);
  border-left: 1px solid rgba(201, 168, 76, 0.15);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.5;
  color: var(--color-text-dim);
}

.log-verbose :deep(.verbose-label) {
  color: var(--color-text-muted);
  font-weight: 600;
  display: inline-block;
  min-width: 24px;
}

.log-verbose :deep(.verbose-dim) {
  color: var(--color-text-dim);
}

.log-verbose :deep(.verbose-crit) {
  color: var(--color-gold);
}

.log-verbose :deep(.die-success) {
  color: #6ec86e;
  font-weight: 600;
}

.log-verbose :deep(.die-fail) {
  color: var(--color-text-dim);
  opacity: 0.6;
}

/* Team-colored character names in narrative text */
.log-narrative :deep(.name-team-1) {
  color: #5b9bd5;
  font-weight: 600;
}
.log-narrative :deep(.name-team-2) {
  color: #e06c75;
  font-weight: 600;
}

.log-entry.is-dot {
  border-left: 2px solid rgba(196, 122, 50, 0.6);
  background: rgba(196, 122, 50, 0.06);
}

.log-entry.is-dot .log-narrative {
  color: #c47a32;
  font-style: italic;
}

.log-crit-badge {
  font-size: 8px;
  font-family: var(--font-display);
  color: var(--color-gold);
  border: 1px solid var(--color-gold-dim);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  align-self: center;
}

.log-strong-badge {
  font-size: 8px;
  font-family: var(--font-display);
  color: #c9a84c99;
  border: 1px solid rgba(201, 168, 76, 0.2);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  align-self: center;
}
</style>
