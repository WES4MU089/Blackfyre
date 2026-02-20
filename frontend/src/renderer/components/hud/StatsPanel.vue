<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'

const store = useCharacterStore()

// --- Aptitude helpers ---
function getAptitude(id: string): number {
  return store.aptitudes.find(a => a.id === id)?.currentValue ?? 0
}

const prowess = computed(() => getAptitude('prowess'))
const fortitude = computed(() => getAptitude('fortitude'))

// --- Equipment references ---
const mainHand = computed(() => store.equipment.mainHand)
const armorItem = computed(() => store.equipment.armor)
const offHand = computed(() => store.equipment.offHand)

// --- Vitals ---
const derivedMaxHealth = computed(() => 20 + fortitude.value * 10)
const healthBonus = computed(() => fortitude.value * 10)

const healthPercent = computed(() =>
  store.vitals.maxHealth > 0
    ? (store.vitals.health / store.vitals.maxHealth) * 100
    : 0
)

const woundPenalty = computed(() => {
  const pct = healthPercent.value
  if (pct >= 75) return 0
  if (pct >= 50) return -2
  if (pct >= 25) return -5
  return -10
})

// --- Offense ---
const weaponName = computed(() => mainHand.value?.itemName ?? null)

const weaponTierMaterial = computed(() => {
  if (!mainHand.value) return null
  const roman = ['', 'I', 'II', 'III', 'IV', 'V']
  const parts: string[] = []
  if (mainHand.value.tier > 0) parts.push(`Tier ${roman[mainHand.value.tier] ?? mainHand.value.tier}`)
  if (mainHand.value.material) {
    parts.push(mainHand.value.material.charAt(0).toUpperCase() + mainHand.value.material.slice(1).replace(/_/g, ' '))
  }
  return parts.length ? parts.join(' \u00B7 ') : null
})

const baseDamage = computed(() => {
  const md = mainHand.value?.modelData
  return md?.baseDamage != null ? Number(md.baseDamage) : null
})

const penetration = computed(() => {
  const md = mainHand.value?.modelData
  return md?.penetration != null ? Number(md.penetration) : null
})

const isTwoHanded = computed(() => mainHand.value?.isTwoHanded ?? false)

// --- Defense ---
const armorName = computed(() => armorItem.value?.itemName ?? null)

const armorTierMaterial = computed(() => {
  if (!armorItem.value) return null
  const roman = ['', 'I', 'II', 'III', 'IV', 'V']
  const parts: string[] = []
  if (armorItem.value.tier > 0) parts.push(`Tier ${roman[armorItem.value.tier] ?? armorItem.value.tier}`)
  if (armorItem.value.material) {
    parts.push(armorItem.value.material.charAt(0).toUpperCase() + armorItem.value.material.slice(1).replace(/_/g, ' '))
  }
  return parts.length ? parts.join(' \u00B7 ') : null
})

const mitigation = computed(() => {
  const md = armorItem.value?.modelData
  return md?.mitigation != null ? Number(md.mitigation) : null
})

const isShield = computed(() => {
  if (!offHand.value) return false
  return offHand.value.category === 'shield' || offHand.value.modelData?.blockBonus != null
})

const shieldName = computed(() => isShield.value ? offHand.value?.itemName ?? null : null)

const blockBonus = computed(() => {
  if (!isShield.value) return null
  const md = offHand.value?.modelData
  return md?.blockBonus != null ? Number(md.blockBonus) : null
})

const totalEncumbrance = computed(() => {
  let total = 0
  for (const slot of Object.values(store.equipment)) {
    if (slot?.modelData?.encumbrance != null) {
      total += Number(slot.modelData.encumbrance)
    }
  }
  return total
})

