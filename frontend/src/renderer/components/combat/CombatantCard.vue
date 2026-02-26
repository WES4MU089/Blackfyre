<script setup lang="ts">
import { computed } from 'vue'
import type { CombatantView } from '@/stores/combat'
import { useCombatStore } from '@/stores/combat'
import StatusEffectIcon from './StatusEffectIcon.vue'
import CombatCallout from './CombatCallout.vue'

const combatStore = useCombatStore()

const props = defineProps<{
  combatant: CombatantView
  isMe: boolean
  isMyRetainer: boolean
  isSelected: boolean
  isCurrentTurn: boolean
  teamColor: 'blue' | 'red'
}>()

const emit = defineEmits<{
  select: [characterId: number]
  'hover-start': [combatant: CombatantView, e: MouseEvent]
  'hover-move': [e: MouseEvent]
  'hover-end': []
}>()

const hpPercent = computed(() => {
  if (props.combatant.maxHealth <= 0) return 0
  return Math.max(0, Math.min(100, (props.combatant.currentHealth / props.combatant.maxHealth) * 100))
})

const hpBarClass = computed(() => {
  if (hpPercent.value <= 25) return 'hp-critical'
  if (hpPercent.value <= 50) return 'hp-low'
  return 'hp-normal'
})

const isClickable = computed(() => props.combatant.isAlive && !props.combatant.isYielded)

const activeCallout = computed(() => combatStore.getCalloutFor(props.combatant.characterId))

function onClick(): void {
  if (isClickable.value) {
    emit('select', props.combatant.characterId)
  }
}

function onMouseEnter(e: MouseEvent): void {
  if (!props.isMe && props.combatant.isAlive) {
    emit('hover-start', props.combatant, e)
  }
}

function onMouseMove(e: MouseEvent): void {
  if (!props.isMe && props.combatant.isAlive) {
    emit('hover-move', e)
  }
}

function onMouseLeave(): void {
  emit('hover-end')
}
</script>

<template>
  <div
    class="combatant-card"
    :class="{
      'is-me': isMe,
      'is-my-retainer': isMyRetainer,
      'is-selected': isSelected,
      'is-current-turn': isCurrentTurn,
      'is-dead': !combatant.isAlive,
      'is-yielded': combatant.isYielded,
      'team-blue': teamColor === 'blue',
      'team-red': teamColor === 'red',
      'is-clickable': isClickable,
    }"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Callout bubble (floats above card) -->
    <CombatCallout v-if="activeCallout" :key="activeCallout.id" :text="activeCallout.text" />

    <!-- Name row -->
    <div class="card-name-row">
      <div v-if="combatant.thumbnailUrl" class="card-portrait">
        <img :src="combatant.thumbnailUrl" :alt="combatant.characterName" />
      </div>
      <span class="card-name" :title="combatant.characterName">
        {{ combatant.characterName }}
      </span>
      <span v-if="isMe" class="me-badge">YOU</span>
      <span v-else-if="isMyRetainer" class="retainer-badge">RET</span>
      <span v-if="isCurrentTurn" class="turn-dot" />
    </div>

    <!-- HP bar -->
    <div class="card-hp-bar-wrapper">
      <div class="card-hp-bar" :class="hpBarClass" :style="{ width: hpPercent + '%' }" />
      <span class="card-hp-text">{{ combatant.currentHealth }} / {{ combatant.maxHealth }}</span>
    </div>

    <!-- Status effects -->
    <div v-if="combatant.statusEffects.length > 0" class="card-effects">
      <StatusEffectIcon
        v-for="(effect, i) in combatant.statusEffects"
        :key="effect.type + '-' + i"
        :type="effect.type"
        :stacks="effect.stacks"
        :rounds-remaining="effect.roundsRemaining"
      />
    </div>

    <!-- Dead / Yielded overlay -->
    <div v-if="!combatant.isAlive" class="card-overlay dead-overlay">DEFEATED</div>
    <div v-else-if="combatant.isYielded" class="card-overlay yield-overlay">YIELDED</div>
  </div>
</template>

<style scoped>
.combatant-card {
  position: relative;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  overflow: visible;
}

.combatant-card.is-clickable {
  cursor: pointer;
}
.combatant-card.is-clickable:hover {
  border-color: var(--color-border);
  background: rgba(0, 0, 0, 0.45);
}

/* Team accent on left border */
.combatant-card.team-blue {
  border-left: 2px solid rgba(91, 155, 213, 0.5);
}
.combatant-card.team-red {
  border-left: 2px solid rgba(224, 108, 117, 0.5);
}

/* Selected highlight */
.combatant-card.is-selected {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
  box-shadow: 0 0 6px rgba(201, 168, 76, 0.2);
}

/* Current turn pulse */
.combatant-card.is-current-turn {
  border-color: var(--color-gold-dim);
}

/* Self highlight */
.combatant-card.is-me {
  background: rgba(201, 168, 76, 0.05);
}

/* Retainer highlight */
.combatant-card.is-my-retainer {
  background: rgba(201, 168, 76, 0.03);
  border-left-style: dashed;
}

/* Dead / Yielded dimming */
.combatant-card.is-dead,
.combatant-card.is-yielded {
  opacity: 0.5;
  cursor: default;
}

/* Portrait */
.card-portrait {
  width: 24px;
  height: 24px;
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border-dim);
}
.card-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Name row */
.card-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.card-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-badge {
  font-size: 8px;
  color: var(--color-gold);
  border: 1px solid var(--color-gold-dim);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.retainer-badge {
  font-size: 8px;
  color: var(--color-gold-dim);
  border: 1px solid rgba(201, 168, 76, 0.2);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.turn-dot {
  width: 6px;
  height: 6px;
  background: var(--color-gold);
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

/* HP bar */
.card-hp-bar-wrapper {
  position: relative;
  height: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1px;
  overflow: hidden;
}

.card-hp-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.4s ease;
  border-radius: 1px;
}

.card-hp-bar.hp-normal {
  background: var(--color-health);
}
.card-hp-bar.hp-low {
  background: #d48f32;
}
.card-hp-bar.hp-critical {
  background: var(--color-crimson-light);
  animation: hp-pulse 1s ease-in-out infinite;
}

.card-hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-family: var(--font-mono);
  color: var(--color-text-bright);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.05em;
}

/* Status effects */
.card-effects {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

/* Overlays */
.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
}

.dead-overlay {
  background: rgba(0, 0, 0, 0.6);
  color: var(--color-crimson-light);
}

.yield-overlay {
  background: rgba(0, 0, 0, 0.5);
  color: var(--color-text-dim);
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
