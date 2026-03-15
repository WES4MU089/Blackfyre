<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { DiceScene, type DiceRollRequest } from '../../lib/dice3d'

const props = withDefaults(defineProps<{
  results: number[]
  threshold?: number
  label?: string
}>(), {
  threshold: 4,
  label: 'Dice Roll',
})

const emit = defineEmits<{
  complete: [successes: number]
  dismiss: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const settledDice = ref<{ value: number; success: boolean }[]>([])
const successes = ref(0)
const allSettled = ref(false)

let scene: DiceScene | null = null

onMounted(async () => {
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas) return

  scene = new DiceScene(canvas, (_, value, isSuccess) => {
    settledDice.value.push({ value, success: isSuccess })
    if (isSuccess) successes.value++
  })

  const request: DiceRollRequest = {
    results: props.results,
    threshold: props.threshold,
  }

  await scene.roll(request)
  allSettled.value = true
  emit('complete', successes.value)
})

onUnmounted(() => {
  scene?.dispose()
  scene = null
})

function dismiss() {
  emit('dismiss')
}
</script>

<template>
  <div class="dice-overlay" @click.self="allSettled && dismiss()">
    <div class="dice-panel">
      <!-- Header -->
      <div class="dice-header">
        <span class="dice-label">{{ label }}</span>
        <span class="dice-threshold">{{ threshold }}+ to succeed</span>
      </div>

      <!-- 3D Canvas -->
      <div class="dice-canvas-wrap">
        <canvas ref="canvasRef" width="640" height="400" class="dice-canvas" />
      </div>

      <!-- Results tray -->
      <div class="dice-results">
        <div class="dice-tally">
          <span class="tally-count" :class="{ 'has-successes': successes > 0 }">
            {{ successes }}
          </span>
          <span class="tally-label">
            {{ successes === 1 ? 'Success' : 'Successes' }}
          </span>
        </div>

        <div class="dice-individual">
          <TransitionGroup name="die-pop">
            <span
              v-for="(die, i) in settledDice"
              :key="i"
              :class="['die-chip', die.success ? 'die-success' : 'die-fail']"
            >
              {{ die.value }}
            </span>
          </TransitionGroup>
        </div>
      </div>

      <!-- Dismiss -->
      <Transition name="fade">
        <button v-if="allSettled" class="dice-dismiss" @click="dismiss">
          Continue
        </button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.dice-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  pointer-events: auto;
  animation: overlay-in 0.3s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dice-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 28px 24px;
  background: rgba(14, 12, 10, 0.95);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 4px;
  box-shadow:
    0 0 40px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(201, 168, 76, 0.1);
}

/* Ornate corner accents */
.dice-panel::before,
.dice-panel::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: var(--color-gold, #c9a84c);
  border-style: solid;
  pointer-events: none;
}
.dice-panel::before {
  top: -1px;
  left: -1px;
  border-width: 2px 0 0 2px;
}
.dice-panel::after {
  bottom: -1px;
  right: -1px;
  border-width: 0 2px 2px 0;
}

/* Header */
.dice-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(201, 168, 76, 0.15);
}

.dice-label {
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-gold, #c9a84c);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.dice-threshold {
  font-family: Rajdhani, Inter, sans-serif;
  font-size: 13px;
  color: rgba(232, 220, 200, 0.5);
  letter-spacing: 1px;
}

/* Canvas */
.dice-canvas-wrap {
  border-radius: 2px;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4);
}

.dice-canvas {
  display: block;
  width: 640px;
  height: 400px;
}

/* Results tray */
.dice-results {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid rgba(201, 168, 76, 0.15);
}

.dice-tally {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.tally-count {
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 36px;
  font-weight: 700;
  color: rgba(232, 220, 200, 0.4);
  line-height: 1;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}

.tally-count.has-successes {
  color: var(--color-gold, #c9a84c);
  text-shadow: 0 0 12px rgba(201, 168, 76, 0.4);
}

.tally-label {
  font-family: Rajdhani, Inter, sans-serif;
  font-size: 11px;
  color: rgba(232, 220, 200, 0.4);
  text-transform: uppercase;
  letter-spacing: 2px;
}

/* Individual die results */
.dice-individual {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.die-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 16px;
  font-weight: 700;
}

.die-success {
  background: rgba(201, 168, 76, 0.15);
  border: 1px solid rgba(201, 168, 76, 0.5);
  color: #c9a84c;
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.2);
}

.die-fail {
  background: rgba(60, 20, 20, 0.3);
  border: 1px solid rgba(100, 40, 40, 0.3);
  color: rgba(180, 100, 100, 0.5);
}

/* Die chip pop-in transition */
.die-pop-enter-from {
  transform: scale(0);
  opacity: 0;
}
.die-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.die-pop-enter-to {
  transform: scale(1);
  opacity: 1;
}

/* Dismiss button */
.dice-dismiss {
  margin-top: 4px;
  padding: 8px 32px;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 2px;
  color: var(--color-gold, #c9a84c);
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 150ms ease;
}

.dice-dismiss:hover {
  background: rgba(201, 168, 76, 0.15);
  border-color: rgba(201, 168, 76, 0.6);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.15);
}

/* Fade transition for dismiss button */
.fade-enter-from { opacity: 0; transform: translateY(4px); }
.fade-enter-active { transition: all 0.3s ease; }
.fade-enter-to { opacity: 1; transform: translateY(0); }
</style>
