<script setup lang="ts">
import { useCharacterStore } from '@/stores/character'

const store = useCharacterStore()

function getStatusClass(value: number, inverted = false): string {
  const effective = inverted ? value : 100 - value
  if (effective > 75) return 'status-critical'
  if (effective > 50) return 'status-warning'
  return 'status-good'
}
</script>

<template>
  <div class="survival-group animate-fade-in-up">
    <!-- Hunger -->
    <div class="survival-item" :class="getStatusClass(store.vitals.hunger)">
      <div class="survival-ring">
        <svg width="38" height="38" viewBox="0 0 38 38">
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="3"
          />
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="var(--color-hunger)"
            stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${store.vitals.hunger * 0.942} 94.2`"
            transform="rotate(-90 19 19)"
            class="ring-progress"
          />
        </svg>
        <div class="survival-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-hunger)">
            <path d="M5 1v5.5c0 .8.7 1.5 1.5 1.5h.5v6.5a.5.5 0 001 0V8h.5c.8 0 1.5-.7 1.5-1.5V1h-1v4h-1V1h-1v4h-1V1H5zM12 1c-1.1 0-2 1.5-2 3.5S11 8 12 8v6.5a.5.5 0 001 0V1h-1z" />
          </svg>
        </div>
      </div>
      <span class="survival-label">{{ Math.round(store.vitals.hunger) }}</span>
    </div>

    <!-- Thirst -->
    <div class="survival-item" :class="getStatusClass(store.vitals.thirst)">
      <div class="survival-ring">
        <svg width="38" height="38" viewBox="0 0 38 38">
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="3"
          />
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="var(--color-thirst)"
            stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${store.vitals.thirst * 0.942} 94.2`"
            transform="rotate(-90 19 19)"
            class="ring-progress"
          />
        </svg>
        <div class="survival-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-thirst)">
            <path d="M8 2S4 7 4 10a4 4 0 108 0c0-3-4-8-4-8zm0 10a2 2 0 01-2-2c0-1.1.9-2.6 2-4.3 1.1 1.7 2 3.2 2 4.3a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      <span class="survival-label">{{ Math.round(store.vitals.thirst) }}</span>
    </div>

    <!-- Stress -->
    <div class="survival-item" :class="getStatusClass(store.vitals.stress, true)">
      <div class="survival-ring">
        <svg width="38" height="38" viewBox="0 0 38 38">
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            stroke-width="3"
          />
          <circle
            cx="19" cy="19" r="15"
            fill="none"
            stroke="var(--color-stress)"
            stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${store.vitals.stress * 0.942} 94.2`"
            transform="rotate(-90 19 19)"
            class="ring-progress"
          />
        </svg>
        <div class="survival-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-stress)">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
        </div>
      </div>
      <span class="survival-label">{{ Math.round(store.vitals.stress) }}</span>
    </div>
  </div>
</template>

<style scoped>
.survival-group {
  display: flex;
  gap: var(--space-md);
  background: linear-gradient(
    135deg,
    rgba(8, 6, 12, 0.94) 0%,
    rgba(12, 10, 18, 0.92) 100%
  );
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
  position: relative;
}

.survival-group::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

.survival-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.survival-ring {
  position: relative;
  width: 38px;
  height: 38px;
}

.ring-progress {
  transition: stroke-dasharray 0.8s ease;
}

.survival-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.survival-label {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-dim);
}

/* Status classes */
.status-critical .ring-progress {
  animation: pulse 1.2s ease-in-out infinite;
}

.status-warning .survival-label {
  color: var(--color-warning);
}

.status-critical .survival-label {
  color: var(--color-danger);
}
</style>
