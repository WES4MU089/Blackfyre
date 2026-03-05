import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NearbyStatusEffect {
  name: string
  effectType: string
  iconUrl: string | null
}

export interface NearbyPlayer {
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

export const useProximityStore = defineStore('proximity', () => {
  const nearbyPlayers = ref<NearbyPlayer[]>([])

  function setNearbyPlayers(players: NearbyPlayer[]): void {
    nearbyPlayers.value = players
  }

  function clearNearbyPlayers(): void {
    nearbyPlayers.value = []
  }

  return {
    nearbyPlayers,
    setNearbyPlayers,
    clearNearbyPlayers,
  }
})
