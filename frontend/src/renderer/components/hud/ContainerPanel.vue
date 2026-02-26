<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useContainerStore, type ContainerItem } from '@/stores/container'
import { useCharacterStore, type InventoryItem } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import { getSocket } from '@/composables/useSocket'
import InventorySlot from './InventorySlot.vue'
import ItemTooltip from './ItemTooltip.vue'

const containerStore = useContainerStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging: isPanelDragging, onDragStart } = useDraggable('container', panelRef, { alwaysDraggable: true })
const { isDragging: isItemDragging } = useItemDrag()

// --- Rename state ---
const isRenaming = ref(false)
const renameInput = ref('')

function startRename(): void {
  renameInput.value = containerStore.name
  isRenaming.value = true
}

function cancelRename(): void {
  isRenaming.value = false
}

function submitRename(): void {
  const trimmed = renameInput.value.trim()
  if (!trimmed || trimmed === containerStore.name || !containerStore.containerId) {
    isRenaming.value = false
    return
  }
  getSocket()?.emit('container:rename', {
    containerId: containerStore.containerId,
    name: trimmed,
  })
  isRenaming.value = false
}

// Close rename if container closes
watch(() => containerStore.isOpen, (open) => {
  if (!open) isRenaming.value = false
})

// --- Lock/Unlock ---
function toggleLock(): void {
  if (!containerStore.containerId) return
  const event = containerStore.isLocked ? 'container:unlock' : 'container:lock'
  getSocket()?.emit(event, { containerId: containerStore.containerId })
}

// Map container items to InventoryItem shape for InventorySlot compatibility
const slotMap = computed(() => {
  const map = new Map<number, InventoryItem>()
  for (const item of containerStore.items) {
    if (item.slot_number >= 1 && item.slot_number <= containerStore.capacity) {
      map.set(item.slot_number, toInventoryItem(item))
    }
  }
  return map
})

/** Convert ContainerItem to InventoryItem so we can reuse InventorySlot */
function toInventoryItem(ci: ContainerItem): InventoryItem {
  return {
    inventory_id: ci.container_inventory_id,
    item_id: ci.item_id,
    item_key: ci.item_key,
    name: ci.name,
    description: ci.description ?? undefined,
    icon_url: ci.icon_url ?? undefined,
    category: ci.category,
    rarity: ci.rarity,
    tier: ci.tier,
    material: ci.material ?? undefined,
    slot_type: ci.slot_type ?? undefined,
    is_two_handed: ci.is_two_handed,
    weight: ci.weight,
    max_stack: ci.max_stack,
    is_usable: false,
    is_tradeable: false,
    base_price: 0,
    model_data: ci.model_data ?? undefined,
    quantity: ci.quantity,
    slot_number: ci.slot_number,
    durability: ci.durability,
    metadata: ci.metadata ?? undefined,
  }
}

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['container']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

// Compute grid rows based on capacity (5 columns)
const gridRows = computed(() => Math.ceil(containerStore.capacity / 5))

function close() {
  getSocket()?.emit('container:close')
  containerStore.closeContainer()
}

// --- Tooltip state ---
const tooltipItem = ref<InventoryItem | null>(null)
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

// --- Drop handling ---
async function onDrop(targetSlot: number, payload: DragPayload): Promise<void> {
  if (!containerStore.containerId) return

  if (payload.source === 'inventory' && payload.inventoryItem) {
    // Inventory → Container: store item
    getSocket()?.emit('container:store', {
      containerId: containerStore.containerId,
      inventoryId: payload.inventoryItem.inventory_id,
      targetSlot,
    })
  } else if (payload.source === 'container' && payload.inventoryItem) {
    // Container → Container: not supported (would need a move handler)
    // For now, ignore same-source drops
  }
}

// --- Click to retrieve ---
function onContextMenu(item: InventoryItem, e: MouseEvent): void {
  e.preventDefault()
  if (!containerStore.containerId) return

  // Find the ContainerItem by matching container_inventory_id
  const containerItem = containerStore.items.find(
    ci => ci.container_inventory_id === item.inventory_id,
  )
  if (!containerItem) return

  // Retrieve item to player's inventory
  getSocket()?.emit('container:retrieve', {
    containerId: containerStore.containerId,
    containerInventoryId: containerItem.container_inventory_id,
  })
}
</script>

