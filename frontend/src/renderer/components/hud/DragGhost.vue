<script setup lang="ts">
import { computed } from 'vue'
import { useItemDrag } from '@/composables/useItemDrag'
import { getItemIcon } from '@/utils/itemIcons'

const { dragPayload, dragPosition } = useItemDrag()

const name = computed(() => {
  if (!dragPayload.value) return ''
  if (dragPayload.value.source === 'inventory' && dragPayload.value.inventoryItem) {
    return dragPayload.value.inventoryItem.name
  }
  if (dragPayload.value.source === 'equipment' && dragPayload.value.equippedItem) {
    return dragPayload.value.equippedItem.itemName
  }
  return ''
})

const iconUrl = computed(() => {
  if (!dragPayload.value) return null
  if (dragPayload.value.source === 'inventory' && dragPayload.value.inventoryItem) {
    return getItemIcon(dragPayload.value.inventoryItem.item_key)
  }
  if (dragPayload.value.source === 'equipment' && dragPayload.value.equippedItem) {
    return getItemIcon(dragPayload.value.equippedItem.itemKey)
  }
  return null
})
</script>

<template>
  <Teleport to="body">
    <div
      class="drag-ghost"
      :style="{
        left: dragPosition.x - 24 + 'px',
        top: dragPosition.y - 24 + 'px',
      }"
    >
      <img v-if="iconUrl" :src="iconUrl" :alt="name" class="drag-ghost__icon" />
    </div>
  </Teleport>
</template>

<style scoped>
.drag-ghost {
  position: fixed;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 14, 10, 0.8);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 9998;
  opacity: 0.85;
}

.drag-ghost__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

</style>
