<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'
import { useHudStore } from '@/stores/hud'
import ApplicationQueue from './ApplicationQueue.vue'
import ApplicationReview from './ApplicationReview.vue'

const adminStore = useAdminStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('admin', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'admin', panelRef,
  { minWidth: 360, maxWidth: 900, minHeight: 300, maxHeight: 900 },
)

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['admin']
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  return { position: 'fixed' as const, right: '20px', top: '90px' }
})

const sizeStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))

function close() {
  adminStore.closePanel()
}
</script>

<template>
  <div class="admin-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="admin-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing }"
      :style="sizeStyle"
    >
      <!-- Header -->
      <div class="admin-header" @mousedown="onDragStart">
        <span class="admin-header-title">Staff Panel</span>
        <button class="admin-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Tab bar (future: Family Trees, Bio Review) -->
      <div class="admin-tabs">
        <button class="admin-tab admin-tab--active">Applications</button>
      </div>

      <!-- Body -->
      <div class="admin-body">
        <ApplicationQueue v-if="adminStore.activeView === 'queue'" />
        <ApplicationReview v-if="adminStore.activeView === 'detail'" />
      </div>

      <!-- Resize handle -->
      <div class="admin-resize-handle" @mousedown="onResizeStart">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
          <circle cx="10" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="6" r="1.2" />
          <circle cx="10" cy="2" r="1.2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-panel-wrapper {
  pointer-events: none;
}

.admin-panel {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: relative;
}

.admin-panel.is-dragging,
.admin-panel.is-resizing {
  z-index: 1000;
}

/* Header */
.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.admin-header:active {
  cursor: grabbing;
}

.admin-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.admin-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.admin-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Tabs */
.admin-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.admin-tab {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}

.admin-tab:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.admin-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

/* Body */
.admin-body {
  padding: var(--space-sm) 0;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

/* Resize handle */
.admin-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-text-muted);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.admin-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
