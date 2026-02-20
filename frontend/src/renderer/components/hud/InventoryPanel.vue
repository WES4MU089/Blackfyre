<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharacterStore, type InventoryItem, type EquippedItem } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import InventorySlot from './InventorySlot.vue'
import ItemTooltip from './ItemTooltip.vue'
import ItemContextMenu from './ItemContextMenu.vue'
import dragonIcon from '@res/images/art/Currency/dragon.png'
import stagIcon from '@res/images/art/Currency/stag.png'
import starIcon from '@res/images/art/Currency/star.png'

const characterStore = useCharacterStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging: isPanelDragging, onDragStart } = useDraggable('inventory', panelRef, { alwaysDraggable: true })
const { isDragging: isItemDragging, dragPayload } = useItemDrag()

const TOTAL_SLOTS = 25

// Currency denominations: 1 Dragon = 100 Stags, 1 Stag = 100 Stars
const dragons = computed(() => Math.floor(characterStore.finances.cash / 10000))
const stags = computed(() => Math.floor((characterStore.finances.cash % 10000) / 100))
const stars = computed(() => characterStore.finances.cash % 100)

// Map inventory items by slot number (1-25)
const slotMap = computed(() => {
  const map = new Map<number, InventoryItem>()
  for (const item of characterStore.inventory) {
    if (item.slot_number >= 1 && item.slot_number <= TOTAL_SLOTS) {
      map.set(item.slot_number, item)
    }
  }
  return map
})

// Total weight
const totalWeight = computed(() => {
  return characterStore.inventory.reduce((sum, item) => sum + item.weight * item.quantity, 0)
})

function formatWeight(w: number): string {
  return w % 1 === 0 ? w.toString() : w.toFixed(1)
}

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['inventory']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function close() {
  hudStore.toggleSystemPanel('inventory')
}

// --- Tooltip state ---
const tooltipItem = ref<InventoryItem | EquippedItem | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

