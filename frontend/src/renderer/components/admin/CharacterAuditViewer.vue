<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAdminSocialStore } from '@/stores/adminSocial'

const store = useAdminSocialStore()

onMounted(() => {
  store.fetchCharacterAudit()
})

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCoins(copper: number): string {
  const dragons = Math.floor(copper / 10000)
  const stags = Math.floor((copper % 10000) / 100)
  const stars = copper % 100
  const parts: string[] = []
  if (dragons > 0) parts.push(`${dragons}d`)
  if (stags > 0) parts.push(`${stags}s`)
  parts.push(`${stars}c`)
  return parts.join(' ')
}

const EVENT_LABELS: Record<string, string> = {
  combat_defeated: 'Combat Defeated',
  retainer_killed: 'Retainer Killed',
  loot_collected: 'Loot Collected',
  trade_executed: 'Trade Executed',
  execution: 'Execution',
  ailment_death: 'Ailment Death',
  ko_death: 'KO Death',
}

const EVENT_COLORS: Record<string, string> = {
  combat_defeated: '#c42b2b',
  retainer_killed: '#d48f32',
  loot_collected: '#d4a932',
  trade_executed: '#4a9e4a',
  execution: '#8b1a1a',
  ailment_death: '#8b1a1a',
  ko_death: '#c42b2b',
}

const EVENT_TYPES = ['', 'combat_defeated', 'retainer_killed', 'loot_collected', 'trade_executed', 'execution', 'ailment_death', 'ko_death']

const showingRange = computed(() => {
  const f = store.charAuditFilters
  const start = f.offset + 1
  const end = Math.min(f.offset + f.limit, store.charAuditTotal)
  return `${start}-${end} of ${store.charAuditTotal}`
})

const hasPrev = computed(() => store.charAuditFilters.offset > 0)
const hasNext = computed(() => store.charAuditFilters.offset + store.charAuditFilters.limit < store.charAuditTotal)
</script>

