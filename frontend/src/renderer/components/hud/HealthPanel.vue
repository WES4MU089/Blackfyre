<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAilmentsStore, type CharacterAilment } from '@/stores/ailments'
import { useCharacterStore } from '@/stores/character'

const ailmentsStore = useAilmentsStore()
const characterStore = useCharacterStore()

// Tick counter to force reactivity on countdown timers
const tick = ref(0)
let tickInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  tickInterval = setInterval(() => { tick.value++ }, 60_000)
})

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})

// --- Wound status ---

const woundSeverity = computed(() => ailmentsStore.woundSeverity)
const isHealthy = computed(() => woundSeverity.value === 'healthy' && ailmentsStore.ailments.length === 0)

const severityLabel: Record<string, string> = {
  healthy: 'Healthy',
  light: 'Light Wounds',
  serious: 'Serious Wounds',
  severe: 'Severe Wounds',
  grave: 'Grave Wounds',
}

const severityPenalty: Record<string, string> = {
  healthy: 'No penalty',
  light: '-1 die penalty',
  serious: '-2 dice penalty',
  severe: '-3 dice penalty',
  grave: 'Cannot enter combat',
}

const ailments = computed(() => ailmentsStore.ailments)

// --- Time helpers ---

function formatTimeRemaining(isoTimestamp: string): string {
  // Access tick.value to ensure reactivity
  void tick.value
  const now = Date.now()
  const target = new Date(isoTimestamp).getTime()
  const diffMs = target - now
  if (diffMs <= 0) return 'Imminent'
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

function isUrgent(isoTimestamp: string): boolean {
  void tick.value
  const diffMs = new Date(isoTimestamp).getTime() - Date.now()
  return diffMs > 0 && diffMs < 2 * 3600 * 1000 // < 2 hours
}

function clockPercent(isoTimestamp: string): number {
  void tick.value
  const now = Date.now()
  const target = new Date(isoTimestamp).getTime()
  const diffMs = target - now
  if (diffMs <= 0) return 100
  // Estimate: assume max stage duration is ~24h for display purposes
  const maxMs = 24 * 3600 * 1000
  return Math.min(100, Math.max(0, ((maxMs - diffMs) / maxMs) * 100))
}

function lightWoundTimeRemaining(): string {
  if (!ailmentsStore.woundHealsAt) return ''
  return formatTimeRemaining(ailmentsStore.woundHealsAt)
}

function stageLabel(a: CharacterAilment): string {
  return `Stage ${a.currentStage}: ${a.stageName}`
}
</script>

<template>
  <div class="health-panel panel-ornate">
    <div class="health-header">Health Status</div>

    <div class="health-body">
      <!-- Healthy empty state -->
      <div v-if="isHealthy" class="health-empty">
        <div class="health-empty-icon">&#10003;</div>
        <div class="health-empty-text">In good health</div>
        <div class="health-empty-hint">No wounds or ailments</div>
      </div>

      <template v-else>
        <!-- Wound Status Section -->
        <div class="health-section">
          <div class="health-section-title">Wound Status</div>

          <div class="wound-badge-row">
            <span class="wound-badge" :class="`wound-badge--${woundSeverity}`">
              {{ severityLabel[woundSeverity] }}
            </span>
          </div>

          <div class="wound-penalty">
            {{ severityPenalty[woundSeverity] }}
          </div>

          <!-- Light wound self-heal timer -->
          <div v-if="woundSeverity === 'light' && ailmentsStore.woundHealsAt" class="wound-timer">
            <span class="wound-timer-label">Self-heals in</span>
            <span class="wound-timer-value">{{ lightWoundTimeRemaining() }}</span>
          </div>

          <!-- Infection risk warning -->
          <div v-if="woundSeverity === 'serious' || woundSeverity === 'severe' || woundSeverity === 'grave'" class="infection-warning">
            <span class="infection-warning-icon">&#9888;</span>
            <span>Infection risk — seek tending</span>
          </div>
        </div>

        <!-- Active Ailments Section -->
        <div v-if="ailments.length > 0" class="health-section">
          <div class="health-section-title">Active Ailments</div>

          <div v-for="a in ailments" :key="a.id" class="ailment-card">
            <div class="ailment-header">
              <span class="ailment-name">{{ a.name }}</span>
              <span class="ailment-stage">{{ stageLabel(a) }}</span>
            </div>

            <!-- Terminal clock -->
            <div class="clock-row">
              <span class="clock-label clock-label--terminal">Terminal</span>
              <div class="clock-bar-track">
                <div
                  class="clock-bar-fill clock-bar-fill--terminal"
                  :class="{
                    'clock-bar-fill--urgent': !a.isTerminalPaused && isUrgent(a.terminalExpiresAt),
                    'clock-bar-fill--paused': a.isTerminalPaused,
                  }"
                  :style="{ width: a.isTerminalPaused ? '0%' : clockPercent(a.terminalExpiresAt) + '%' }"
                />
              </div>
              <span class="clock-time">
                <template v-if="a.isTerminalPaused">
                  <span class="paused-badge">Paused</span>
                </template>
                <template v-else>
                  {{ formatTimeRemaining(a.terminalExpiresAt) }}
                </template>
              </span>
            </div>

            <!-- Immunity clock -->
            <div class="clock-row">
              <span class="clock-label clock-label--immunity">Immunity</span>
              <div class="clock-bar-track">
                <div
                  class="clock-bar-fill clock-bar-fill--immunity"
                  :style="{ width: clockPercent(a.immunityExpiresAt) + '%' }"
                />
              </div>
              <span class="clock-time">{{ formatTimeRemaining(a.immunityExpiresAt) }}</span>
            </div>

            <!-- Symptoms -->
            <div v-if="a.symptoms.length > 0" class="ailment-symptoms">
              <span v-for="(s, i) in a.symptoms" :key="i" class="symptom-tag">{{ s }}</span>
            </div>
          </div>
        </div>

        <!-- Treatment info -->
        <div class="health-section health-section--info">
          <div class="treatment-hint">Seek a healer with Lore skill to tend wounds</div>
          <div class="treatment-hint">Medicine pauses infection and boosts recovery</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.health-panel {
  pointer-events: auto;
  margin-left: 6px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  width: 280px;
}

