<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTradeStore } from '@/stores/trade'
import { useCharacterStore, type InventoryItem } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import { getSocket } from '@/composables/useSocket'
import InventorySlot from './InventorySlot.vue'
import ItemTooltip from './ItemTooltip.vue'
import dragonIcon from '@res/images/art/Currency/dragon.png'
import stagIcon from '@res/images/art/Currency/stag.png'
import starIcon from '@res/images/art/Currency/star.png'

const tradeStore = useTradeStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging: isPanelDragging, onDragStart } = useDraggable('trade', panelRef, { alwaysDraggable: true })
const { isDragging: isItemDragging } = useItemDrag()

const OFFER_SLOTS = 12

// Coin input state
const coinInputMode = ref(false)
const coinDragons = ref(0)
const coinStags = ref(0)
const coinStars = ref(0)

// My offer items mapped to slot grid
const mySlotMap = computed(() => {
  const map = new Map<number, InventoryItem>()
  tradeStore.myItems.forEach((item, idx) => {
    map.set(idx + 1, item as unknown as InventoryItem)
  })
  return map
})

// Partner offer items mapped to slot grid
const partnerSlotMap = computed(() => {
  const map = new Map<number, InventoryItem>()
  tradeStore.partnerItems.forEach((item, idx) => {
    map.set(idx + 1, item as unknown as InventoryItem)
  })
  return map
})

// Currency breakdown helpers
function toDenominations(copper: number) {
  return {
    dragons: Math.floor(copper / 10000),
    stags: Math.floor((copper % 10000) / 100),
    stars: copper % 100,
  }
}

const myCoinsDisplay = computed(() => toDenominations(tradeStore.myCoins))
const partnerCoinsDisplay = computed(() => toDenominations(tradeStore.partnerCoins))

// My purse for max validation
const myPurse = computed(() => characterStore.finances.purse)

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['trade']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function close(): void {
  getSocket()?.emit('trade:cancel')
  tradeStore.closeTrade()
}

// --- Coin editing ---
function openCoinInput(): void {
  if (tradeStore.myReady) return
  const d = toDenominations(tradeStore.myCoins)
  coinDragons.value = d.dragons
  coinStags.value = d.stags
  coinStars.value = d.stars
  coinInputMode.value = true
}

function submitCoins(): void {
  const total = (coinDragons.value * 10000) + (coinStags.value * 100) + coinStars.value
  if (total < 0) return
  if (total > myPurse.value) {
    tradeStore.setMessage(false, 'Not enough coin in purse')
    return
  }
  getSocket()?.emit('trade:set-coins', { coins: total })
  coinInputMode.value = false
}

function cancelCoinInput(): void {
  coinInputMode.value = false
}

// Close coin input if trade state changes
watch(() => tradeStore.myReady, () => {
  coinInputMode.value = false
})

// --- Item offer via drop ---
function onMyOfferDrop(_targetSlot: number, payload: DragPayload): void {
  if (tradeStore.myReady) return
  if (payload.source === 'inventory' && payload.inventoryItem) {
    const item = payload.inventoryItem
    if (!item.is_tradeable) {
      tradeStore.setMessage(false, 'This item cannot be traded')
      return
    }
    getSocket()?.emit('trade:offer-item', {
      inventoryId: item.inventory_id,
      quantity: item.quantity,
    })
  }
}

// --- Remove item from offer via right-click ---
function onMyOfferContext(item: InventoryItem, e: MouseEvent): void {
  e.preventDefault()
  if (tradeStore.myReady) return
  getSocket()?.emit('trade:remove-item', { inventoryId: item.inventory_id })
}

// --- Ready / Unready ---
function toggleReady(): void {
  getSocket()?.emit('trade:ready', { ready: !tradeStore.myReady })
}

