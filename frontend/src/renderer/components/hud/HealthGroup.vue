<script setup lang="ts">
import { useCharacterStore } from '@/stores/character'
import VitalsBar from './VitalsBar.vue'

const store = useCharacterStore()
</script>

<template>
  <div class="health-group animate-fade-in-up">
    <div class="health-bars">
      <!-- Health Bar -->
      <div class="bar-row">
        <div class="bar-icon health-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4.5 2 6.5 2c1.2 0 2.3.7 2.8 1.7L8 5.4l-1.3-1.7C7.2 2.7 8 2 9.5 2c2 0 4 2 4 4.5S8 14 8 14z" />
          </svg>
        </div>
        <VitalsBar
          :value="store.vitals.health"
          color="var(--color-health)"
          bg-color="var(--color-health-bg)"
          glow-color="var(--color-health-glow)"
          :critical="store.isCriticalHealth"
          size="md"
        />
      </div>

      <!-- Armor Bar -->
      <div class="bar-row">
        <div class="bar-icon armor-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L2 4v4c0 3.5 2.6 6.4 6 7.1 3.4-.7 6-3.6 6-7.1V4L8 1zm0 1.5L13 5v3c0 2.8-2.1 5.3-5 5.9-2.9-.6-5-3.1-5-5.9V5l5-2.5z" />
          </svg>
        </div>
        <VitalsBar
          :value="store.vitals.armor"
          color="var(--color-armor)"
          bg-color="var(--color-armor-bg)"
          glow-color="var(--color-armor-glow)"
          size="md"
        />
      </div>

      <!-- Stamina Bar -->
      <div class="bar-row">
        <div class="bar-icon stamina-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.5 2L5 9h3l-1.5 5L11 7H8L9.5 2z" />
          </svg>
        </div>
        <VitalsBar
          :value="store.vitals.stamina"
          color="var(--color-stamina)"
          bg-color="var(--color-stamina-bg)"
          glow-color="var(--color-stamina-glow)"
          size="md"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.health-group {
  background: linear-gradient(
    135deg,
    rgba(8, 6, 12, 0.94) 0%,
    rgba(12, 10, 18, 0.92) 100%
  );
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-width: 220px;
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
  position: relative;
}

.health-group::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

.health-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.bar-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  filter: drop-shadow(0 0 3px currentColor);
}

.health-icon {
  color: var(--color-health);
}

.armor-icon {
  color: var(--color-armor);
}

.stamina-icon {
  color: var(--color-stamina);
}
</style>
