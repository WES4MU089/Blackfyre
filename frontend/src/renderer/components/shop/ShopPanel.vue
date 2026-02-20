<script setup lang="ts">
import { ref, computed } from 'vue'
import { useShopStore, type ShopItem, type ShopCategory } from '@/stores/shop'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { getSocket } from '@/composables/useSocket'
import { getTierColor } from '@/utils/tierColors'
import ItemTooltip from '@/components/hud/ItemTooltip.vue'
import dragonIcon from '@res/images/art/Currency/dragon.png'
import stagIcon from '@res/images/art/Currency/stag.png'
import starIcon from '@res/images/art/Currency/star.png'

const shopStore = useShopStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { onDragStart } = useDraggable('shop', panelRef, { alwaysDraggable: true })

// Currency breakdown from shop's playerCash
const dragons = computed(() => Math.floor(shopStore.playerCash / 10000))
const stags = computed(() => Math.floor((shopStore.playerCash % 10000) / 100))
const stars = computed(() => shopStore.playerCash % 100)

// Inventory space
const inventorySlotsFree = computed(() => {
  const used = characterStore.inventory.length
  return 25 - used
})

// Tooltip state
const tooltipItem = ref<ShopItem | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

function onHoverStart(item: ShopItem, e: MouseEvent): void {
  tooltipItem.value = item
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverMove(e: MouseEvent): void {
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverEnd(): void {
  tooltipItem.value = null
}

function formatPrice(totalStars: number): string {
  const d = Math.floor(totalStars / 10000)
  const s = Math.floor((totalStars % 10000) / 100)
  const c = totalStars % 100
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (s) parts.push(`${s}s`)
  if (c || parts.length === 0) parts.push(`${c}c`)
  return parts.join(' ')
}

function getStatSummary(item: ShopItem): string {
  if (!item.model_data) return ''
  const m = item.model_data
  const parts: string[] = []
  if (m.baseDamage != null) parts.push(`${m.baseDamage} dmg`)
  if (m.penetration != null) parts.push(`${m.penetration} pen`)
  if (m.mitigation != null) parts.push(`${m.mitigation} mit`)
  if (m.blockBonus != null) parts.push(`+${m.blockBonus} block`)
  if (m.encumbrance != null && Number(m.encumbrance) !== 0) parts.push(`${m.encumbrance} enc`)
  return parts.join('  /  ')
}

function getItemColor(item: ShopItem): string {
  return getTierColor(item.tier)
}

function buyItem(itemKey: string): void {
  if (shopStore.buyingItemKey) return
  shopStore.setBuying(itemKey)
  getSocket()?.emit('shop:buy', { itemKey })
}

function close(): void {
  getSocket()?.emit('shop:close')
  shopStore.closeShop()
}

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['shop']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})
</script>

<template>
  <div class="shop-wrapper">
    <div ref="panelRef" class="shop-panel panel-ornate animate-fade-in" :style="panelStyle">
      <!-- Header -->
      <div class="shop-header" @mousedown="onDragStart">
        <div class="shop-identity">
          <div class="shop-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 11h.01M15 11h.01M9 15h6" />
            </svg>
          </div>
          <div class="shop-name-block">
            <span class="shop-name">{{ shopStore.npcName }}</span>
            <span class="shop-role">Merchant</span>
          </div>
        </div>
        <button class="shop-close" @click="close">&times;</button>
      </div>

      <!-- Currency row -->
      <div class="shop-currency">
        <span class="shop-currency__label">Your Purse:</span>
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
        <div class="currency-divider" />
        <span class="shop-slots">{{ inventorySlotsFree }} slots free</span>
      </div>

      <!-- Category tabs -->
      <div class="shop-tabs">
        <button
          v-for="cat in shopStore.categories"
          :key="cat.key"
          class="shop-tab"
          :class="{ active: shopStore.activeCategory === cat.key }"
          @click="shopStore.setCategory(cat.key)"
        >
          {{ cat.label }}
          <span class="shop-tab__count">{{ cat.count }}</span>
        </button>
      </div>

      <!-- Item list -->
      <div class="shop-items">
        <div
          v-for="item in shopStore.activeItems"
          :key="item.item_key"
          class="shop-item"
          :class="{
            'cannot-afford': !shopStore.canAfford(item.base_price),
            'is-buying': shopStore.buyingItemKey === item.item_key,
          }"
          @mouseenter="onHoverStart(item, $event)"
          @mousemove="onHoverMove"
          @mouseleave="onHoverEnd"
        >
          <!-- Item icon -->
          <div class="shop-item__icon">
            <img v-if="item.icon_url" :src="item.icon_url" :alt="item.name" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <path d="M14 2l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h8z" />
            </svg>
          </div>

          <!-- Item details -->
          <div class="shop-item__info">
            <div class="shop-item__name" :style="{ color: getItemColor(item) }">
              {{ item.name }}
              <span v-if="item.is_two_handed" class="shop-item__tag">2H</span>
            </div>
            <div class="shop-item__stats">{{ getStatSummary(item) }}</div>
          </div>

          <!-- Price + buy -->
          <div class="shop-item__action">
            <span class="shop-item__price" :class="{ unaffordable: !shopStore.canAfford(item.base_price) }">
              {{ formatPrice(item.base_price) }}
            </span>
            <button
              class="shop-item__buy"
              :disabled="!shopStore.canAfford(item.base_price) || inventorySlotsFree <= 0 || shopStore.buyingItemKey !== null"
              @click.stop="buyItem(item.item_key)"
            >
              {{ shopStore.buyingItemKey === item.item_key ? '...' : 'Buy' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Status message -->
      <div v-if="shopStore.lastMessage" class="shop-message" :class="{ success: shopStore.lastMessage.success, failure: !shopStore.lastMessage.success }">
        {{ shopStore.lastMessage.text }}
      </div>

      <!-- Footer -->
      <div class="shop-footer">
        <span class="shop-footer__hint">Hover items for details</span>
      </div>
    </div>

    <!-- Tooltip -->
    <ItemTooltip
      v-if="tooltipItem"
      :item="tooltipItem"
      :x="tooltipPos.x"
      :y="tooltipPos.y"
    />
  </div>
</template>

<style scoped>
.shop-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 160;
}

.shop-panel {
  width: 480px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
}

/* ── Header ── */

.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.shop-header:active {
  cursor: grabbing;
}

.shop-identity {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.shop-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-gold-dim);
  background: var(--color-surface-dark);
  color: var(--color-gold-dim);
  padding: 6px;
  flex-shrink: 0;
}