.health-header {
  padding: 6px 10px;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.health-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.health-body::-webkit-scrollbar {
  width: 4px;
}

.health-body::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

/* Empty state */
.health-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  gap: 6px;
}

.health-empty-icon {
  font-size: 24px;
  color: var(--color-success);
  opacity: 0.6;
}

.health-empty-text {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  letter-spacing: 0.08em;
}

.health-empty-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Sections */
.health-section {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border-dim);
}

.health-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.health-section--info {
  padding-bottom: 0;
}

.health-section-title {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* Wound badge */
.wound-badge-row {
  margin-bottom: 4px;
}

.wound-badge {
  display: inline-block;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 3px;
}

.wound-badge--healthy {
  color: var(--color-success);
  background: rgba(45, 138, 78, 0.15);
}

.wound-badge--light {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.15);
}

.wound-badge--serious {
  color: #c87830;
  background: rgba(200, 120, 48, 0.15);
}

.wound-badge--severe {
  color: var(--color-crimson);
  background: rgba(139, 26, 26, 0.15);
}

.wound-badge--grave {
  color: #cc2222;
  background: rgba(204, 34, 34, 0.15);
}

.wound-penalty {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.wound-timer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10px;
  margin-top: 4px;
}

.wound-timer-label {
  color: var(--color-text-muted);
  font-family: var(--font-body);
}

.wound-timer-value {
  color: var(--color-gold);
  font-family: var(--font-mono);
  font-weight: 600;
}

/* Infection warning */
.infection-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 10px;
  color: #c87830;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 6px;
  background: rgba(200, 120, 48, 0.08);
  border: 1px solid rgba(200, 120, 48, 0.25);
  border-radius: 3px;
}

.infection-warning-icon {
  font-size: 12px;
}

/* Ailment card */
.ailment-card {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px;
  margin-bottom: 8px;
}

.ailment-card:last-child {
  margin-bottom: 0;
}

.ailment-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}

.ailment-name {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.ailment-stage {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
}

/* Clock rows */
.clock-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.clock-row:last-of-type {
  margin-bottom: 0;
}

.clock-label {
  font-family: var(--font-display);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  min-width: 52px;
  flex-shrink: 0;
}

.clock-label--terminal {
  color: var(--color-crimson-light);
}

.clock-label--immunity {
  color: var(--color-success);
}

.clock-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(60, 50, 35, 0.4);
  border-radius: 2px;
  overflow: hidden;
}

.clock-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s ease;
}

.clock-bar-fill--terminal {
  background: linear-gradient(90deg, #5c1010, var(--color-crimson-light));
}

.clock-bar-fill--immunity {
  background: linear-gradient(90deg, #1a5c2e, var(--color-success));
}

.clock-bar-fill--urgent {
  animation: clock-pulse 1.5s ease-in-out infinite;
}

.clock-bar-fill--paused {
  background: var(--color-text-muted);
  opacity: 0.3;
}

@keyframes clock-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.clock-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
  min-width: 44px;
  text-align: right;
  flex-shrink: 0;
}

.paused-badge {
  display: inline-block;
  font-family: var(--font-display);
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 2px;
  padding: 0 4px;
}

/* Symptoms */
.ailment-symptoms {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid var(--color-border-dim);
}

.symptom-tag {
  font-family: var(--font-body);
  font-size: 8px;
  font-style: italic;
  color: var(--color-text-muted);
  background: rgba(60, 50, 35, 0.3);
  padding: 1px 5px;
  border-radius: 2px;
}

/* Treatment hints */
.treatment-hint {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-dim);
  font-style: italic;
  line-height: 1.5;
}
</style>
