<script setup lang="ts">
import { onMounted } from 'vue'
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()

const ORG_TYPE_LABELS: Record<string, string> = {
  order: 'Order',
  guild: 'Guild',
  company: 'Company',
}

onMounted(() => {
  store.fetchOrganizations()
})
</script>

<template>
  <div class="org-list">
    <div v-if="store.organizations.length === 0" class="empty-state">
      No organizations found
    </div>
    <button
      v-for="org in store.organizations"
      :key="org.id"
      class="org-card"
      @click="store.viewOrganization(org.id)"
    >
      <div class="org-card-top">
        <span class="org-card-name">{{ org.name }}</span>
        <span class="badge badge--type">{{ ORG_TYPE_LABELS[org.org_type] ?? org.org_type }}</span>
      </div>
      <div class="org-card-meta">
        <span v-if="org.leader_name">Leader: {{ org.leader_name }}</span>
        <span>{{ org.member_count }} member{{ org.member_count !== 1 ? 's' : '' }}</span>
      </div>
      <div v-if="org.description" class="org-card-desc">
        {{ org.description.length > 100 ? org.description.slice(0, 100) + '...' : org.description }}
      </div>
    </button>
  </div>
</template>

<style scoped>
.org-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.org-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.org-card:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.org-card-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.org-card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
}

.org-card-meta {
  display: flex;
  gap: var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.org-card-desc {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.badge--type {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
  background: rgba(201, 168, 76, 0.05);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
}
</style>