<template>
  <div
    ref="panelRef"
    class="container-panel panel-ornate animate-fade-in"
    :class="{ 'is-dragging': isPanelDragging }"
    :style="panelStyle"
  >
    <!-- Header (drag handle) -->
    <div class="ctr-header" @mousedown="onDragStart">
      <!-- Inline rename or static title -->
      <div v-if="isRenaming" class="ctr-rename" @mousedown.stop>
        <input
          v-model="renameInput"
          class="ctr-rename__input"
          maxlength="100"
          @keydown.enter="submitRename"
          @keydown.escape="cancelRename"
          @vue:mounted="($event: any) => $event.el.focus()"
        />
        <button class="ctr-rename__btn ctr-rename__ok" @click="submitRename" title="Save">&#10003;</button>
        <button class="ctr-rename__btn ctr-rename__cancel" @click="cancelRename" title="Cancel">&#10005;</button>
      </div>
      <span v-else class="ctr-title" :class="{ 'ctr-title--editable': containerStore.isOwner }" @dblclick="containerStore.isOwner && startRename()">
        {{ containerStore.name }}
      </span>
      <button class="ctr-close" @click="close" title="Close">&times;</button>
    </div>

    <!-- Description -->
    <div v-if="containerStore.description" class="ctr-desc">
      {{ containerStore.description }}
    </div>

    <!-- Capacity + owner controls -->
    <div class="ctr-info">
      <span class="ctr-capacity">{{ containerStore.itemCount }} / {{ containerStore.capacity }}</span>
      <div class="ctr-controls">
        <button v-if="containerStore.isOwner" class="ctr-lock-btn" :class="containerStore.isLocked ? 'ctr-lock-btn--locked' : 'ctr-lock-btn--unlocked'" @click="toggleLock" :title="containerStore.isLocked ? 'Unlock' : 'Lock'">
          {{ containerStore.isLocked ? 'Locked' : 'Unlocked' }}
        </button>
        <span v-else-if="containerStore.isLocked" class="ctr-lock-badge">Locked</span>
        <span class="ctr-hint">Right-click to retrieve</span>
      </div>
    </div>

    <!-- Container Grid -->
    <div
      class="ctr-grid"
      :style="{ gridTemplateRows: `repeat(${gridRows}, 64px)` }"
    >
      <InventorySlot
        v-for="i in containerStore.capacity"
        :key="i"
        :item="slotMap.get(i) ?? null"
        :slot-index="i"
        drag-source="container"
        :container-id="containerStore.containerId ?? undefined"
        @hover-start="onHoverStart"
        @hover-move="onHoverMove"
        @hover-end="onHoverEnd"
        @context-menu="onContextMenu"
        @drop="onDrop"
      />
    </div>

    <!-- Message feedback -->
    <div v-if="containerStore.lastMessage" class="ctr-message" :class="containerStore.lastMessage.success ? 'ctr-message--ok' : 'ctr-message--err'">
      {{ containerStore.lastMessage.text }}
    </div>
  </div>

  <!-- Tooltip (teleported to body) -->
  <ItemTooltip
    v-if="tooltipItem && !isItemDragging"
    :item="tooltipItem"
    :x="tooltipPos.x"
    :y="tooltipPos.y"
  />
</template>

<style scoped>
.container-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

/* Header (drag handle) */
.ctr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.ctr-header:active {
  cursor: grabbing;
}

.container-panel.is-dragging {
  z-index: 1000;
}

.ctr-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ctr-title--editable {
  cursor: text;
  border-bottom: 1px dashed transparent;
  transition: border-color var(--transition-fast);
}

.ctr-title--editable:hover {
  border-bottom-color: var(--color-gold-dim);
}

/* Inline rename */
.ctr-rename {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ctr-rename__input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  outline: none;
}

.ctr-rename__input:focus {
  border-color: var(--color-gold);
}

.ctr-rename__btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 10px;
  transition: all var(--transition-fast);
}

.ctr-rename__ok {
  color: #4a9e4a;
}

.ctr-rename__ok:hover {
  background: rgba(74, 158, 74, 0.15);
  border-color: rgba(74, 158, 74, 0.4);
}

.ctr-rename__cancel {
  color: var(--color-text-muted);
}

.ctr-rename__cancel:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.ctr-close {
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

.ctr-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Description */
.ctr-desc {
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  font-style: italic;
  border-bottom: 1px solid var(--color-border-dim);
}

/* Info row */
.ctr-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.ctr-capacity {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.ctr-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctr-lock-btn {
  padding: 1px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}

.ctr-lock-btn--unlocked {
  color: #4a9e4a;
  border-color: rgba(74, 158, 74, 0.3);
}

.ctr-lock-btn--unlocked:hover {
  background: rgba(74, 158, 74, 0.12);
  border-color: rgba(74, 158, 74, 0.5);
}

.ctr-lock-btn--locked {
  color: var(--color-crimson-light);
  border-color: rgba(139, 26, 26, 0.3);
}

.ctr-lock-btn--locked:hover {
  background: rgba(139, 26, 26, 0.12);
  border-color: rgba(139, 26, 26, 0.5);
}

.ctr-lock-badge {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-crimson-light);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ctr-hint {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 0.04em;
}

/* Grid */
.ctr-grid {
  display: grid;
  grid-template-columns: repeat(5, 64px);
  gap: 4px;
  padding: var(--space-sm);
  justify-content: center;
}

/* Message feedback */
.ctr-message {
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  text-align: center;
  border-top: 1px solid var(--color-border-dim);
}

.ctr-message--ok {
  color: #4a9e4a;
}

.ctr-message--err {
  color: var(--color-crimson);
}
</style>
