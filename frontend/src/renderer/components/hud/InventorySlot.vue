<script setup lang="ts">
import type { InventoryItem } from '@/stores/character'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import { getItemIcon } from '@/utils/itemIcons'
import { getTierClass } from '@/utils/tierColors'
import { computed } from 'vue'

const props = defineProps<{
  item: InventoryItem | null
  slotIndex: number
}>()

const emit = defineEmits<{
  'hover-start': [item: InventoryItem, e: MouseEvent]
  'hover-move': [e: MouseEvent]
  'hover-end': []
  'context-menu': [item: InventoryItem, e: MouseEvent]
  'drop': [targetSlot: number, payload: DragPayload]
}>()

const { isDragging, dragPayload, startDrag, endDrag } = useItemDrag()

function tierClass(tier: number): string {
  return getTierClass(tier)
}

const itemIcon = computed(() => {
  if (!props.item) return null
  const wt = props.item.model_data?.weaponType as string | undefined
  return getItemIcon(props.item.item_key, { weaponType: wt, tier: props.item.tier, category: props.item.category })
})

// Is this slot the current drag source?
const isDragSource = computed(() => {
  if (!isDragging.value || !dragPayload.value) return false
  return dragPayload.value.source === 'inventory' && dragPayload.value.sourceSlot === props.slotIndex
})

// Is a drag currently hovering over this slot?
const isDropTarget = computed(() => {
  return isDragging.value && !isDragSource.value
})

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || !props.item) return
  startDrag(e, {
    source: 'inventory',
    inventoryItem: props.item,
    sourceSlot: props.slotIndex,
  })
}

function onMouseUp(): void {
  if (!isDragging.value) return
  const payload = endDrag()
  if (payload) {
    emit('drop', props.slotIndex, payload)
  }
}

function onMouseEnter(e: MouseEvent): void {
  if (props.item && !isDragging.value) {
    emit('hover-start', props.item, e)
  }
}

function onMouseMove(e: MouseEvent): void {
  if (props.item && !isDragging.value) {
    emit('hover-move', e)
  }
}

function onMouseLeave(): void {
  emit('hover-end')
}

function onContextMenu(e: MouseEvent): void {
  e.preventDefault()
  if (props.item) {
    emit('hover-end')
    emit('context-menu', props.item, e)
  }
}
</script>

<template>
  <div
    class="inv-slot"
    :class="[
      item ? tierClass(item.tier) : 'inv-slot--empty',
      { 'inv-slot--drag-source': isDragSource, 'inv-slot--drop-hover': isDropTarget },
    ]"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @contextmenu="onContextMenu"
  >
    <template v-if="item">
      <!-- Item icon -->
      <img
        :src="itemIcon!"
        :alt="item.name"
        class="inv-slot__icon"
      />

      <!-- Quantity badge -->
      <span v-if="item.quantity > 1" class="inv-slot__qty">
        {{ item.quantity }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.inv-slot {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
  transition: all var(--transition-fast);
  cursor: default;
  user-select: none;
}

.inv-slot--empty {
  border-style: dashed;
  border-color: var(--color-border-dim);
  box-shadow: var(--shadow-inset-dark);
}

.inv-slot:not(.inv-slot--empty):not(.inv-slot--drag-source):hover {
  transform: scale(1.06);
  z-index: 2;
}

.inv-slot--drag-source {
  opacity: 0.3;
}

.inv-slot--drop-hover {
  border-color: var(--color-gold) !important;
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.4) !important;
}

/* Tier border colors */
.tier-1 {
  border-color: #9d9d9d;
}
.tier-1:not(.inv-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(157, 157, 157, 0.4);
}

.tier-2 {
  border-color: #4a9e4a;
}
.tier-2:not(.inv-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(74, 158, 74, 0.4);
}

.tier-3 {
  border-color: #3a7bd5;
}
.tier-3:not(.inv-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(58, 123, 213, 0.4);
}

.tier-4 {
  border-color: #9b32d4;
}
.tier-4:not(.inv-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(155, 50, 212, 0.4);
}

.tier-5 {
  border-color: #ffc22f;
  box-shadow: 0 0 8px rgba(255, 194, 47, 0.5);
}
.tier-5:not(.inv-slot--drag-source):hover {
  box-shadow: 0 0 16px rgba(255, 194, 47, 0.7);
}

/* Item icon */
.inv-slot__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  border-radius: inherit;
}

/* Quantity badge */
.inv-slot__qty {
  position: absolute;
  bottom: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-gold-light);
  line-height: 1;
  pointer-events: none;
}
</style>
