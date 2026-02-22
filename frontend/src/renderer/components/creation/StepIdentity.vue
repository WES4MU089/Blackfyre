<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCreationStore } from '@/stores/creation'

const store = useCreationStore()

const NAME_REGEX = /^[a-zA-Z\s'-]+$/

const nameValid = computed(() => {
  const name = store.characterName.trim()
  return name.length >= 2 && name.length <= 100 && NAME_REGEX.test(name)
})

const nameError = computed(() => {
  const name = store.characterName.trim()
  if (name.length === 0) return null
  if (name.length < 2) return 'Name must be at least 2 characters'
  if (name.length > 100) return 'Name must be under 100 characters'
  if (!NAME_REGEX.test(name)) return 'Only letters, spaces, hyphens, and apostrophes allowed'
  return null
})

const backstoryLength = computed(() => store.backstory.length)
const appBioLength = computed(() => store.applicationBio.length)
const publicBioLength = computed(() => store.publicBio.length)

// Houses grouped by region for the dropdown
const housesByRegion = computed(() => {
  const groups: Record<string, typeof store.houses> = {}
  for (const h of store.houses) {
    const region = h.region_name || 'Unknown'
    if (!groups[region]) groups[region] = []
    groups[region].push(h)
  }
  return groups
})

const tierLabel = computed(() => {
  switch (store.applicationTier) {
    case 1: return null
    case 2: return 'This character requires staff approval.'
    case 3: return 'Featured role — this character requires strict staff review.'
  }
})

const tierClass = computed(() => {
  switch (store.applicationTier) {
    case 2: return 'tier-2'
    case 3: return 'tier-3'
    default: return ''
  }
})

// Show HoH contact when joining a house that has a head
const showHohContact = computed(() =>
  store.selectedHouse && store.selectedHouse.head_character_id !== null
)

const ORG_TYPE_LABELS: Record<string, string> = {
  order: 'Orders',
  guild: 'Guilds',
  company: 'Companies',
}

onMounted(() => {
  store.fetchHouses()
  store.fetchOrganizations()
})
</script>

<template>
  <div class="step-identity">
    <!-- Application Tier Banner -->
    <div v-if="tierLabel" class="tier-banner" :class="tierClass">
      <span class="tier-icon">{{ store.applicationTier === 3 ? '★' : '!' }}</span>
      <span class="tier-text">{{ tierLabel }}</span>
    </div>

    <!-- Character Name -->
    <div class="field-section">
      <label class="field-label" for="char-name">Character Name</label>
      <input
        id="char-name"
        v-model="store.characterName"
        type="text"
        class="field-input name-input"
        :class="{
          'field-input--valid': nameValid,
          'field-input--error': nameError,
        }"
        placeholder="Enter your character's name..."
        maxlength="100"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="field-feedback">
        <span v-if="nameError" class="field-error">{{ nameError }}</span>
        <span v-else-if="nameValid" class="field-ok">Valid name</span>
      </div>
    </div>

    <!-- Parentage Row -->
    <div class="parentage-row">
      <div class="field-section">
        <label class="field-label" for="father-name">Father's Name <span class="required">*</span></label>
        <input
          id="father-name"
          v-model="store.fatherName"
          type="text"
          class="field-input"
          placeholder="e.g. Eddard Stark"
          maxlength="150"
          autocomplete="off"
        />
        <div class="field-hint">Free text — does not need to be a player character.</div>
      </div>
      <div class="field-section">
        <label class="field-label" for="mother-name">Mother's Name <span class="required">*</span></label>
        <input
          id="mother-name"
          v-model="store.motherName"
          type="text"
          class="field-input"
          placeholder="e.g. Catelyn Tully"
          maxlength="150"
          autocomplete="off"
        />
      </div>
    </div>

    <!-- House Selection -->
    <div class="field-section">
      <label class="field-label" for="house-select">Noble House</label>
      <select
        id="house-select"
        v-model="store.selectedHouseId"
        class="field-input field-select"
      >
        <option :value="null">No House (Common-born)</option>
        <optgroup v-for="(houses, region) in housesByRegion" :key="region" :label="region">
          <option v-for="h in houses" :key="h.id" :value="h.id">
            {{ h.name }}{{ h.is_royal_house ? ' (Royal)' : h.is_great_house ? ' (Great House)' : '' }}
            {{ h.seat ? ` — ${h.seat}` : '' }}
          </option>
        </optgroup>
      </select>
    </div>

    <!-- Lineage Flags (conditional on house) -->
    <div v-if="store.selectedHouseId" class="lineage-flags">
      <label class="checkbox-label">
        <input type="checkbox" v-model="store.isBastard" class="checkbox-input" />
        <span class="checkbox-text">Bastard Blood</span>
        <span class="checkbox-hint">Illegitimate child — uses regional bastard surname</span>
      </label>

      <label class="checkbox-label">
        <input type="checkbox" v-model="store.isDragonSeed" class="checkbox-input" />
        <span class="checkbox-text">Dragon Seed</span>
        <span class="checkbox-hint">Valyrian blood outside House Targaryen — extremely rare, strict review</span>
      </label>
    </div>

    <!-- Dragon Seed without house (very rare standalone) -->
    <div v-if="!store.selectedHouseId" class="lineage-flags">
      <label class="checkbox-label">
        <input type="checkbox" v-model="store.isDragonSeed" class="checkbox-input" />
        <span class="checkbox-text">Dragon Seed</span>
        <span class="checkbox-hint">Valyrian blood — extremely rare, strict review</span>
      </label>
    </div>

    <!-- Requested Role (conditional on house) -->
    <div v-if="store.selectedHouseId" class="field-section">
      <label class="field-label" for="requested-role">Requested Role</label>
      <select
        id="requested-role"
        v-model="store.requestedRole"
        class="field-input field-select"
      >
        <option value="member">House Member</option>
        <option value="head_of_house">Head of House</option>
        <option value="lord_paramount">Lord Paramount</option>
        <option value="royalty">Royalty</option>
      </select>
    </div>

    <!-- Featured Role Toggle (conditional on house) -->
    <div v-if="store.selectedHouseId" class="lineage-flags">
      <label class="checkbox-label">
        <input
          type="checkbox"
          v-model="store.isFeaturedRole"
          :disabled="['head_of_house', 'lord_paramount', 'royalty'].includes(store.requestedRole)"
          class="checkbox-input"
        />
        <span class="checkbox-text">Featured Role</span>
        <span class="checkbox-hint">
          {{ ['head_of_house', 'lord_paramount', 'royalty'].includes(store.requestedRole)
            ? 'Automatically enabled for leadership positions'
            : 'Mark this character as a significant narrative role (higher activity expectations)' }}
        </span>
      </label>
    </div>

    <!-- Organization Affiliation -->
    <div class="field-section">
      <label class="field-label" for="org-select">
        Organization
        <span class="field-optional">(optional)</span>
      </label>
      <select
        id="org-select"
        v-model="store.selectedOrganizationId"
        class="field-input field-select"
      >
        <option :value="null">No Organization</option>
        <optgroup
          v-for="(orgs, orgType) in store.organizationsByType"
          :key="orgType"
          :label="ORG_TYPE_LABELS[orgType] || orgType"
        >
          <option v-for="o in orgs" :key="o.id" :value="o.id">
            {{ o.name }}{{ o.requires_approval ? ' (requires approval)' : '' }}
          </option>
        </optgroup>
      </select>
      <div v-if="store.selectedOrganization?.requires_approval" class="field-hint" style="color: var(--color-gold);">
        Joining this organization requires staff approval.
      </div>
    </div>

    <!-- HoH Contact (shown when joining existing house with a head) -->
    <div v-if="showHohContact" class="field-section">
      <label class="field-label" for="hoh-contact">Head of House Contact</label>
      <textarea
        id="hoh-contact"
        v-model="store.hohContact"
        class="field-input field-textarea"
        placeholder="Have you contacted the current Head of House to discuss your character concept? Please describe."
        maxlength="2000"
        rows="3"
      />
    </div>

    <!-- Application Bio (required for Tier 2/3) -->
    <div v-if="store.requiresApplication" class="field-section">
      <label class="field-label" for="app-bio">
        Application Bio <span class="required">*</span>
      </label>
      <div class="field-hint">
        Full backstory and justification for this character. Staff-only — not visible to other players.
        {{ store.applicationTier === 3 ? 'Featured roles require a minimum of 500 characters.' : '' }}
      </div>
      <textarea
        id="app-bio"
        v-model="store.applicationBio"
        class="field-input field-textarea"
        placeholder="Describe your character's history, motivations, and why you want this role..."
        maxlength="10000"
        rows="8"
        spellcheck="true"
      />
      <div class="field-footer">
        <span class="char-count" :class="{ 'char-count--warn': appBioLength > 9000 }">
          {{ appBioLength }} / 10,000
        </span>
      </div>
    </div>

    <!-- Public Bio (optional, always shown) -->
    <div class="field-section">
      <label class="field-label" for="public-bio">
        Public Bio
        <span class="field-optional">(optional)</span>
      </label>
      <div class="field-hint">
        Publicly visible IC information — reputation, known deeds, personality. No secret plots or OOC info.
      </div>
      <textarea
        id="public-bio"
        v-model="store.publicBio"
        class="field-input field-textarea"
        placeholder="What people in the world would know about your character..."
        maxlength="5000"
        rows="4"
        spellcheck="true"
      />
      <div class="field-footer">
        <span class="char-count" :class="{ 'char-count--warn': publicBioLength > 4500 }">
          {{ publicBioLength }} / 5,000
        </span>
      </div>
    </div>

    <!-- Backstory (private) -->
    <div class="field-section">
      <label class="field-label" for="char-backstory">
        Private Backstory
        <span class="field-optional">(optional)</span>
      </label>
      <div class="field-hint">Visible only to you and staff. Secret plots, hidden motivations, OOC notes.</div>
      <textarea
        id="char-backstory"
        v-model="store.backstory"
        class="field-input field-textarea"
        placeholder="Write your character's private history, secrets, and hidden motivations..."
        maxlength="5000"
        rows="6"
        spellcheck="true"
      />
      <div class="field-footer">
        <span class="char-count" :class="{ 'char-count--warn': backstoryLength > 4500 }">
          {{ backstoryLength }} / 5,000
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-identity {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 640px;
  margin: 0 auto;
}

