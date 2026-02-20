<script setup lang="ts">
import { computed } from 'vue'
import { useCombatStore } from '@/stores/combat'
import { useCombat } from '@/composables/useCombat'

const combatStore = useCombatStore()
const { submitAction, yieldCombat, skipTurn } = useCombat()

const isMyTurn = computed(() => combatStore.isMyTurn)
const me = computed(() => combatStore.myCombatant)
const sessionOver = computed(() => combatStore.sessionEnded)

// Active combatant — the character whose turn it is (self or retainer)
const activeCombatant = computed(() => {
  if (combatStore.isRetainerTurn) return combatStore.currentRetainerCombatant
  return me.value
})

// Check if active combatant is engaged to anyone
const isEngaged = computed(() => (activeCombatant.value?.engagedTo.length ?? 0) > 0)

// Check if a target is selected
const hasTarget = computed(() => combatStore.selectedTargetId !== null)

// Check if selected target is an enemy
const targetIsEnemy = computed(() => {
  if (!combatStore.selectedTargetId) return false
  return combatStore.enemies.some(e => e.characterId === combatStore.selectedTargetId)
})

// Check if selected target is an ally
const targetIsAlly = computed(() => {
  if (!combatStore.selectedTargetId) return false
  return combatStore.allies.some(a => a.characterId === combatStore.selectedTargetId)
})

interface ActionDef {
  key: string
  label: string
  tooltip: string
  enabled: boolean
  requiresTarget: boolean
}

const actions = computed<ActionDef[]>(() => [
  {
    key: 'attack',
    label: 'Attack',
    tooltip: targetIsEnemy.value
      ? 'Strike the selected enemy'
      : 'Select an enemy target first',
    enabled: isMyTurn.value && targetIsEnemy.value && !sessionOver.value,
    requiresTarget: true,
  },
  {
    key: 'protect',
    label: 'Protect',
    tooltip: targetIsAlly.value
      ? 'Guard the selected ally from attacks'
      : 'Select an ally to protect',
    enabled: isMyTurn.value && targetIsAlly.value && !sessionOver.value,
    requiresTarget: true,
  },
  {
    key: 'grapple',
    label: 'Grapple',
    tooltip: targetIsEnemy.value
      ? 'Contest Prowess to restrain the enemy (-20 defense)'
      : 'Select an enemy to grapple',
    enabled: isMyTurn.value && targetIsEnemy.value && !sessionOver.value,
    requiresTarget: true,
  },
  {
    key: 'disengage',
    label: 'Disengage',
    tooltip: isEngaged.value
      ? 'Attempt to break free (Cunning vs Prowess)'
      : 'Not engaged in melee',
    enabled: isMyTurn.value && isEngaged.value && !sessionOver.value,
    requiresTarget: false,
  },
  {
    key: 'brace',
    label: 'Brace',
    tooltip: 'Skip your attack for +5 defense per attacker this round',
    enabled: isMyTurn.value && !sessionOver.value,
    requiresTarget: false,
  },
])

function onAction(action: ActionDef): void {
  if (!action.enabled) return
  submitAction(action.key, combatStore.selectedTargetId ?? undefined)
}

function onYield(): void {
  if (sessionOver.value) return
  yieldCombat()
}

function onSkip(): void {
  if (!isMyTurn.value || sessionOver.value) return
  skipTurn()
}
</script>

<template>
  <div class="action-bar">
    <!-- Main 5 actions -->
    <div class="action-buttons">
      <button
        v-for="action in actions"
        :key="action.key"
        class="action-btn"
        :class="[
          `action-${action.key}`,
          { 'needs-target': action.requiresTarget && !hasTarget && isMyTurn },
        ]"
        :disabled="!action.enabled"
        :title="action.tooltip"
        @click="onAction(action)"
      >
        {{ action.label }}
      </button>
    </div>

    <!-- Secondary actions -->
    <div class="action-secondary">
      <button
        class="action-btn action-skip"
        :disabled="!isMyTurn || sessionOver"
        title="Skip your turn"
        @click="onSkip"
      >
        Skip
      </button>
      <button
        class="action-btn action-yield"
        :disabled="sessionOver"
        title="Surrender — remove yourself from combat"
        @click="onYield"
      >
        Yield
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex: 1;
}

.action-secondary {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex: 1;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Subtle hint when action needs a target but none selected */
.action-btn.needs-target {
  border-style: dashed;
}

/* Action-specific accent colors on hover */
.action-attack:hover:not(:disabled) {
  border-color: rgba(196, 43, 43, 0.5);
  color: #c42b2b;
  background: rgba(196, 43, 43, 0.06);
}

.action-protect:hover:not(:disabled) {
  border-color: rgba(58, 123, 213, 0.5);
  color: #3a7bd5;
  background: rgba(58, 123, 213, 0.06);
}

.action-grapple:hover:not(:disabled) {
  border-color: rgba(155, 50, 212, 0.5);
  color: #9b32d4;
  background: rgba(155, 50, 212, 0.06);
}

.action-disengage:hover:not(:disabled) {
  border-color: rgba(212, 169, 50, 0.5);
  color: #d4a932;
  background: rgba(212, 169, 50, 0.06);
}

.action-brace:hover:not(:disabled) {
  border-color: rgba(45, 138, 78, 0.5);
  color: #2d8a4e;
  background: rgba(45, 138, 78, 0.06);
}

/* Secondary action styles */
.action-skip {
  flex: none !important;
  background: transparent;
}

.action-yield {
  flex: none !important;
  border-color: rgba(139, 26, 26, 0.3);
  color: var(--color-text-dim);
}
.action-yield:hover:not(:disabled) {
  border-color: rgba(139, 26, 26, 0.5);
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.06);
}
</style>
