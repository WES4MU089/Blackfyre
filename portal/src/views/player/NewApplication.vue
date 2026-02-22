<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface ClassTemplate {
  id: number
  template_key: string
  name: string
  category: string
  locked_aptitudes: Record<string, number>
  free_aptitude_points: number
  starting_cash: number
}

interface House {
  id: number
  name: string
  motto: string | null
  seat: string | null
  region_id: number | null
  region_name: string | null
  is_great_house: boolean
  is_royal_house: boolean
  head_character_id: number | null
}

interface Organization {
  id: number
  name: string
  org_type: string
  requires_approval: boolean
}

const router = useRouter()
const { apiFetch } = useApi()

const templates = ref<ClassTemplate[]>([])
const houses = ref<House[]>([])
const organizations = ref<Organization[]>([])
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const success = ref(false)

// Form state
const selectedTemplateKey = ref('')
const characterName = ref('')
const fatherName = ref('')
const motherName = ref('')
const selectedHouseId = ref<number | null>(null)
const isBastard = ref(false)
const isDragonSeed = ref(false)
const requestedRole = ref('member')
const isFeaturedRole = ref(false)
const selectedOrganizationId = ref<number | null>(null)
const hohContact = ref('')
const applicationBio = ref('')
const publicBio = ref('')
const backstory = ref('')

const aptitudes = ref<Record<string, number>>({
  prowess: 4,
  fortitude: 4,
  command: 4,
  cunning: 4,
  stewardship: 4,
  presence: 4,
  lore: 4,
  faith: 4,
})

