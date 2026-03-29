<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLootStore, type LootItem } from '@/stores/loot'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import ItemTooltip from './ItemTooltip.vue'

const lootStore = useLootStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging: isPanelDragging, onDragStart } = useDraggable('loot', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['loot']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
})

const readyCount = computed(() => lootStore.players.filter(p => p.is_ready).length)
const totalPlayers = computed(() => lootStore.players.length)

const timeRemaining = computed(() => {
  if (!lootStore.pool) return ''
  const expires = new Date(lootStore.pool.hard_expires_at).getTime()
  const now = Date.now()
  const diff = expires - now
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${mins}m`
})

function formatCopper(amount: number): string {
  const dragons = Math.floor(amount / 10000)
  const stags = Math.floor((amount % 10000) / 100)
  if (dragons > 0) return `${dragons} GD ${stags > 0 ? stags + 's' : ''}`
  if (stags > 0) return `${stags} stags`
  return `${amount}c`
}

function rarityClass(rarity: string): string {
  return `rarity-${rarity}`
}

function tierPips(tier: number): string {
  return '\u2726'.repeat(tier)
}

// Tooltip
const tooltipItem = ref<LootItem | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

function onHoverStart(item: LootItem, e: MouseEvent): void {
  tooltipItem.value = item
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}
function onHoverMove(e: MouseEvent): void {
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}
function onHoverEnd(): void {
  tooltipItem.value = null
}

function emitReady(): void {
  lootStore.setReady()
  // The actual socket emit is handled by the parent via the store
  window.dispatchEvent(new CustomEvent('loot:ready', { detail: { poolId: lootStore.pool?.id } }))
}

function close(): void {
  lootStore.closeLoot()
}
</script>

<template>
  <div
    ref="panelRef"
    class="loot-panel panel-ornate animate-fade-in"
    :class="{ 'is-dragging': isPanelDragging }"
    :style="panelStyle"
  >
    <!-- Header -->
    <div class="loot-header" @mousedown="onDragStart">
      <span class="loot-title">Spoils of War</span>
      <span class="loot-timer dim">{{ timeRemaining }}</span>
      <button v-if="lootStore.isResolved" class="loot-close" @click="close">&times;</button>
    </div>

    <!-- Status bar -->
    <div class="loot-status">
      <span class="dim">Players ready: {{ readyCount }} / {{ totalPlayers }}</span>
      <span v-if="lootStore.isResolved" class="loot-resolved-badge">Resolved</span>
    </div>

    <!-- Item categories -->
    <div class="loot-body">
      <template v-for="[label, catItems] in [
        ['Weapons', lootStore.weaponItems],
        ['Armor', lootStore.armorItems],
        ['Shields', lootStore.shieldItems],
        ['Other', lootStore.otherItems],
      ] as [string, LootItem[]][]" :key="label">
        <div v-if="catItems.length > 0" class="loot-category">
          <div class="loot-cat-header">{{ label }} ({{ catItems.length }})</div>
          <div v-for="item in catItems" :key="item.id"
            class="loot-item"
            :class="{
              'loot-item--claimed': lootStore.myClaims.has(item.id),
              'loot-item--won': lootStore.isResolved && item.status === 'claimed',
              'loot-item--sold': lootStore.isResolved && item.status === 'sold',
            }"
            @click="!lootStore.isResolved && lootStore.toggleClaim(item.id)"
            @mouseenter="onHoverStart(item, $event)"
            @mousemove="onHoverMove"
            @mouseleave="onHoverEnd"
          >
            <div class="loot-item-check">
              <template v-if="!lootStore.isResolved">
                <span v-if="lootStore.myClaims.has(item.id)" class="check-on">&#9745;</span>
                <span v-else class="check-off">&#9744;</span>
              </template>
              <template v-else>
                <span v-if="item.status === 'claimed'" class="check-won">&#10003;</span>
                <span v-else-if="item.status === 'sold'" class="check-sold">&#8212;</span>
              </template>
            </div>
            <div class="loot-item-info">
              <span class="loot-item-name" :class="rarityClass(item.rarity)">{{ item.name }}</span>
              <span class="loot-item-tier dim">{{ tierPips(item.tier) }}</span>
            </div>
            <span class="loot-item-price mono dim">{{ formatCopper(item.base_price) }}</span>
            <div v-if="lootStore.isResolved && item.winning_roll" class="loot-item-roll mono">
              {{ item.winning_roll }}
            </div>
          </div>
        </div>
      </template>

      <!-- Coin split -->
      <div class="loot-category">
        <div class="loot-cat-header">Coin</div>
        <div class="loot-coin-row">
          <span class="gold">{{ formatCopper(lootStore.pool?.total_coin ?? 0) }}</span>
          <span class="dim">from fallen enemies (split evenly)</span>
        </div>
        <div v-if="lootStore.isResolved && lootStore.pool?.auto_sell_coin" class="loot-coin-row">
          <span class="gold">+ {{ formatCopper(lootStore.pool.auto_sell_coin) }}</span>
          <span class="dim">from unclaimed item sales</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="loot-footer">
      <template v-if="!lootStore.isResolved">
        <span class="dim" style="font-size: var(--font-size-xs)">{{ lootStore.claimedCount }} items selected</span>
        <button
          class="loot-ready-btn"
          :class="{ 'loot-ready-btn--done': lootStore.isReady }"
          :disabled="lootStore.isReady"
          @click="emitReady"
        >
          {{ lootStore.isReady ? 'Waiting...' : 'Ready' }}
        </button>
      </template>
      <template v-else>
        <button class="loot-close-btn" @click="close">Close</button>
      </template>
    </div>
  </div>

  <!-- Tooltip would go here if LootItem mapped to InventoryItem, but for now skip -->
</template>

<style scoped>
.loot-panel {
  width: 420px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  max-height: 600px;
}

.loot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}
.loot-header:active { cursor: grabbing; }
.loot-panel.is-dragging { z-index: 1000; }

.loot-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.loot-timer { font-family: var(--font-mono); font-size: var(--font-size-xs); }

.loot-close {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  font-size: var(--font-size-lg); color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}
.loot-close:hover { color: var(--color-text); background: var(--color-surface-hover); }

.loot-status {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
  font-size: var(--font-size-xs);
}

.loot-resolved-badge {
  color: #4a9e4a; font-weight: 700; text-transform: uppercase;
  font-size: 9px; letter-spacing: 0.1em;
}

.loot-body {
  overflow-y: auto;
  max-height: 420px;
  padding: var(--space-xs) 0;
}

.loot-category { margin-bottom: var(--space-xs); }

.loot-cat-header {
  padding: 2px var(--space-md);
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-dim);
}

.loot-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.loot-item:hover { background: var(--color-surface-hover); }
.loot-item--claimed { background: rgba(201, 168, 76, 0.06); }
.loot-item--won { background: rgba(74, 158, 74, 0.08); }
.loot-item--sold { opacity: 0.5; }

.loot-item-check { width: 18px; text-align: center; font-size: 14px; }
.check-on { color: var(--color-gold); }
.check-off { color: var(--color-text-dim); }
.check-won { color: #4a9e4a; font-weight: 700; }
.check-sold { color: var(--color-text-dim); }

.loot-item-info { flex: 1; display: flex; align-items: center; gap: var(--space-xs); min-width: 0; }
.loot-item-name { font-size: var(--font-size-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.loot-item-tier { font-size: 10px; }
.loot-item-price { font-size: var(--font-size-xs); white-space: nowrap; }
.loot-item-roll { font-size: var(--font-size-xs); color: var(--color-gold); width: 28px; text-align: right; }

/* Rarity colors */
.rarity-common { color: var(--color-text); }
.rarity-uncommon { color: #5b9bd5; }
.rarity-rare { color: var(--color-gold); }
.rarity-epic { color: #a855f7; }
.rarity-legendary { color: #ef4444; }

.loot-coin-row {
  padding: 4px var(--space-md);
  display: flex; gap: var(--space-sm);
  font-size: var(--font-size-sm);
}

.loot-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border);
}

.loot-ready-btn {
  padding: 4px 16px;
  background: none;
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  color: var(--color-gold);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.loot-ready-btn:hover { background: rgba(201,168,76,0.12); border-color: var(--color-gold); }
.loot-ready-btn--done { opacity: 0.5; cursor: default; border-style: dashed; }
.loot-ready-btn:disabled { cursor: not-allowed; }

.loot-close-btn {
  padding: 4px 16px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.loot-close-btn:hover { background: var(--color-surface-hover); }

.gold { color: var(--color-gold); }
.dim { color: var(--color-text-dim); }
.mono { font-family: var(--font-mono); }
</style>
