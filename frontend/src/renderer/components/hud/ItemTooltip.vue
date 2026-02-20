<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { InventoryItem, EquippedItem } from '@/stores/character'
import type { ShopItem } from '@/stores/shop'
import { getTierColor } from '@/utils/tierColors'

type TooltipItem = InventoryItem | EquippedItem | ShopItem

const props = defineProps<{
  item: TooltipItem
  x: number
  y: number
}>()

const el = ref<HTMLElement | null>(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

// Unified field access — InventoryItem/ShopItem use snake_case, EquippedItem uses camelCase
// Use runtime field probing to handle all three types robustly
const i = computed(() => props.item as Record<string, unknown>)

const itemName = computed(() => (i.value.name ?? i.value.itemName ?? '') as string)
const description = computed(() => (i.value.description ?? '') as string)
const category = computed(() => (i.value.category ?? '') as string)
const rarity = computed(() => (i.value.rarity ?? '') as string)
const tier = computed(() => (i.value.tier ?? 1) as number)
const material = computed(() => (i.value.material ?? null) as string | null)
const weight = computed(() => (i.value.weight ?? 0) as number)
const basePrice = computed(() => (i.value.base_price ?? i.value.basePrice ?? 0) as number)
const modelData = computed(() => (i.value.model_data ?? i.value.modelData ?? null) as Record<string, number | boolean> | null)
const slotType = computed(() => (i.value.slot_type ?? i.value.slotType ?? null) as string | null)
const isTwoHanded = computed(() => (i.value.is_two_handed ?? i.value.isTwoHanded ?? false) as boolean)

// Inventory-only fields
const durability = computed(() => (i.value.durability ?? null) as number | null)
const isUsable = computed(() => (i.value.is_usable ?? false) as boolean)
const isTradeable = computed(() => (i.value.is_tradeable ?? true) as boolean)

const tierColor = computed(() => getTierColor(tier.value ?? 1))

const armorClass = computed(() => {
  if (category.value !== 'armor' || !modelData.value) return null
  const ac = (modelData.value as Record<string, unknown>).armorClass
  return ac ? String(ac) : null
})

const categoryLabel = computed(() => {
  const parts = [category.value.toUpperCase()]
  if (armorClass.value) parts.push(armorClass.value.toUpperCase())
  else if (slotType.value) parts.push(slotType.value.replace(/([A-Z])/g, ' $1').trim().toUpperCase())
  return parts.join(' \u00B7 ')
})

const tierLabel = computed(() => {
  if (!tier.value || tier.value === 0) return null
  const roman = ['', 'I', 'II', 'III', 'IV', 'V']
  const t = roman[tier.value] || tier.value.toString()
  const parts = [`Tier ${t}`]
  if (material.value) parts.push(material.value.charAt(0).toUpperCase() + material.value.slice(1).replace(/_/g, ' '))
  return parts.join(' \u00B7 ')
})

// Model data stats
const stats = computed(() => {
  if (!modelData.value) return []
  const entries: { label: string; value: string }[] = []
  const m = modelData.value as Record<string, number | boolean>
  if (m.baseDamage != null) entries.push({ label: 'Base Damage', value: String(m.baseDamage) })
  if (m.penetration != null) entries.push({ label: 'Penetration', value: String(m.penetration) })
  if (m.penMod != null) entries.push({ label: 'Pen Modifier', value: (m.penMod as number) >= 0 ? `+${m.penMod}` : String(m.penMod) })
  if (m.mitigation != null) entries.push({ label: 'Mitigation', value: String(m.mitigation) })
  if (m.blockBonus != null) entries.push({ label: 'Block Bonus', value: `+${m.blockBonus}` })
  if (m.encumbrance != null) entries.push({ label: 'Encumbrance', value: String(m.encumbrance) })
  if (m.speed != null) entries.push({ label: 'Speed', value: String(m.speed) })
  if (m.stamina != null) entries.push({ label: 'Stamina', value: String(m.stamina) })
  if (m.carryCapacity != null) entries.push({ label: 'Carry Capacity', value: String(m.carryCapacity) })
  if (m.chargeBonus != null) entries.push({ label: 'Charge Bonus', value: `+${m.chargeBonus}` })
  return entries
})

// Price in Westerosi currency
const priceLabel = computed(() => {
  if (!basePrice.value) return null
  const total = basePrice.value
  const dragons = Math.floor(total / 10000)
  const stags = Math.floor((total % 10000) / 100)
  const stars = total % 100
  const parts: string[] = []
  if (dragons) parts.push(`${dragons}d`)
  if (stags) parts.push(`${stags}s`)
  if (stars || parts.length === 0) parts.push(`${stars}c`)
  return parts.join(' ')
})

function positionTooltip(): void {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 12

  // Default: right of cursor
  let x = props.x + margin
  let y = props.y + margin

  // Flip left if overflows right
  if (x + rect.width > vw) {
    x = props.x - rect.width - margin
  }
  // Flip up if overflows bottom
  if (y + rect.height > vh) {
    y = props.y - rect.height - margin
  }
  // Clamp to viewport
  x = Math.max(4, Math.min(x, vw - rect.width - 4))
  y = Math.max(4, Math.min(y, vh - rect.height - 4))

  adjustedX.value = x
  adjustedY.value = y
}

// Re-position when cursor moves (props.x/y update from hover-move)
watch(() => [props.x, props.y], () => {
  positionTooltip()
})

onMounted(() => {
  requestAnimationFrame(positionTooltip)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="el"
      class="item-tooltip"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
    >
      <!-- Name -->
      <div class="tooltip-name" :style="{ color: tierColor }">{{ itemName }}</div>

      <!-- Category + slot type -->
      <div class="tooltip-category">{{ categoryLabel }}</div>

      <!-- Tier + Material -->
      <div v-if="tierLabel" class="tooltip-tier">{{ tierLabel }}</div>

      <!-- Description -->
      <div v-if="description" class="tooltip-desc">{{ description }}</div>

      <!-- Stats -->
      <div v-if="stats.length > 0" class="tooltip-stats">
        <div class="tooltip-divider" />
        <div v-for="stat in stats" :key="stat.label" class="tooltip-stat">
          <span class="tooltip-stat__label">{{ stat.label }}</span>
          <span class="tooltip-stat__value">{{ stat.value }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="tooltip-divider" />
      <div class="tooltip-footer">
        <span v-if="weight" class="tooltip-weight">{{ weight.toFixed(1) }} kg</span>
        <span v-if="priceLabel" class="tooltip-price">{{ priceLabel }}</span>
        <span v-if="durability != null && durability < 100" class="tooltip-durability">
          {{ Math.round(durability) }}% dur
        </span>
      </div>

      <!-- Flags -->
      <div class="tooltip-flags">
        <span v-if="isTwoHanded" class="tooltip-flag">Two-Handed</span>
        <span v-if="isUsable" class="tooltip-flag tooltip-flag--usable">Usable</span>
        <span v-if="!isTradeable" class="tooltip-flag tooltip-flag--notrade">Soulbound</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.item-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 260px;
  padding: 8px 10px;
  background: rgba(18, 14, 10, 0.96);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
  pointer-events: none;
  font-family: var(--font-body);
}

.tooltip-name {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}

.tooltip-category {
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.tooltip-tier {
  font-size: 10px;
  color: var(--color-text-dim);
  margin-bottom: 4px;
}

.tooltip-desc {
  font-size: 11px;
  color: var(--color-text);
  font-style: italic;
  line-height: 1.4;
  margin-bottom: 4px;
  opacity: 0.85;
}

.tooltip-divider {
  height: 1px;
  background: var(--color-border-dim);
  margin: 5px 0;
}

.tooltip-stats {
  margin-bottom: 2px;
}

.tooltip-stat {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  line-height: 1.6;
}

.tooltip-stat__label {
  color: var(--color-text-muted);
}

.tooltip-stat__value {
  color: var(--color-gold-light);
  font-family: var(--font-mono);
  font-weight: 600;
}

.tooltip-footer {
  display: flex;
  gap: 8px;
  font-size: 9px;
  color: var(--color-text-muted);
}

.tooltip-weight {
  opacity: 0.7;
}

.tooltip-price {
  color: var(--color-gold-dim);
}

.tooltip-durability {
  color: #c47a32;
}

.tooltip-flags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.tooltip-flag {
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tooltip-flag--usable {
  background: rgba(74, 158, 74, 0.15);
  border-color: rgba(74, 158, 74, 0.3);
  color: #4a9e4a;
}

.tooltip-flag--notrade {
  background: rgba(139, 26, 26, 0.15);
  border-color: rgba(139, 26, 26, 0.3);
  color: #b04040;
}
</style>
