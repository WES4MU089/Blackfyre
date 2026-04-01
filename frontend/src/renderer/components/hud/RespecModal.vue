<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { acquireInteractionLock, releaseInteractionLock } from '@/composables/useInteractionLock'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const TOTAL_POINTS = 28
const MIN_PER_APT = 1
const MAX_PER_APT = 7

const APTITUDE_NAMES: Record<string, string> = {
  prowess: 'Prowess',
  fortitude: 'Fortitude',
  command: 'Command',
  cunning: 'Cunning',
  stewardship: 'Stewardship',
  presence: 'Presence',
  lore: 'Lore',
  faith: 'Faith',
  craftsmanship: 'Craftsmanship',
}

const APTITUDE_ORDER = [
  'prowess', 'fortitude', 'command', 'cunning', 'stewardship',
  'presence', 'lore', 'faith', 'craftsmanship',
]

// Working copy of aptitudes for editing
const draft = ref<Record<string, number>>({})
const isSubmitting = ref(false)
const errorMsg = ref('')

// Initialize draft from current character aptitudes
function initDraft() {
  const d: Record<string, number> = {}
  for (const key of APTITUDE_ORDER) {
    const apt = characterStore.aptitudes.find(a => a.id === key)
    d[key] = apt ? apt.baseValue : 1
  }
  draft.value = d
}

initDraft()

const pointsUsed = computed(() =>
  Object.values(draft.value).reduce((sum, v) => sum + v, 0)
)

const pointsRemaining = computed(() => TOTAL_POINTS - pointsUsed.value)

const isValid = computed(() => pointsRemaining.value === 0)

const hasChanged = computed(() => {
  for (const key of APTITUDE_ORDER) {
    const apt = characterStore.aptitudes.find(a => a.id === key)
    if (apt && draft.value[key] !== apt.baseValue) return true
  }
  return false
})

function increment(key: string) {
  if (draft.value[key] < MAX_PER_APT && pointsRemaining.value > 0) {
    draft.value[key]++
  }
}

function decrement(key: string) {
  if (draft.value[key] > MIN_PER_APT) {
    draft.value[key]--
  }
}

function resetDraft() {
  initDraft()
  errorMsg.value = ''
}

async function submit() {
  if (!isValid.value || !hasChanged.value || isSubmitting.value) return
  isSubmitting.value = true
  errorMsg.value = ''

  const result = await characterStore.submitRespec(draft.value)

  if (result.success) {
    hudStore.addNotification('success', 'Respec Complete', 'Your aptitudes have been reallocated.')
  } else {
    errorMsg.value = result.error ?? 'Respec failed'
    hudStore.addNotification('error', 'Respec Failed', errorMsg.value)
  }

  isSubmitting.value = false
}

function close() {
  characterStore.closeRespecModal()
}

// Keep the window interactive while this modal is open
let lockToken: number | null = null
onMounted(() => {
  lockToken = acquireInteractionLock()
})

onBeforeUnmount(() => {
  if (lockToken !== null) {
    releaseInteractionLock(lockToken)
    lockToken = null
  }
})
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div class="respec-overlay" @click.self="close">
      <div class="respec-modal">
        <div class="respec-header">
          <h2 class="respec-title">Respec Aptitudes</h2>
          <span class="respec-subtitle">Redistribute your {{ TOTAL_POINTS }} aptitude points</span>
          <button class="respec-close" @click="close">&times;</button>
        </div>

        <div class="respec-body">
          <div class="respec-points-bar">
            <span class="respec-points-label">Points remaining:</span>
            <span
              class="respec-points-value"
              :class="{
                'respec-points--over': pointsRemaining < 0,
                'respec-points--zero': pointsRemaining === 0,
              }"
            >
              {{ pointsRemaining }}
            </span>
          </div>

          <div class="respec-apt-list">
            <div
              v-for="key in APTITUDE_ORDER"
              :key="key"
              class="respec-apt-row"
            >
              <span class="respec-apt-name">{{ APTITUDE_NAMES[key] }}</span>
              <div class="respec-apt-controls">
                <button
                  class="respec-apt-btn"
                  :disabled="draft[key] <= MIN_PER_APT"
                  @click="decrement(key)"
                >
                  &minus;
                </button>
                <span class="respec-apt-value">{{ draft[key] }}</span>
                <button
                  class="respec-apt-btn"
                  :disabled="draft[key] >= MAX_PER_APT || pointsRemaining <= 0"
                  @click="increment(key)"
                >
                  +
                </button>
              </div>
              <div class="respec-apt-pips">
                <span
                  v-for="i in MAX_PER_APT"
                  :key="i"
                  class="respec-pip"
                  :class="{ 'respec-pip--filled': i <= draft[key] }"
                />
              </div>
            </div>
          </div>

          <div v-if="errorMsg" class="respec-error">{{ errorMsg }}</div>
        </div>

        <div class="respec-footer">
          <button class="respec-reset-btn" @click="resetDraft">Reset</button>
          <button class="respec-cancel-btn" @click="close">Cancel</button>
          <button
            class="respec-confirm-btn"
            :disabled="!isValid || !hasChanged || isSubmitting"
            @click="submit"
          >
            {{ isSubmitting ? 'Submitting...' : 'Confirm Respec' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.respec-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  pointer-events: auto;
}

.respec-modal {
  background: var(--color-bg-panel, #1a1a1a);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-md);
  width: 380px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.respec-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border-dim);
  position: relative;
}

.respec-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  margin: 0;
}

.respec-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.respec-close {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  cursor: pointer;
  padding: 2px 6px;
}

.respec-close:hover {
  color: var(--color-text);
}

.respec-body {
  padding: var(--space-sm) var(--space-lg);
  overflow-y: auto;
  flex: 1;
}

.respec-points-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0 var(--space-sm);
  border-bottom: 1px solid var(--color-border-dim);
  margin-bottom: var(--space-sm);
}

.respec-points-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.respec-points-value {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  font-weight: bold;
}

.respec-points--over {
  color: #e06c75;
}

.respec-points--zero {
  color: #6ec86e;
}

.respec-apt-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.respec-apt-row {
  display: grid;
  grid-template-columns: 110px auto 1fr;
  align-items: center;
  gap: var(--space-sm);
  padding: 3px 0;
}

.respec-apt-name {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.respec-apt-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.respec-apt-btn {
  width: 20px;
  height: 20px;
  border: 1px solid var(--color-border-dim);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.3);
  color: var(--color-gold);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.respec-apt-btn:hover:not(:disabled) {
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.1);
}

.respec-apt-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.respec-apt-value {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  width: 18px;
  text-align: center;
}

.respec-apt-pips {
  display: flex;
  gap: 3px;
  align-items: center;
}

.respec-pip {
  width: 10px;
  height: 6px;
  border-radius: 1px;
  border: 1px solid var(--color-border-dim);
  background: rgba(0, 0, 0, 0.2);
  transition: background 0.15s ease;
}

.respec-pip--filled {
  background: var(--color-gold-dim);
  border-color: var(--color-gold-dim);
}

.respec-error {
  margin-top: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(224, 108, 117, 0.1);
  border: 1px solid rgba(224, 108, 117, 0.3);
  border-radius: var(--radius-sm);
  color: #e06c75;
  font-size: var(--font-size-xs);
  text-align: center;
}

.respec-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border-top: 1px solid var(--color-border-dim);
}

.respec-reset-btn {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  background: transparent;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  margin-right: auto;
}

.respec-reset-btn:hover {
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.respec-cancel-btn {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.respec-cancel-btn:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.respec-confirm-btn {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-lg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.respec-confirm-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

.respec-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
