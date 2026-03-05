import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { NearbyStatusEffect } from './proximity'

export interface TargetCharacter {
  characterId: number
  characterName: string
  thumbnailUrl: string | null
  distance: number
  health: number
  maxHealth: number
  isAlive: boolean
  woundSeverity: string
  statusEffects: NearbyStatusEffect[]
}

export const useTargetStore = defineStore('target', () => {
  const target = ref<TargetCharacter | null>(null)

  function setTarget(t: TargetCharacter): void {
    // Toggle off if clicking the same target
    if (target.value && target.value.characterId === t.characterId) {
      target.value = null
    } else {
      target.value = t
    }
  }

  function updateTarget(t: Partial<TargetCharacter> & { characterId: number }): void {
    if (target.value && target.value.characterId === t.characterId) {
      Object.assign(target.value, t)
    }
  }

  function clearTarget(): void {
    target.value = null
  }

  return {
    target,
    setTarget,
    updateTarget,
    clearTarget,
  }
})
