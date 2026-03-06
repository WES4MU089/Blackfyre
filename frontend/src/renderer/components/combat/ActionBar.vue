<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCombatStore } from '@/stores/combat'
import { useCombat } from '@/composables/useCombat'

const combatStore = useCombatStore()
const { submitAction, yieldCombat, skipTurn } = useCombat()

const isMyTurn = computed(() => combatStore.isMyTurn)
const me = computed(() => combatStore.myCombatant)
const sessionOver = computed(() => combatStore.sessionEnded)
const pendingMend = computed(() => combatStore.pendingMendChoice !== null)

// Active combatant — the character whose turn it is (self or retainer)
const activeCombatant = computed(() => {
  if (combatStore.isRetainerTurn) return combatStore.currentRetainerCombatant
  return me.value
})

// Check if active combatant is engaged to anyone
const isEngaged = computed(() => (activeCombatant.value?.engagedTo.length ?? 0) > 0)

// Check if active combatant has allies for rally
const hasAllies = computed(() => combatStore.allies.length > 0)

// Check if active combatant is on rally cooldown
const hasRallyCooldown = computed(() => {
  const ac = activeCombatant.value
  if (!ac) return true
  return ac.statusEffects.some(e => e.type === 'rally_cooldown')
})

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

// Check if selected target is self
const targetIsSelf = computed(() => {
  if (!combatStore.selectedTargetId) return false
  return combatStore.selectedTargetId === activeCombatant.value?.characterId
})

// Check if selected target is an ally or self (for mend)
const targetIsFriendly = computed(() => targetIsAlly.value || targetIsSelf.value)

interface ActionDef {
  key: string
  label: string
  tooltip: string
  enabled: boolean
  requiresTarget: boolean
}

const actionsEnabled = computed(() => isMyTurn.value && !sessionOver.value && !pendingMend.value)

// Row 1: Target actions — Attack, Protect, Grapple
const row1 = computed<ActionDef[]>(() => [
  {
    key: 'attack',
    label: 'Attack',
    tooltip: targetIsEnemy.value
      ? 'Strike the selected enemy'
      : 'Select an enemy target first',
    enabled: actionsEnabled.value && targetIsEnemy.value,
    requiresTarget: true,
  },
  {
    key: 'protect',
    label: 'Protect',
    tooltip: targetIsAlly.value
      ? 'Guard the selected ally from attacks'
      : 'Select an ally to protect',
    enabled: actionsEnabled.value && targetIsAlly.value,
    requiresTarget: true,
  },
  {
    key: 'grapple',
    label: 'Grapple',
    tooltip: targetIsEnemy.value
      ? 'Contest Prowess to restrain the enemy (-20 defense)'
      : 'Select an enemy to grapple',
    enabled: actionsEnabled.value && targetIsEnemy.value,
    requiresTarget: true,
  },
])

// Row 2: Tactical — Brace, Rally, Mend
const row2 = computed<ActionDef[]>(() => [
  {
    key: 'brace',
    label: 'Brace',
    tooltip: 'Skip your attack for +5 defense per attacker this round',
    enabled: actionsEnabled.value,
    requiresTarget: false,
  },
  {
    key: 'rally',
    label: 'Rally',
    tooltip: hasRallyCooldown.value
      ? 'Rally is on cooldown'
      : hasAllies.value
        ? 'Inspire allies with Command (+ATK dice)'
        : 'No allies to rally',
    enabled: actionsEnabled.value && hasAllies.value && !hasRallyCooldown.value,
    requiresTarget: false,
  },
  {
    key: 'mend',
    label: 'Mend',
    tooltip: targetIsFriendly.value
      ? 'Use a bandage — Lore check to heal + clear ailments'
      : 'Select yourself or an ally to mend',
    enabled: actionsEnabled.value && targetIsFriendly.value,
    requiresTarget: true,
  },
])

// Row 3: Situational — Disengage, Skip, Yield
const row3Actions = computed<ActionDef[]>(() => [
  {
    key: 'disengage',
    label: 'Retreat',
    tooltip: isEngaged.value
      ? 'Attempt to break free (Cunning vs Prowess)'
      : 'Not engaged in melee',
    enabled: actionsEnabled.value && isEngaged.value,
    requiresTarget: false,
  },
])

const showMendConfirm = ref(false)

function onAction(action: ActionDef): void {
  if (!action.enabled) return
  if (action.key === 'mend') {
    showMendConfirm.value = true
    return
  }
  submitAction(action.key, combatStore.selectedTargetId ?? undefined)
}

function confirmMend(): void {
  showMendConfirm.value = false
  submitAction('mend', combatStore.selectedTargetId ?? undefined)
}

function cancelMend(): void {
  showMendConfirm.value = false
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
    <!-- Row 1: Target actions -->
    <div class="action-row">
      <button
        v-for="action in row1"
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

    <!-- Row 2: Tactical actions -->
    <div class="action-row">
      <button
        v-for="action in row2"
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

    <!-- Row 3: Situational + turn management -->
    <div class="action-row">
      <button
        v-for="action in row3Actions"
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

    <!-- Mend confirmation overlay (not teleported — must stay inside pointer-events:auto ancestor) -->
    <div v-if="showMendConfirm" class="mend-confirm-overlay">
      <div class="mend-confirm-panel">
        <p class="mend-confirm-text">
          Mending consumes <strong>one bandage</strong>. Health can only be restored
          to this target once per combat &mdash; further mends can still clear ailments
          and stabilize wounds.
        </p>
        <p class="mend-confirm-prompt">Proceed?</p>
        <div class="mend-confirm-actions">
          <button class="mend-btn mend-btn-cancel" @click="cancelMend">Cancel</button>
          <button class="mend-btn mend-btn-confirm" @click="confirmMend">Mend</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-xs) 0;
}

.action-row {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 5px 0;
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
  text-align: center;
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

.action-rally:hover:not(:disabled) {
  border-color: rgba(0, 172, 193, 0.5);
  color: #00acc1;
  background: rgba(0, 172, 193, 0.06);
}

.action-mend:hover:not(:disabled) {
  border-color: rgba(46, 160, 67, 0.5);
  color: #2ea043;
  background: rgba(46, 160, 67, 0.06);
}

/* Row 3 specific styles */
.action-skip {
  background: transparent;
}

.action-yield {
  border-color: rgba(139, 26, 26, 0.3);
  color: var(--color-text-dim);
}
.action-yield:hover:not(:disabled) {
  border-color: rgba(139, 26, 26, 0.5);
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.06);
}

/* Mend confirmation overlay */
.mend-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  pointer-events: auto;
}

.mend-confirm-panel {
  width: 340px;
  padding: var(--space-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  text-align: center;
}

.mend-confirm-text {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  line-height: 1.5;
}

.mend-confirm-text strong {
  color: var(--color-gold);
}

.mend-confirm-prompt {
  margin: 0 0 var(--space-md);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mend-confirm-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

.mend-btn {
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mend-btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border-dim);
  color: var(--color-text-dim);
}
.mend-btn-cancel:hover {
  border-color: var(--color-text-dim);
  color: var(--color-text);
}

.mend-btn-confirm {
  background: rgba(46, 160, 67, 0.15);
  border: 1px solid rgba(46, 160, 67, 0.5);
  color: #2ea043;
}
.mend-btn-confirm:hover {
  background: rgba(46, 160, 67, 0.25);
  border-color: #2ea043;
}
</style>