/* Tier Banner */
.tier-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
}

.tier-banner.tier-2 {
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  color: var(--color-gold);
}

.tier-banner.tier-3 {
  background: rgba(139, 26, 26, 0.1);
  border: 1px solid var(--color-crimson-dark);
  color: var(--color-crimson-light);
}

.tier-icon {
  font-size: var(--font-size-md);
  flex-shrink: 0;
}

.tier-text {
  line-height: 1.4;
}

/* Field sections */
.field-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.required {
  color: var(--color-crimson-light);
}

.field-optional {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.field-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}

.field-input:focus {
  border-color: var(--color-gold-dark);
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.1);
}

.field-input--valid {
  border-color: var(--color-gold-dim);
}

.field-input--error {
  border-color: var(--color-crimson-dark);
}

.name-input {
  max-width: 400px;
  color: var(--color-gold);
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  letter-spacing: 0.08em;
  text-align: center;
  align-self: center;
}

.name-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  letter-spacing: 0.02em;
}

.field-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.field-select option,
.field-select optgroup {
  background: var(--color-surface-dark);
  color: var(--color-text);
}

.field-textarea {
  resize: vertical;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.field-textarea::placeholder {
  color: var(--color-text-muted);
}

.field-feedback {
  min-height: 18px;
}

.field-error {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-crimson-light);
}

.field-ok {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.field-footer {
  display: flex;
  justify-content: flex-end;
}

.char-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.char-count--warn {
  color: var(--color-warning);
}

/* Parentage row */
.parentage-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

/* Lineage flags */
.lineage-flags {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.checkbox-label:hover {
  background: rgba(255, 255, 255, 0.03);
}

.checkbox-input {
  margin-top: 2px;
  accent-color: var(--color-gold);
  flex-shrink: 0;
}

.checkbox-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 500;
}

.checkbox-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  display: block;
  margin-top: 2px;
}
</style>