.shop-icon svg {
  width: 100%;
  height: 100%;
}

.shop-name-block {
  display: flex;
  flex-direction: column;
}

.shop-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.shop-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.shop-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 var(--space-xs);
  line-height: 1;
  transition: color var(--transition-fast);
}

.shop-close:hover {
  color: var(--color-crimson-light);
}

/* ── Currency ── */

.shop-currency {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.shop-currency__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  margin-right: var(--space-xs);
}

.currency-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.currency-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.currency-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.currency-gold { color: var(--color-gold); }
.currency-silver { color: #b8c4d0; }
.currency-copper { color: #c48a5a; }

.currency-divider {
  width: 1px;
  height: 16px;
  background: var(--color-border-dim);
}

.shop-slots {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  letter-spacing: 0.04em;
}

/* ── Category tabs ── */

.shop-tabs {
  display: flex;
  gap: 2px;
  padding: var(--space-xs) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.shop-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  transition: all var(--transition-fast);
}

.shop-tab:hover {
  color: var(--color-gold-light);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.05);
}

.shop-tab.active {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.1);
}

.shop-tab__count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* ── Item list ── */

.shop-items {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs) var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 200px;
  max-height: 360px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.shop-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.shop-item:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-dim);
}

.shop-item.cannot-afford .shop-item__name {
  color: var(--color-crimson-light) !important;
}

.shop-item.cannot-afford .shop-item__action {
  opacity: 0.4;
}

.shop-item.is-buying {
  opacity: 0.7;
  pointer-events: none;
}

.shop-item__icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface-dark);
  flex-shrink: 0;
  overflow: hidden;
}

.shop-item__icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.shop-item__icon svg {
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
}

.shop-item__info {
  flex: 1;
  min-width: 0;
}

.shop-item__name {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 6px;
}

.shop-item__tag {
  font-family: var(--font-mono);
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
}

.shop-item__stats {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.03em;
  margin-top: 1px;
}

.shop-item__action {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.shop-item__price {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-gold-dim);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.shop-item__price.unaffordable {
  color: var(--color-crimson-light);
}

.shop-item__buy {
  padding: 3px 12px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-gold);
  letter-spacing: 0.06em;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.shop-item__buy:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
  color: var(--color-gold-light);
}

.shop-item__buy:active:not(:disabled) {
  background: rgba(201, 168, 76, 0.3);
}

.shop-item__buy:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Status message ── */

.shop-message {
  padding: var(--space-xs) var(--space-md);
  font-size: var(--font-size-sm);
  text-align: center;
  letter-spacing: 0.04em;
  border-top: 1px solid var(--color-border-dim);
}

.shop-message.success {
  color: var(--color-success);
}

.shop-message.failure {
  color: var(--color-crimson-light);
}

/* ── Footer ── */

.shop-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs) var(--space-md);
  border-top: 1px solid var(--color-border-dim);
}

.shop-footer__hint {
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  font-style: italic;
}
</style>
