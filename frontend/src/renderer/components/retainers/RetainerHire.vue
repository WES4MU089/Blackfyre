<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const step = ref<'name' | 'aptitudes' | 'confirm'>('name')
const retainerName = ref('')
const nameError = ref('')
const submitError = ref('')
const isSubmitting = ref(false)

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'] as const
const APTITUDE_LABELS: Record<string, string> = {
  prowess: 'Prowess', fortitude: 'Fortitude', command: 'Command', cunning: 'Cunning',
  stewardship: 'Stewardship', presence: 'Presence', lore: 'Lore', faith: 'Faith',
}

const tier = computed(() => characterStore.retainerHireTier)
const isT5 = computed(() => tier.value?.tier === 5)
const aptCap = computed(() => tier.value?.aptitudeCap ?? 7)

// Aptitude allocation
const aptitudes = ref<Record<string, number>>(
  Object.fromEntries(APTITUDE_KEYS.map(k => [k, isT5.value ? (tier.value?.aptitudeCap ?? 8) : 1]))
)

const pointsSpent = computed(() =>
  APTITUDE_KEYS.reduce((sum, k) => sum + (aptitudes.value[k] ?? 0), 0)
)
const budget = computed(() => tier.value?.aptitudeBudget ?? 0)
const pointsRemaining = computed(() => budget.value - pointsSpent.value)

function increment(key: string): void {
  if (aptitudes.value[key] < aptCap.value && pointsRemaining.value > 0) {
    aptitudes.value[key]++
  }
}

function decrement(key: string): void {
  if (aptitudes.value[key] > 1) {
    aptitudes.value[key]--
  }
}

function goToAptitudes(): void {
  const name = retainerName.value.trim()
  if (!name || name.length > 50) {
    nameError.value = 'Name must be 1-50 characters'
    return
  }
  nameError.value = ''
  if (isT5.value) {
    // T5 has fixed aptitudes — skip to confirm
    step.value = 'confirm'
  } else {
    step.value = 'aptitudes'
  }
}

function goToConfirm(): void {
  if (pointsRemaining.value !== 0) return
  step.value = 'confirm'
}

function goBack(): void {
  submitError.value = ''
  if (step.value === 'confirm' && !isT5.value) {
    step.value = 'aptitudes'
  } else if (step.value === 'confirm' && isT5.value) {
    step.value = 'name'
  } else {
    step.value = 'name'
  }
}

async function confirmHire(): Promise<void> {
  if (!tier.value) return
  isSubmitting.value = true
  submitError.value = ''

  const result = await characterStore.hireRetainer(
    tier.value.tier,
    retainerName.value.trim(),
    { ...aptitudes.value },
  )

  isSubmitting.value = false
  if (result.success) {
    hudStore.addNotification('success', 'Retainer Hired', `${retainerName.value.trim()} has joined your service.`)
  } else {
    submitError.value = result.error ?? 'Failed to hire'
  }
}

function cancel(): void {
  characterStore.closeRetainerHire()
}
</script>

