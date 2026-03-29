<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVaultStore, type VaultItem } from '@/stores/vault'
import { useCharacterStore, type InventoryItem } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import { getSocket } from '@/composables/useSocket'
import InventorySlot from './InventorySlot.vue'
import ItemTooltip from './ItemTooltip.vue'

const vaultStore = useVaultStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging: isPanelDragging, onDragStart } = useDraggable('vault', panelRef, { alwaysDraggable: true })
const { isDragging: isItemDragging } = useItemDrag()

const VAULT_TIER_NAMES: Record<number, string> = {
  1: 'Iron Strongbox',
  2: 'Reinforced Chest',
  3: 'Vault Chamber',
  4: 'Grand Vault',
}

const UPGRADE_COSTS: Record<number, number> = { 2: 10000, 3: 25000, 4: 50000 }
const UPGRADE_SLOTS: Record<number, number> = { 2: 50, 3: 75, 4: 100 }

// Map vault items to InventoryItem shape for InventorySlot compatibility
const slotMap = computed(() => {
  const map = new Map<number, InventoryItem>()
  for (const item of vaultStore.items) {
    if (item.slot_number >= 1 && item.slot_number <= vaultStore.slots) {
      map.set(item.slot_number, toInventoryItem(item))
    }
  }
  return map
})

function toInventoryItem(vi: VaultItem): InventoryItem {
  return {
    inventory_id: vi.vault_item_id,
    item_id: vi.item_id,
    item_key: vi.item_key,
    name: vi.name,
    description: vi.description ?? undefined,
    icon_url: vi.icon_url ?? undefined,
    category: vi.category,
    rarity: vi.rarity,
    tier: vi.tier,
    material: vi.material ?? undefined,
    slot_type: vi.slot_type ?? undefined,
    is_two_handed: vi.is_two_handed,
    weight: vi.weight,
    max_stack: vi.max_stack,
    is_usable: false,
    is_tradeable: false,
    base_price: 0,
    model_data: vi.model_data ?? undefined,
    quantity: vi.quantity,
    slot_number: vi.slot_number,
    durability: vi.durability,
    metadata: vi.metadata ?? undefined,
  }
}

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['vault']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const gridRows = computed(() => Math.ceil(vaultStore.slots / 5))

const canUpgrade = computed(() => vaultStore.tier < 4)
const nextTierCost = computed(() => UPGRADE_COSTS[vaultStore.tier + 1] ?? 0)
const nextTierSlots = computed(() => UPGRADE_SLOTS[vaultStore.tier + 1] ?? 0)

function close() {
  getSocket()?.emit('vault:close')
  vaultStore.closeVault()
}

function upgrade() {
  getSocket()?.emit('vault:upgrade')
}

// --- Tooltip ---
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

// --- Drop: inventory → vault ---
async function onDrop(targetSlot: number, payload: DragPayload): Promise<void> {
  if (payload.source === 'inventory' && payload.inventoryItem) {
    getSocket()?.emit('vault:store', {
      inventoryId: payload.inventoryItem.inventory_id,
      targetSlot,
    })
  }
}

// --- Right-click to retrieve ---
function onContextMenu(item: InventoryItem, e: MouseEvent): void {
  e.preventDefault()
  const vaultItem = vaultStore.items.find(vi => vi.vault_item_id === item.inventory_id)
  if (!vaultItem) return
  getSocket()?.emit('vault:retrieve', { vaultItemId: vaultItem.vault_item_id })
}
</script>

<template>
  <div
    ref="panelRef"
    class="vault-panel panel-ornate animate-fade-in"
    :class="{ 'is-dragging': isPanelDragging }"
    :style="panelStyle"
  >
    <!-- Header -->
    <div class="vlt-header" @mousedown="onDragStart">
      <span class="vlt-title">{{ VAULT_TIER_NAMES[vaultStore.tier] ?? 'Vault' }}</span>
      <button class="vlt-close" @click="close" title="Close">&times;</button>
    </div>

    <!-- Info bar -->
    <div class="vlt-info">
      <span class="vlt-capacity">{{ vaultStore.itemCount }} / {{ vaultStore.slots }}</span>
      <div class="vlt-controls">
        <button v-if="canUpgrade" class="vlt-upgrade-btn" @click="upgrade" :title="`Expand to ${nextTierSlots} slots (${nextTierCost.toLocaleString()} copper)`">
          Expand ({{ nextTierCost.toLocaleString() }}c)
        </button>
        <span class="vlt-hint">Right-click to retrieve</span>
      </div>
    </div>

    <!-- Vault Grid -->
    <div class="vlt-grid" :style="{ gridTemplateRows: `repeat(${gridRows}, 64px)` }">
      <InventorySlot
        v-for="i in vaultStore.slots"
        :key="i"
        :item="slotMap.get(i) ?? null"
        :slot-index="i"
        drag-source="vault"
        @hover-start="onHoverStart"
        @hover-move="onHoverMove"
        @hover-end="onHoverEnd"
        @context-menu="onContextMenu"
        @drop="onDrop"
      />
    </div>

    <!-- Message -->
    <div v-if="vaultStore.lastMessage" class="vlt-message" :class="vaultStore.lastMessage.success ? 'vlt-message--ok' : 'vlt-message--err'">
      {{ vaultStore.lastMessage.text }}
    </div>
  </div>

  <!-- Tooltip -->
  <ItemTooltip
    v-if="tooltipItem && !isItemDragging"
    :item="tooltipItem"
    :x="tooltipPos.x"
    :y="tooltipPos.y"
  />
</template>

<style scoped>
.vault-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.vlt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.vlt-header:active { cursor: grabbing; }
.vault-panel.is-dragging { z-index: 1000; }

.vlt-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vlt-close {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  font-size: var(--font-size-lg); color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.vlt-close:hover { color: var(--color-text); background: var(--color-surface-hover); }

.vlt-info {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.vlt-capacity {
  font-family: var(--font-mono); font-size: var(--font-size-xs);
  color: var(--color-text-muted); letter-spacing: 0.04em;
}

.vlt-controls { display: flex; align-items: center; gap: 8px; }

.vlt-upgrade-btn {
  padding: 1px 8px; background: none;
  border: 1px solid var(--color-gold-dim); border-radius: var(--radius-sm);
  cursor: pointer; font-family: var(--font-body); font-size: 9px;
  color: var(--color-gold); letter-spacing: 0.06em; text-transform: uppercase;
  transition: all var(--transition-fast);
}
.vlt-upgrade-btn:hover { background: rgba(201,168,76,0.12); border-color: var(--color-gold); }

.vlt-hint {
  font-family: var(--font-body); font-size: 9px;
  color: var(--color-text-dim); letter-spacing: 0.04em;
}

.vlt-grid {
  display: grid; grid-template-columns: repeat(5, 64px);
  gap: 4px; padding: var(--space-sm); justify-content: center;
  max-height: 400px; overflow-y: auto;
}

.vlt-message {
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-body); font-size: var(--font-size-xs);
  text-align: center; border-top: 1px solid var(--color-border-dim);
}
.vlt-message--ok { color: #4a9e4a; }
.vlt-message--err { color: var(--color-crimson); }
</style>
