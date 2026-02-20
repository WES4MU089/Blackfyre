<script setup lang="ts">
import type { RetainerInfo } from '@/stores/character'

const props = defineProps<{
  retainer: RetainerInfo
}>()

const emit = defineEmits<{
  select: [id: number]
}>()

const tierLabels = ['', 'I', 'II', 'III', 'IV', 'V']

function healthPercent(): number {
  return props.retainer.maxHealth > 0
    ? (props.retainer.health / props.retainer.maxHealth) * 100
    : 0
}

function tierClass(): string {
  const map: Record<number, string> = { 1: 'tier-iron', 2: 'tier-iron', 3: 'tier-steel', 4: 'tier-cf', 5: 'tier-vs' }
  return map[props.retainer.tier] ?? 'tier-iron'
}
</script>

<template>
  <button class="retainer-card" @click="emit('select', retainer.id)">
    <div class="retainer-card-header">
      <span class="retainer-name">{{ retainer.name }}</span>
      <span class="retainer-tier-badge" :class="tierClass()">{{ tierLabels[retainer.tier] }}</span>
    </div>
    <div class="retainer-card-body">
      <span class="retainer-tier-name">{{ retainer.tierName }}</span>
      <span class="retainer-level">Lv. {{ retainer.level }}</span>
    </div>
    <div class="retainer-hp-bar">
      <div class="retainer-hp-fill" :style="{ width: healthPercent() + '%' }" />
    </div>
    <div class="retainer-hp-text">
      {{ Math.round(retainer.health) }} / {{ Math.round(retainer.maxHealth) }}
    </div>
  </button>
</template>

<style scoped>
.retainer-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  width: 100%;
}

.retainer-card:hover {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.05);
}

.retainer-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.retainer-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.retainer-tier-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.retainer-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.retainer-tier-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.retainer-level {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.retainer-hp-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.retainer-hp-fill {
  height: 100%;
  background: var(--color-health, #8b1a1a);
  border-radius: 2px;
  transition: width 0.3s;
}

.retainer-hp-text {
  font-size: 9px;
  color: var(--color-text-dim);
  text-align: center;
}

/* Tier color classes */
.tier-iron { color: #7a7e8b; border-color: rgba(122, 126, 139, 0.3); }
.tier-steel { color: #a89b85; border-color: rgba(168, 155, 133, 0.3); }
.tier-cf { color: #c9a84c; border-color: rgba(201, 168, 76, 0.3); }
.tier-vs { color: #e0c878; border-color: rgba(224, 200, 120, 0.3); text-shadow: 0 0 6px rgba(224, 200, 120, 0.3); }
</style>
