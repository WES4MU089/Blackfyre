<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCreationStore, type ClassTemplate } from '@/stores/creation'
import dragonIcon from '@res/images/art/Currency/dragon.png'
import stagIcon from '@res/images/art/Currency/stag.png'
import starIcon from '@res/images/art/Currency/star.png'

const store = useCreationStore()

// Currency: 1 Dragon = 100 Stags, 1 Stag = 100 Stars (stored in Stars)
function toCurrency(raw: number) {
  return {
    dragons: Math.floor(raw / 10000),
    stags: Math.floor((raw % 10000) / 100),
    stars: raw % 100,
  }
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'nobility', label: 'Nobility' },
  { key: 'military', label: 'Military' },
  { key: 'religious', label: 'Religious' },
  { key: 'scholarly', label: 'Scholarly' },
  { key: 'commerce', label: 'Commerce' },
  { key: 'criminal', label: 'Criminal' },
  { key: 'common', label: 'Common' },
]

const activeCategory = ref('all')

const filteredTemplates = computed(() => {
  if (activeCategory.value === 'all') return store.templates
  return store.templates.filter(t => t.category === activeCategory.value)
})

function selectTemplate(t: ClassTemplate): void {
  store.selectTemplate(t)
}

</script>

<template>
  <div class="step-template">
    <!-- Category filter tabs -->
    <div class="category-tabs">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.key"
        class="category-tab"
        :class="{ 'category-tab--active': activeCategory === cat.key }"
        @click="activeCategory = cat.key"
      >
        {{ cat.label }}
      </button>
    </div>

    <div class="template-layout">
      <!-- Card grid -->
      <div class="template-grid">
        <button
          v-for="t in filteredTemplates"
          :key="t.template_key"
          class="template-card"
          :class="{ 'template-card--selected': store.selectedTemplate?.template_key === t.template_key }"
          @click="selectTemplate(t)"
        >
          <div class="card-header">
            <span class="card-name">{{ t.name }}</span>
            <span class="card-category">{{ t.category }}</span>
          </div>
          <p class="card-description">{{ t.description }}</p>
          <div class="card-meta">
            <span class="card-points" title="Free aptitude points">
              {{ t.free_aptitude_points }} free pts
            </span>
            <span class="card-wealth" title="Starting purse">
              <template v-if="toCurrency(t.starting_cash).dragons > 0">
                <img :src="dragonIcon" alt="" class="card-coin" />{{ toCurrency(t.starting_cash).dragons }}
              </template>
              <img :src="stagIcon" alt="" class="card-coin" />{{ toCurrency(t.starting_cash).stags }}
              <template v-if="toCurrency(t.starting_cash).stars > 0">
                <img :src="starIcon" alt="" class="card-coin" />{{ toCurrency(t.starting_cash).stars }}
              </template>
            </span>
          </div>
          <p v-if="t.fantasy_examples" class="card-examples">{{ t.fantasy_examples }}</p>
        </button>
      </div>

      <!-- Detail panel -->
      <div v-if="store.selectedTemplate" class="template-detail">
        <h2 class="detail-name">{{ store.selectedTemplate.name }}</h2>
        <span class="detail-category">{{ store.selectedTemplate.category }}</span>
        <p class="detail-description">{{ store.selectedTemplate.description }}</p>

        <p v-if="store.selectedTemplate.fantasy_examples" class="detail-examples">
          <span class="detail-label">Think:</span> {{ store.selectedTemplate.fantasy_examples }}
        </p>

        <!-- Locked Aptitudes -->
        <div class="detail-section">
          <h3 class="detail-section-title">Starting Aptitudes</h3>
          <div class="detail-aptitudes">
            <div
              v-for="(val, key) in store.selectedTemplate.locked_aptitudes"
              :key="key"
              class="detail-apt-row"
            >
              <span class="detail-apt-name">{{ store.APTITUDE_LABELS[key as string] || key }}</span>
              <div class="detail-apt-pips">
                <span
                  v-for="i in 7"
                  :key="i"
                  class="detail-pip"
                  :class="{ 'detail-pip--filled': i <= val }"
                />
              </div>
              <span class="detail-apt-val">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- Starting Wealth & Points -->
        <div class="detail-section">
          <h3 class="detail-section-title">Starting Resources</h3>

          <!-- Purse (cash on hand) -->
          <div class="detail-currency-group">
            <span class="detail-label">Purse</span>
            <div class="detail-coins">
              <div v-if="toCurrency(store.selectedTemplate.starting_cash).dragons > 0" class="coin-item">
                <img :src="dragonIcon" alt="Dragons" class="coin-icon" />
                <span class="coin-value coin-gold">{{ toCurrency(store.selectedTemplate.starting_cash).dragons }}</span>
              </div>
              <div class="coin-item">
                <img :src="stagIcon" alt="Stags" class="coin-icon" />
                <span class="coin-value coin-silver">{{ toCurrency(store.selectedTemplate.starting_cash).stags }}</span>
              </div>
              <div v-if="toCurrency(store.selectedTemplate.starting_cash).stars > 0" class="coin-item">
                <img :src="starIcon" alt="Stars" class="coin-icon" />
                <span class="coin-value coin-copper">{{ toCurrency(store.selectedTemplate.starting_cash).stars }}</span>
              </div>
            </div>
          </div>

          <!-- Free allocation points -->
          <div class="detail-resources">
            <div class="detail-resource">
              <span class="detail-label">Free Apt. Points</span>
              <span class="detail-value detail-value--gold">{{ store.selectedTemplate.free_aptitude_points }}</span>
            </div>
          </div>
        </div>

        <!-- Starting Equipment -->
        <div v-if="store.selectedTemplate.starting_items.length > 0" class="detail-section">
          <h3 class="detail-section-title">Starting Equipment</h3>
          <div class="detail-items">
            <span v-for="item in store.selectedTemplate.starting_items" :key="item.item_key" class="detail-item">
              {{ item.item_key.replace(/_/g, ' ') }}<span v-if="item.quantity > 1"> x{{ item.quantity }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="template-detail template-detail--empty">
        <p class="detail-empty-text">Select a class to view details</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-template {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  height: 100%;
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.category-tab {
  padding: 5px 12px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.category-tab:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.category-tab--active {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

/* Layout */
.template-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-md);
  flex: 1;
  min-height: 0;
}

/* Card Grid */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-sm);
  align-content: start;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.template-card:hover {
  border-color: var(--color-border);
  background: var(--color-surface-hover);
}

.template-card--selected {
  border-color: var(--color-gold-dark);
  background: rgba(201, 168, 76, 0.06);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.1);
}