function onHoverStart(item: InventoryItem, e: MouseEvent): void {
  tooltipItem.value = item
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverMove(e: MouseEvent): void {
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverEnd(): void {
  tooltipItem.value = null
}

// --- Context menu state ---
const ctxItem = ref<InventoryItem | null>(null)
const ctxPos = ref({ x: 0, y: 0 })

function onContextMenu(item: InventoryItem, e: MouseEvent): void {
  tooltipItem.value = null
  ctxItem.value = item
  ctxPos.value = { x: e.clientX, y: e.clientY }
}

function closeContextMenu(): void {
  ctxItem.value = null
}

async function onContextAction(action: string): Promise<void> {
  if (!ctxItem.value) return
  const item = ctxItem.value
  closeContextMenu()

  switch (action) {
    case 'equip':
      if (item.slot_type) {
        await characterStore.equipItem(item.inventory_id, item.slot_type)
      }
      break
    case 'use':
      await characterStore.useItem(item.inventory_id)
      break
    case 'drop':
      await characterStore.dropItem(item.inventory_id)
      break
    case 'unequip':
      // shouldn't happen from inventory, but handle it
      break
    case 'inspect':
      // Show tooltip persistently (for now, just log)
      console.log('Inspect:', item)
      break
    case 'give':
      // TODO: open give dialog
      hudStore.addNotification('info', 'Give', 'Trade system coming soon')
      break
  }
}

// --- Drop handling ---
async function onDrop(targetSlot: number, payload: DragPayload): Promise<void> {
  if (payload.source === 'inventory' && payload.sourceSlot != null) {
    // Inventory → Inventory: move/swap
    if (payload.sourceSlot !== targetSlot) {
      await characterStore.moveItem(payload.sourceSlot, targetSlot)
    }
  } else if (payload.source === 'equipment' && payload.equipmentSlotId) {
    // Equipment → Inventory: unequip to target slot
    await characterStore.unequipItem(payload.equipmentSlotId, targetSlot)
  }
}

// --- Sort ---
function sortByType(): void {
  characterStore.sortInventory('type')
}

function sortByName(): void {
  characterStore.sortInventory('name')
}
</script>

<template>
  <div
    ref="panelRef"
    class="inventory-panel panel-ornate animate-fade-in"
    :class="{ 'is-dragging': isPanelDragging }"
    :style="panelStyle"
  >
    <!-- Header (drag handle) -->
    <div class="inv-header" @mousedown="onDragStart">
      <span class="inv-title">Inventory</span>
      <button class="inv-close" @click="close" title="Close">&times;</button>
    </div>

    <!-- Currency row -->
    <div class="inv-currency">
      <div class="currency-item">
        <img :src="dragonIcon" alt="Gold Dragons" class="currency-icon" />
        <span class="currency-value currency-gold">{{ dragons.toLocaleString() }}</span>
      </div>
      <div class="currency-divider" />
      <div class="currency-item">
        <img :src="stagIcon" alt="Silver Stags" class="currency-icon" />
        <span class="currency-value currency-silver">{{ stags.toLocaleString() }}</span>
      </div>
      <div class="currency-divider" />
      <div class="currency-item">
        <img :src="starIcon" alt="Copper Stars" class="currency-icon" />
        <span class="currency-value currency-copper">{{ stars.toLocaleString() }}</span>
      </div>
    </div>

    <!-- Sort buttons -->
    <div class="inv-sort">
      <span class="inv-sort__label">Sort:</span>
      <button class="inv-sort__btn" @click="sortByType">Type</button>
      <button class="inv-sort__btn" @click="sortByName">Name</button>
    </div>

    <!-- 5x5 Inventory Grid -->
    <div class="inv-grid">
      <InventorySlot
        v-for="i in TOTAL_SLOTS"
        :key="i"
        :item="slotMap.get(i) ?? null"
        :slot-index="i"
        @hover-start="onHoverStart"
        @hover-move="onHoverMove"
        @hover-end="onHoverEnd"
        @context-menu="onContextMenu"
        @drop="onDrop"
      />
    </div>

    <!-- Weight footer -->
    <div class="inv-footer">
      <span class="inv-weight">
        Weight: {{ formatWeight(totalWeight) }} / 100.0 kg
      </span>
    </div>
  </div>

  <!-- Tooltip (teleported to body) -->
  <ItemTooltip
    v-if="tooltipItem && !isItemDragging"
    :item="tooltipItem"
    :x="tooltipPos.x"
    :y="tooltipPos.y"
  />

  <!-- Context menu (teleported to body) -->
  <ItemContextMenu
    v-if="ctxItem"
    :item="ctxItem"
    source="inventory"
    :x="ctxPos.x"
    :y="ctxPos.y"
    @action="onContextAction"
    @close="closeContextMenu"
  />
</template>

<style scoped>
.inventory-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

/* Header (drag handle) */
.inv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.inv-header:active {
  cursor: grabbing;
}

.inventory-panel.is-dragging {
  z-index: 1000;
}

.inv-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.inv-close {
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

.inv-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Currency */
.inv-currency {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.currency-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.currency-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.currency-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.currency-gold { color: var(--color-gold); }
.currency-silver { color: #b8c4d0; }
.currency-copper { color: #c48a5a; }

.currency-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-dim);
}

/* Sort row */
.inv-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.inv-sort__label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.inv-sort__btn {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  transition: all var(--transition-fast);
}

.inv-sort__btn:hover {
  color: var(--color-gold-light);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

/* Grid */
.inv-grid {
  display: grid;
  grid-template-columns: repeat(5, 64px);
  grid-template-rows: repeat(5, 64px);
  gap: 4px;
  padding: var(--space-sm);
  justify-content: center;
}

/* Footer */
.inv-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: var(--space-xs) var(--space-md);
  border-top: 1px solid var(--color-border-dim);
}

.inv-weight {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}
</style>
