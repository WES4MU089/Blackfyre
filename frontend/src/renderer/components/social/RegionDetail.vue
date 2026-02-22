<script setup lang="ts">
import { useSocialStore } from '@/stores/social'

const store = useSocialStore()
</script>

<template>
  <div class="region-detail">
    <template v-if="store.selectedRegion">
      <div class="detail-header">
        <h2 class="detail-title">{{ store.selectedRegion.name }}</h2>
        <div v-if="store.selectedRegion.ruling_house_name" class="detail-subtitle">
          Ruled by House {{ store.selectedRegion.ruling_house_name }}
        </div>
      </div>

      <div v-if="store.selectedRegion.description" class="detail-description">
        {{ store.selectedRegion.description }}
      </div>

      <div class="section-label">Houses</div>

      <div v-if="store.regionHouses.length === 0" class="empty-state">
        No houses in this region
      </div>

      <div class="house-grid">
        <button
          v-for="house in store.regionHouses"
          :key="house.id"
          class="house-card"
          @click="store.viewHouse(house.id)"
        >
          <div class="house-card-top">
            <span class="house-card-name">{{ house.name }}</span>
            <span v-if="house.is_royal_house" class="badge badge--royal">Royal</span>
            <span v-else-if="house.is_great_house" class="badge badge--great">Great</span>
          </div>
          <div v-if="house.motto" class="house-card-motto">"{{ house.motto }}"</div>
          <div v-if="house.seat" class="house-card-meta">Seat: {{ house.seat }}</div>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.region-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-header {
  margin-bottom: var(--space-xs);
}

.detail-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.detail-subtitle {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  margin-top: 2px;
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
}

.house-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.house-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.house-card:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.house-card-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.house-card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.08em;
}

.house-card-motto {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  font-style: italic;
}

.house-card-meta {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.badge {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
}

.badge--royal {
  color: var(--color-gold);
  border: 1px solid rgba(201, 168, 76, 0.4);
  background: rgba(201, 168, 76, 0.1);
}

.badge--great {
  color: var(--color-text-dim);
  border: 1px solid var(--color-border);
  background: rgba(201, 168, 76, 0.05);
}

.empty-state {
  text-align: center;
  padding: var(--space-lg);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.1em;
}
</style>
