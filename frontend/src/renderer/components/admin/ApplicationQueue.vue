<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'revision', label: 'Revision' },
  { value: 'all', label: 'All' },
]

function tierLabel(tier: number): string {
  return tier === 3 ? 'III' : 'II'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function onFilterChange(status: string): void {
  adminStore.statusFilter = status
  adminStore.fetchApplicationQueue()
}

onMounted(() => {
  adminStore.fetchApplicationQueue()
})
</script>

<template>
  <div class="app-queue">
    <!-- Filter bar -->
    <div class="queue-filters">
      <button
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value"
        class="filter-btn"
        :class="{ 'filter-btn--active': adminStore.statusFilter === opt.value }"
        @click="onFilterChange(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="adminStore.isLoading" class="queue-loading">Loading...</div>

    <!-- Empty -->
    <div v-else-if="adminStore.filteredApplications.length === 0" class="queue-empty">
      No applications found.
    </div>

    <!-- List -->
    <div v-else class="queue-list">
      <button
        v-for="app in adminStore.filteredApplications"
        :key="app.id"
        class="queue-item"
        @click="adminStore.fetchApplicationDetail(app.id)"
      >
        <div class="queue-item-top">
          <span class="queue-item-name">{{ app.character_name }}</span>
          <span class="queue-item-tier" :class="`queue-item-tier--${app.tier}`">T{{ tierLabel(app.tier) }}</span>
        </div>
        <div class="queue-item-mid">
          <span v-if="app.house_name" class="queue-item-house">{{ app.house_name }}</span>
          <span v-else class="queue-item-house queue-item-house--none">No house</span>
          <span class="queue-item-role" v-if="app.requested_role !== 'member'">{{ app.requested_role.replace(/_/g, ' ') }}</span>
        </div>
        <div class="queue-item-bottom">
          <span class="queue-item-status" :class="`queue-item-status--${app.status}`">{{ app.status }}</span>
          <span class="queue-item-time">{{ timeAgo(app.created_at) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-queue {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.queue-filters {
  display: flex;
  gap: 4px;
  padding: 0 var(--space-sm);
}

.filter-btn {
  padding: 3px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  border-color: var(--color-gold-dim);
  color: var(--color-text-dim);
}

.filter-btn--active {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
}

.queue-loading,
.queue-empty {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-lg);
  font-style: italic;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 var(--space-sm);
  max-height: 480px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.queue-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.queue-item:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.queue-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.queue-item-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.queue-item-tier {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 2px;
}

.queue-item-tier--2 {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
}

.queue-item-tier--3 {
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.12);
}

.queue-item-mid {
  display: flex;
  align-items: center;
  gap: 8px;
}

.queue-item-house {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.queue-item-house--none {
  color: var(--color-text-muted);
  font-style: italic;
}

.queue-item-role {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-gold-dark);
  text-transform: capitalize;
}

.queue-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.queue-item-status {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
}

.queue-item-status--pending {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
}

.queue-item-status--approved {
  color: var(--color-success);
  background: rgba(45, 138, 78, 0.12);
}

.queue-item-status--denied {
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.12);
}

.queue-item-status--revision {
  color: #c87830;
  background: rgba(200, 120, 48, 0.12);
}

.queue-item-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
}
</style>
