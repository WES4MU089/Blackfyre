<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { hpBarColor } from '@/utils/healthColor'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const detail = computed(() => characterStore.retainerDetail)

const APTITUDE_LABELS: Record<string, string> = {
  prowess: 'Prowess', fortitude: 'Fortitude', command: 'Command', cunning: 'Cunning',
  stewardship: 'Stewardship', presence: 'Presence', lore: 'Lore', faith: 'Faith',
}

const SLOT_LABELS: Record<string, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  armor: 'Armor',
  accessory1: 'Accessory 1',
  accessory2: 'Accessory 2',
  ancillary1: 'Ancillary 1',
  ancillary2: 'Ancillary 2',
}

const ALL_SLOTS = Object.keys(SLOT_LABELS)

const tierLabels = ['', 'I', 'II', 'III', 'IV', 'V']

const activeSection = ref<'equipment' | 'inventory' | 'transfer'>('equipment')

/** Track which inventory item is showing an equip slot picker */
const equipPickerItemId = ref<number | null>(null)

function healthPercent(): number {
  if (!detail.value) return 0
  return detail.value.maxHealth > 0
    ? (detail.value.health / detail.value.maxHealth) * 100
    : 0
}

function xpPercent(): number {
  if (!detail.value) return 0
  return (detail.value.xpSegments / 10) * 100
}

/** Slots currently equipped — for showing which are available */
const occupiedSlots = computed(() => {
  if (!detail.value) return new Set<string>()
  return new Set(detail.value.equipment.map(e => e.slotId))
})

async function allocatePoint(key: string): Promise<void> {
  if (!detail.value) return
  const success = await characterStore.allocateRetainerAptitude(detail.value.characterId, key)
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to allocate aptitude point')
  }
}

async function handleUnequip(slotId: string): Promise<void> {
  if (!detail.value) return
  const success = await characterStore.unequipRetainerItem(detail.value.characterId, slotId)
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to unequip item')
  }
}

function toggleEquipPicker(inventoryId: number): void {
  equipPickerItemId.value = equipPickerItemId.value === inventoryId ? null : inventoryId
}

async function handleEquip(inventoryId: number, slotId: string): Promise<void> {
  if (!detail.value) return
  equipPickerItemId.value = null
  const success = await characterStore.equipRetainerItem(detail.value.characterId, inventoryId, slotId)
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to equip item')
  }
}

async function handleTransferToPlayer(inventoryId: number): Promise<void> {
  if (!detail.value) return
  const success = await characterStore.transferItem(detail.value.characterId, inventoryId, 'to_player')
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to transfer item')
  }
}

async function handleTransferToRetainer(inventoryId: number): Promise<void> {
  if (!detail.value) return
  const success = await characterStore.transferItem(detail.value.characterId, inventoryId, 'to_retainer')
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to transfer item')
  }
}

async function handleDismiss(): Promise<void> {
  if (!detail.value) return
  const name = detail.value.name
  const success = await characterStore.dismissRetainerApi(detail.value.characterId)
  if (success) {
    hudStore.addNotification('info', 'Dismissed', `${name} has been dismissed.`)
  } else {
    hudStore.addNotification('danger', 'Error', 'Failed to dismiss retainer')
  }
}

function close(): void {
  characterStore.clearRetainerDetail()
}
</script>

