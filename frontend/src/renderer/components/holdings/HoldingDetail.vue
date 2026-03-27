<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHoldingsStore } from '@/stores/holdings'
import type { HoldingBuilding } from '@/stores/holdings'

const holdingsStore = useHoldingsStore()
const activeTab = ref<'overview' | 'buildings' | 'resources'>('overview')
const showBuildSelect = ref(false)
const buildSlotCategory = ref<string>('')

const h = computed(() => holdingsStore.selectedHolding!)

const defenseBuildings = computed(() =>
  h.value.buildings.filter(b => b.slot_category === 'defense')
)
const gatheringBuildings = computed(() =>
  h.value.buildings.filter(b => b.slot_category === 'gathering')
)
const productionBuildings = computed(() =>
  h.value.buildings.filter(b => b.slot_category === 'production')
)

function hpPercent(): number {
  return h.value.settlement_hp_max > 0
    ? (h.value.settlement_hp_current / h.value.settlement_hp_max) * 100
    : 0
}

function manpowerPercent(): number {
  return h.value.manpower_max > 0
    ? (h.value.manpower_current / h.value.manpower_max) * 100
    : 0
}

function resourcePercent(quantity: number, capacity: number): number {
  return capacity > 0 ? (quantity / capacity) * 100 : 0
}

function resourceColor(type: string): string {
  const colors: Record<string, string> = {
    food: '#6b8e23',
    gold: '#c9a84c',
    timber: '#8b6914',
    stone: '#808080',
    iron: '#708090',
  }
  return colors[type] || '#888'
}

function tierRoman(tier: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][tier] || `T${tier}`
}

function formatConstructionTime(completes: string | null): string {
  if (!completes) return ''
  const end = new Date(completes)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return 'Ready'
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return `${days} tick${days !== 1 ? 's' : ''}`
}

function openBuildSelect(category: string) {
  buildSlotCategory.value = category
  showBuildSelect.value = true
  holdingsStore.fetchBuildingTypes()
}

const availableBuildingTypes = computed(() => {
  if (!buildSlotCategory.value) return []
  return holdingsStore.buildingTypes.filter(
    bt => bt.category === buildSlotCategory.value && bt.tier === 1
  )
})

async function buildNew(buildingTypeId: number) {
  showBuildSelect.value = false
  try {
    await holdingsStore.startConstruction(h.value.id, buildingTypeId, 1)
  } catch { /* error handled in store */ }
}

async function upgradeBuilding(building: HoldingBuilding) {
  const nextTier = building.tier + 1
  if (nextTier > building.max_tier) return
  try {
    await holdingsStore.startConstruction(h.value.id, building.building_type_id, nextTier)
  } catch { /* error handled in store */ }
}

async function cancelBuild(buildingId: number) {
  try {
    await holdingsStore.cancelConstruction(h.value.id, buildingId)
  } catch { /* error handled in store */ }
}
</script>