.card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.template-card--selected .card-name {
  color: var(--color-gold);
}

.card-category {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.card-description {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px solid var(--color-border-dim);
}

.card-points {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.card-wealth {
  display: flex;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gold-dark);
  flex-shrink: 0;
}

.card-coin {
  width: 12px;
  height: 12px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
  margin-left: 2px;
}

.card-examples {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0;
}

/* Detail Panel */
.template-detail {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.template-detail--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: var(--color-border-dim);
}

.detail-empty-text {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 4px;
}

.detail-category {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.detail-description {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: var(--space-sm) 0;
}

.detail-examples {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0 0 var(--space-md);
}

.detail-label {
  color: var(--color-text-dim);
  font-style: normal;
}

/* Detail Sections */
.detail-section {
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border-dim);
}

.detail-section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 var(--space-sm);
}

/* Aptitude display */
.detail-aptitudes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-apt-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-apt-name {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  width: 80px;
  flex-shrink: 0;
  text-align: right;
}

.detail-apt-pips {
  display: flex;
  gap: 2px;
  flex: 1;
}

.detail-pip {
  width: 100%;
  max-width: 20px;
  height: 8px;
  background: rgba(201, 168, 76, 0.06);
  border: 1px solid rgba(201, 168, 76, 0.12);
  border-radius: 1px;
  flex: 1;
}

.detail-pip--filled {
  background: linear-gradient(180deg, var(--color-gold), var(--color-gold-dark));
  border-color: rgba(201, 168, 76, 0.5);
}

.detail-pip--skill {
  max-width: 24px;
  height: 10px;
}

.detail-apt-val {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

/* Skills display */
.detail-skills {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-skill-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-skill-name {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  width: 80px;
  text-align: right;
  flex-shrink: 0;
  text-transform: capitalize;
}

.detail-skill-pips {
  display: flex;
  gap: 3px;
}

/* Currency display */
.detail-currency-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(201, 168, 76, 0.03);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}

.detail-coins {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.coin-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.coin-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.coin-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.coin-gold { color: var(--color-gold); }
.coin-silver { color: #b8c4d0; }
.coin-copper { color: #c48a5a; }

/* Resources */
.detail-resources {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.detail-resource {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(201, 168, 76, 0.03);
  border-radius: var(--radius-sm);
}

.detail-resource .detail-label {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.detail-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.detail-value--gold {
  color: var(--color-gold);
}

/* Items */
.detail-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-item {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  padding: 2px 8px;
  background: rgba(201, 168, 76, 0.05);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  text-transform: capitalize;
}
</style>
