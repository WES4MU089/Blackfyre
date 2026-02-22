<script setup lang="ts">
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()
</script>

<template>
  <div class="faction-detail">
    <template v-if="store.selectedFaction">
      <div class="detail-header">
        <h2 class="detail-title">{{ store.selectedFaction.name }}</h2>
        <div class="detail-meta">
          <span v-if="store.selectedFaction.leader_name">Leader: {{ store.selectedFaction.leader_name }}</span>
          <span>{{ store.selectedFaction.public_member_count }} public member{{ store.selectedFaction.public_member_count !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div v-if="store.selectedFaction.description" class="detail-description">
        {{ store.selectedFaction.description }}
      </div>

      <div class="section-label">Public Members</div>
      <div class="visibility-note">Only publicly declared members are shown</div>

      <div v-if="store.selectedFactionMembers.length === 0" class="empty-state">
        No public members
      </div>
      <div v-else class="member-list">
        <div v-for="member in store.selectedFactionMembers" :key="member.character_id" class="member-item">
          <span class="member-name">{{ member.character_name }}</span>
          <span v-if="member.title" class="member-title">{{ member.title }}</span>
          <span v-if="member.house_name" class="member-house">House {{ member.house_name }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.faction-detail {
  display: flex;
  flex-direction: column;
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

.visibility-note {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  font-style: italic;
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

.member-house {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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
