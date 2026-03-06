<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useCombatStore } from '@/stores/combat'
import { useCombat } from '@/composables/useCombat'

const combatStore = useCombatStore()
const { respondToCoup, cancelCoup } = useCombat()

const attackerData = computed(() => combatStore.pendingCoupAttacker)
const witnessData = computed(() => combatStore.pendingCoupWitness)
const visible = computed(() => attackerData.value !== null || witnessData.value !== null)

// Countdown timer
const remaining = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null

function updateCountdown(): void {
  const expiresAt = attackerData.value?.expiresAt ?? witnessData.value?.expiresAt
  if (!expiresAt) {
    remaining.value = ''
    return
  }
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) {
    remaining.value = '0:00'
    return
  }
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  remaining.value = `${mins}:${secs.toString().padStart(2, '0')}`
}

watch(visible, (v) => {
  if (v) {
    updateCountdown()
    countdownInterval = setInterval(updateCountdown, 1000)
  } else {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  }
}, { immediate: true })

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})

function onIntervene(): void {
  if (!witnessData.value) return
  respondToCoup(witnessData.value.targetCharacterId, 'intervene')
}

function onDoNothing(): void {
  if (!witnessData.value) return
  respondToCoup(witnessData.value.targetCharacterId, 'do-nothing')
}

function onCancel(): void {
  if (!attackerData.value) return
  cancelCoup(attackerData.value.targetCharacterId)
}
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div v-if="visible" class="coup-overlay">
      <div class="coup-panel">
        <h3 class="coup-title">Coup de Gr&acirc;ce</h3>

        <!-- Witness mode -->
        <template v-if="witnessData">
          <p class="coup-desc">
            <span class="name-highlight">{{ witnessData.attackerName }}</span>
            is attempting to execute
            <span class="name-highlight">{{ witnessData.targetName }}</span>.
          </p>
          <p class="coup-timer">
            You have <span class="timer-value">{{ remaining }}</span> to respond.
          </p>
          <div class="coup-actions">
            <button class="btn-intervene" @click="onIntervene">Intervene</button>
            <button class="btn-do-nothing" @click="onDoNothing">Do Nothing</button>
          </div>
        </template>

        <!-- Attacker mode -->
        <template v-else-if="attackerData">
          <p class="coup-desc">
            Nearby witnesses have been alerted.
            <br>Awaiting response...
          </p>
          <p class="coup-timer-large">{{ remaining }}</p>
          <div class="coup-actions">
            <button class="btn-cancel" @click="onCancel">Cancel</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.coup-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9000;
  pointer-events: auto;
}

.coup-panel {
  background: linear-gradient(180deg, rgba(20, 15, 10, 0.95), rgba(30, 22, 14, 0.92));
  border: 1px solid rgba(139, 26, 26, 0.6);
  border-radius: var(--radius-md, 6px);
  padding: 20px 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(139, 26, 26, 0.15);
  text-align: center;
}

.coup-title {
  margin: 0 0 12px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #cc2222;
  border-bottom: 1px solid rgba(139, 26, 26, 0.4);
  padding-bottom: 10px;
}

.coup-desc {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--color-text-muted, #a09580);
  line-height: 1.5;
}

.name-highlight {
  color: var(--color-text-bright, #e8dcc8);
  font-weight: 600;
}

.coup-timer {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--color-text-dim, #8a7d6b);
}

.timer-value {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 14px;
  font-weight: 700;
  color: #cc2222;
}

.coup-timer-large {
  margin: 8px 0 16px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 28px;
  font-weight: 700;
  color: #cc2222;
  letter-spacing: 0.05em;
}

.coup-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-intervene,
.btn-do-nothing,
.btn-cancel {
  padding: 7px 18px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-intervene {
  color: #2ea043;
  background: rgba(46, 160, 67, 0.15);
  border: 1px solid rgba(46, 160, 67, 0.5);
}

.btn-intervene:hover {
  background: rgba(46, 160, 67, 0.25);
  border-color: #2ea043;
}

.btn-do-nothing {
  color: var(--color-text-dim, #8a7d6b);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border-dim, #3a3024);
}

.btn-do-nothing:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--color-gold-dim, #6b5a2e);
}

.btn-cancel {
  color: var(--color-text-dim, #8a7d6b);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border-dim, #3a3024);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--color-gold-dim, #6b5a2e);
}
</style>
