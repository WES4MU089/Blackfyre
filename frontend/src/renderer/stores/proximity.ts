import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NearbyStatusEffect {
  name: string
  effectType: string
  iconUrl: string | null
}

export interface NearbyEquipment {
  weaponName: string | null
  weaponType: string | null
  weaponMaterial: string | null
  isTwoHanded: boolean
  armorName: string | null
  armorClass: string | null
  armorMaterial: string | null
  shieldName: string | null
  shieldClass: string | null
}

export interface NearbyPlayer {
  characterId: number
  characterName: string
  thumbnailUrl: string | null
  portraitUrl: string | null
  distance: number
  health: number
  maxHealth: number
  isAlive: boolean
  woundSeverity: string
  statusEffects: NearbyStatusEffect[]
  equipment: NearbyEquipment | null
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
