<script setup lang="ts">
import { computed } from 'vue'
import { useHudStore } from '@/stores/hud'

const hudStore = useHudStore()

const latencyText = computed(() => {
  if (!hudStore.isConnected) return '--'
  return `${hudStore.latency}ms`
})

const simText = computed(() => {
  return hudStore.simName || 'No Region'
})

const gridText = computed(() => {
  if (!hudStore.simName) return '--'
  return `(${hudStore.gridCoords.x}, ${hudStore.gridCoords.y})`
})

const posText = computed(() => {
  if (!hudStore.simName) return '<--, --, -->'
  const p = hudStore.avatarPosition
  return `<${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}>`
})

const playerCountText = computed(() => {
  const count = hudStore.regionPlayerCount
  return `${count} online`
})
</script>

<template>
  <div class="bottombar">
    <!-- Connection status + latency -->
    <div class="bb-section bb-connection">
      <span
        class="bb-dot"
        :class="hudStore.isConnected ? 'bb-dot--online' : 'bb-dot--offline'"
      />
      <span class="bb-label">{{ hudStore.isConnected ? 'Connected' : 'Offline' }}</span>
      <span class="bb-value">{{ latencyText }}</span>
    </div>

    <div class="bb-divider" />

    <!-- Sim name + grid coords -->
    <div class="bb-section bb-location">
      <span class="bb-sim">{{ simText }}</span>
      <span class="bb-grid">{{ gridText }}</span>
    </div>

    <div class="bb-divider" />

    <!-- Avatar position -->
    <div class="bb-section bb-position">
      <span class="bb-value">{{ posText }}</span>
    </div>

    <div class="bb-divider" />

    <!-- Player count -->
    <div class="bb-section bb-players">
      <span class="bb-value">{{ playerCountText }}</span>
    </div>
  </div>
</template>

<style scoped>
.bottombar {
  height: 32px;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  padding: 0 var(--space-md);
  gap: var(--space-sm);
  border-top: 1px solid var(--color-border-dim);
  user-select: none;
}

.bb-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bb-divider {
  width: 1px;
  height: 16px;
  background: var(--color-border-dim);
  flex-shrink: 0;
}

/* Connection dot */
.bb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bb-dot--online {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(45, 138, 78, 0.6);
  animation: pulse 2s ease-in-out infinite;
}

.bb-dot--offline {
  background: var(--color-danger);
  box-shadow: 0 0 6px rgba(196, 43, 43, 0.4);
}

/* Labels */
.bb-label {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}

.bb-value {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.03em;
}

/* Sim name in gold */
.bb-sim {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--color-gold);
  letter-spacing: 0.06em;
}

.bb-grid {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

/* Spacing */
.bb-connection {
  flex-shrink: 0;
}

.bb-location {
  flex: 1;
  justify-content: center;
}

.bb-position {
  flex-shrink: 0;
}

.bb-players {
  flex-shrink: 0;
  margin-left: auto;
}
</style>
