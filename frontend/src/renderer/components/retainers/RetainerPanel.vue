<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import RetainerCard from './RetainerCard.vue'
import RetainerDetail from './RetainerDetail.vue'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('retainers', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['retainers']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const retainerCount = computed(() => characterStore.retainers.length)

onMounted(() => {
  characterStore.fetchRetainers()
})

async function openDetail(retainerId: number): Promise<void> {
  await characterStore.fetchRetainerDetail(retainerId)
}

function close(): void {
  characterStore.clearRetainerDetail()
  hudStore.toggleSystemPanel('retainers')
}
</script>

<template>
  <div class="retainer-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="retainer-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
      <!-- Header (drag handle) -->
      <div class="retainer-panel-header" @mousedown="onDragStart">
        <span class="retainer-panel-title">Retainers</span>
        <div class="retainer-panel-header-right">
          <span class="retainer-panel-count">{{ retainerCount }} / 4</span>
          <button class="retainer-panel-close" @click="close" title="Close">&times;</button>
        </div>
      </div>

      <!-- List view (when no detail is open) -->
      <template v-if="!characterStore.retainerDetail">
        <div class="retainer-panel-body">
          <div v-if="retainerCount > 0" class="retainer-list">
            <RetainerCard
              v-for="ret in characterStore.retainers"
              :key="ret.id"
              :retainer="ret"
              @select="openDetail"
            />
          </div>

          <div v-else class="retainer-empty">
            <span class="retainer-empty-text">No retainers in service.</span>
            <span class="retainer-empty-hint">Visit the Retainer Captain to hire fighters.</span>
          </div>
        </div>
      </template>

      <!-- Detail view -->
      <template v-else>
        <RetainerDetail />
      </template>
    </div>
  </div>
</template>

<style scoped>
.retainer-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  pointer-events: none;
}

.retainer-panel {
  width: 360px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.retainer-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.retainer-panel-header:active {
  cursor: grabbing;
}

.retainer-panel-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.retainer-panel-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.retainer-panel-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.retainer-panel-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.retainer-panel-close:hover { color: var(--color-text); }

.retainer-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

.retainer-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.retainer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xl) var(--space-md);
  text-align: center;
}

.retainer-empty-text {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.retainer-empty-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