// --- Aptitude bonus descriptions ---
const aptitudeBonuses = computed(() => [
  { id: 'prowess', name: 'Prowess', value: getAptitude('prowess'), desc: 'Attack & Defense rolls' },
  { id: 'fortitude', name: 'Fortitude', value: getAptitude('fortitude'), desc: `+${getAptitude('fortitude') * 10} Max Health` },
  { id: 'command', name: 'Command', value: getAptitude('command'), desc: 'Warfare rolls' },
  { id: 'cunning', name: 'Cunning', value: getAptitude('cunning'), desc: 'Stealth & Perception' },
  { id: 'stewardship', name: 'Stewardship', value: getAptitude('stewardship'), desc: 'Trade & Craft' },
  { id: 'presence', name: 'Presence', value: getAptitude('presence'), desc: 'Social & Intimidation' },
  { id: 'lore', name: 'Lore', value: getAptitude('lore'), desc: 'Knowledge & Medicine' },
  { id: 'faith', name: 'Faith', value: getAptitude('faith'), desc: 'Ritual & Devotion' },
])

// Split aptitudes into two columns for the grid cell
const leftAptitudes = computed(() => aptitudeBonuses.value.slice(0, 4))
const rightAptitudes = computed(() => aptitudeBonuses.value.slice(4))

// --- Equipment summary ---
const SLOT_LABELS: Record<string, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  armor: 'Armor',
  accessory1: 'Accessory 1',
  accessory2: 'Accessory 2',
  ancillary1: 'Ancillary 1',
  ancillary2: 'Ancillary 2',
}

const SLOT_ORDER = ['mainHand', 'offHand', 'armor', 'accessory1', 'accessory2', 'ancillary1', 'ancillary2']

function getKeyStat(item: typeof store.equipment.mainHand): string | null {
  if (!item?.modelData) return null
  const md = item.modelData
  if (md.baseDamage != null) return `${md.baseDamage} dmg`
  if (md.mitigation != null) return `${md.mitigation} mit`
  if (md.blockBonus != null) return `+${md.blockBonus} block`
  return null
}

const slotSummaries = computed(() =>
  SLOT_ORDER.map(slotId => {
    const item = store.equipment[slotId]
    return {
      slotId,
      label: SLOT_LABELS[slotId],
      name: item?.itemName ?? null,
      keyStat: item ? getKeyStat(item) : null,
      weight: item?.weight ?? 0,
    }
  })
)

const totalEquipWeight = computed(() =>
  slotSummaries.value.reduce((sum, s) => sum + s.weight, 0)
)

function formatWeight(w: number): string {
  return w % 1 === 0 ? w.toString() : w.toFixed(1)
}
</script>

