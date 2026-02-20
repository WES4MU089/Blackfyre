<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'
import TurnIndicator from './TurnIndicator.vue'
import TargetInfoPanel from './TargetInfoPanel.vue'
import ActionBar from './ActionBar.vue'
import CombatLog from './CombatLog.vue'

const props = defineProps<{
  sessionOver: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const hudStore = useHudStore()

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('combat-controls', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'combat-controls', panelRef,
  { minWidth: 320, maxWidth: 600, minHeight: 360, maxHeight: 700 },
)

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['combat-controls']
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  // Default: centered
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
  return {
    position: 'fixed' as const,
    left: `${Math.round(vw / 2 - 180)}px`,
    top: `${Math.round(vh / 2 - 240)}px`,
  }
})

const sizeStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))
</script>

<template>
  <div class="combat-controls-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="combat-controls panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing }"
      :style="sizeStyle"
    >
      <!-- Header -->
      <div class="controls-header" @mousedown="onDragStart">
        <span class="controls-title">Combat</span>
        <button
          v-if="sessionOver"
          class="controls-close"
          title="Close combat panel"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <!-- Turn Indicator -->
      <div class="controls-turn">
        <TurnIndicator />
      </div>

      <!-- Target Info -->
      <div class="controls-target-info">
        <TargetInfoPanel />
      </div>

      <!-- Action Bar -->
      <div class="controls-actions">
        <ActionBar />
      </div>

      <!-- Combat Log -->
      <div class="controls-log">
        <CombatLog />
      </div>

      <!-- Resize handle -->
      <div class="controls-resize-handle" @mousedown="onResizeStart">
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
.combat-controls-wrapper {
  pointer-events: none;
}

.combat-controls {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
  position: relative;
}

.combat-controls.is-dragging {
  z-index: 1000;
}

/* Header */
.controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.controls-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.controls-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 var(--space-xs);
  line-height: 1;
}
.controls-close:hover {
  color: var(--color-gold);
}

/* Turn indicator section */
.controls-turn {
  padding: var(--space-xs) var(--space-md);
  flex-shrink: 0;
}

/* Target info section */
.controls-target-info {
  padding: 0 var(--space-md);
  margin-top: var(--space-xs);
  flex-shrink: 0;
}

/* Actions section */
.controls-actions {
  padding: 0 var(--space-md);
  border-top: 1px solid var(--color-border-dim);
  margin-top: var(--space-xs);
  flex-shrink: 0;
}

/* Log section — fills remaining vertical space */
.controls-log {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-xs) var(--space-md) var(--space-sm);
  overflow: hidden;
}

/* Resize handle */
.controls-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-gold-dark);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.controls-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
