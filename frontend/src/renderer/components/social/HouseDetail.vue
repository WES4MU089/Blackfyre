<script setup lang="ts">
import { ref } from 'vue'
import { useSocialStore } from '@/stores/social'
import FamilyTreeWidget from './FamilyTreeWidget.vue'
import SuggestEditForm from './SuggestEditForm.vue'

const store = useSocialStore()
const showSuggestForm = ref(false)
</script>

<template>
  <div class="house-detail">
    <template v-if="store.houseDetail">
      <!-- House info -->
      <div class="house-info">
        <div class="house-info-top">
          <h2 class="house-name">House {{ store.houseDetail.name }}</h2>
          <span v-if="store.houseDetail.is_royal_house" class="badge badge--royal">Royal</span>
          <span v-else-if="store.houseDetail.is_great_house" class="badge badge--great">Great</span>
        </div>
        <div v-if="store.houseDetail.motto" class="house-motto">"{{ store.houseDetail.motto }}"</div>
        <div class="house-meta-row">
          <span v-if="store.houseDetail.seat" class="house-meta">Seat: {{ store.houseDetail.seat }}</span>
          <span v-if="store.houseDetail.region_name" class="house-meta">Region: {{ store.houseDetail.region_name }}</span>
        </div>
      </div>

      <!-- Character Roster -->
      <div class="section-label">Members</div>
      <div v-if="store.familyTreeCharacters.length === 0" class="empty-state">
        No characters in this house
      </div>
      <div v-else class="roster">
        <div
          v-for="char in store.familyTreeCharacters"
          :key="char.id"
          class="roster-item"
          :class="{ 'roster-item--inactive': !char.is_active }"
        >
          <span class="roster-name">{{ char.name }}</span>
          <span v-if="char.title" class="roster-title">{{ char.title }}</span>
          <span v-if="char.epithet" class="roster-epithet">{{ char.epithet }}</span>
          <span v-if="!char.is_active" class="roster-deceased">Deceased</span>
        </div>
      </div>

      <!-- Family Tree -->
      <div class="section-label">
        Family Tree
        <button class="suggest-toggle" @click="showSuggestForm = !showSuggestForm">
          {{ showSuggestForm ? 'Cancel' : 'Suggest Edit' }}
        </button>
      </div>

      <SuggestEditForm
        v-if="showSuggestForm"
        :house-id="store.houseDetail.id"
        :characters="store.familyTreeCharacters"
        :npcs="store.familyTreeNpcs"
        @submitted="showSuggestForm = false"
      />

      <FamilyTreeWidget
        v-if="store.familyTreeEdges.length > 0 || store.familyTreeNpcs.length > 0"
        :npcs="store.familyTreeNpcs"
        :edges="store.familyTreeEdges"
        :characters="store.familyTreeCharacters"
      />
      <div v-else class="empty-state">
        No family tree data yet
      </div>
    </template>
  </div>
</template>

<style scoped>
.house-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.house-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.house-info-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.house-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.house-motto {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  font-style: italic;
}

.house-meta-row {
  display: flex;
  gap: var(--space-md);
}

.house-meta {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border-dim);
  padding-bottom: var(--space-xs);
  margin-top: var(--space-sm);
}

.suggest-toggle {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-gold);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all var(--transition-fast);
}

.suggest-toggle:hover {
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

/* Roster */
.roster {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.roster-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 4px var(--space-sm);
  border-radius: var(--radius-sm);
}

.roster-item--inactive {
  opacity: 0.5;
}

.roster-name {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 600;
}

.roster-title {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.roster-epithet {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.roster-deceased {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-crimson-light);
  text-transform: uppercase;
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
  padding: var(--space-md);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.1em;
}
</style>
