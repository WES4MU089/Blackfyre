<script setup lang="ts">
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()

const ORG_TYPE_LABELS: Record<string, string> = {
  order: 'Order',
  guild: 'Guild',
  company: 'Company',
}
</script>

<template>
  <div class="org-detail">
    <template v-if="store.selectedOrg">
      <div class="detail-header">
        <div class="detail-header-top">
          <h2 class="detail-title">{{ store.selectedOrg.name }}</h2>
          <span class="badge badge--type">{{ ORG_TYPE_LABELS[store.selectedOrg.org_type] ?? store.selectedOrg.org_type }}</span>
          <span v-if="store.selectedOrg.requires_approval" class="badge badge--restricted">Restricted</span>
        </div>
        <div class="detail-meta">
          <span v-if="store.selectedOrg.leader_name">Leader: {{ store.selectedOrg.leader_name }}</span>
          <span v-if="store.selectedOrg.region_name">Region: {{ store.selectedOrg.region_name }}</span>
          <span>{{ store.selectedOrg.member_count }} member{{ store.selectedOrg.member_count !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div v-if="store.selectedOrg.description" class="detail-description">
        {{ store.selectedOrg.description }}
      </div>

      <div class="section-label">Members</div>

      <div v-if="store.selectedOrgMembers.length === 0" class="empty-state">
        No members
      </div>
      <div v-else class="member-list">
        <div v-for="member in store.selectedOrgMembers" :key="member.id" class="member-item">
          <span class="member-name">{{ member.character_name }}</span>
          <span v-if="member.title" class="member-title">{{ member.title }}</span>
          <span v-if="member.rank" class="member-rank">{{ member.rank }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.org-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-header-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.detail-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.detail-meta {
  display: flex;
  gap: var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  margin-top: 4px;
}

.detail-description {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.5;
  padding: var(--space-sm);
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border-dim);
  padding-bottom: var(--space-xs);
  margin-top: var(--space-sm);
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 4px var(--space-sm);
}

.member-name {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 600;
}

.member-title {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.member-rank {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  border: 1px solid var(--color-border-dim);
  padding: 0 4px;
  border-radius: 2px;
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

.badge--restricted {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
  color: #c87830;
  border: 1px solid rgba(200, 120, 48, 0.4);
  background: rgba(200, 120, 48, 0.08);
}

.empty-state {
  text-align: center;
  padding: var(--space-md);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.1em;
}
</style>
