<script setup lang="ts">
import { computed } from 'vue'
import { useCombatStore } from '@/stores/combat'
import StatusEffectIcon from './StatusEffectIcon.vue'

const combatStore = useCombatStore()

const target = computed(() => {
  if (!combatStore.selectedTargetId) return null
  return combatStore.combatants.find(c => c.characterId === combatStore.selectedTargetId) ?? null
})

/** Resolve engaged character IDs to names. */
const engagedNames = computed(() => {
  if (!target.value) return []
  return target.value.engagedTo
    .map(id => combatStore.combatants.find(c => c.characterId === id))
    .filter(Boolean)
    .map(c => c!.characterName)
})

/** Name of the ally this combatant is protecting, if any. */
const protectingName = computed(() => {
  if (!target.value?.protectingId) return null
  return combatStore.combatants.find(c => c.characterId === target.value!.protectingId)?.characterName ?? null
})

const hpPercent = computed(() => {
  if (!target.value || target.value.maxHealth <= 0) return 0
  return Math.max(0, Math.min(100, (target.value.currentHealth / target.value.maxHealth) * 100))
})

const hpBarClass = computed(() => {
  if (hpPercent.value <= 25) return 'hp-critical'
  if (hpPercent.value <= 50) return 'hp-low'
  return 'hp-normal'
})

const teamLabel = computed(() =>
  target.value?.team === 1 ? 'Team 1' : 'Team 2'
)

function close(): void {
  combatStore.selectTarget(null)
}
</script>

<template>
  <Transition name="info-slide">
    <div v-if="target" class="target-info-panel">
      <div class="info-header">
        <span class="info-name">{{ target.characterName }}</span>
        <span class="info-team" :class="target.team === 1 ? 'team-blue' : 'team-red'">
          {{ teamLabel }}
        </span>
        <button class="info-close" @click="close">&times;</button>
      </div>

      <!-- HP -->
      <div class="info-hp">
        <div class="info-hp-bar-wrapper">
          <div class="info-hp-bar" :class="hpBarClass" :style="{ width: hpPercent + '%' }" />
          <span class="info-hp-text">{{ target.currentHealth }} / {{ target.maxHealth }}</span>
        </div>
      </div>

      <div class="info-body">
        <!-- Engagement -->
        <div class="info-section">
          <span class="info-label">Engaged with</span>
          <div v-if="engagedNames.length > 0" class="info-tags">
            <span v-for="name in engagedNames" :key="name" class="engagement-tag">{{ name }}</span>
          </div>
          <span v-else class="info-none">None</span>
        </div>

        <!-- Protecting -->
        <div v-if="protectingName" class="info-section">
          <span class="info-label">Protecting</span>
          <span class="protect-tag">{{ protectingName }}</span>
        </div>

        <!-- Bracing -->
        <div v-if="target.isBracing" class="info-section">
          <span class="info-label">Stance</span>
          <span class="brace-tag">Bracing</span>
        </div>

        <!-- Status Effects -->
        <div v-if="target.statusEffects.length > 0" class="info-section">
          <span class="info-label">Effects</span>
          <div class="info-effects">
            <div v-for="(effect, i) in target.statusEffects" :key="effect.type + '-' + i" class="effect-row">
              <StatusEffectIcon
                :type="effect.type"
                :stacks="effect.stacks"
                :rounds-remaining="effect.roundsRemaining"
              />
              <span class="effect-detail">
                {{ effect.type.charAt(0).toUpperCase() + effect.type.slice(1) }}
                <template v-if="effect.stacks > 1"> x{{ effect.stacks }}</template>
                <template v-if="effect.roundsRemaining > 0">
                  <span class="effect-rounds">({{ effect.roundsRemaining }}r)</span>
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.target-info-panel {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: rgba(20, 18, 14, 0.95);
  padding: var(--space-xs) var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* Slide transition */
.info-slide-enter-active,
.info-slide-leave-active {
  transition: all 0.2s ease;
}
.info-slide-enter-from,
.info-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin: 0;
}

/* Header */
.info-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.info-name {
  flex: 1;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.05em;
}

.info-team {
  font-family: var(--font-display);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 2px;
}
.info-team.team-blue {
  color: #5b9bd5;
  border-color: rgba(91, 155, 213, 0.4);
}
.info-team.team-red {
  color: #e06c75;
  border-color: rgba(224, 108, 117, 0.4);
}

.info-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.info-close:hover {
  color: var(--color-gold);
}

/* HP bar */
.info-hp-bar-wrapper {
  position: relative;
  height: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1px;
  overflow: hidden;
}

.info-hp-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.4s ease;
  border-radius: 1px;
}
.info-hp-bar.hp-normal { background: var(--color-health); }
.info-hp-bar.hp-low { background: #d48f32; }
.info-hp-bar.hp-critical { background: var(--color-crimson-light); }

.info-hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-family: var(--font-mono);
  color: var(--color-text-bright);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

/* Body */
.info-body {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
}

.info-section {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.info-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.info-none {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  font-style: italic;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.engagement-tag {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.2);
  padding: 0 5px;
  border-radius: 2px;
}

.protect-tag {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: #3a7bd5;
  background: rgba(58, 123, 213, 0.08);
  border: 1px solid rgba(58, 123, 213, 0.2);
  padding: 0 5px;
  border-radius: 2px;
}

.brace-tag {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: #2d8a4e;
  background: rgba(45, 138, 78, 0.08);
  border: 1px solid rgba(45, 138, 78, 0.2);
  padding: 0 5px;
  border-radius: 2px;
}

/* Effects list */
.info-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.effect-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.effect-detail {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.effect-rounds {
  color: var(--color-text-dim);
  font-size: 9px;
}
</style>
