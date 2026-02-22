<script setup lang="ts">
import { onMounted } from 'vue'
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()

onMounted(() => {
  store.fetchRegions()
})
</script>

<template>
  <div class="region-list">
    <div v-if="store.regions.length === 0" class="empty-state">
      No regions found
    </div>
    <button
      v-for="region in store.regions"
      :key="region.id"
      class="region-card"
      @click="store.viewRegion(region.id)"
    >
      <div class="region-card-name">{{ region.name }}</div>
      <div v-if="region.ruling_house_name" class="region-card-meta">
        Ruled by House {{ region.ruling_house_name }}
      </div>
      <div v-if="region.description" class="region-card-desc">
        {{ region.description.length > 120 ? region.description.slice(0, 120) + '...' : region.description }}
      </div>
    </button>
  </div>
</template>

<style scoped>
.region-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.region-card {
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

.region-card:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.region-card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.region-card-meta {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.region-card-desc {
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