<template>
  <div class="ca-viewer">
    <!-- Filters -->
    <div class="ca-filters">
      <input
        :value="store.charAuditFilters.characterName"
        type="text"
        class="ca-input"
        placeholder="Character name..."
        @change="store.setCharAuditFilter('characterName', ($event.target as HTMLInputElement).value)"
      />
      <select
        :value="store.charAuditFilters.eventType"
        class="ca-select"
        @change="store.setCharAuditFilter('eventType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">All events</option>
        <option v-for="t in EVENT_TYPES.slice(1)" :key="t" :value="t">{{ EVENT_LABELS[t] || t }}</option>
      </select>
    </div>

    <!-- Results -->
    <div v-if="store.isLoading" class="ca-empty">Loading...</div>
    <div v-else-if="store.charAuditEntries.length === 0" class="ca-empty">No snapshot entries</div>

    <div v-else class="ca-list">
      <div
        v-for="entry in store.charAuditEntries"
        :key="entry.id"
        class="ca-entry"
        :class="{ 'ca-entry--expanded': store.charAuditExpanded === entry.id }"
      >
        <!-- Summary row -->
        <div class="ca-summary" @click="store.toggleCharAuditExpand(entry.id)">
          <span class="ca-time">{{ formatTime(entry.created_at) }}</span>
          <span class="ca-name">{{ entry.character_name }}</span>
          <span class="ca-badge" :style="{ borderColor: EVENT_COLORS[entry.event_type] || '#787878', color: EVENT_COLORS[entry.event_type] || '#787878' }">
            {{ EVENT_LABELS[entry.event_type] || entry.event_type }}
          </span>
          <span v-if="entry.event_source" class="ca-source">{{ entry.event_source }}</span>
          <span class="ca-chevron">{{ store.charAuditExpanded === entry.id ? '\u25B2' : '\u25BC' }}</span>
        </div>

        <!-- Expanded snapshot -->
        <div v-if="store.charAuditExpanded === entry.id" class="ca-snapshot">
          <div class="ca-section">
            <div class="ca-section-title">Character</div>
            <div class="ca-row">
              <span>Level {{ entry.snapshot.level }}</span>
              <span>XP: {{ entry.snapshot.xpSegments }}/10</span>
              <span>State: {{ entry.snapshot.deathState }}</span>
              <span v-if="entry.snapshot.woundSeverity">Wound: {{ entry.snapshot.woundSeverity }}</span>
            </div>
          </div>

          <div class="ca-section">
            <div class="ca-section-title">Finances</div>
            <div class="ca-row">
              <span>Purse: {{ formatCoins(entry.snapshot.finances.purse) }}</span>
              <span>Vault: {{ formatCoins(entry.snapshot.finances.vault) }}</span>
              <span>Vault Tier: {{ entry.snapshot.finances.vaultTier }}</span>
            </div>
          </div>

          <div v-if="entry.snapshot.equipment.length > 0" class="ca-section">
            <div class="ca-section-title">Equipment</div>
            <div v-for="eq in entry.snapshot.equipment" :key="eq.slotId" class="ca-item-row">
              <span class="ca-slot">{{ eq.slotId }}</span>
              <span class="ca-item-name">{{ eq.itemName }}</span>
              <span v-if="eq.durability < 100" class="ca-dim">({{ Math.round(eq.durability) }}%)</span>
            </div>
          </div>

          <div v-if="entry.snapshot.inventory.length > 0" class="ca-section">
            <div class="ca-section-title">Inventory ({{ entry.snapshot.inventory.length }} items)</div>
            <div v-for="inv in entry.snapshot.inventory" :key="inv.inventoryId" class="ca-item-row">
              <span class="ca-item-name">{{ inv.itemName }}</span>
              <span v-if="inv.quantity > 1" class="ca-qty">x{{ inv.quantity }}</span>
              <span v-if="inv.durability < 100" class="ca-dim">({{ Math.round(inv.durability) }}%)</span>
            </div>
          </div>

          <div v-if="entry.snapshot.retainers.length > 0" class="ca-section">
            <div class="ca-section-title">Retainers</div>
            <div v-for="ret in entry.snapshot.retainers" :key="ret.characterId" class="ca-item-row">
              <span class="ca-item-name">{{ ret.name }}</span>
              <span class="ca-dim">T{{ ret.tier }} Lv{{ ret.level }}</span>
              <span :style="{ color: ret.isActive ? '#4a9e4a' : '#c42b2b' }">{{ ret.isActive ? 'Active' : 'Inactive' }}</span>
              <span class="ca-dim">{{ ret.deathState }} ({{ Math.round(ret.health) }}hp)</span>
            </div>
          </div>

          <div v-if="entry.metadata" class="ca-section">
            <div class="ca-section-title">Metadata</div>
            <pre class="ca-json">{{ JSON.stringify(entry.metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="store.charAuditTotal > 0" class="ca-pagination">
      <button class="ca-page-btn" :disabled="!hasPrev" @click="store.prevCharAuditPage()">Prev</button>
      <span class="ca-page-info">{{ showingRange }}</span>
      <button class="ca-page-btn" :disabled="!hasNext" @click="store.nextCharAuditPage()">Next</button>
    </div>
  </div>
</template>

<style scoped>
.ca-viewer {
  padding: 0 var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.ca-filters {
  display: flex;
  gap: var(--space-xs);
}

.ca-input,
.ca-select {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}
.ca-input { flex: 1; }
.ca-input:focus, .ca-select:focus { border-color: var(--color-gold-dim); }

.ca-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ca-entry {
  background: var(--color-surface);
  border-left: 2px solid var(--color-border-dim);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.ca-entry--expanded {
  border-left-color: var(--color-gold-dim);
}

.ca-summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 5px var(--space-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.ca-summary:hover {
  background: var(--color-surface-hover);
}

.ca-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  min-width: 90px;
}

.ca-name {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  font-weight: 600;
  min-width: 100px;
}

.ca-badge {
  font-family: var(--font-mono);
  font-size: 8px;
  text-transform: uppercase;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 2px;
  white-space: nowrap;
}

.ca-source {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
}

.ca-chevron {
  margin-left: auto;
  font-size: 8px;
  color: var(--color-text-muted);
}

/* Expanded snapshot */
.ca-snapshot {
  padding: var(--space-xs) var(--space-sm) var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border-top: 1px solid var(--color-border-dim);
}

.ca-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ca-section-title {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ca-row {
  display: flex;
  gap: var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.ca-item-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  padding-left: var(--space-xs);
}

.ca-slot {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-gold-dim);
  min-width: 70px;
}

.ca-item-name {
  color: var(--color-text);
}

.ca-qty {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.ca-dim {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
}

.ca-json {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
  background: rgba(0, 0, 0, 0.2);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
}

/* Pagination */
.ca-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.ca-page-btn {
  padding: 3px 10px;
  font-family: var(--font-body);
  font-size: 10px;
  text-transform: uppercase;
  color: var(--color-text-dim);
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ca-page-btn:hover:not(:disabled) { color: var(--color-gold); border-color: var(--color-gold-dim); }
.ca-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.ca-page-info {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.ca-empty {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
