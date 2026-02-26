<script setup lang="ts">
import { computed } from 'vue'
import { useCombatStore, type WoundAssessmentView } from '@/stores/combat'

const combatStore = useCombatStore()

const results = computed(() => combatStore.woundAssessments)
const visible = computed(() => combatStore.sessionEnded && results.value.length > 0)

function severityLabel(r: WoundAssessmentView): string {
  switch (r.severity) {
    case 'light': return 'LIGHT WOUNDS'
    case 'serious': return 'SERIOUS WOUNDS'
    case 'severe': return 'SEVERE WOUNDS'
    case 'grave': return 'GRAVE WOUNDS'
    default: return 'UNSCATHED'
  }
}

function severityClass(r: WoundAssessmentView): string {
  return `severity-${r.severity}`
}

function penaltyText(r: WoundAssessmentView): string {
  if (r.dicePenalty === 0) return ''
  if (r.severity === 'grave') return 'Cannot enter combat'
  return `-${r.dicePenalty} dice penalty`
}
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div v-if="visible" class="wound-overlay">
      <div class="wound-panel">
        <h3 class="wound-title">Wound Assessment</h3>
        <div v-for="r in results" :key="r.characterId" class="wound-result">
          <div class="result-header">
            <span class="char-name">{{ r.characterName }}</span>
            <span class="hp-badge">{{ r.healthPercent }}% HP</span>
          </div>
          <div class="health-bar-track">
            <div
              class="health-bar-fill"
              :class="severityClass(r)"
              :style="{ width: Math.max(r.healthPercent, 2) + '%' }"
            />
          </div>
          <div class="severity-row">
            <span class="severity-badge" :class="severityClass(r)">
              {{ severityLabel(r) }}
            </span>
            <span v-if="penaltyText(r)" class="penalty-text">{{ penaltyText(r) }}</span>
          </div>
          <p class="narrative">{{ r.narrative }}</p>
          <div v-if="r.infectionRisk" class="infection-warning">
            Seek tending or infection will set in
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wound-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 200;
  pointer-events: auto;
}

.wound-panel {
  background: linear-gradient(180deg, rgba(20, 15, 10, 0.95), rgba(30, 22, 14, 0.92));
  border: 1px solid var(--color-gold-dim, #6b5a2e);
  border-radius: var(--radius-md, 6px);
  padding: 16px 20px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.wound-title {
  margin: 0 0 12px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-gold, #c9a84c);
  text-align: center;
  border-bottom: 1px solid var(--color-border-dim, #3a3024);
  padding-bottom: 8px;
}

.wound-result {
  margin-bottom: 14px;
}

.wound-result:last-child {
  margin-bottom: 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.char-name {
  font-weight: 600;
  color: var(--color-text-bright, #e8dcc8);
  font-size: 13px;
}

.hp-badge {
  font-size: 10px;
  color: var(--color-text-dim, #8a7d6b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.health-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(60, 50, 35, 0.6);
  border-radius: 3px;
  margin-bottom: 6px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.health-bar-fill.severity-healthy {
  background: #4a8c3f;
}

.health-bar-fill.severity-light {
  background: var(--color-gold, #c9a84c);
}

.health-bar-fill.severity-serious {
  background: #c87830;
}

.health-bar-fill.severity-severe {
  background: var(--color-crimson, #8b1a1a);
}

.health-bar-fill.severity-grave {
  background: #5a0a0a;
}

.severity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.severity-badge {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 3px;
}

.severity-badge.severity-light {
  color: var(--color-gold, #c9a84c);
  background: rgba(201, 168, 76, 0.15);
}

.severity-badge.severity-serious {
  color: #c87830;
  background: rgba(200, 120, 48, 0.15);
}

.severity-badge.severity-severe {
  color: var(--color-crimson, #8b1a1a);
  background: rgba(139, 26, 26, 0.15);
}

.severity-badge.severity-grave {
  color: #cc2222;
  background: rgba(204, 34, 34, 0.15);
}

.penalty-text {
  font-size: 10px;
  color: var(--color-text-dim, #8a7d6b);
}

.narrative {
  font-size: 11px;
  color: var(--color-text-muted, #a09580);
  line-height: 1.4;
  font-style: italic;
  margin: 0 0 4px;
}

.infection-warning {
  font-size: 10px;
  color: #c87830;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 6px;
  background: rgba(200, 120, 48, 0.1);
  border: 1px solid rgba(200, 120, 48, 0.3);
  border-radius: 3px;
}
</style>
