<script setup lang="ts">
import type { HoldingOverview } from '@/stores/holdings'

const props = defineProps<{
  holding: HoldingOverview
}>()

const emit = defineEmits<{
  select: [id: number]
}>()

const sizeLabels: Record<number, string> = { 1: 'Small', 2: 'Medium', 3: 'Large' }

function manpowerPercent(): number {
  return props.holding.manpower_max > 0
    ? (props.holding.manpower_current / props.holding.manpower_max) * 100
    : 0
}

function typeClass(): string {
  const map: Record<string, string> = {
    Military: 'type-military',
    Hybrid: 'type-hybrid',
    Civilian: 'type-civilian',
  }
  return map[props.holding.holding_type] ?? ''
}
</script>

<template>
  <button class="holding-card" @click="emit('select', holding.id)">
    <div class="holding-card-header">
      <span class="holding-name">{{ holding.name }}</span>
      <span class="holding-type-badge" :class="typeClass()">{{ holding.holding_type }}</span>
    </div>
    <div class="holding-card-meta">
      <span class="holding-size">{{ sizeLabels[holding.size] || 'Size ' + holding.size }}</span>
      <span v-if="holding.special_slot_name" class="holding-special">{{ holding.special_slot_name }}</span>
    </div>
    <div class="holding-card-stats">
      <div class="holding-stat">
        <span class="holding-stat-label">Manpower</span>
        <div class="holding-bar">
          <div class="holding-bar-fill manpower-fill" :style="{ width: manpowerPercent() + '%' }" />
        </div>
        <span class="holding-stat-value">{{ holding.manpower_current.toLocaleString() }} / {{ holding.manpower_max.toLocaleString() }}</span>
      </div>
    </div>
    <div v-if="holding.construction_count > 0" class="holding-card-construction">
      {{ holding.construction_count }} building{{ holding.construction_count > 1 ? 's' : '' }} under construction
    </div>
  </button>
</template>

<style scoped>
.holding-card {
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
.holding-card:hover {
  border-color: var(--color-gold);
  background: var(--color-surface-hover, rgba(201, 168, 76, 0.05));
}

.holding-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.holding-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.holding-type-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-bg);
}
.type-military { background: var(--color-crimson, #8b1a1a); color: #fff; }
.type-hybrid { background: var(--color-gold, #c9a84c); color: #1a1a1a; }
.type-civilian { background: #4a7c59; color: #fff; }

.holding-card-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.holding-special {
  color: var(--color-gold);
  font-style: italic;
}

.holding-card-stats {
  margin-top: 2px;
}

.holding-stat {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.holding-stat-label {
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  min-width: 60px;
}

.holding-bar {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
}

.holding-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.manpower-fill {
  background: linear-gradient(90deg, var(--color-gold), #e8c84c);
}

.holding-stat-value {
  font-size: 10px;
  color: var(--color-text-dim);
  min-width: 80px;
  text-align: right;
}

.holding-card-construction {
  font-size: 10px;
  color: var(--color-gold);
  font-style: italic;
  margin-top: 2px;
}
</style>
