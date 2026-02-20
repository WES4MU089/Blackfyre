<script setup lang="ts">
import type { EquippedItem } from '@/stores/character'
import { useItemDrag, canEquipToSlot, type DragPayload } from '@/composables/useItemDrag'
import { getItemIcon } from '@/utils/itemIcons'
import { computed } from 'vue'

const props = defineProps<{
  slotId: string
  slotLabel: string
  item: EquippedItem | null
}>()

const emit = defineEmits<{
  'hover-start': [item: EquippedItem, e: MouseEvent]
  'hover-move': [e: MouseEvent]
  'hover-end': []
  'context-menu': [item: EquippedItem, e: MouseEvent]
  'drop': [slotId: string, payload: DragPayload]
}>()

const { isDragging, dragPayload, startDrag, endDrag } = useItemDrag()

function rarityClass(rarity: string): string {
  switch (rarity) {
    case 'uncommon': return 'rarity-uncommon'
    case 'rare': return 'rarity-rare'
    case 'epic': return 'rarity-epic'
    case 'legendary': return 'rarity-legendary'
    default: return 'rarity-common'
  }
}

const itemIcon = computed(() => props.item ? getItemIcon(props.item.itemKey) : null)

// Is this slot the current drag source?
const isDragSource = computed(() => {
  if (!isDragging.value || !dragPayload.value) return false
  return dragPayload.value.source === 'equipment' && dragPayload.value.equipmentSlotId === props.slotId
})

// Can the dragged item be dropped here?
const isValidDrop = computed(() => {
  if (!isDragging.value || !dragPayload.value || isDragSource.value) return false
  if (dragPayload.value.source === 'inventory' && dragPayload.value.inventoryItem) {
    return canEquipToSlot(dragPayload.value.inventoryItem.slot_type, props.slotId)
  }
  // Equipment-to-equipment drag: only allow if same slot group
  if (dragPayload.value.source === 'equipment' && dragPayload.value.equippedItem) {
    return canEquipToSlot(dragPayload.value.equippedItem.slotType, props.slotId)
  }
  return false
})

const isInvalidDrop = computed(() => {
  return isDragging.value && !isDragSource.value && !isValidDrop.value
    && dragPayload.value?.source === 'inventory'
    && !!dragPayload.value?.inventoryItem?.slot_type
})

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || !props.item) return
  startDrag(e, {
    source: 'equipment',
    equippedItem: props.item,
    equipmentSlotId: props.slotId,
  })
}

function onMouseUp(): void {
  if (!isDragging.value || !isValidDrop.value) return
  const payload = endDrag()
  if (payload) {
    emit('drop', props.slotId, payload)
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
    class="equip-slot"
    :class="[
      item ? rarityClass(item.rarity) : 'equip-slot--empty',
      {
        'equip-slot--drag-source': isDragSource,
        'equip-slot--drop-valid': isValidDrop,
        'equip-slot--drop-invalid': isInvalidDrop,
      },
    ]"
    @mousedown="onMouseDown"
    @mouseup="onMouseUp"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @contextmenu="onContextMenu"
  >
    <template v-if="item">
      <img
        :src="itemIcon!"
        :alt="item.itemName"
        class="equip-slot__icon"
      />
    </template>
    <template v-else>
      <span class="equip-slot__label">{{ slotLabel }}</span>
    </template>
  </div>
</template>

<style scoped>
.equip-slot {
  width: 56px;
  height: 56px;
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

.equip-slot--empty {
  border-style: dashed;
  border-color: var(--color-border-dim);
  box-shadow: var(--shadow-inset-dark);
}

.equip-slot:not(.equip-slot--empty):not(.equip-slot--drag-source):hover {
  transform: scale(1.06);
  z-index: 2;
}

.equip-slot--drag-source {
  opacity: 0.3;
}

.equip-slot--drop-valid {
  border-color: #4a9e4a !important;
  box-shadow: 0 0 10px rgba(74, 158, 74, 0.5) !important;
  border-style: solid !important;
}

.equip-slot--drop-invalid {
  border-color: rgba(139, 26, 26, 0.5) !important;
  background: rgba(139, 26, 26, 0.08);
}

/* Rarity border colors */
.rarity-common {
  border-color: var(--color-border);
}

.rarity-uncommon {
  border-color: #4a9e4a;
}
.rarity-uncommon:not(.equip-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(74, 158, 74, 0.4);
}

.rarity-rare {
  border-color: #3a7bd5;
}
.rarity-rare:not(.equip-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(58, 123, 213, 0.4);
}

.rarity-epic {
  border-color: #9b32d4;
}
.rarity-epic:not(.equip-slot--drag-source):hover {
  box-shadow: 0 0 8px rgba(155, 50, 212, 0.4);
}

.rarity-legendary {
  border-color: var(--color-gold);
  box-shadow: 0 0 4px rgba(201, 168, 76, 0.3);
}
.rarity-legendary:not(.equip-slot--drag-source):hover {
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.5);
}

/* Item icon */
.equip-slot__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  border-radius: inherit;
}

/* Empty slot label */
.equip-slot__label {
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  user-select: none;
  text-align: center;
  line-height: 1.2;
  padding: 2px;
  pointer-events: none;
}
</style>
