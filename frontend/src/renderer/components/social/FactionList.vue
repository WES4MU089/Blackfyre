<script setup lang="ts">
import { onMounted } from 'vue'
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()

onMounted(() => {
  store.fetchFactions()
})
</script>

<template>
  <div class="faction-list">
    <div v-if="store.factions.length === 0" class="empty-state">
      No active factions
    </div>
    <button
      v-for="faction in store.factions"
      :key="faction.id"
      class="faction-card"
      @click="store.viewFaction(faction.id)"
    >
      <div class="faction-card-top">
        <span class="faction-card-name">{{ faction.name }}</span>
        <span class="faction-card-count">
          {{ faction.public_member_count }} public member{{ faction.public_member_count !== 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="faction.leader_name" class="faction-card-meta">
        Led by {{ faction.leader_name }}
      </div>
      <div v-if="faction.description" class="faction-card-desc">
        {{ faction.description.length > 100 ? faction.description.slice(0, 100) + '...' : faction.description }}
      </div>
    </button>
  </div>
</template>

<style scoped>
.faction-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.faction-card {
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

.faction-card:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.faction-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.faction-card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
}

.faction-card-count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.faction-card-meta {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.faction-card-desc {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
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