// --- Confirm (both ready) ---
function confirmTrade(): void {
  getSocket()?.emit('trade:confirm')
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

// Auto-open inventory when trade starts
watch(() => tradeStore.isOpen, (open) => {
  if (open && !hudStore.isPanelOpen('inventory')) {
    hudStore.toggleSystemPanel('inventory')
  }
})
</script>

<template>
  <div
    ref="panelRef"
    class="trade-panel panel-ornate animate-fade-in"
    :class="{ 'is-dragging': isPanelDragging }"
    :style="panelStyle"
  >
    <!-- Header -->
    <div class="trd-header" @mousedown="onDragStart">
      <span class="trd-title">Trade</span>
      <span class="trd-partner">{{ tradeStore.partnerCharacterName }}</span>
      <button class="trd-close" @click="close" title="Cancel Trade">&times;</button>
    </div>

    <div class="trd-body">
      <!-- My Offer (left side) -->
      <div class="trd-side">
        <div class="trd-side-label">Your Offer</div>

        <!-- My item grid -->
        <div class="trd-grid">
          <InventorySlot
            v-for="i in OFFER_SLOTS"
            :key="'my-' + i"
            :item="mySlotMap.get(i) ?? null"
            :slot-index="i"
            drag-source="trade-my"
            @hover-start="onHoverStart"
            @hover-move="onHoverMove"
            @hover-end="onHoverEnd"
            @context-menu="onMyOfferContext"
            @drop="onMyOfferDrop"
          />
        </div>

        <!-- My coins -->
        <div class="trd-coins" @click="openCoinInput">
          <template v-if="!coinInputMode">
            <div class="trd-coin-row" v-if="tradeStore.myCoins > 0 || true">
              <span class="trd-coin-item" v-if="myCoinsDisplay.dragons > 0">
                <img :src="dragonIcon" class="trd-coin-icon" /> {{ myCoinsDisplay.dragons }}
              </span>
              <span class="trd-coin-item" v-if="myCoinsDisplay.stags > 0">
                <img :src="stagIcon" class="trd-coin-icon" /> {{ myCoinsDisplay.stags }}
              </span>
              <span class="trd-coin-item" v-if="myCoinsDisplay.stars > 0 || tradeStore.myCoins === 0">
                <img :src="starIcon" class="trd-coin-icon" /> {{ myCoinsDisplay.stars }}
              </span>
            </div>
            <span class="trd-coin-edit-hint" v-if="!tradeStore.myReady">click to edit</span>
          </template>
          <template v-else>
            <div class="trd-coin-inputs" @click.stop>
              <label class="trd-coin-input-group">
                <img :src="dragonIcon" class="trd-coin-icon" />
                <input type="number" v-model.number="coinDragons" min="0" class="trd-coin-field" />
              </label>
              <label class="trd-coin-input-group">
                <img :src="stagIcon" class="trd-coin-icon" />
                <input type="number" v-model.number="coinStags" min="0" max="99" class="trd-coin-field" />
              </label>
              <label class="trd-coin-input-group">
                <img :src="starIcon" class="trd-coin-icon" />
                <input type="number" v-model.number="coinStars" min="0" max="99" class="trd-coin-field" />
              </label>
              <div class="trd-coin-btns">
                <button class="trd-coin-ok" @click.stop="submitCoins">Set</button>
                <button class="trd-coin-cancel" @click.stop="cancelCoinInput">Cancel</button>
              </div>
            </div>
          </template>
        </div>

        <!-- Ready state -->
        <div class="trd-ready-row">
          <button
            class="trd-ready-btn"
            :class="{ 'trd-ready-btn--active': tradeStore.myReady }"
            @click="toggleReady"
          >
            {{ tradeStore.myReady ? 'Ready' : 'Lock In' }}
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="trd-divider" />

      <!-- Partner Offer (right side) -->
      <div class="trd-side trd-side--partner">
        <div class="trd-side-label">Their Offer</div>

        <!-- Partner item grid (read-only) -->
        <div class="trd-grid">
          <InventorySlot
            v-for="i in OFFER_SLOTS"
            :key="'partner-' + i"
            :item="partnerSlotMap.get(i) ?? null"
            :slot-index="i"
            drag-source="trade-partner"
            @hover-start="onHoverStart"
            @hover-move="onHoverMove"
            @hover-end="onHoverEnd"
          />
        </div>

        <!-- Partner coins -->
        <div class="trd-coins trd-coins--partner">
          <div class="trd-coin-row">
            <span class="trd-coin-item" v-if="partnerCoinsDisplay.dragons > 0">
              <img :src="dragonIcon" class="trd-coin-icon" /> {{ partnerCoinsDisplay.dragons }}
            </span>
            <span class="trd-coin-item" v-if="partnerCoinsDisplay.stags > 0">
              <img :src="stagIcon" class="trd-coin-icon" /> {{ partnerCoinsDisplay.stags }}
            </span>
            <span class="trd-coin-item" v-if="partnerCoinsDisplay.stars > 0 || tradeStore.partnerCoins === 0">
              <img :src="starIcon" class="trd-coin-icon" /> {{ partnerCoinsDisplay.stars }}
            </span>
          </div>
        </div>

        <!-- Partner ready state -->
        <div class="trd-ready-row">
          <span class="trd-ready-indicator" :class="{ 'trd-ready-indicator--active': tradeStore.partnerReady }">
            {{ tradeStore.partnerReady ? 'Ready' : 'Waiting...' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Confirm bar (visible when both ready) -->
    <div v-if="tradeStore.bothReady" class="trd-confirm-bar">
      <button class="trd-confirm-btn" @click="confirmTrade">Confirm Trade</button>
    </div>

    <!-- Hints -->
    <div class="trd-footer">
      <span v-if="!tradeStore.myReady" class="trd-hint">Drag items from inventory. Right-click to remove.</span>
      <span v-else-if="!tradeStore.partnerReady" class="trd-hint">Waiting for {{ tradeStore.partnerCharacterName }} to ready up...</span>
      <span v-else class="trd-hint trd-hint--confirm">Both ready. Confirm to complete the trade.</span>
    </div>

    <!-- Message -->
    <div v-if="tradeStore.lastMessage" class="trd-message" :class="tradeStore.lastMessage.success ? 'trd-message--ok' : 'trd-message--err'">
      {{ tradeStore.lastMessage.text }}
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
.trade-panel {
  width: 520px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.trd-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}
.trd-header:active { cursor: grabbing; }
.trade-panel.is-dragging { z-index: 1000; }

.trd-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.trd-partner {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex: 1;
}

.trd-close {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  font-size: var(--font-size-lg); color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.trd-close:hover { color: var(--color-text); background: var(--color-surface-hover); }

.trd-body {
  display: flex;
  gap: 0;
  padding: var(--space-xs) 0;
}

.trd-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--space-xs);
}

.trd-side-label {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: var(--space-xs);
}

.trd-divider {
  width: 1px;
  background: var(--color-border-dim);
  align-self: stretch;
  margin: var(--space-xs) 0;
}

.trd-grid {
  display: grid;
  grid-template-columns: repeat(4, 52px);
  gap: 3px;
  justify-content: center;
}

/* Coins */
.trd-coins {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: var(--space-xs);
  padding: 4px 8px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: rgba(201, 168, 76, 0.03);
  min-height: 28px;
  cursor: pointer;
  transition: border-color var(--transition-fast);
  width: 100%;
}
.trd-coins:hover { border-color: var(--color-gold-dim); }
.trd-coins--partner { cursor: default; }
.trd-coins--partner:hover { border-color: var(--color-border-dim); }

.trd-coin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.trd-coin-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.trd-coin-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.trd-coin-edit-hint {
  font-family: var(--font-body);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}

/* Coin input mode */
.trd-coin-inputs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.trd-coin-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.trd-coin-field {
  width: 54px;
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  text-align: right;
}
.trd-coin-field:focus { border-color: var(--color-gold-dim); outline: none; }
.trd-coin-field::-webkit-inner-spin-button,
.trd-coin-field::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

.trd-coin-btns {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 2px;
}

.trd-coin-ok,
.trd-coin-cancel {
  padding: 1px 10px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text);
  transition: all var(--transition-fast);
}
.trd-coin-ok { border-color: var(--color-gold-dim); color: var(--color-gold); }
.trd-coin-ok:hover { background: rgba(201, 168, 76, 0.12); }
.trd-coin-cancel:hover { background: var(--color-surface-hover); }

/* Ready */
.trd-ready-row {
  margin-top: var(--space-xs);
  display: flex;
  justify-content: center;
}

.trd-ready-btn {
  padding: 4px 20px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}
.trd-ready-btn:hover { border-color: var(--color-gold-dim); color: var(--color-gold); }
.trd-ready-btn--active {
  border-color: #2d8a4e;
  color: #4a9e4a;
  background: rgba(45, 138, 78, 0.1);
}
.trd-ready-btn--active:hover {
  border-color: var(--color-border);
  color: var(--color-text);
  background: none;
}

.trd-ready-indicator {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}
.trd-ready-indicator--active {
  color: #4a9e4a;
}

/* Confirm bar */
.trd-confirm-bar {
  padding: var(--space-xs) var(--space-md);
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.04);
}

.trd-confirm-btn {
  padding: 6px 32px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}
.trd-confirm-btn:hover {
  background: rgba(201, 168, 76, 0.2);
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.3);
}

/* Footer hints */
.trd-footer {
  padding: 3px var(--space-md);
  border-top: 1px solid var(--color-border-dim);
  text-align: center;
}

.trd-hint {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 0.04em;
}
.trd-hint--confirm { color: var(--color-gold-dim); }

/* Message */
.trd-message {
  padding: var(--space-xs) var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  text-align: center;
  border-top: 1px solid var(--color-border-dim);
}
.trd-message--ok { color: #4a9e4a; }
.trd-message--err { color: var(--color-crimson); }
</style>
