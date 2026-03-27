<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHoldingsStore } from '@/stores/holdings'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import HoldingCard from './HoldingCard.vue'
import HoldingDetail from './HoldingDetail.vue'

const holdingsStore = useHoldingsStore()
const hudStore = useHudStore()

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('holdings', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['holdings']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const holdingCount = computed(() => holdingsStore.holdings.length)

onMounted(() => {
  holdingsStore.fetchHoldings()
})

async function openDetail(holdingId: number): Promise<void> {
  await holdingsStore.fetchHoldingDetail(holdingId)
}

function close(): void {
  holdingsStore.clearSelection()
  hudStore.toggleSystemPanel('holdings')
}

function backToList(): void {
  holdingsStore.clearSelection()
}
</script>

<template>
  <div class="holdings-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="holdings-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
      <!-- Header (drag handle) -->
      <div class="holdings-panel-header" @mousedown="onDragStart">
        <div class="holdings-panel-header-left">
          <button
            v-if="holdingsStore.selectedHolding"
            class="holdings-panel-back"
            @click="backToList"
            title="Back to list"
          >&larr;</button>
          <span class="holdings-panel-title">
            {{ holdingsStore.selectedHolding ? holdingsStore.selectedHolding.name : 'Holdings' }}
          </span>
        </div>
        <div class="holdings-panel-header-right">
          <span v-if="!holdingsStore.selectedHolding" class="holdings-panel-count">{{ holdingCount }}</span>
          <button class="holdings-panel-close" @click="close" title="Close">&times;</button>
        </div>
      </div>

      <!-- List view -->
      <template v-if="!holdingsStore.selectedHolding">
        <div class="holdings-panel-body">
          <div v-if="holdingsStore.isLoading" class="holdings-loading">Loading...</div>

          <div v-else-if="holdingCount > 0" class="holdings-list">
            <HoldingCard
              v-for="h in holdingsStore.holdings"
              :key="h.id"
              :holding="h"
              @select="openDetail"
            />
          </div>

          <div v-else class="holdings-empty">
            <span class="holdings-empty-text">No holdings under your control.</span>
          </div>
        </div>
      </template>

      <!-- Detail view -->
      <template v-else>
        <HoldingDetail />
      </template>
    </div>
  </div>
</template>

<style scoped>
.holdings-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  pointer-events: none;
}

.holdings-panel {
  width: 420px;
  max-height: 650px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.holdings-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.holdings-panel-header:active {
  cursor: grabbing;
}

.holdings-panel-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.holdings-panel-back {
  background: none;
  border: none;
  color: var(--color-gold);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.holdings-panel-back:hover { color: var(--color-text); }

.holdings-panel-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.holdings-panel-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.holdings-panel-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.holdings-panel-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.holdings-panel-close:hover { color: var(--color-text); }

.holdings-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

.holdings-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.holdings-loading {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-dim);
  font-size: var(--font-size-sm);
}

.holdings-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xl) var(--space-md);
  text-align: center;
}

.holdings-empty-text {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}
</style>
