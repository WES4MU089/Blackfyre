import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

export type CreationStep = 'template' | 'aptitudes' | 'identity' | 'review'

const STEP_ORDER: CreationStep[] = ['template', 'aptitudes', 'identity', 'review']

const APTITUDE_KEYS = ['prowess', 'fortitude', 'command', 'cunning', 'stewardship', 'presence', 'lore', 'faith'] as const

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

const APTITUDE_TOTAL = 32

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

  const stepValidation = computed(() => ({
    template: !!selectedTemplate.value,
    aptitudes: freeAptitudePointsRemaining.value === 0,
    identity: characterName.value.trim().length >= 2,
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

  /** Build the payload for character:create */
  function getCreatePayload() {
    if (!selectedTemplate.value) return null

    return {
      templateKey: selectedTemplate.value.template_key,
      aptitudes: { ...aptitudes.value },
      name: characterName.value.trim(),
      backstory: backstory.value.trim() || undefined,
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

    // Computed
    totalAptitudePoints,
    freeAptitudePointsRemaining,
    currentStepIndex,
    stepValidation,
    canAdvance,
    templatesByCategory,

    // Constants
    APTITUDE_KEYS,
    APTITUDE_LABELS,
    STEP_ORDER,

    // Methods
    open,
    close,
    selectTemplate,
    incrementAptitude,
    decrementAptitude,
    getAptitudeLockedMin,
    canGoToStep,
    goToStep,
    nextStep,
    prevStep,
    getCreatePayload,
  }
})