<template>
  <div class="holding-detail">
    <!-- Tabs -->
    <div class="holding-tabs">
      <button
        v-for="tab in (['overview', 'buildings', 'resources'] as const)"
        :key="tab"
        class="holding-tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </div>

    <div class="holding-detail-body">
      <!-- Error banner -->
      <div v-if="holdingsStore.error" class="holding-error">
        {{ holdingsStore.error }}
      </div>

      <!-- OVERVIEW TAB -->
      <template v-if="activeTab === 'overview'">
        <div class="detail-section">
          <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">{{ h.holding_type }} (Size {{ h.size }})</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Settlement HP</span>
            <div class="detail-bar-group">
              <div class="detail-bar">
                <div class="detail-bar-fill hp-fill" :style="{ width: hpPercent() + '%' }" />
              </div>
              <span class="detail-bar-text">{{ h.settlement_hp_current.toLocaleString() }} / {{ h.settlement_hp_max.toLocaleString() }}</span>
            </div>
          </div>

          <div class="detail-row">
            <span class="detail-label">Manpower</span>
            <div class="detail-bar-group">
              <div class="detail-bar">
                <div class="detail-bar-fill manpower-fill" :style="{ width: manpowerPercent() + '%' }" />
              </div>
              <span class="detail-bar-text">{{ h.manpower_current.toLocaleString() }} / {{ h.manpower_max.toLocaleString() }}</span>
            </div>
          </div>

          <div class="detail-row">
            <span class="detail-label">Food/Tick</span>
            <span class="detail-value consumption">-{{ h.food_consumption_per_tick }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Walls</span>
            <span class="detail-value">+{{ h.walls_hp_bonus }} HP, +{{ h.walls_advantage }} Advantage</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Garrison Cap</span>
            <span class="detail-value">{{ h.garrison_capacity.toLocaleString() }}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">Warehouse</span>
            <span class="detail-value">Tier {{ tierRoman(h.warehouse_tier) }} ({{ h.warehouse_capacity.toLocaleString() }} per resource)</span>
          </div>

          <div v-if="h.special_slot_name" class="detail-row">
            <span class="detail-label">Special</span>
            <span class="detail-value special">{{ h.special_slot_name }}</span>
          </div>
          <div v-if="h.special_slot_description" class="detail-description">
            {{ h.special_slot_description }}
          </div>
        </div>

        <!-- Slot summary -->
        <div class="detail-section">
          <div class="section-title">Slots</div>
          <div class="slot-grid">
            <div class="slot-item">
              <span class="slot-label">Defense</span>
              <span class="slot-value">{{ h.slots.defense.used }} / {{ h.slots.defense.total }}</span>
            </div>
            <div class="slot-item">
              <span class="slot-label">Gathering</span>
              <span class="slot-value">{{ h.slots.gathering.used }} / {{ h.slots.gathering.total }}</span>
            </div>
            <div class="slot-item">
              <span class="slot-label">Production</span>
              <span class="slot-value">{{ h.slots.production.used }} / {{ h.slots.production.total }}</span>
            </div>
          </div>
        </div>

        <!-- Resource nodes -->
        <div class="detail-section">
          <div class="section-title">Resource Nodes</div>
          <div v-if="h.resource_nodes.length === 0" class="detail-empty">No nodes assigned</div>
          <div v-else class="node-list">
            <div v-for="node in h.resource_nodes" :key="node.id" class="node-item">
              <span class="node-name">{{ node.name }}</span>
              <span class="node-resource" :style="{ color: resourceColor(node.resource_produced) }">
                {{ node.resource_produced }}
                <span v-if="node.output_multiplier > 1">(x{{ node.output_multiplier }})</span>
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- BUILDINGS TAB -->
      <template v-if="activeTab === 'buildings'">
        <!-- Build select modal -->
        <div v-if="showBuildSelect" class="build-select-overlay">
          <div class="build-select">
            <div class="build-select-header">
              <span>Build {{ buildSlotCategory }}</span>
              <button class="holdings-panel-close" @click="showBuildSelect = false">&times;</button>
            </div>
            <div class="build-select-list">
              <button
                v-for="bt in availableBuildingTypes"
                :key="bt.id"
                class="build-option"
                @click="buildNew(bt.id)"
              >
                <span class="build-option-name">{{ bt.name }}</span>
                <span class="build-option-desc">{{ bt.description }}</span>
                <div class="build-option-costs">
                  <span v-if="bt.gold_cost">{{ bt.gold_cost }}g</span>
                  <span v-if="bt.timber_cost">{{ bt.timber_cost }}w</span>
                  <span v-if="bt.stone_cost">{{ bt.stone_cost }}s</span>
                  <span v-if="bt.iron_cost">{{ bt.iron_cost }}i</span>
                  <span class="build-time">{{ bt.build_time_ticks }}t</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Defense -->
        <div class="detail-section">
          <div class="section-header">
            <span class="section-title">Defense ({{ h.slots.defense.used }}/{{ h.slots.defense.total }})</span>
            <button
              v-if="h.slots.defense.used < h.slots.defense.total"
              class="build-btn"
              @click="openBuildSelect('defense')"
            >+ Build</button>
          </div>
          <div v-for="b in defenseBuildings" :key="b.id" class="building-row">
            <div class="building-info">
              <span class="building-name">{{ b.building_name }}</span>
              <span class="building-tier">{{ tierRoman(b.tier) }}</span>
            </div>
            <div v-if="b.is_under_construction" class="building-construction">
              <span class="construction-text">Upgrading to {{ tierRoman(b.target_tier!) }}...</span>
              <span class="construction-time">{{ formatConstructionTime(b.construction_completes_at) }}</span>
              <button class="cancel-btn" @click="cancelBuild(b.id)" title="Cancel">x</button>
            </div>
            <button
              v-else-if="b.tier < b.max_tier"
              class="upgrade-btn"
              @click="upgradeBuilding(b)"
            >Upgrade</button>
          </div>
        </div>

        <!-- Gathering -->
        <div class="detail-section">
          <div class="section-header">
            <span class="section-title">Gathering ({{ h.slots.gathering.used }}/{{ h.slots.gathering.total }})</span>
            <button
              v-if="h.slots.gathering.used < h.slots.gathering.total"
              class="build-btn"
              @click="openBuildSelect('gathering')"
            >+ Build</button>
          </div>
          <div v-for="b in gatheringBuildings" :key="b.id" class="building-row">
            <div class="building-info">
              <span class="building-name">{{ b.building_name }}</span>
              <span class="building-tier">{{ tierRoman(b.tier) }}</span>
              <span v-if="b.node_name" class="building-node">{{ b.node_name }}</span>
              <span v-else class="building-node unassigned">No node</span>
            </div>
            <div v-if="b.is_under_construction" class="building-construction">
              <span class="construction-text">Upgrading to {{ tierRoman(b.target_tier!) }}...</span>
              <span class="construction-time">{{ formatConstructionTime(b.construction_completes_at) }}</span>
              <button class="cancel-btn" @click="cancelBuild(b.id)" title="Cancel">x</button>
            </div>
            <button
              v-else-if="b.tier < b.max_tier"
              class="upgrade-btn"
              @click="upgradeBuilding(b)"
            >Upgrade</button>
          </div>
        </div>

        <!-- Production -->
        <div class="detail-section">
          <div class="section-header">
            <span class="section-title">Production ({{ h.slots.production.used }}/{{ h.slots.production.total }})</span>
            <button
              v-if="h.slots.production.used < h.slots.production.total"
              class="build-btn"
              @click="openBuildSelect('production')"
            >+ Build</button>
          </div>
          <div v-for="b in productionBuildings" :key="b.id" class="building-row">
            <div class="building-info">
              <span class="building-name">{{ b.building_name }}</span>
              <span class="building-tier">{{ tierRoman(b.tier) }}</span>
            </div>
            <div v-if="b.is_under_construction" class="building-construction">
              <span class="construction-text">Upgrading to {{ tierRoman(b.target_tier!) }}...</span>
              <span class="construction-time">{{ formatConstructionTime(b.construction_completes_at) }}</span>
              <button class="cancel-btn" @click="cancelBuild(b.id)" title="Cancel">x</button>
            </div>
            <button
              v-else-if="b.tier < b.max_tier"
              class="upgrade-btn"
              @click="upgradeBuilding(b)"
            >Upgrade</button>
          </div>
        </div>
      </template>

      <!-- RESOURCES TAB -->
      <template v-if="activeTab === 'resources'">
        <div class="detail-section">
          <div class="section-title">Warehouse (Tier {{ tierRoman(h.warehouse_tier) }})</div>
          <div v-for="res in h.resources" :key="res.resource_type" class="resource-row">
            <span class="resource-label" :style="{ color: resourceColor(res.resource_type) }">
              {{ res.resource_type }}
            </span>
            <div class="detail-bar">
              <div
                class="detail-bar-fill"
                :style="{ width: resourcePercent(res.quantity, res.capacity) + '%', background: resourceColor(res.resource_type) }"
              />
            </div>
            <span class="resource-value">{{ res.quantity.toLocaleString() }} / {{ res.capacity.toLocaleString() }}</span>
          </div>
          <button
            v-if="h.warehouse_tier < 5"
            class="upgrade-btn warehouse-upgrade"
            @click="holdingsStore.upgradeWarehouse(h.id)"
          >Upgrade Warehouse</button>
        </div>

        <!-- Iron stockpile -->
        <div v-if="h.iron_stockpile.length > 0" class="detail-section">
          <div class="section-title">Refined Iron</div>
          <div v-for="iron in h.iron_stockpile" :key="iron.tier" class="resource-row">
            <span class="resource-label iron-label">{{ iron.name }}</span>
            <span class="resource-value">{{ iron.quantity.toLocaleString() }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.holding-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.holding-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.holding-tab {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-dim);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.holding-tab:hover { color: var(--color-text); }
.holding-tab.active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.holding-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

.holding-error {
  background: rgba(139, 26, 26, 0.2);
  border: 1px solid var(--color-crimson, #8b1a1a);
  color: #e8a0a0;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  margin-bottom: var(--space-sm);
}

.detail-section {
  margin-bottom: var(--space-md);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xs);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-xs);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 2px 0;
}

.detail-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  min-width: 80px;
}

