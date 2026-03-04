<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCombatStore } from '@/stores/combat'
import { useCombat } from '@/composables/useCombat'

const combatStore = useCombatStore()
const { resolveMendChoice } = useCombat()

const pending = computed(() => combatStore.pendingMendChoice)
const selected = ref<string[]>([])

function toggleEffect(effect: string): void {
  const idx = selected.value.indexOf(effect)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else if (pending.value && selected.value.length < pending.value.maxPicks) {
    selected.value.push(effect)
  }
}

function confirm(): void {
  resolveMendChoice(selected.value)
  selected.value = []
}

function effectLabel(type: string): string {
  switch (type) {
    case 'bleeding': return 'Bleeding'
    case 'stunned': return 'Stunned'
    case 'sundered': return 'Sundered'
    default: return type
  }
}

function effectDescription(type: string): string {
  switch (type) {
    case 'bleeding': return 'Taking damage each round'
    case 'stunned': return 'Skip next turn'
    case 'sundered': return 'Reduced armor mitigation'
    default: return ''
  }
}
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div v-if="pending" class="mend-choice-overlay">
      <div class="mend-choice-panel">
        <h3 class="mend-choice-title">Choose Ailments to Clear</h3>
        <p class="mend-choice-subtitle">
          {{ pending.targetName }} &mdash;
          {{ pending.loreSuccesses }} Lore success{{ pending.loreSuccesses > 1 ? 'es' : '' }}
        </p>
        <p v-if="pending.healingAmount > 0" class="mend-heal-info">
          Restored {{ pending.healingAmount }} health
        </p>

        <div class="effect-list">
          <button
            v-for="effect in pending.mendableEffects"
            :key="effect"
            class="effect-option"
            :class="[
              `effect-${effect}`,
              { selected: selected.includes(effect) },
            ]"
            :disabled="!selected.includes(effect) && selected.length >= pending.maxPicks"
            @click="toggleEffect(effect)"
          >
            <span class="effect-check">{{ selected.includes(effect) ? '\u2713' : '' }}</span>
            <span class="effect-info">
              <span class="effect-name">{{ effectLabel(effect) }}</span>
              <span class="effect-desc">{{ effectDescription(effect) }}</span>
            </span>
          </button>
        </div>

        <div class="pick-counter">
          {{ selected.length }} / {{ pending.maxPicks }} selected
        </div>

        <button
          class="mend-confirm-btn"
          :disabled="selected.length === 0"
          @click="confirm"
        >
          Confirm
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mend-choice-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9000;
  pointer-events: auto;
}

.mend-choice-panel {
  background: linear-gradient(180deg, rgba(20, 15, 10, 0.95), rgba(30, 22, 14, 0.92));
  border: 1px solid var(--color-gold-dim, #6b5a2e);
  border-radius: var(--radius-md, 6px);
  padding: 16px 20px;
  min-width: 300px;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  text-align: center;
}

.mend-choice-title {
  margin: 0 0 8px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-gold, #c9a84c);
  border-bottom: 1px solid var(--color-border-dim, #3a3024);
  padding-bottom: 8px;
}

.mend-choice-subtitle {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--color-text-dim, #8a7d6b);
}

.mend-heal-info {
  margin: 0 0 12px;
  font-size: 11px;
  color: #2ea043;
}

.effect-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.effect-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border-dim, #3a3024);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.effect-option:hover:not(:disabled) {
  border-color: var(--color-gold-dim, #6b5a2e);
  background: rgba(201, 168, 76, 0.06);
}

.effect-option:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.effect-option.selected {
  border-color: #2ea043;
  background: rgba(46, 160, 67, 0.1);
}

.effect-check {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-dim, #3a3024);
  border-radius: 3px;
  font-size: 12px;
  color: #2ea043;
  flex-shrink: 0;
}

.effect-option.selected .effect-check {
  border-color: #2ea043;
  background: rgba(46, 160, 67, 0.2);
}

.effect-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.effect-name {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.effect-bleeding .effect-name { color: #cc3333; }
.effect-stunned .effect-name { color: #d4a932; }
.effect-sundered .effect-name { color: #9b32d4; }

.effect-desc {
  font-size: 10px;
  color: var(--color-text-dim, #8a7d6b);
}

.pick-counter {
  font-size: 11px;
  color: var(--color-text-dim, #8a7d6b);
  margin-bottom: 10px;
  letter-spacing: 0.04em;
}

.mend-confirm-btn {
  padding: 6px 20px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
  background: rgba(46, 160, 67, 0.15);
  border: 1px solid rgba(46, 160, 67, 0.5);
  color: #2ea043;
}

.mend-confirm-btn:hover:not(:disabled) {
  background: rgba(46, 160, 67, 0.25);
  border-color: #2ea043;
}

.mend-confirm-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
