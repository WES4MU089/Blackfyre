<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'

const props = defineProps<{
  areaId: string
  label?: string
  alwaysDraggable?: boolean
}>()

const hudStore = useHudStore()
const areaRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable(
  props.areaId,
  areaRef,
  props.alwaysDraggable ? { alwaysDraggable: true } : undefined
)

const hasCustomPosition = computed(() => {
  const pos = hudStore.hudPositions[props.areaId]
  return pos != null && pos.x != null && pos.y != null
})

const positionStyle = computed(() => {
  const pos = hudStore.hudPositions[props.areaId]
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    zIndex: isDragging.value ? 1000 : undefined,
  }
})
</script>

<template>
  <div
    ref="areaRef"
    class="draggable-area"
    :class="{
      'is-edit-mode': hudStore.layoutEditMode,
      'is-dragging': isDragging,
      'has-custom-position': hasCustomPosition,
    }"
    :style="positionStyle"
  >
    <!-- Drag handle (only visible in edit mode) -->
    <div
      v-if="hudStore.layoutEditMode"
      class="drag-handle"
      @mousedown="onDragStart"
    >
      <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" opacity="0.6">
        <circle cx="2" cy="1" r="1" /><circle cx="5" cy="1" r="1" /><circle cx="8" cy="1" r="1" />
        <circle cx="2" cy="5" r="1" /><circle cx="5" cy="5" r="1" /><circle cx="8" cy="5" r="1" />
      </svg>
      <span class="drag-label">{{ label || areaId }}</span>
    </div>

    <slot :drag-start="onDragStart" />
  </div>
</template>

<style scoped>
.draggable-area {
  pointer-events: auto;
}

.draggable-area.is-edit-mode {
  outline: 1px dashed var(--color-gold-dim);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.draggable-area.is-dragging {
  outline-color: var(--color-gold);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.3);
}

.drag-handle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  cursor: grab;
  background: rgba(201, 168, 76, 0.1);
  border-bottom: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  color: var(--color-gold-dim);
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-label {
  font-family: var(--font-display);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-gold-dim);
}
</style>
