<script setup lang="ts">
import { useCreationStore } from '@/stores/creation'

const store = useCreationStore()

// 2-column layout matching CharacterPanel aptitude layout
const LEFT_COLUMN = ['prowess', 'command', 'stewardship', 'lore', 'craftsmanship'] as const
const RIGHT_COLUMN = ['fortitude', 'cunning', 'presence', 'faith'] as const

function isAtMin(key: string): boolean {
  return (store.aptitudes[key] ?? 2) <= store.getAptitudeLockedMin(key)
}

function isAtMax(key: string): boolean {
  return (store.aptitudes[key] ?? 2) >= 7
}
</script>

<template>
  <div class="step-aptitudes">
    <!-- Points counter -->
    <div class="points-header">
      <span class="points-label">Aptitude Points Remaining</span>
      <span
        class="points-counter"
        :class="{
          'points-counter--done': store.freeAptitudePointsRemaining === 0,
          'points-counter--pulse': store.freeAptitudePointsRemaining > 0,
        }"
      >
        {{ store.freeAptitudePointsRemaining }}
      </span>
    </div>

    <p class="step-hint">
      Distribute points across your aptitudes. Locked values from your class template cannot be lowered.
      Each aptitude ranges from 2 to 7 at creation.
    </p>

    <!-- 2-column aptitude layout -->
    <div class="aptitudes-grid">
      <!-- Left column -->
      <div class="aptitudes-column">
        <div v-for="key in LEFT_COLUMN" :key="key" class="apt-row">
          <span class="apt-name">{{ store.APTITUDE_LABELS[key] }}</span>
          <button
            class="apt-btn apt-btn--minus"
            :disabled="isAtMin(key)"
            @click="store.decrementAptitude(key)"
          >-</button>
          <div class="apt-segments">
            <div
              v-for="i in 10"
              :key="i"
              class="apt-seg"
              :class="{
                'apt-seg--filled': i <= (store.aptitudes[key] ?? 2),
                'apt-seg--locked': i <= store.getAptitudeLockedMin(key),
                'apt-seg--beyond-cap': i > 7,
              }"
            />
          </div>
          <span class="apt-value">{{ store.aptitudes[key] ?? 2 }}</span>
          <button
            class="apt-btn apt-btn--plus"
            :disabled="isAtMax(key) || store.freeAptitudePointsRemaining <= 0"
            @click="store.incrementAptitude(key)"
          >+</button>
        </div>
      </div>

      <!-- Right column -->
      <div class="aptitudes-column">
        <div v-for="key in RIGHT_COLUMN" :key="key" class="apt-row">
          <span class="apt-name">{{ store.APTITUDE_LABELS[key] }}</span>
          <button
            class="apt-btn apt-btn--minus"
            :disabled="isAtMin(key)"
            @click="store.decrementAptitude(key)"
          >-</button>
          <div class="apt-segments">
            <div
              v-for="i in 10"
              :key="i"
              class="apt-seg"
              :class="{
                'apt-seg--filled': i <= (store.aptitudes[key] ?? 2),
                'apt-seg--locked': i <= store.getAptitudeLockedMin(key),
                'apt-seg--beyond-cap': i > 7,
              }"
            />
          </div>
          <span class="apt-value">{{ store.aptitudes[key] ?? 2 }}</span>
          <button
            class="apt-btn apt-btn--plus"
            :disabled="isAtMax(key) || store.freeAptitudePointsRemaining <= 0"
            @click="store.incrementAptitude(key)"
          >+</button>
        </div>
      </div>
    </div>

    <!-- Template reference -->
    <div v-if="store.selectedTemplate" class="template-reference">
      <span class="ref-label">Class:</span>
      <span class="ref-value">{{ store.selectedTemplate.name }}</span>
      <span class="ref-sep">|</span>
      <span class="ref-label">Free Points:</span>
      <span class="ref-value">{{ store.selectedTemplate.free_aptitude_points }}</span>
    </div>
  </div>
</template>

<style scoped>
.step-aptitudes {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 820px;
  margin: 0 auto;
}

/* Points header */
.points-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.points-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.points-counter {
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  font-weight: 700;
  min-width: 28px;
  text-align: center;
}

.points-counter--done {
  color: var(--color-text-muted);
}

.points-counter--pulse {
  animation: pulse-gold 2s ease-in-out infinite;
}

@keyframes pulse-gold {
  0%, 100% { text-shadow: 0 0 4px rgba(201, 168, 76, 0.2); }
  50% { text-shadow: 0 0 12px rgba(201, 168, 76, 0.6); }
}

.step-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

/* 2-column grid */
.aptitudes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.aptitudes-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* Each aptitude row */
.apt-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.apt-name {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  width: 90px;
  flex-shrink: 0;
  text-align: right;
}

.apt-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.apt-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.15);
  border-color: var(--color-gold-dark);
  color: var(--color-gold);
}

.apt-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

.apt-btn--plus {
  color: var(--color-gold-dark);
}

/* Segmented bar */
.apt-segments {
  flex: 1;
  display: flex;
  gap: 2px;
}

.apt-seg {
  flex: 1;
  height: 16px;
  background: rgba(201, 168, 76, 0.04);
  border: 1px solid rgba(201, 168, 76, 0.1);
  border-radius: 1px;
  transition: all var(--transition-fast);
}

.apt-seg--filled {
  background: linear-gradient(180deg, var(--color-gold), var(--color-gold-dark));
  border-color: rgba(201, 168, 76, 0.5);
  box-shadow: 0 0 3px rgba(201, 168, 76, 0.12);
}

.apt-seg--locked {
  border-color: rgba(201, 168, 76, 0.35);
}

.apt-seg--locked.apt-seg--filled {
  background: linear-gradient(180deg, var(--color-gold-dark), #7a5e1e);
  border-color: rgba(201, 168, 76, 0.4);
}

.apt-seg--beyond-cap {
  opacity: 0.3;
  border-style: dashed;
}

.apt-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 700;
}

/* Template reference */
.template-reference {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border-dim);
}

.ref-label {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.ref-value {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
}

.ref-sep {
  color: var(--color-border);
  font-size: var(--font-size-xs);
}
</style>
