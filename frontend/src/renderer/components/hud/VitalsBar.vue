<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  max?: number
  color: string
  bgColor: string
  glowColor?: string
  icon?: string
  label?: string
  showValue?: boolean
  critical?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  max: 100,
  glowColor: undefined,
  icon: undefined,
  label: undefined,
  showValue: false,
  critical: false,
  size: 'md'
})

const percent = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)))

const barHeight = computed(() => {
  switch (props.size) {
    case 'sm': return '5px'
    case 'lg': return '12px'
    default: return '8px'
  }
})
</script>

<template>
  <div class="vitals-bar" :class="{ critical: critical && percent < 20 }">
    <!-- Label row -->
    <div v-if="label || showValue" class="bar-header">
      <span v-if="label" class="bar-label">{{ label }}</span>
      <span v-if="showValue" class="bar-value">{{ Math.round(value) }}/{{ max }}</span>
    </div>

    <!-- Bar container -->
    <div class="bar-track" :style="{ height: barHeight }">
      <!-- Background glow -->
      <div
        class="bar-glow"
        :style="{
          width: percent + '%',
          background: glowColor || bgColor,
        }"
      />
      <!-- Fill bar -->
      <div
        class="bar-fill"
        :style="{
          width: percent + '%',
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          boxShadow: percent > 0 ? `0 0 8px ${glowColor || color}60` : 'none'
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.vitals-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 120px;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bar-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.bar-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  font-family: var(--font-mono);
}

.bar-track {
  position: relative;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.3;
  filter: blur(4px);
  transition: width 0.6s ease;
}

.bar-fill {
  position: relative;
  height: 100%;
  border-radius: inherit;
  transition: width 0.6s ease;
}

/* Critical pulse */
.critical .bar-fill {
  animation: pulse 1.2s ease-in-out infinite;
}

.critical .bar-track {
  box-shadow: 0 0 10px rgba(196, 43, 43, 0.3);
}
</style>
