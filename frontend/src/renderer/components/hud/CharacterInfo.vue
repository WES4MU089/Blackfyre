<script setup lang="ts">
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'

const characterStore = useCharacterStore()
const hudStore = useHudStore()
</script>

<template>
  <div v-if="characterStore.isLoaded" class="char-info animate-fade-in">
    <div class="char-name font-display">{{ characterStore.character?.name }}</div>
    <div class="char-meta">
      <span class="connection-dot" :class="{ connected: hudStore.isConnected }" />
      <span v-if="hudStore.latency > 0" class="char-latency">{{ hudStore.latency }}ms</span>
    </div>
  </div>
</template>

<style scoped>
.char-info {
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
  display: flex;
  align-items: center;
  gap: var(--space-md);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
  position: relative;
}

.char-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

.char-name {
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-shadow: 0 0 8px rgba(201, 168, 76, 0.2);
}

.char-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-crimson);
}

.connection-dot.connected {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(45, 138, 78, 0.5);
}

.char-latency {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}
</style>
