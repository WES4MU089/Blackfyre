import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'

const API_BASE = BACKEND_URL

export interface CharacterAilment {
  id: number
  ailmentKey: string
  name: string
  currentStage: number
  stageName: string
  terminalExpiresAt: string
  immunityExpiresAt: string
  isTerminalPaused: boolean
  symptoms: string[]
}

export interface AilmentState {
  woundSeverity: 'healthy' | 'light' | 'serious' | 'severe' | 'grave'
  woundReceivedAt: string | null
  woundHealsAt: string | null
  ailments: CharacterAilment[]
}

export const useAilmentsStore = defineStore('ailments', () => {
  const ailments = ref<CharacterAilment[]>([])
  const woundSeverity = ref<AilmentState['woundSeverity']>('healthy')
  const woundHealsAt = ref<string | null>(null)
  const deathState = ref<'alive' | 'ko' | 'dead'>('alive')
  const koExpiresAt = ref<string | null>(null)
  const tendingLocked = ref(false)
  const isLoading = ref(false)

  const hasActiveAilments = computed(() => ailments.value.length > 0)
  const hasWounds = computed(() => woundSeverity.value !== 'healthy')
  const isKo = computed(() => deathState.value === 'ko')

  const primaryAilment = computed(() =>
    ailments.value.length > 0 ? ailments.value[0] : null
  )

  async function fetchAilments(characterId: number): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${API_BASE}/api/ailments/${characterId}`)
      if (!res.ok) return
      const data = await res.json()
      woundSeverity.value = data.woundSeverity ?? 'healthy'
      woundHealsAt.value = data.woundHealsAt ?? null
      deathState.value = data.deathState ?? 'alive'
      koExpiresAt.value = data.koExpiresAt ?? null
      tendingLocked.value = data.tendingLocked ?? false
      ailments.value = (data.ailments ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        ailmentKey: a.ailmentKey,
        name: a.name,
        currentStage: a.currentStage,
        stageName: a.stageName,
        terminalExpiresAt: a.terminalExpiresAt,
        immunityExpiresAt: a.immunityExpiresAt,
        isTerminalPaused: a.isTerminalPaused,
        symptoms: a.symptoms ?? [],
      }))
    } catch { /* swallow */ } finally {
      isLoading.value = false
    }
  }

  // Socket event handlers
  function onAilmentOnset(data: CharacterAilment): void {
    ailments.value.push(data)
  }

  function onAilmentProgressed(data: { ailmentId: number; newStage: number; stageName: string; terminalExpiresAt: string; immunityExpiresAt: string }): void {
    const a = ailments.value.find(a => a.id === data.ailmentId)
    if (a) {
      a.currentStage = data.newStage
      a.stageName = data.stageName
      a.terminalExpiresAt = data.terminalExpiresAt
      a.immunityExpiresAt = data.immunityExpiresAt
    }
  }

  function onAilmentImproved(data: { ailmentId: number; newStage: number; stageName: string; terminalExpiresAt: string; immunityExpiresAt: string }): void {
    const a = ailments.value.find(a => a.id === data.ailmentId)
    if (a) {
      a.currentStage = data.newStage
      a.stageName = data.stageName
      a.terminalExpiresAt = data.terminalExpiresAt
      a.immunityExpiresAt = data.immunityExpiresAt
    }
  }

  function onAilmentCured(data: { ailmentId: number }): void {
    ailments.value = ailments.value.filter(a => a.id !== data.ailmentId)
  }

  function onWoundUpdated(data: { woundSeverity: AilmentState['woundSeverity']; woundHealsAt?: string | null; deathState?: 'alive' | 'ko' | 'dead'; koExpiresAt?: string | null }): void {
    woundSeverity.value = data.woundSeverity
    if (data.woundHealsAt !== undefined) woundHealsAt.value = data.woundHealsAt
    if (data.deathState !== undefined) deathState.value = data.deathState
    if (data.koExpiresAt !== undefined) koExpiresAt.value = data.koExpiresAt
  }

  function onKoResolved(data: { outcome: string; woundSeverity: AilmentState['woundSeverity'] }): void {
    deathState.value = 'alive'
    koExpiresAt.value = null
    tendingLocked.value = false
    woundSeverity.value = data.woundSeverity
  }

  function clear(): void {
    ailments.value = []
    woundSeverity.value = 'healthy'
    woundHealsAt.value = null
    deathState.value = 'alive'
    koExpiresAt.value = null
    tendingLocked.value = false
  }

  return {
    ailments,
    woundSeverity,
    woundHealsAt,
    deathState,
    koExpiresAt,
    tendingLocked,
    isLoading,
    hasActiveAilments,
    hasWounds,
    isKo,
    primaryAilment,
    fetchAilments,
    onAilmentOnset,
    onAilmentProgressed,
    onAilmentImproved,
    onAilmentCured,
    onWoundUpdated,
    onKoResolved,
    clear,
  }
})