<template>
  <div v-if="detail" class="retainer-detail">
    <div class="detail-header">
      <button class="detail-back" @click="close">&larr;</button>
      <div class="detail-title-row">
        <span class="detail-name">{{ detail.name }}</span>
        <span class="detail-tier">{{ tierLabels[detail.tier] }} {{ detail.tierName }}</span>
      </div>
    </div>

    <div class="detail-body">
      <!-- Level & XP -->
      <div class="detail-section">
        <div class="detail-row">
          <span class="detail-label">Level</span>
          <span class="detail-value">{{ detail.level }} / 10</span>
        </div>
        <div class="xp-bar">
          <div class="xp-fill" :style="{ width: xpPercent() + '%' }" />
        </div>
        <div class="xp-text">{{ detail.xpSegments }} / 10 segments</div>
      </div>

      <!-- Health -->
      <div class="detail-section">
        <div class="detail-row">
          <span class="detail-label">Health</span>
          <span class="detail-value">{{ Math.round(detail.health) }} / {{ Math.round(detail.maxHealth) }}</span>
        </div>
        <div class="hp-bar">
          <div class="hp-fill" :style="{ width: healthPercent() + '%', background: hpBarColor(healthPercent()) }" />
        </div>
      </div>

      <!-- Aptitudes -->
      <div class="detail-section">
        <div class="section-title">Aptitudes</div>
        <div v-if="detail.unspentAptitudePoints > 0" class="unspent-points">
          {{ detail.unspentAptitudePoints }} unspent point{{ detail.unspentAptitudePoints > 1 ? 's' : '' }}
        </div>
        <div class="apt-list">
          <div v-for="apt in detail.aptitudes" :key="apt.key" class="apt-row">
            <span class="apt-label">{{ APTITUDE_LABELS[apt.key] ?? apt.key }}</span>
            <div class="apt-bar-wrapper">
              <div class="apt-bar">
                <div class="apt-bar-fill" :style="{ width: (apt.currentValue / (detail.aptitudeCap ?? 7)) * 100 + '%' }" />
              </div>
              <span class="apt-val">{{ apt.currentValue }}</span>
              <button
                v-if="detail.unspentAptitudePoints > 0 && apt.currentValue < (detail.aptitudeCap ?? 7)"
                class="apt-plus"
                @click="allocatePoint(apt.key)"
              >+</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Section tabs -->
      <div class="section-tabs">
        <button
          class="section-tab"
          :class="{ 'section-tab--active': activeSection === 'equipment' }"
          @click="activeSection = 'equipment'"
        >Equipment</button>
        <button
          class="section-tab"
          :class="{ 'section-tab--active': activeSection === 'inventory' }"
          @click="activeSection = 'inventory'"
        >Inventory ({{ detail.inventory.length }})</button>
        <button
          class="section-tab"
          :class="{ 'section-tab--active': activeSection === 'transfer' }"
          @click="activeSection = 'transfer'"
        >Transfer</button>
      </div>

      <!-- Equipment section -->
      <div v-if="activeSection === 'equipment'" class="detail-section">
        <div class="equip-list">
          <div v-for="slot in ALL_SLOTS" :key="slot" class="equip-row">
            <span class="equip-slot">{{ SLOT_LABELS[slot] }}</span>
            <template v-if="detail.equipment.find(e => e.slotId === slot)">
              <span class="equip-name">{{ detail.equipment.find(e => e.slotId === slot)!.itemName }}</span>
              <button class="btn-action btn-action--danger" @click="handleUnequip(slot)">Unequip</button>
            </template>
            <template v-else>
              <span class="equip-empty">Empty</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Inventory section -->
      <div v-if="activeSection === 'inventory'" class="detail-section">
        <div class="inv-list">
          <div v-for="item in detail.inventory" :key="item.id" class="inv-row">
            <div class="inv-item-info">
              <span class="inv-name">{{ item.itemName }}</span>
              <span v-if="item.quantity > 1" class="inv-qty">x{{ item.quantity }}</span>
            </div>
            <div class="inv-actions">
              <button class="btn-action" @click="toggleEquipPicker(item.id)">Equip</button>
              <button class="btn-action btn-action--transfer" @click="handleTransferToPlayer(item.id)">To Player</button>
            </div>
            <!-- Slot picker -->
            <div v-if="equipPickerItemId === item.id" class="slot-picker">
              <button
                v-for="slot in ALL_SLOTS"
                :key="slot"
                class="slot-pick-btn"
                :class="{ 'slot-pick-btn--occupied': occupiedSlots.has(slot) }"
                @click="handleEquip(item.id, slot)"
              >{{ SLOT_LABELS[slot] }}</button>
            </div>
          </div>
          <div v-if="detail.inventory.length === 0" class="empty-text">Empty</div>
        </div>
      </div>

      <!-- Transfer section (player inventory) -->
      <div v-if="activeSection === 'transfer'" class="detail-section">
        <div class="section-title">Your Inventory</div>
        <div class="inv-list">
          <div v-for="item in characterStore.inventory" :key="item.inventory_id" class="inv-row">
            <div class="inv-item-info">
              <span class="inv-name">{{ item.name }}</span>
              <span v-if="item.quantity > 1" class="inv-qty">x{{ item.quantity }}</span>
            </div>
            <div class="inv-actions">
              <button class="btn-action btn-action--give" @click="handleTransferToRetainer(item.inventory_id)">Give</button>
            </div>
          </div>
          <div v-if="characterStore.inventory.length === 0" class="empty-text">No items in your inventory</div>
        </div>
      </div>

      <!-- Dismiss -->
      <div class="detail-section">
        <button class="btn-dismiss" @click="handleDismiss">Dismiss Retainer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.retainer-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.detail-back {
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  font-size: 12px;
  cursor: pointer;
  padding: 1px 6px;
  line-height: 1;
  transition: all 0.15s;
}
.detail-back:hover {
  color: var(--color-gold);
  border-color: var(--color-gold);
}