const APTITUDE_LABELS: Record<string, string> = {
  prowess: 'Prowess',
  fortitude: 'Fortitude',
  command: 'Command',
  cunning: 'Cunning',
  stewardship: 'Stewardship',
  presence: 'Presence',
  lore: 'Lore',
  faith: 'Faith',
}

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith']
const APTITUDE_TOTAL = 32
const NAME_REGEX = /^[a-zA-Z\s'-]+$/

// Computed
const selectedTemplate = computed(() =>
  templates.value.find(t => t.template_key === selectedTemplateKey.value)
)

const selectedHouse = computed(() =>
  houses.value.find(h => h.id === selectedHouseId.value)
)

const selectedOrganization = computed(() =>
  organizations.value.find(o => o.id === selectedOrganizationId.value)
)

const aptitudeTotal = computed(() =>
  Object.values(aptitudes.value).reduce((a, b) => a + b, 0)
)

const pointsRemaining = computed(() => APTITUDE_TOTAL - aptitudeTotal.value)

const housesByRegion = computed(() => {
  const groups: Record<string, House[]> = {}
  for (const h of houses.value) {
    const region = h.region_name || 'Unknown'
    if (!groups[region]) groups[region] = []
    groups[region].push(h)
  }
  return groups
})

const organizationsByType = computed(() => {
  const groups: Record<string, Organization[]> = {}
  for (const o of organizations.value) {
    if (!groups[o.org_type]) groups[o.org_type] = []
    groups[o.org_type].push(o)
  }
  return groups
})

const applicationTier = computed((): 1 | 2 | 3 => {
  const tmpl = selectedTemplate.value
  if (!tmpl) return 1
  const isFeat = isFeaturedRole.value ||
    ['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole.value)
  if (isFeat) return 3
  if (tmpl.category === 'nobility' || selectedHouseId.value || isBastard.value || isDragonSeed.value || selectedOrganization.value?.requires_approval) return 2
  return 1
})

const requiresApplication = computed(() => applicationTier.value >= 2)

const showHohContact = computed(() =>
  selectedHouse.value && selectedHouse.value.head_character_id !== null
)

const nameValid = computed(() => {
  const name = characterName.value.trim()
  return name.length >= 2 && name.length <= 100 && NAME_REGEX.test(name)
})

const nameError = computed(() => {
  const name = characterName.value.trim()
  if (name.length === 0) return null
  if (name.length < 2) return 'Name must be at least 2 characters'
  if (name.length > 100) return 'Name must be under 100 characters'
  if (!NAME_REGEX.test(name)) return 'Only letters, spaces, hyphens, and apostrophes allowed'
  return null
})

const canSubmit = computed(() => {
  if (!selectedTemplateKey.value) return false
  if (!nameValid.value) return false
  if (!fatherName.value.trim()) return false
  if (!motherName.value.trim()) return false
  if (aptitudeTotal.value !== APTITUDE_TOTAL) return false
  if (requiresApplication.value && applicationBio.value.trim().length === 0) return false
  return true
})

const ORG_TYPE_LABELS: Record<string, string> = {
  order: 'Orders',
  guild: 'Guilds',
  company: 'Companies',
}

// On template change, reset aptitudes to locked values
function onTemplateChange() {
  const tmpl = selectedTemplate.value
  if (!tmpl) return
  const locked = tmpl.locked_aptitudes
  // Start each aptitude at its locked minimum (or 1)
  for (const key of APTITUDE_KEYS) {
    aptitudes.value[key] = locked[key] ?? 1
  }
  // Distribute remaining points evenly
  const lockedTotal = Object.values(aptitudes.value).reduce((a, b) => a + b, 0)
  let remaining = APTITUDE_TOTAL - lockedTotal
  let idx = 0
  while (remaining > 0) {
    const key = APTITUDE_KEYS[idx % 8]
    if (aptitudes.value[key] < 7) {
      aptitudes.value[key]++
      remaining--
    }
    idx++
    if (idx > 100) break
  }
}

function getAptMin(key: string): number {
  return selectedTemplate.value?.locked_aptitudes[key] ?? 1
}

// Fetch data
onMounted(async () => {
  try {
    const [tmplData, housesData, orgsData] = await Promise.all([
      apiFetch<{ templates: ClassTemplate[] }>('/api/applications/templates'),
      apiFetch<{ houses: House[] }>('/api/houses'),
      apiFetch<{ organizations: Organization[] }>('/api/organizations'),
    ])
    templates.value = tmplData.templates
    houses.value = housesData.houses
    organizations.value = orgsData.organizations
  } catch (e: any) {
    error.value = e.message || 'Failed to load form data'
  } finally {
    loading.value = false
  }
})

// Auto-set featured role for leadership positions
function onRoleChange() {
  if (['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole.value)) {
    isFeaturedRole.value = true
  }
}

async function submitApplication() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  error.value = ''

  try {
    const result = await apiFetch<{ success: boolean; characterId: number; tier: number; applicationStatus: string }>(
      '/api/applications/submit',
      {
        method: 'POST',
        body: JSON.stringify({
          templateKey: selectedTemplateKey.value,
          aptitudes: aptitudes.value,
          name: characterName.value.trim(),
          backstory: backstory.value.trim() || undefined,
          fatherName: fatherName.value.trim(),
          motherName: motherName.value.trim(),
          houseId: selectedHouseId.value,
          isBastard: isBastard.value,
          isDragonSeed: isDragonSeed.value,
          requestedRole: requestedRole.value,
          isFeaturedRole: isFeaturedRole.value,
          hohContact: hohContact.value.trim() || undefined,
          applicationBio: applicationBio.value.trim() || undefined,
          publicBio: publicBio.value.trim() || undefined,
          organizationId: selectedOrganizationId.value,
        }),
      }
    )

    success.value = true
    // Redirect to applications list after a moment
    setTimeout(() => {
      router.push({ name: 'my-applications' })
    }, 2000)
  } catch (e: any) {
    error.value = e.message || 'Failed to submit application'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="new-app">
    <PageHeader title="New Character" subtitle="Create a character and submit for approval" />

    <p v-if="loading" class="dim">Loading form data...</p>

    <!-- Success State -->
    <div v-else-if="success" class="success-card card">
      <h2>Character Submitted</h2>
      <p>Your character has been created. Redirecting to your applications...</p>
    </div>

    <form v-else @submit.prevent="submitApplication" class="creation-form">
      <!-- Tier Banner -->
      <div v-if="applicationTier >= 2 && selectedTemplateKey" class="tier-banner" :class="applicationTier === 3 ? 'tier-3' : 'tier-2'">
        <span class="tier-icon">{{ applicationTier === 3 ? '\u2605' : '!' }}</span>
        <span>{{ applicationTier === 3 ? 'Featured role \u2014 this character requires strict staff review.' : 'This character requires staff approval.' }}</span>
      </div>

      <!-- Section 1: Class Template -->
      <fieldset class="form-section">
        <legend class="section-title">Class Template</legend>
        <div class="template-grid">
          <label
            v-for="tmpl in templates"
            :key="tmpl.template_key"
            class="template-card card"
            :class="{ 'template-selected': selectedTemplateKey === tmpl.template_key }"
          >
            <input
              type="radio"
              :value="tmpl.template_key"
              v-model="selectedTemplateKey"
              @change="onTemplateChange"
              class="sr-only"
            />
            <span class="template-name">{{ tmpl.name }}</span>
            <span class="template-cat muted">{{ tmpl.category }}</span>
          </label>
        </div>
      </fieldset>

      <template v-if="selectedTemplateKey">
        <!-- Section 2: Character Name -->
        <fieldset class="form-section">
          <legend class="section-title">Identity</legend>

          <div class="field">
            <label class="field-label" for="char-name">Character Name <span class="req">*</span></label>
            <input
              id="char-name"
              v-model="characterName"
              type="text"
              class="name-input"
              :class="{ 'input-valid': nameValid, 'input-error': nameError }"
              placeholder="Enter your character's name..."
              maxlength="100"
              autocomplete="off"
              spellcheck="false"
            />
            <div class="field-feedback">
              <span v-if="nameError" class="feedback-error">{{ nameError }}</span>
            </div>
          </div>

          <!-- Parentage -->
          <div class="parentage-row">
            <div class="field">
              <label class="field-label" for="father-name">Father's Name <span class="req">*</span></label>
              <input id="father-name" v-model="fatherName" type="text" placeholder="e.g. Eddard Stark" maxlength="150" autocomplete="off" />
              <div class="field-hint">Free text &mdash; does not need to be a player character.</div>
            </div>
            <div class="field">
              <label class="field-label" for="mother-name">Mother's Name <span class="req">*</span></label>
              <input id="mother-name" v-model="motherName" type="text" placeholder="e.g. Catelyn Tully" maxlength="150" autocomplete="off" />
            </div>
          </div>
        </fieldset>

        <!-- Section 3: Aptitudes -->
        <fieldset class="form-section">
          <legend class="section-title">
            Aptitudes
            <span class="points-badge" :class="{ 'points-ok': pointsRemaining === 0, 'points-over': pointsRemaining < 0 }">
              {{ pointsRemaining }} points remaining
            </span>
          </legend>

          <div class="aptitudes-grid">
            <div v-for="key in APTITUDE_KEYS" :key="key" class="apt-row">
              <label class="apt-label">{{ APTITUDE_LABELS[key] }}</label>
              <div class="apt-controls">
                <button type="button" class="apt-btn" :disabled="aptitudes[key] <= getAptMin(key)" @click="aptitudes[key]--">&minus;</button>
                <span class="apt-value">{{ aptitudes[key] }}</span>
                <button type="button" class="apt-btn" :disabled="aptitudes[key] >= 7 || pointsRemaining <= 0" @click="aptitudes[key]++">+</button>
              </div>
              <span v-if="getAptMin(key) > 1" class="apt-locked muted">min {{ getAptMin(key) }}</span>
            </div>
          </div>
        </fieldset>

        <!-- Section 4: House & Lineage -->
        <fieldset class="form-section">
          <legend class="section-title">House &amp; Lineage</legend>

          <div class="field">
            <label class="field-label" for="house-select">Noble House</label>
            <select id="house-select" v-model="selectedHouseId">
              <option :value="null">No House (Common-born)</option>
              <optgroup v-for="(houseGroup, region) in housesByRegion" :key="region" :label="String(region)">
                <option v-for="h in houseGroup" :key="h.id" :value="h.id">
                  {{ h.name }}{{ h.is_royal_house ? ' (Royal)' : h.is_great_house ? ' (Great House)' : '' }}{{ h.seat ? ' \u2014 ' + h.seat : '' }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Lineage flags -->
          <div class="lineage-flags">
            <label v-if="selectedHouseId" class="checkbox-row">
              <input type="checkbox" v-model="isBastard" />
              <span>
                <strong>Bastard Blood</strong>
                <span class="field-hint">Illegitimate child &mdash; uses regional bastard surname</span>
              </span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" v-model="isDragonSeed" />
              <span>
                <strong>Dragon Seed</strong>
                <span class="field-hint">Valyrian blood &mdash; extremely rare, strict review</span>
              </span>
            </label>
          </div>

          <!-- Role -->
          <div v-if="selectedHouseId" class="field">
            <label class="field-label" for="role-select">Requested Role</label>
            <select id="role-select" v-model="requestedRole" @change="onRoleChange">
              <option value="member">House Member</option>
              <option value="head_of_house">Head of House</option>
              <option value="lord_paramount">Lord Paramount</option>
              <option value="royalty">Royalty</option>
            </select>
          </div>

          <div v-if="selectedHouseId" class="lineage-flags">
            <label class="checkbox-row">
              <input
                type="checkbox"
                v-model="isFeaturedRole"
                :disabled="['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole)"
              />
              <span>
                <strong>Featured Role</strong>
                <span class="field-hint">
                  {{ ['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole)
                    ? 'Automatically enabled for leadership positions'
                    : 'Mark this character as a significant narrative role' }}
                </span>
              </span>
            </label>
          </div>

          <!-- HoH Contact -->
          <div v-if="showHohContact" class="field">
            <label class="field-label" for="hoh-contact">Head of House Contact</label>
            <textarea
              id="hoh-contact"
              v-model="hohContact"
              placeholder="Have you contacted the current Head of House to discuss your character concept?"
              maxlength="2000"
              rows="3"
            />
          </div>
        </fieldset>

        <!-- Section 5: Organization -->
        <fieldset class="form-section">
          <legend class="section-title">Organization <span class="optional">(optional)</span></legend>
          <div class="field">
            <select v-model="selectedOrganizationId">
              <option :value="null">No Organization</option>
              <optgroup v-for="(orgs, orgType) in organizationsByType" :key="orgType" :label="ORG_TYPE_LABELS[String(orgType)] || String(orgType)">
                <option v-for="o in orgs" :key="o.id" :value="o.id">
                  {{ o.name }}{{ o.requires_approval ? ' (requires approval)' : '' }}
                </option>
              </optgroup>
            </select>
            <div v-if="selectedOrganization?.requires_approval" class="field-hint" style="color: var(--color-gold);">
              Joining this organization requires staff approval.
            </div>
          </div>
        </fieldset>

        <!-- Section 6: Bios -->
        <fieldset class="form-section">
          <legend class="section-title">Character Writing</legend>

          <!-- Application Bio -->
          <div v-if="requiresApplication" class="field">
            <label class="field-label" for="app-bio">Application Bio <span class="req">*</span></label>
            <div class="field-hint">
              Full backstory and justification. Staff-only &mdash; not visible to other players.
              {{ applicationTier === 3 ? 'Featured roles require a minimum of 500 characters.' : '' }}
            </div>
            <textarea
              id="app-bio"
              v-model="applicationBio"
              placeholder="Describe your character's history, motivations, and why you want this role..."
              maxlength="10000"
              rows="8"
              spellcheck="true"
            />
            <div class="field-footer">
              <span class="char-count" :class="{ 'count-warn': applicationBio.length > 9000 }">
                {{ applicationBio.length }} / 10,000
              </span>
            </div>
          </div>

          <!-- Public Bio -->
          <div class="field">
            <label class="field-label" for="public-bio">Public Bio <span class="optional">(optional)</span></label>
            <div class="field-hint">Publicly visible IC information &mdash; reputation, known deeds, personality.</div>
            <textarea
              id="public-bio"
              v-model="publicBio"
              placeholder="What people in the world would know about your character..."
              maxlength="5000"
              rows="4"
              spellcheck="true"
            />
            <div class="field-footer">
              <span class="char-count" :class="{ 'count-warn': publicBio.length > 4500 }">
                {{ publicBio.length }} / 5,000
              </span>
            </div>
          </div>

          <!-- Private Backstory -->
          <div class="field">
            <label class="field-label" for="backstory">Private Backstory <span class="optional">(optional)</span></label>
            <div class="field-hint">Visible only to you and staff. Secret plots, hidden motivations, OOC notes.</div>
            <textarea
              id="backstory"
              v-model="backstory"
              placeholder="Secret history, hidden motivations..."
              maxlength="5000"
              rows="4"
              spellcheck="true"
            />
            <div class="field-footer">
              <span class="char-count" :class="{ 'count-warn': backstory.length > 4500 }">
                {{ backstory.length }} / 5,000
              </span>
            </div>
          </div>
        </fieldset>

        <!-- Error -->
        <div v-if="error" class="error-box card">
          <span class="crimson">{{ error }}</span>
        </div>

        <!-- Submit -->
        <div class="submit-bar">
          <button type="submit" class="btn-primary submit-btn" :disabled="!canSubmit || submitting">
            {{ submitting ? 'Submitting...' : applicationTier >= 2 ? 'Submit for Review' : 'Create Character' }}
          </button>
          <span class="muted">
            {{ applicationTier === 1 ? 'Tier 1 &mdash; Instant approval' : applicationTier === 2 ? 'Tier 2 &mdash; Requires staff approval' : 'Tier 3 &mdash; Featured role review' }}
          </span>
        </div>
      </template>
    </form>
  </div>
</template>

<style scoped>
.new-app {
  max-width: 780px;
  margin: 0 auto;
}

.success-card {
  text-align: center;
  margin-top: var(--space-2xl);
  padding: var(--space-xl);
}

.success-card h2 {
  color: var(--color-success);
  margin-bottom: var(--space-sm);
}

.creation-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  margin-top: var(--space-lg);
}

/* Tier Banner */
.tier-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
.tier-2 {
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  color: var(--color-gold);
}
.tier-3 {
  background: rgba(139, 26, 26, 0.1);
  border: 1px solid var(--color-crimson-dark);
  color: var(--color-crimson-light);
}
.tier-icon { font-size: var(--font-size-md); flex-shrink: 0; }

/* Form Sections */
.form-section {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* Templates */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-sm);
}

.template-card {
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  text-align: center;
  transition: all var(--transition-fast);
}
.template-card:hover {
  border-color: var(--color-gold-dim);
}
.template-selected {
  border-color: var(--color-gold) !important;
  background: rgba(201, 168, 76, 0.08);
}
.template-name {
  display: block;
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.template-cat {
  display: block;
  font-size: var(--font-size-xs);
  text-transform: capitalize;
  margin-top: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.req { color: var(--color-crimson-light); }
.optional {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: none;
  letter-spacing: 0;
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.field-feedback { min-height: 18px; }
.feedback-error {
  font-size: var(--font-size-xs);
  color: var(--color-crimson-light);
}

.name-input {
  max-width: 420px;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  letter-spacing: 0.06em;
  text-align: center;
  color: var(--color-gold);
}

.input-valid { border-color: var(--color-gold-dim); }
.input-error { border-color: var(--color-crimson-dark); }

.parentage-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

/* Aptitudes */
.aptitudes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm) var(--space-lg);
}

.apt-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.apt-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  min-width: 100px;
}

.apt-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.apt-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-gold);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.apt-btn:hover:not(:disabled) {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
}
.apt-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.apt-value {
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-gold);
  min-width: 24px;
  text-align: center;
}

.apt-locked {
  font-size: var(--font-size-xs);
  font-style: italic;
}

.points-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: rgba(201, 168, 76, 0.1);
  color: var(--color-gold);
  text-transform: none;
  letter-spacing: 0;
}
.points-ok { color: var(--color-success); background: rgba(45, 138, 78, 0.1); }
.points-over { color: var(--color-danger); background: rgba(196, 43, 43, 0.1); }

/* Lineage */
.lineage-flags {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.checkbox-row:hover { background: rgba(255, 255, 255, 0.02); }
.checkbox-row input[type="checkbox"] {
  margin-top: 3px;
  accent-color: var(--color-gold);
  flex-shrink: 0;
}
.checkbox-row strong {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  display: block;
}
.checkbox-row .field-hint {
  display: block;
  margin-top: 2px;
}

/* Bio text areas */
.field-footer {
  display: flex;
  justify-content: flex-end;
}

.char-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}
.count-warn { color: var(--color-warning); }

/* Error */
.error-box {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

/* Submit */
.submit-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border-dim);
}

.submit-btn {
  padding: var(--space-sm) var(--space-xl);
  font-size: var(--font-size-md);
}
</style>