<template>
  <div v-if="tier" class="retainer-hire-overlay">
    <div class="retainer-hire-panel panel-ornate animate-fade-in">
      <div class="hire-header">
        <span class="hire-title">Hire Retainer — {{ tier.name }}</span>
        <button class="hire-close" @click="cancel">&times;</button>
      </div>

      <!-- Step 1: Name -->
      <div v-if="step === 'name'" class="hire-body">
        <p class="hire-desc">{{ tier.description }}</p>
        <div class="hire-cost">Cost: <span class="gold-text">{{ tier.hireCost.toLocaleString() }} stars</span></div>
        <div class="hire-field">
          <label class="hire-label">Retainer Name</label>
          <input
            v-model="retainerName"
            class="hire-input"
            placeholder="Enter a name..."
            maxlength="50"
            @keydown.enter="goToAptitudes"
          />
          <span v-if="nameError" class="hire-error">{{ nameError }}</span>
        </div>
        <div class="hire-actions">
          <button class="btn btn-secondary" @click="cancel">Cancel</button>
          <button class="btn btn-primary" :disabled="!retainerName.trim()" @click="goToAptitudes">
            {{ isT5 ? 'Review' : 'Allocate Points' }}
          </button>
        </div>
      </div>

      <!-- Step 2: Aptitude Allocation -->
      <div v-if="step === 'aptitudes'" class="hire-body">
        <div class="hire-budget">
          Points: <span :class="{ 'gold-text': pointsRemaining === 0, 'warn-text': pointsRemaining > 0 }">
            {{ pointsSpent }} / {{ budget }}
          </span>
          <span v-if="pointsRemaining > 0" class="remaining">({{ pointsRemaining }} remaining)</span>
        </div>

        <div class="apt-grid">
          <div v-for="key in APTITUDE_KEYS" :key="key" class="apt-row">
            <span class="apt-label">{{ APTITUDE_LABELS[key] }}</span>
            <div class="apt-controls">
              <button class="apt-btn" :disabled="aptitudes[key] <= 1" @click="decrement(key)">-</button>
              <span class="apt-value">{{ aptitudes[key] }}</span>
              <button class="apt-btn" :disabled="aptitudes[key] >= aptCap || pointsRemaining <= 0" @click="increment(key)">+</button>
            </div>
          </div>
        </div>

        <div class="hire-actions">
          <button class="btn btn-secondary" @click="goBack">Back</button>
          <button class="btn btn-primary" :disabled="pointsRemaining !== 0" @click="goToConfirm">Confirm</button>
        </div>
      </div>

      <!-- Step 3: Confirm -->
      <div v-if="step === 'confirm'" class="hire-body">
        <div class="confirm-summary">
          <div class="confirm-row">
            <span class="confirm-label">Name</span>
            <span class="confirm-value">{{ retainerName.trim() }}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-label">Tier</span>
            <span class="confirm-value">{{ tier.name }}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-label">Cost</span>
            <span class="confirm-value gold-text">{{ tier.hireCost.toLocaleString() }} stars</span>
          </div>
          <div class="confirm-divider" />
          <div v-for="key in APTITUDE_KEYS" :key="key" class="confirm-row">
            <span class="confirm-label">{{ APTITUDE_LABELS[key] }}</span>
            <span class="confirm-value">{{ aptitudes[key] }}</span>
          </div>
        </div>

        <span v-if="submitError" class="hire-error">{{ submitError }}</span>

        <div class="hire-actions">
          <button class="btn btn-secondary" :disabled="isSubmitting" @click="goBack">Back</button>
          <button class="btn btn-primary" :disabled="isSubmitting" @click="confirmHire">
            {{ isSubmitting ? 'Hiring...' : 'Hire Retainer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.retainer-hire-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  pointer-events: auto;
}

.retainer-hire-panel {
  width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hire-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.hire-title {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hire-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.hire-close:hover { color: var(--color-text); }

.hire-body {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow-y: auto;
}

.hire-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.hire-cost {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.gold-text { color: var(--color-gold); }
.warn-text { color: #d4a932; }

.hire-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hire-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hire-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
}
.hire-input:focus {
  outline: none;
  border-color: var(--color-gold);
}

.hire-error {
  font-size: var(--font-size-xs);
  color: #c42b2b;
}

.hire-budget {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}
.remaining {
  margin-left: var(--space-xs);
  color: var(--color-text-muted);
}

.apt-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}

.apt-label {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  min-width: 100px;
}

.apt-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apt-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-gold);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}
.apt-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}
.apt-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.apt-value {
  width: 20px;
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gold);
}

.confirm-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
}

.confirm-label { color: var(--color-text-dim); }
.confirm-value { color: var(--color-text); }

.confirm-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-xs) 0;
}

.hire-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.btn-primary {
  background: rgba(201, 168, 76, 0.15);
  border-color: var(--color-gold);
  color: var(--color-gold);
}
.btn-primary:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.25);
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-border);
  color: var(--color-text-dim);
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
</style>
