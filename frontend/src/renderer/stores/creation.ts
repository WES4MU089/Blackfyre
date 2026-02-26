import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'

export interface ClassTemplate {
  id: number
  template_key: string
  name: string
  description: string
  category: 'nobility' | 'military' | 'religious' | 'scholarly' | 'commerce' | 'criminal' | 'common'
  fantasy_examples: string | null
  locked_aptitudes: Record<string, number>
  free_aptitude_points: number
  starting_cash: number
  starting_bank: number
  starting_job_key: string
  starting_job_grade: number
  starting_items: Array<{ item_key: string; quantity: number }>
  sort_order: number
}

export interface House {
  id: number
  name: string
  motto: string | null
  sigil_url: string | null
  seat: string | null
  region_id: number | null
  region_name: string | null
  is_great_house: boolean
  is_royal_house: boolean
  head_character_id: number | null
}

export interface Organization {
  id: number
  name: string
  org_type: 'order' | 'guild' | 'company'
  description: string | null
  sigil_url: string | null
  region_id: number | null
  region_name: string | null
  leader_character_id: number | null
  leader_name: string | null
  requires_approval: boolean
  member_count: number
}

export type CreationStep = 'template' | 'aptitudes' | 'identity' | 'review'

const STEP_ORDER: CreationStep[] = ['template', 'aptitudes', 'identity', 'review']

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith', 'craftsmanship'] as const

const APTITUDE_LABELS: Record<string, string> = {
  prowess: 'Prowess',
  fortitude: 'Fortitude',
  command: 'Command',
  cunning: 'Cunning',
  stewardship: 'Stewardship',
  presence: 'Presence',
  lore: 'Lore',
  faith: 'Faith',
  craftsmanship: 'Craftsmanship',
}

const APTITUDE_TOTAL = 36