.detail-value {
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.detail-value.consumption { color: #c44; }
.detail-value.special { color: var(--color-gold); font-style: italic; }

.detail-bar-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.detail-bar {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
}

.detail-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.hp-fill { background: linear-gradient(90deg, #8b1a1a, #c44); }
.manpower-fill { background: linear-gradient(90deg, var(--color-gold), #e8c84c); }

.detail-bar-text {
  font-size: 10px;
  color: var(--color-text-dim);
  white-space: nowrap;
  min-width: 90px;
  text-align: right;
}

.detail-description {
  font-size: 11px;
  color: var(--color-text-dim);
  font-style: italic;
  padding: 2px 0 4px 0;
}

.detail-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

/* Slots grid */
.slot-grid {
  display: flex;
  gap: var(--space-md);
}

.slot-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.slot-label {
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.slot-value {
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

/* Resource nodes */
.node-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.node-name {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  text-transform: capitalize;
}

.node-resource {
  font-size: var(--font-size-xs);
  text-transform: capitalize;
}

/* Buildings */
.building-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  margin-bottom: 3px;
}

.building-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.building-name {
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.building-tier {
  font-size: 10px;
  color: var(--color-gold);
  font-weight: 600;
}

.building-node {
  font-size: 10px;
  color: var(--color-text-dim);
  font-style: italic;
}
.building-node.unassigned { color: var(--color-text-muted); }

.building-construction {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.construction-text {
  font-size: 10px;
  color: var(--color-gold);
  font-style: italic;
}

.construction-time {
  font-size: 10px;
  color: var(--color-text-dim);
}

.build-btn, .upgrade-btn {
  background: none;
  border: 1px solid var(--color-gold);
  color: var(--color-gold);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: background 0.15s;
}
.build-btn:hover, .upgrade-btn:hover {
  background: rgba(201, 168, 76, 0.15);
}

.cancel-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
}
.cancel-btn:hover { color: #c44; }

.warehouse-upgrade {
  margin-top: var(--space-sm);
  width: 100%;
}

/* Resources */
.resource-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 3px 0;
}

.resource-label {
  font-size: var(--font-size-xs);
  text-transform: capitalize;
  min-width: 50px;
}

.iron-label {
  color: var(--color-text);
  min-width: 120px;
}

.resource-value {
  font-size: 10px;
  color: var(--color-text-dim);
  white-space: nowrap;
  min-width: 90px;
  text-align: right;
}

/* Build select */
.build-select-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.build-select {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: 300px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.build-select-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  text-transform: uppercase;
}

.build-select-list {
  overflow-y: auto;
  padding: var(--space-sm);
}

.build-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  margin-bottom: 4px;
  transition: border-color 0.15s;
}
.build-option:hover { border-color: var(--color-gold); }

.build-option-name {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  font-weight: 600;
}

.build-option-desc {
  font-size: 10px;
  color: var(--color-text-dim);
}

.build-option-costs {
  display: flex;
  gap: var(--space-xs);
  font-size: 10px;
  color: var(--color-text-muted);
}

.build-time {
  color: var(--color-gold);
}
</style>
