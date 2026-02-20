<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const detail = computed(() => characterStore.retainerDetail)

const APTITUDE_LABELS: Record<string, string> = {
  prowess: 'Prowess', fortitude: 'Fortitude', command: 'Command', cunning: 'Cunning',
  stewardship: 'Stewardship', presence: 'Presence', lore: 'Lore', faith: 'Faith',
}

const tierLabels = ['', 'I', 'II', 'III', 'IV', 'V']

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

async function allocatePoint(key: string): Promise<void> {
  if (!detail.value) return
  const success = await characterStore.allocateRetainerAptitude(detail.value.characterId, key)
  if (!success) {
    hudStore.addNotification('danger', 'Error', 'Failed to allocate aptitude point')
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
      <div class="detail-title-row">
        <span class="detail-name">{{ detail.name }}</span>
        <span class="detail-tier">{{ tierLabels[detail.tier] }} {{ detail.tierName }}</span>
      </div>
      <button class="detail-close" @click="close">&times;</button>
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
          <div class="hp-fill" :style="{ width: healthPercent() + '%' }" />
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

      <!-- Equipment -->
      <div class="detail-section">
        <div class="section-title">Equipment</div>
        <div class="equip-list">
          <div v-for="eq in detail.equipment" :key="eq.slotId" class="equip-row">
            <span class="equip-slot">{{ eq.slotId }}</span>
            <span class="equip-name">{{ eq.itemName }}</span>
          </div>
          <div v-if="detail.equipment.length === 0" class="empty-text">No equipment</div>
        </div>
      </div>

      <!-- Inventory -->
      <div class="detail-section">
        <div class="section-title">Inventory ({{ detail.inventory.length }})</div>
        <div class="inv-list">
          <div v-for="item in detail.inventory" :key="item.id" class="inv-row">
            <span class="inv-name">{{ item.itemName }}</span>
            <span v-if="item.quantity > 1" class="inv-qty">x{{ item.quantity }}</span>
          </div>
          <div v-if="detail.inventory.length === 0" class="empty-text">Empty</div>
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
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.detail-title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
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

.detail-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.detail-close:hover { color: var(--color-text); }

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
  background: var(--color-health, #8b1a1a);
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

.equip-list, .inv-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equip-row, .inv-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  padding: 2px 0;
}

.equip-slot {
  color: var(--color-text-dim);
  text-transform: capitalize;
  min-width: 70px;
}

.equip-name, .inv-name { color: var(--color-text); }
.inv-qty { color: var(--color-text-dim); }

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
