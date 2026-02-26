<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCreationStore } from '@/stores/creation'

const store = useCreationStore()
const portraitInput = ref<HTMLInputElement | null>(null)
const portraitError = ref<string | null>(null)

const MAX_PORTRAIT_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function triggerPortraitSelect(): void {
  portraitInput.value?.click()
}

function onPortraitSelected(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  portraitError.value = null

  if (!ACCEPTED_TYPES.includes(file.type)) {
    portraitError.value = 'Only PNG, JPG, or WebP images are allowed'
    input.value = ''
    return
  }
  if (file.size > MAX_PORTRAIT_SIZE) {
    portraitError.value = 'Image must be under 5 MB'
    input.value = ''
    return
  }

  store.setPortrait(file)
  input.value = ''
}

function removePortrait(): void {
  store.setPortrait(null)
  portraitError.value = null
}

const thumbnailInput = ref<HTMLInputElement | null>(null)
const thumbnailError = ref<string | null>(null)

function triggerThumbnailSelect(): void {
  thumbnailInput.value?.click()
}

function onThumbnailSelected(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  thumbnailError.value = null

  if (!ACCEPTED_TYPES.includes(file.type)) {
    thumbnailError.value = 'Only PNG, JPG, or WebP images are allowed'
    input.value = ''
    return
  }
  if (file.size > MAX_PORTRAIT_SIZE) {
    thumbnailError.value = 'Image must be under 5 MB'
    input.value = ''
    return
  }

  store.setThumbnail(file)
  input.value = ''
}

function removeThumbnail(): void {
  store.setThumbnail(null)
  thumbnailError.value = null
}

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

    <!-- Portraits Row -->
    <div class="portraits-row">
      <!-- Full Portrait -->
      <div class="field-section portrait-section">
        <label class="field-label">Character Portrait <span class="field-optional">(400 x 600)</span></label>
        <div
          class="portrait-frame portrait-frame--full"
          :class="{ 'portrait-frame--empty': !store.portraitPreview }"
          @click="triggerPortraitSelect"
        >
          <img
            v-if="store.portraitPreview"
            :src="store.portraitPreview"
            alt="Portrait preview"
            class="portrait-img"
          />
          <div v-else class="portrait-placeholder">
            <span class="portrait-plus">+</span>
            <span class="portrait-hint">Upload</span>
            <span class="portrait-hint-sm">PNG / JPG / WebP</span>
          </div>
        </div>
        <div class="portrait-controls">
          <button
            v-if="store.portraitPreview"
            class="portrait-btn portrait-btn--remove"
            type="button"
            @click="removePortrait"
          >
            Remove
          </button>
          <button
            class="portrait-btn"
            type="button"
            @click="triggerPortraitSelect"
          >
            {{ store.portraitPreview ? 'Change' : 'Browse...' }}
          </button>
          <div v-if="portraitError" class="field-error">{{ portraitError }}</div>
        </div>
        <input
          ref="portraitInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="portrait-file-input"
          @change="onPortraitSelected"
        />
      </div>

      <!-- Thumbnail -->
      <div class="field-section portrait-section">
        <label class="field-label">Thumbnail <span class="field-optional">(96 x 96)</span></label>
        <div
          class="portrait-frame portrait-frame--thumb"
          :class="{ 'portrait-frame--empty': !store.thumbnailPreview }"
          @click="triggerThumbnailSelect"
        >
          <img
            v-if="store.thumbnailPreview"
            :src="store.thumbnailPreview"
            alt="Thumbnail preview"
            class="portrait-img"
          />
          <div v-else class="portrait-placeholder">
            <span class="portrait-plus">+</span>
            <span class="portrait-hint">Upload</span>
            <span class="portrait-hint-sm">96 x 96 px</span>
          </div>
        </div>
        <div class="portrait-controls">
          <button
            v-if="store.thumbnailPreview"
            class="portrait-btn portrait-btn--remove"
            type="button"
            @click="removeThumbnail"
          >
            Remove
          </button>
          <button
            class="portrait-btn"
            type="button"
            @click="triggerThumbnailSelect"
          >
            {{ store.thumbnailPreview ? 'Change' : 'Browse...' }}
          </button>
          <div v-if="thumbnailError" class="field-error">{{ thumbnailError }}</div>
        </div>
        <input
          ref="thumbnailInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="portrait-file-input"
          @change="onThumbnailSelected"
        />
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

/* Portraits row */
.portraits-row {
  display: flex;
  gap: var(--space-xl);
  justify-content: center;
}

.portrait-section {
  align-items: center;
}

.portrait-frame {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color var(--transition-fast);
  background: var(--color-surface-dark);
}

.portrait-frame--full {
  width: 160px;
  height: 240px;
}

.portrait-frame--thumb {
  width: 96px;
  height: 96px;
}

.portrait-frame:hover {
  border-color: var(--color-gold-dim);
}

.portrait-frame--empty {
  border-style: dashed;
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.portrait-plus {
  font-size: 28px;
  color: var(--color-text-muted);
  line-height: 1;
}

.portrait-frame--thumb .portrait-plus {
  font-size: 20px;
}

.portrait-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.portrait-hint-sm {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  opacity: 0.6;
}

.portrait-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding-top: var(--space-xs);
}

.portrait-btn {
  padding: 5px 14px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.portrait-btn:hover {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
}

.portrait-btn--remove {
  color: var(--color-text-muted);
  border-color: var(--color-border-dim);
}

.portrait-btn--remove:hover {
  color: var(--color-crimson-light);
  border-color: var(--color-crimson-dark);
}

.portrait-file-input {
  display: none;
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