.detail-title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  flex: 1;
}

.detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
}

.detail-tier {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 2px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
}

.detail-label { color: var(--color-text-dim); }
.detail-value { color: var(--color-text); }

.xp-bar, .hp-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  background: var(--color-gold);
  border-radius: 2px;
  transition: width 0.3s;
}

.hp-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.xp-text {
  font-size: 9px;
  color: var(--color-text-dim);
}

.unspent-points {
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  font-weight: 600;
}

.apt-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.apt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.apt-label {
  font-size: 11px;
  color: var(--color-text);
  min-width: 80px;
}

.apt-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.apt-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.apt-bar-fill {
  height: 100%;
  background: var(--color-gold);
  border-radius: 3px;
  transition: width 0.3s;
}

.apt-val {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-gold);
  min-width: 14px;
  text-align: center;
}

.apt-plus {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(201, 168, 76, 0.15);
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-sm);
  color: var(--color-gold);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}
.apt-plus:hover { background: rgba(201, 168, 76, 0.3); }

/* Section tabs */
.section-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0;
}

.section-tab {
  flex: 1;
  padding: 4px 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.section-tab:hover {
  color: var(--color-text-dim);
}

.section-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

/* Equipment list */
.equip-list, .inv-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equip-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.equip-slot {
  color: var(--color-text-dim);
  min-width: 72px;
  font-size: 10px;
}

.equip-name {
  color: var(--color-text);
  flex: 1;
}

.equip-empty {
  color: var(--color-text-muted);
  font-style: italic;
  flex: 1;
  font-size: 10px;
}

/* Inventory rows */
.inv-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.inv-item-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.inv-name {
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inv-qty { color: var(--color-text-dim); font-size: 10px; }

.inv-actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

/* Action buttons */
.btn-action {
  padding: 1px 6px;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-gold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-action:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

.btn-action--danger {
  background: rgba(139, 26, 26, 0.08);
  border-color: rgba(139, 26, 26, 0.25);
  color: #c42b2b;
}

.btn-action--danger:hover {
  background: rgba(139, 26, 26, 0.2);
  border-color: rgba(139, 26, 26, 0.5);
}

.btn-action--transfer {
  color: var(--color-text-dim);
  border-color: var(--color-border-dim);
  background: none;
}

.btn-action--transfer:hover {
  color: var(--color-text);
  border-color: var(--color-border-bright);
  background: rgba(255, 255, 255, 0.04);
}

.btn-action--give {
  color: var(--color-gold);
  border-color: rgba(201, 168, 76, 0.25);
  background: rgba(201, 168, 76, 0.08);
}

.btn-action--give:hover {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

/* Slot picker */
.slot-picker {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 4px 0;
}

.slot-pick-btn {
  padding: 2px 6px;
  background: rgba(201, 168, 76, 0.06);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.15s;
}

.slot-pick-btn:hover {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.15);
}

.slot-pick-btn--occupied {
  border-color: rgba(201, 168, 76, 0.15);
  color: var(--color-text-muted);
}

.empty-text {
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

.btn-dismiss {
  padding: var(--space-xs) var(--space-md);
  background: rgba(139, 26, 26, 0.15);
  border: 1px solid rgba(139, 26, 26, 0.4);
  border-radius: var(--radius-sm);
  color: #c42b2b;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-dismiss:hover {
  background: rgba(139, 26, 26, 0.3);
  border-color: #c42b2b;
}
</style>
