<script setup lang="ts">
import { ref, computed, onBeforeUnmount, nextTick } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useCharacterStore } from '@/stores/character'
import { useAuthStore } from '@/stores/auth'
import { useDraggable } from '@/composables/useDraggable'
import { BACKEND_URL } from '@/config'
import { DiceScene, type DiceRollRequest } from '@/lib/dice3d'

const hudStore = useHudStore()
const characterStore = useCharacterStore()
const authStore = useAuthStore()

const panelRef = ref<HTMLElement | null>(null)
const { onDragStart } = useDraggable('dice-roller', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['dice-roller']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function close() {
  hudStore.toggleSystemPanel('dice-roller')
}

// --- Aptitudes ---
interface AptitudeOption {
  id: string
  name: string
  currentValue: number
}

const aptitudeOptions = computed<AptitudeOption[]>(() =>
  characterStore.aptitudes.map(a => ({
    id: a.id,
    name: a.name,
    currentValue: a.currentValue,
  }))
)

const selectedAptitudeId = ref<string>('prowess')
const selectedAptitude = computed<AptitudeOption | null>(() =>
  aptitudeOptions.value.find(a => a.id === selectedAptitudeId.value) ?? null
)

const diceCount = computed(() => selectedAptitude.value?.currentValue ?? 0)

// --- Roll state ---
const rolling = ref(false)
const resultDice = ref<number[]>([])
const resultSuccesses = ref(0)
const resultLabel = ref('')
const resultMessage = ref('')
const resultBroadcast = ref(false)
const errorText = ref('')

const canvasRef = ref<HTMLCanvasElement | null>(null)
let scene: DiceScene | null = null

function disposeScene() {
  scene?.dispose()
  scene = null
}

onBeforeUnmount(disposeScene)

async function roll() {
  if (rolling.value) return
  errorText.value = ''
  resultDice.value = []
  resultSuccesses.value = 0
  resultLabel.value = ''
  resultMessage.value = ''
  resultBroadcast.value = false

  const charId = characterStore.character?.id
  if (!charId) {
    errorText.value = 'No active character'
    return
  }
  if (!selectedAptitude.value) {
    errorText.value = 'Pick an aptitude first'
    return
  }
  const count = selectedAptitude.value.currentValue
  if (count < 1) {
    errorText.value = 'Aptitude must be at least 1 to roll'
    return
  }

  rolling.value = true
  disposeScene()
  await nextTick()

  const canvas = canvasRef.value
  if (!canvas) {
    rolling.value = false
    errorText.value = 'Dice canvas not ready'
    return
  }

  // Client-side 3D roll — collect the physics-settled values.
  const collected: { value: number; success: boolean }[] = []
  scene = new DiceScene(canvas, (_, value, isSuccess) => {
    collected.push({ value, success: isSuccess })
  })

  const request: DiceRollRequest = { count, threshold: 4 }

  try {
    await scene.roll(request)
  } catch (e) {
    rolling.value = false
    errorText.value = 'Dice roll failed'
    return
  }

  const dice = collected.map(c => c.value)
  const successes = collected.filter(c => c.success).length

  // Send the result up so the server can mirror it into SL local chat
  try {
    const res = await fetch(`${BACKEND_URL}/api/dice/roll-aptitude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        characterId: charId,
        aptitude: selectedAptitude.value.id,
        dice,
        successes,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      errorText.value = data.error || 'Server rejected the roll'
    } else {
      resultDice.value = data.dice
      resultSuccesses.value = data.successes
      resultLabel.value = data.label
      resultMessage.value = data.message
      resultBroadcast.value = Boolean(data.broadcastToChat)
    }
  } catch {
    errorText.value = 'Network error'
  } finally {
    rolling.value = false
  }
}
</script>

<template>
  <div ref="panelRef" class="dice-panel panel-ornate animate-fade-in" :style="panelStyle">
    <div class="dp-header" @mousedown="onDragStart">
      <span class="dp-title">Dice Roller</span>
      <button class="dp-close" title="Close" @click="close">&times;</button>
    </div>

    <div class="dp-body">
      <div class="dp-controls">
        <label class="dp-field">
          <span class="dp-field-label">Aptitude</span>
          <select v-model="selectedAptitudeId" class="dp-select" :disabled="rolling">
            <option
              v-for="opt in aptitudeOptions"
              :key="opt.id"
              :value="opt.id"
            >{{ opt.name }} ({{ opt.currentValue }}d6)</option>
          </select>
        </label>

        <button
          class="dp-roll-btn"
          :disabled="rolling || diceCount < 1 || !characterStore.character"
          @click="roll"
        >
          {{ rolling ? 'Rolling...' : `Roll ${diceCount}d6` }}
        </button>
      </div>

      <div class="dp-canvas-wrap">
        <canvas ref="canvasRef" class="dp-canvas" width="360" height="240" />
      </div>

      <div v-if="errorText" class="dp-error">{{ errorText }}</div>

      <div v-else-if="resultDice.length" class="dp-result">
        <div class="dp-result-row">
          <span class="dp-result-label">{{ resultLabel }}</span>
          <span class="dp-result-total">{{ resultSuccesses }} {{ resultSuccesses === 1 ? 'success' : 'successes' }}</span>
        </div>
        <div class="dp-result-dice">
          <span
            v-for="(d, i) in resultDice"
            :key="i"
            class="dp-die"
            :class="{ 'dp-die--success': d >= 4 }"
          >{{ d }}</span>
        </div>
        <div class="dp-result-hint">
          {{ resultBroadcast
            ? 'Broadcast to local chat — players nearby will see this roll.'
            : 'Not broadcast (no linked SL avatar). Link your SL account with /bf verify to share rolls.'
          }}
        </div>
      </div>

      <div v-else class="dp-placeholder">
        Pick an aptitude and roll. The result is posted to SL local chat via your HUDSync.
      </div>
    </div>
  </div>
</template>

<style scoped>
.dice-panel {
  position: fixed;
  top: 120px;
  left: 120px;
  width: 400px;
  background: rgba(15, 12, 8, 0.94);
  border: 1px solid var(--color-gold-dim, #806020);
  border-radius: 6px;
  font-family: var(--font-body, sans-serif);
  color: var(--color-text, #e8dcc8);
  pointer-events: auto;
  z-index: 500;
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-gold-dim, #806020);
  background: rgba(201, 168, 76, 0.08);
  cursor: grab;
  user-select: none;
}

.dp-header:active {
  cursor: grabbing;
}

.dp-title {
  font-family: var(--font-display, serif);
  color: var(--color-gold, #c9a84c);
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dp-close {
  background: transparent;
  border: none;
  color: var(--color-text-dim, #a89878);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.dp-close:hover {
  color: var(--color-gold, #c9a84c);
}

.dp-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dp-controls {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.dp-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dp-field-label {
  font-family: var(--font-display, serif);
  font-size: 10px;
  color: var(--color-gold-dark, #806020);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.dp-select {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--color-border, #333);
  border-radius: 3px;
  padding: 6px 8px;
  color: var(--color-text, #e8dcc8);
  font-size: 12px;
}

.dp-roll-btn {
  background: rgba(201, 168, 76, 0.15);
  border: 1px solid var(--color-gold-dim, #806020);
  border-radius: 3px;
  padding: 8px 14px;
  color: var(--color-gold, #c9a84c);
  font-family: var(--font-display, serif);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.dp-roll-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.25);
  border-color: var(--color-gold, #c9a84c);
}

.dp-roll-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dp-canvas-wrap {
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--color-border, #333);
  border-radius: 3px;
}

.dp-canvas {
  width: 360px;
  height: 240px;
  display: block;
}

.dp-error {
  color: var(--color-crimson, #c86060);
  font-size: 12px;
  text-align: center;
}

.dp-placeholder {
  color: var(--color-text-dim, #a89878);
  font-size: 11px;
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}

.dp-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(201, 168, 76, 0.06);
  border: 1px solid var(--color-gold-dim, #806020);
  border-radius: 3px;
}

.dp-result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dp-result-label {
  color: var(--color-gold, #c9a84c);
  font-family: var(--font-display, serif);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.dp-result-total {
  color: var(--color-text, #e8dcc8);
  font-weight: 600;
  font-size: 13px;
}

.dp-result-dice {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dp-die {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--color-border, #444);
  border-radius: 3px;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-dim, #a89878);
}

.dp-die--success {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold, #c9a84c);
  color: var(--color-gold, #c9a84c);
}

.dp-result-hint {
  font-size: 10px;
  color: var(--color-text-dim, #a89878);
  font-style: italic;
}
</style>
