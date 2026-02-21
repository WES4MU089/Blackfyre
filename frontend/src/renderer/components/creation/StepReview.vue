<script setup lang="ts">
import { computed } from 'vue'
import { useCreationStore } from '@/stores/creation'
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

// Aptitudes sorted by value descending for compact display
const sortedAptitudes = computed(() =>
  store.APTITUDE_KEYS
    .map(key => ({ key, label: store.APTITUDE_LABELS[key], value: store.aptitudes[key] ?? 1 }))
    .sort((a, b) => b.value - a.value)
)

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  head_of_house: 'Head of House',
  lord_paramount: 'Lord Paramount',
  royalty: 'Royalty',
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

</script>

<template>
  <div v-if="store.selectedTemplate" class="step-review">
    <!-- Character name -->
    <h2 class="review-name">{{ store.characterName }}</h2>
    <span class="review-template">{{ store.selectedTemplate.name }}</span>

    <!-- Sections -->
    <div class="review-sections">
      <!-- Aptitudes -->
      <div class="review-section">
        <button class="section-header" @click="store.goToStep('aptitudes')">
          <h3 class="section-title">Aptitudes</h3>
          <span class="section-edit">edit</span>
        </button>
        <div class="aptitude-list">
          <div v-for="apt in sortedAptitudes" :key="apt.key" class="review-apt-row">
            <span class="review-apt-name">{{ apt.label }}</span>
            <div class="review-apt-pips">
              <span
                v-for="i in 7"
                :key="i"
                class="review-pip"
                :class="{ 'review-pip--filled': i <= apt.value }"
              />
            </div>
            <span class="review-apt-val">{{ apt.value }}</span>
          </div>
        </div>
      </div>

      <!-- Starting Resources -->
      <div class="review-section">
        <button class="section-header" @click="store.goToStep('template')">
          <h3 class="section-title">Starting Resources</h3>
          <span class="section-edit">edit</span>
        </button>
        <div class="resource-grid">
          <div class="resource-item">
            <span class="resource-label">Purse</span>
            <div class="resource-coins">
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
          <div v-if="store.selectedTemplate.starting_job_key" class="resource-item">
            <span class="resource-label">Job</span>
            <span class="resource-value">{{ store.selectedTemplate.starting_job_key }}</span>
          </div>
        </div>
        <div v-if="store.selectedTemplate.starting_items.length > 0" class="resource-items">
          <span class="resource-label">Equipment:</span>
          <span v-for="item in store.selectedTemplate.starting_items" :key="item.item_key" class="review-item">
            {{ item.item_key.replace(/_/g, ' ') }}<span v-if="item.quantity > 1"> x{{ item.quantity }}</span>
          </span>
        </div>
      </div>

      <!-- Lineage & House -->
      <div class="review-section">
        <button class="section-header" @click="store.goToStep('identity')">
          <h3 class="section-title">Lineage</h3>
          <span class="section-edit">edit</span>
        </button>
        <div class="lineage-content">
          <!-- Parentage -->
          <div class="lineage-row">
            <span class="lineage-label">Father</span>
            <span class="lineage-value">{{ store.fatherName || '—' }}</span>
          </div>
          <div class="lineage-row">
            <span class="lineage-label">Mother</span>
            <span class="lineage-value">{{ store.motherName || '—' }}</span>
          </div>

          <!-- House -->
          <div v-if="store.selectedHouse" class="lineage-row">
            <span class="lineage-label">House</span>
            <span class="lineage-value">{{ store.selectedHouse.name }}</span>
          </div>
          <div v-else class="lineage-row">
            <span class="lineage-label">House</span>
            <span class="lineage-value lineage-value--muted">No house</span>
          </div>

          <!-- Badges -->
          <div v-if="store.isBastard || store.isDragonSeed" class="lineage-badges">
            <span v-if="store.isBastard" class="lineage-badge lineage-badge--bastard">Bastard</span>
            <span v-if="store.isDragonSeed" class="lineage-badge lineage-badge--dragon">Dragon Seed</span>
          </div>

          <!-- Requested role (if house selected) -->
          <div v-if="store.selectedHouseId && store.requestedRole !== 'member'" class="lineage-row">
            <span class="lineage-label">Role</span>
            <span class="lineage-value lineage-value--role">{{ roleLabel(store.requestedRole) }}</span>
          </div>
        </div>
      </div>

      <!-- Application Tier Banner -->
      <div v-if="store.requiresApplication" class="review-section review-section--tier">
        <div class="tier-banner" :class="`tier-banner--${store.applicationTier}`">
          <span class="tier-banner-label">Tier {{ store.applicationTier }} Application</span>
          <span class="tier-banner-hint">Requires staff approval before play</span>
        </div>
        <!-- Application bio preview -->
        <div v-if="store.applicationBio.trim()" class="tier-bio-preview">
          <span class="tier-bio-label">Application Bio</span>
          <p class="tier-bio-text">{{ store.applicationBio }}</p>
        </div>
      </div>

      <!-- Public Bio -->
      <div v-if="store.publicBio.trim()" class="review-section">
        <button class="section-header" @click="store.goToStep('identity')">
          <h3 class="section-title">Public Bio</h3>
          <span class="section-edit">edit</span>
        </button>
        <p class="review-backstory">{{ store.publicBio }}</p>
      </div>

      <!-- Backstory -->
      <div v-if="store.backstory.trim()" class="review-section">
        <button class="section-header" @click="store.goToStep('identity')">
          <h3 class="section-title">Private Backstory</h3>
          <span class="section-edit">edit</span>
        </button>
        <p class="review-backstory">{{ store.backstory }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-review {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  max-width: 600px;
  margin: 0 auto;
}

.review-name {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  margin: 0;
}

.review-template {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 10px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

/* Sections */
.review-sections {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.review-section {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  background: var(--color-surface-dark);
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.section-header:hover {
  background: var(--color-surface-hover);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.section-edit {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-gold-dark);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.section-header:hover .section-edit {
  color: var(--color-gold);
}

/* Aptitude rows */
.aptitude-list {
  padding: 6px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.review-apt-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.review-apt-name {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  width: 80px;
  text-align: right;
  flex-shrink: 0;
}

.review-apt-pips {
  display: flex;
  gap: 2px;
  flex: 1;
}

.review-pip {
  flex: 1;
  max-width: 24px;
  height: 8px;
  background: rgba(201, 168, 76, 0.05);
  border: 1px solid rgba(201, 168, 76, 0.1);
  border-radius: 1px;
}

.review-pip--filled {
  background: linear-gradient(180deg, var(--color-gold), var(--color-gold-dark));
  border-color: rgba(201, 168, 76, 0.5);
}

.review-pip--skill {
  max-width: 28px;
  height: 10px;
}

.review-apt-val {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 700;
}

/* Skill rows */
.skill-list {
  padding: 6px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.review-skill-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.review-skill-name {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  width: 120px;
  text-align: right;
  flex-shrink: 0;
}

.review-skill-pips {
  display: flex;
  gap: 3px;
}

.review-locked-tag {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-gold-dark);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.review-empty {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding: 8px 12px;
  margin: 0;
}

/* Resources */
.resource-grid {
  display: flex;
  gap: var(--space-md);
  padding: 8px 12px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resource-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.resource-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.resource-coins {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coin-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

.coin-icon {
  width: 16px;
  height: 16px;
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

.resource-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 0 12px 8px;
}

.review-item {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  padding: 1px 6px;
  background: rgba(201, 168, 76, 0.04);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  text-transform: capitalize;
}

/* Lineage */
.lineage-content {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lineage-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.lineage-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lineage-value {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.lineage-value--muted {
  color: var(--color-text-muted);
  font-style: italic;
}

.lineage-value--role {
  color: var(--color-gold);
}

.lineage-badges {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.lineage-badge {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 2px;
}

.lineage-badge--bastard {
  color: #c87830;
  background: rgba(200, 120, 48, 0.12);
  border: 1px solid rgba(200, 120, 48, 0.3);
}

.lineage-badge--dragon {
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.12);
  border: 1px solid rgba(139, 26, 26, 0.3);
}

/* Application tier */
.review-section--tier {
  border-color: rgba(201, 168, 76, 0.3);
}

.tier-banner {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tier-banner--2 {
  background: rgba(201, 168, 76, 0.06);
}

.tier-banner--3 {
  background: rgba(139, 26, 26, 0.06);
}

.tier-banner-label {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tier-banner-hint {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
}

.tier-bio-preview {
  padding: 6px 12px 10px;
  border-top: 1px solid var(--color-border-dim);
}

.tier-bio-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tier-bio-text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 4px 0 0;
  max-height: 80px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

/* Backstory */
.review-backstory {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  padding: 8px 12px;
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}
</style>