<template>
  <div class="stats-panel panel-ornate">
    <div class="stats-header">Detailed Stats</div>

    <div class="stats-grid">
      <!-- Row 1, Col 1: Vitals -->
      <div class="stats-cell">
        <div class="stats-cell__title">Vitals</div>

        <div class="stats-row">
          <span class="stats-row__label">Health</span>
          <span class="stats-row__value">
            {{ Math.floor(store.vitals.health) }} / {{ Math.floor(store.vitals.maxHealth) }}
          </span>
        </div>

        <div class="stats-hp-bar">
          <div
            class="stats-hp-fill"
            :class="{ 'stats-hp-fill--critical': healthPercent < 20 }"
            :style="{ width: `${healthPercent}%` }"
          />
        </div>

        <div class="stats-row">
          <span class="stats-row__label">Max Health</span>
          <span class="stats-row__value">{{ derivedMaxHealth }}</span>
        </div>
        <div class="stats-row stats-row--sub">
          <span class="stats-row__label">Fortitude Bonus</span>
          <span class="stats-row__value stats-row__value--positive">+{{ healthBonus }}</span>
        </div>

        <div class="stats-row">
          <span class="stats-row__label">Wound Penalty</span>
          <span
            class="stats-row__value"
            :class="woundPenalty < 0 ? 'stats-row__value--negative' : 'stats-row__value--neutral'"
          >
            {{ woundPenalty === 0 ? 'None' : woundPenalty }}
          </span>
        </div>
      </div>

      <!-- Row 1, Col 2: Offense -->
      <div class="stats-cell">
        <div class="stats-cell__title">Offense</div>

        <template v-if="mainHand">
          <div class="stats-equip-name">{{ weaponName }}</div>
          <div v-if="weaponTierMaterial" class="stats-equip-meta">{{ weaponTierMaterial }}</div>

          <div class="stats-row">
            <span class="stats-row__label">Base Damage</span>
            <span class="stats-row__value">{{ baseDamage ?? '—' }}</span>
          </div>
          <div class="stats-row">
            <span class="stats-row__label">Penetration</span>
            <span class="stats-row__value">{{ penetration ?? '—' }}</span>
          </div>
          <div class="stats-row">
            <span class="stats-row__label">Attack Mod</span>
            <span class="stats-row__value stats-row__value--positive">+{{ prowess }}</span>
          </div>
          <div class="stats-row stats-row--sub">
            <span class="stats-row__label">from Prowess</span>
            <span class="stats-row__value--hint">{{ prowess }}</span>
          </div>

          <div v-if="isTwoHanded" class="stats-flag">Two-Handed</div>
        </template>
        <template v-else>
          <div class="stats-empty">No weapon equipped</div>
        </template>
      </div>

      <!-- Row 1, Col 3: Defense -->
      <div class="stats-cell">
        <div class="stats-cell__title">Defense</div>

        <template v-if="armorItem">
          <div class="stats-equip-name">{{ armorName }}</div>
          <div v-if="armorTierMaterial" class="stats-equip-meta">{{ armorTierMaterial }}</div>

          <div class="stats-row">
            <span class="stats-row__label">Mitigation</span>
            <span class="stats-row__value">{{ mitigation ?? '—' }}</span>
          </div>
        </template>
        <template v-else>
          <div class="stats-empty">No armor equipped</div>
        </template>

        <template v-if="shieldName">
          <div class="stats-equip-name stats-equip-name--secondary">{{ shieldName }}</div>
          <div class="stats-row">
            <span class="stats-row__label">Block Bonus</span>
            <span class="stats-row__value stats-row__value--positive">+{{ blockBonus }}</span>
          </div>
        </template>

        <div class="stats-row">
          <span class="stats-row__label">Defense Mod</span>
          <span class="stats-row__value stats-row__value--positive">+{{ prowess }}</span>
        </div>
        <div class="stats-row stats-row--sub">
          <span class="stats-row__label">from Prowess</span>
          <span class="stats-row__value--hint">{{ prowess }}</span>
        </div>

        <div class="stats-row">
          <span class="stats-row__label">Encumbrance</span>
          <span
            class="stats-row__value"
            :class="totalEncumbrance < 0 ? 'stats-row__value--negative' : 'stats-row__value--neutral'"
          >
            {{ totalEncumbrance === 0 ? 'None' : totalEncumbrance }}
          </span>
        </div>
      </div>

      <!-- Row 2, Col 1-2: Aptitude Bonuses (spans 2 columns) -->
      <div class="stats-cell stats-cell--wide">
        <div class="stats-cell__title">Aptitude Bonuses</div>

        <div class="stats-apt-grid">
          <div class="stats-apt-col">
            <div v-for="apt in leftAptitudes" :key="apt.id" class="stats-apt-row">
              <div class="stats-apt-header">
                <span class="stats-apt-name">{{ apt.name }}</span>
                <span class="stats-apt-value">{{ apt.value }}</span>
              </div>
              <div class="stats-apt-desc">{{ apt.desc }}</div>
            </div>
          </div>
          <div class="stats-apt-col">
            <div v-for="apt in rightAptitudes" :key="apt.id" class="stats-apt-row">
              <div class="stats-apt-header">
                <span class="stats-apt-name">{{ apt.name }}</span>
                <span class="stats-apt-value">{{ apt.value }}</span>
              </div>
              <div class="stats-apt-desc">{{ apt.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2, Col 3: Equipment Summary -->
      <div class="stats-cell">
        <div class="stats-cell__title">Equipment</div>

        <div v-for="slot in slotSummaries" :key="slot.slotId" class="stats-slot-row">
          <div class="stats-slot-header">
            <span class="stats-slot-label">{{ slot.label }}</span>
            <span v-if="slot.keyStat" class="stats-slot-stat">{{ slot.keyStat }}</span>
          </div>
          <div class="stats-slot-name" :class="{ 'stats-slot-name--empty': !slot.name }">
            {{ slot.name ?? 'Empty' }}
          </div>
        </div>

        <div class="stats-divider" />
        <div class="stats-row">
          <span class="stats-row__label">Total Weight</span>
          <span class="stats-row__value">{{ formatWeight(totalEquipWeight) }} kg</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  pointer-events: auto;
  margin-left: 6px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.stats-header {
  padding: 6px 10px;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* 3-column grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.stats-grid::-webkit-scrollbar {
  width: 4px;
}

.stats-grid::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

/* Grid cells */
.stats-cell {
  padding: 8px 10px;
  border-right: 1px solid var(--color-border-dim);
  border-bottom: 1px solid var(--color-border-dim);
  min-width: 0;
}

.stats-cell:nth-child(3),
.stats-cell:last-child {
  border-right: none;
}

.stats-cell--wide {
  grid-column: span 2;
}

.stats-cell__title {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* Stat rows */
.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10px;
  line-height: 1.7;
  gap: 4px;
}

.stats-row--sub {
  opacity: 0.6;
  font-size: 9px;
}

.stats-row__label {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  white-space: nowrap;
}

.stats-row__value {
  color: var(--color-gold-light);
  font-family: var(--font-mono);
  font-weight: 600;
  white-space: nowrap;
}

.stats-row__value--positive {
  color: var(--color-gold-light);
}

.stats-row__value--negative {
  color: var(--color-crimson-light);
}

.stats-row__value--neutral {
  color: var(--color-text-muted);
}

.stats-row__value--hint {
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 9px;
}

/* HP bar */
.stats-hp-bar {
  height: 4px;
  background: rgba(139, 26, 26, 0.15);
  border: 1px solid var(--color-border-dim);
  border-radius: 2px;
  overflow: hidden;
  margin: 3px 0 6px;
}

.stats-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b1a1a, #c04040);
  border-radius: 2px;
  transition: width 300ms ease;
}

.stats-hp-fill--critical {
  animation: hp-pulse 1.2s ease-in-out infinite;
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Equipment name in offense/defense cells */
.stats-equip-name {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--color-text);
  letter-spacing: 0.04em;
  margin-bottom: 1px;
}

.stats-equip-name--secondary {
  margin-top: 8px;
}

.stats-equip-meta {
  font-size: 9px;
  color: var(--color-text-dim);
  margin-bottom: 4px;
}

.stats-empty {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 4px;
}

.stats-flag {
  display: inline-block;
  margin-top: 4px;
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Aptitude grid (2 columns inside the wide cell) */
.stats-apt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.stats-apt-col {
  display: flex;
  flex-direction: column;
}

.stats-apt-row {
  margin-bottom: 4px;
}

.stats-apt-row:last-child {
  margin-bottom: 0;
}

.stats-apt-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.stats-apt-name {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stats-apt-value {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--color-gold);
}

.stats-apt-desc {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* Equipment summary slot rows */
.stats-slot-row {
  margin-bottom: 4px;
}

.stats-slot-row:last-of-type {
  margin-bottom: 0;
}

.stats-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.stats-slot-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stats-slot-stat {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-gold-dim);
}

.stats-slot-name {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-slot-name--empty {
  color: var(--color-text-muted);
  font-style: italic;
}

.stats-divider {
  height: 1px;
  background: var(--color-border-dim);
  margin: 6px 0;
}
</style>
