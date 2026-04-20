<script setup lang="ts">
import { ref, computed } from 'vue'
import DiceRollOverlay from '../components/combat/DiceRollOverlay.vue'

const showRoll = ref(false)
const diceCount = ref(6)
const threshold = ref(4)
const label = ref('Attack Roll')
const lastSuccesses = ref<number | null>(null)

// Generate random d6 results (simulates what the server would send)
const results = ref<number[]>([])

function generateResults() {
  results.value = Array.from({ length: diceCount.value }, () => Math.floor(Math.random() * 6) + 1)
}

function triggerRoll() {
  generateResults()
  lastSuccesses.value = null
  showRoll.value = true
}

function onComplete(successes: number) {
  lastSuccesses.value = successes
}

function onDismiss() {
  showRoll.value = false
}

// Presets matching actual game rolls
const presets = [
  { name: 'Attack (Prowess 6)', dice: 6, thresh: 4, lbl: 'Attack Roll' },
  { name: 'Defense (Shield)', dice: 5, thresh: 5, lbl: 'Defense Roll' },
  { name: 'Rally (Command 4)', dice: 4, thresh: 4, lbl: 'Rally' },
  { name: 'Mend (Lore 3)', dice: 3, thresh: 4, lbl: 'Mend' },
  { name: 'Retreat (Prowess 7)', dice: 7, thresh: 4, lbl: 'Retreat' },
  { name: 'Survival (Fort 5)', dice: 5, thresh: 4, lbl: 'Survival Check' },
  { name: 'Initiative (8d6 sum)', dice: 8, thresh: 4, lbl: 'Initiative' },
  { name: 'Big Pool (12d6)', dice: 12, thresh: 4, lbl: 'Massive Roll' },
]

function applyPreset(p: typeof presets[0]) {
  diceCount.value = p.dice
  threshold.value = p.thresh
  label.value = p.lbl
}

const expectedSuccesses = computed(() => {
  if (!results.value.length) return null
  return results.value.filter(r => r >= threshold.value).length
})
</script>

<template>
  <div class="dice-test">
    <div class="test-panel">
      <h1 class="test-title">Dice Roll Test</h1>

      <!-- Controls -->
      <div class="controls">
        <div class="control-group">
          <label>Dice Count</label>
          <input v-model.number="diceCount" type="number" min="1" max="20" class="input" />
        </div>

        <div class="control-group">
          <label>Threshold</label>
          <select v-model.number="threshold" class="input">
            <option :value="4">4+ (Attack / Defense / Tactical)</option>
            <option :value="5">5+ (Legacy)</option>
            <option :value="3">3+ (Easy)</option>
          </select>
        </div>

        <div class="control-group">
          <label>Label</label>
          <input v-model="label" type="text" class="input" />
        </div>
      </div>

      <!-- Presets -->
      <div class="presets">
        <span class="presets-label">Presets:</span>
        <button
          v-for="p in presets"
          :key="p.name"
          class="preset-btn"
          @click="applyPreset(p)"
        >
          {{ p.name }}
        </button>
      </div>

      <!-- Roll button -->
      <button class="roll-btn" @click="triggerRoll" :disabled="showRoll">
        Roll {{ diceCount }}d6
      </button>

      <!-- Last result -->
      <div v-if="lastSuccesses !== null" class="last-result">
        Last roll: <strong>{{ lastSuccesses }}</strong> successes
        out of {{ results.length }} dice (threshold {{ threshold }}+)
        <span class="result-detail">
          [ {{ results.join(', ') }} ]
        </span>
      </div>
    </div>

    <!-- Dice overlay -->
    <DiceRollOverlay
      v-if="showRoll"
      :results="results"
      :threshold="threshold"
      :label="label"
      @complete="onComplete"
      @dismiss="onDismiss"
    />
  </div>
</template>

<style scoped>
.dice-test {
  width: 100vw;
  height: 100vh;
  background: #0a0908;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Rajdhani, Inter, sans-serif;
  color: #e8dcc8;
}

.test-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 40px;
  background: rgba(14, 12, 10, 0.95);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 4px;
  min-width: 520px;
}

.test-title {
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 24px;
  font-weight: 600;
  color: #c9a84c;
  text-transform: uppercase;
  letter-spacing: 3px;
  margin: 0;
}

/* Controls */
.controls {
  display: flex;
  gap: 16px;
  width: 100%;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.control-group label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(232, 220, 200, 0.5);
}

.input {
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 2px;
  color: #e8dcc8;
  font-family: Rajdhani, Inter, sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 150ms ease;
}

.input:focus {
  border-color: rgba(201, 168, 76, 0.5);
}

/* Presets */
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  width: 100%;
}

.presets-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(232, 220, 200, 0.4);
  margin-right: 4px;
}

.preset-btn {
  padding: 4px 10px;
  background: rgba(201, 168, 76, 0.05);
  border: 1px solid rgba(201, 168, 76, 0.15);
  border-radius: 2px;
  color: rgba(232, 220, 200, 0.6);
  font-family: Rajdhani, Inter, sans-serif;
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms ease;
}

.preset-btn:hover {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.4);
  color: #c9a84c;
}

/* Roll button */
.roll-btn {
  padding: 12px 48px;
  background: rgba(201, 168, 76, 0.1);
  border: 2px solid rgba(201, 168, 76, 0.4);
  border-radius: 3px;
  color: #c9a84c;
  font-family: Cinzel, MedievalSharp, serif;
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 200ms ease;
}

.roll-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: #c9a84c;
  box-shadow: 0 0 20px rgba(201, 168, 76, 0.2);
}

.roll-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Last result */
.last-result {
  font-size: 14px;
  color: rgba(232, 220, 200, 0.6);
  text-align: center;
}

.last-result strong {
  color: #c9a84c;
  font-size: 18px;
}

.result-detail {
  display: block;
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: rgba(232, 220, 200, 0.35);
}
</style>
