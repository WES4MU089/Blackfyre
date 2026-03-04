import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NearbyPlayer {
  characterId: number
  characterName: string
  thumbnailUrl: string | null
  distance: number
  health: number
  maxHealth: number
  isAlive: boolean
  woundSeverity: string
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