export const useCreationStore = defineStore('creation', () => {
  // Wizard state
  const isOpen = ref(false)
  const currentStep = ref<CreationStep>('template')
  const isSubmitting = ref(false)
  const submitError = ref<string | null>(null)

  // Template data (cached from server)
  const templates = ref<ClassTemplate[]>([])
  const selectedTemplate = ref<ClassTemplate | null>(null)

  // Aptitude allocation
  const aptitudes = ref<Record<string, number>>({})

  // Identity
  const characterName = ref('')
  const backstory = ref('')
  const portraitFile = ref<File | null>(null)
  const portraitPreview = ref<string | null>(null)

  // Lineage / Application fields
  const fatherName = ref('')
  const motherName = ref('')
  const selectedHouseId = ref<number | null>(null)
  const isBastard = ref(false)
  const isDragonSeed = ref(false)
  const requestedRole = ref<'member' | 'head_of_house' | 'lord_paramount' | 'royalty'>('member')
  const isFeaturedRole = ref(false)
  const hohContact = ref('')
  const applicationBio = ref('')
  const publicBio = ref('')

  // Organizations
  const selectedOrganizationId = ref<number | null>(null)

  // Houses (loaded from API)
  const houses = ref<House[]>([])
  const housesLoaded = ref(false)

  // Organizations (loaded from API)
  const organizations = ref<Organization[]>([])
  const organizationsLoaded = ref(false)

  // ===== COMPUTED =====

  const totalAptitudePoints = computed(() =>
    Object.values(aptitudes.value).reduce((sum, v) => sum + v, 0)
  )

  const freeAptitudePointsRemaining = computed(() =>
    APTITUDE_TOTAL - totalAptitudePoints.value
  )

  const currentStepIndex = computed(() =>
    STEP_ORDER.indexOf(currentStep.value)
  )

  const selectedHouse = computed(() =>
    houses.value.find(h => h.id === selectedHouseId.value) ?? null
  )

  const selectedOrganization = computed(() =>
    organizations.value.find(o => o.id === selectedOrganizationId.value) ?? null
  )

  const organizationsByType = computed(() => {
    const map: Record<string, Organization[]> = {}
    for (const o of organizations.value) {
      if (!map[o.org_type]) map[o.org_type] = []
      map[o.org_type].push(o)
    }
    return map
  })

  const applicationTier = computed((): 1 | 2 | 3 => {
    if (!selectedTemplate.value) return 1
    // Tier 3: featured role or leadership positions
    if (isFeaturedRole.value || ['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole.value)) {
      return 3
    }
    // Tier 2: noble template, house membership, bastard, dragon seed, or restricted organization
    if (
      selectedTemplate.value.category === 'nobility' ||
      selectedHouseId.value ||
      isBastard.value ||
      isDragonSeed.value ||
      selectedOrganization.value?.requires_approval
    ) {
      return 2
    }
    return 1
  })

  const requiresApplication = computed(() => applicationTier.value >= 2)

  const stepValidation = computed(() => ({
    template: !!selectedTemplate.value,
    aptitudes: freeAptitudePointsRemaining.value === 0,
    identity: characterName.value.trim().length >= 2
      && fatherName.value.trim().length >= 1
      && motherName.value.trim().length >= 1
      && (!requiresApplication.value || applicationBio.value.trim().length >= 1),
    review: true,
  }))

  const canAdvance = computed(() =>
    stepValidation.value[currentStep.value]
  )

  const templatesByCategory = computed(() => {
    const map: Record<string, ClassTemplate[]> = {}
    for (const t of templates.value) {
      if (!map[t.category]) map[t.category] = []
      map[t.category].push(t)
    }
    return map
  })

  // ===== METHODS =====

  function open(): void {
    isOpen.value = true
    currentStep.value = 'template'
    selectedTemplate.value = null
    aptitudes.value = {}
    characterName.value = ''
    backstory.value = ''
    if (portraitPreview.value) {
      URL.revokeObjectURL(portraitPreview.value)
    }
    portraitFile.value = null
    portraitPreview.value = null
    fatherName.value = ''
    motherName.value = ''
    selectedHouseId.value = null
    selectedOrganizationId.value = null
    isBastard.value = false
    isDragonSeed.value = false
    requestedRole.value = 'member'
    isFeaturedRole.value = false
    hohContact.value = ''
    applicationBio.value = ''
    publicBio.value = ''
    isSubmitting.value = false
    submitError.value = null
  }

  function close(): void {
    isOpen.value = false
  }

  function selectTemplate(template: ClassTemplate): void {
    selectedTemplate.value = template

    // Initialize aptitudes to locked minimums
    const apt: Record<string, number> = {}
    for (const key of APTITUDE_KEYS) {
      apt[key] = template.locked_aptitudes[key] ?? 1
    }
    aptitudes.value = apt
  }

  function incrementAptitude(key: string): void {
    if (freeAptitudePointsRemaining.value <= 0) return
    const current = aptitudes.value[key] ?? 1
    if (current >= 7) return
    aptitudes.value = { ...aptitudes.value, [key]: current + 1 }
  }

  function decrementAptitude(key: string): void {
    const current = aptitudes.value[key] ?? 1
    const lockedMin = selectedTemplate.value?.locked_aptitudes[key] ?? 1
    if (current <= lockedMin || current <= 1) return
    aptitudes.value = { ...aptitudes.value, [key]: current - 1 }
  }

  function getAptitudeLockedMin(key: string): number {
    return selectedTemplate.value?.locked_aptitudes[key] ?? 1
  }

  function canGoToStep(step: CreationStep): boolean {
    const targetIdx = STEP_ORDER.indexOf(step)
    for (let i = 0; i < targetIdx; i++) {
      if (!stepValidation.value[STEP_ORDER[i]]) return false
    }
    return true
  }

  function goToStep(step: CreationStep): void {
    if (canGoToStep(step)) {
      currentStep.value = step
      submitError.value = null
    }
  }

  function nextStep(): void {
    const idx = currentStepIndex.value
    if (idx < STEP_ORDER.length - 1 && canAdvance.value) {
      currentStep.value = STEP_ORDER[idx + 1]
      submitError.value = null
    }
  }

  function prevStep(): void {
    const idx = currentStepIndex.value
    if (idx > 0) {
      currentStep.value = STEP_ORDER[idx - 1]
      submitError.value = null
    }
  }

  function setPortrait(file: File | null): void {
    if (portraitPreview.value) {
      URL.revokeObjectURL(portraitPreview.value)
    }
    portraitFile.value = file
    portraitPreview.value = file ? URL.createObjectURL(file) : null
  }

  async function fetchHouses(): Promise<void> {
    if (housesLoaded.value) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/houses`)
      if (res.ok) {
        const data = await res.json()
        houses.value = data.houses
        housesLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch houses:', err)
    }
  }

  async function fetchOrganizations(): Promise<void> {
    if (organizationsLoaded.value) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations`)
      if (res.ok) {
        const data = await res.json()
        organizations.value = data.organizations
        organizationsLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err)
    }
  }

  /** Build the payload for character:create */
  function getCreatePayload() {
    if (!selectedTemplate.value) return null

    // Auto-enable featured role for leadership positions
    const featured = isFeaturedRole.value ||
      ['head_of_house', 'lord_paramount', 'royalty'].includes(requestedRole.value)

    return {
      templateKey: selectedTemplate.value.template_key,
      aptitudes: { ...aptitudes.value },
      name: characterName.value.trim(),
      backstory: backstory.value.trim() || undefined,
      fatherName: fatherName.value.trim(),
      motherName: motherName.value.trim(),
      houseId: selectedHouseId.value,
      isBastard: isBastard.value,
      isDragonSeed: isDragonSeed.value,
      requestedRole: requestedRole.value,
      isFeaturedRole: featured,
      hohContact: hohContact.value.trim() || null,
      applicationBio: applicationBio.value.trim() || null,
      publicBio: publicBio.value.trim() || null,
      organizationId: selectedOrganizationId.value,
    }
  }

  return {
    // State
    isOpen,
    currentStep,
    isSubmitting,
    submitError,
    templates,
    selectedTemplate,
    aptitudes,
    characterName,
    backstory,
    portraitFile,
    portraitPreview,
    fatherName,
    motherName,
    selectedHouseId,
    selectedOrganizationId,
    isBastard,
    isDragonSeed,
    requestedRole,
    isFeaturedRole,
    hohContact,
    applicationBio,
    publicBio,
    houses,
    housesLoaded,
    organizations,
    organizationsLoaded,

    // Computed
    totalAptitudePoints,
    freeAptitudePointsRemaining,
    currentStepIndex,
    stepValidation,
    canAdvance,
    templatesByCategory,
    selectedHouse,
    selectedOrganization,
    organizationsByType,
    applicationTier,
    requiresApplication,

    // Constants
    APTITUDE_KEYS,
    APTITUDE_LABELS,
    STEP_ORDER,

    // Methods
    open,
    close,
    setPortrait,
    selectTemplate,
    incrementAptitude,
    decrementAptitude,
    getAptitudeLockedMin,
    canGoToStep,
    goToStep,
    nextStep,
    prevStep,
    fetchHouses,
    fetchOrganizations,
    getCreatePayload,
  }
})
