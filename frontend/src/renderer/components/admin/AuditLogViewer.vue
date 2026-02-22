<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAdminSocialStore } from '@/stores/adminSocial'

const store = useAdminSocialStore()

onMounted(() => {
  store.fetchAuditLog()
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

const showingRange = computed(() => {
  const f = store.auditFilters
  const start = f.offset + 1
  const end = Math.min(f.offset + f.limit, store.auditTotal)
  return `${start}-${end} of ${store.auditTotal}`
})

const hasPrev = computed(() => store.auditFilters.offset > 0)
const hasNext = computed(() => store.auditFilters.offset + store.auditFilters.limit < store.auditTotal)

const TARGET_TYPES = ['', 'application', 'character', 'organization', 'faction', 'family_tree_npc', 'family_tree_edge', 'role', 'permission']
</script>

<template>
  <div class="audit-viewer">
    <!-- Filters -->
    <div class="filters">
      <input
        :value="store.auditFilters.actionKey"
        type="text"
        class="filter-input"
        placeholder="Action key..."
        @change="store.setAuditFilter('actionKey', ($event.target as HTMLInputElement).value)"
      />
      <select
        :value="store.auditFilters.targetType"
        class="filter-select"
        @change="store.setAuditFilter('targetType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">All targets</option>
        <option v-for="t in TARGET_TYPES.slice(1)" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <!-- Results -->
    <div v-if="store.isLoading" class="loading">Loading...</div>
    <div v-else-if="store.auditEntries.length === 0" class="empty-state">No audit entries</div>

    <div v-else class="log-list">
      <div v-for="entry in store.auditEntries" :key="entry.id" class="log-entry">
        <div class="log-entry-top">
          <span class="log-time">{{ formatTime(entry.created_at) }}</span>
          <span class="log-actor">{{ entry.actor_name }}</span>
          <span v-if="entry.actor_role" class="log-role">{{ entry.actor_role }}</span>
        </div>
        <div class="log-entry-body">
          <span class="log-action">{{ entry.action_key }}</span>
          <span class="log-desc">{{ entry.description }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="store.auditTotal > 0" class="pagination">
      <button class="page-btn" :disabled="!hasPrev" @click="store.prevAuditPage()">Prev</button>
      <span class="page-info">{{ showingRange }}</span>
      <button class="page-btn" :disabled="!hasNext" @click="store.nextAuditPage()">Next</button>
    </div>
  </div>
</template>

<style scoped>
.audit-viewer {
  padding: 0 var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* Filters */
.filters {
  display: flex;
  gap: var(--space-xs);
}

.filter-input,
.filter-select {
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

.filter-input {
  flex: 1;
}

.filter-input:focus,
.filter-select:focus {
  border-color: var(--color-gold-dim);
}

/* Log entries */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px var(--space-sm);
  background: var(--color-surface);
  border-left: 2px solid var(--color-border-dim);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.log-entry-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.log-time {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  min-width: 90px;
}

.log-actor {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  font-weight: 600;
}

.log-role {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-gold);
  text-transform: uppercase;
  padding: 0 4px;
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 2px;
}

.log-entry-body {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.log-action {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gold-dim);
  flex-shrink: 0;
}

.log-desc {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.page-btn {
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

.page-btn:hover:not(:disabled) {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
