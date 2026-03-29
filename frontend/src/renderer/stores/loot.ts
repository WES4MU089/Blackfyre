import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface LootItem {
  id: number
  item_id: number
  name: string
  item_key: string
  icon_url: string | null
  category: string
  rarity: string
  tier: number
  base_price: number
  source_name: string
  status: 'available' | 'claimed' | 'sold'
  won_by_player_id: number | null
  winning_roll: number | null
}

export interface LootPlayer {
  player_id: number
  character_id: number
  character_name: string
  combatant_count: number
  is_ready: boolean
  coin_received: number
}

export interface LootPoolData {
  pool: {
    id: number
    session_id: number
    status: 'review' | 'resolved' | 'expired'
    first_ready_at: string | null
    hard_expires_at: string
    total_item_value: number
    total_coin: number
    auto_sell_coin: number
  }
  items: LootItem[]
  players: LootPlayer[]
  myClaims: number[]
}

export const useLootStore = defineStore('loot', () => {
  const isOpen = ref(false)
  const poolData = ref<LootPoolData | null>(null)
  const myClaims = ref<Set<number>>(new Set())
  const isReady = ref(false)
  const isResolved = ref(false)

  const items = computed(() => poolData.value?.items ?? [])
  const players = computed(() => poolData.value?.players ?? [])
  const pool = computed(() => poolData.value?.pool ?? null)

  const weaponItems = computed(() => items.value.filter(i => i.category === 'weapon'))
  const armorItems = computed(() => items.value.filter(i => i.category === 'armor'))
  const shieldItems = computed(() => items.value.filter(i => i.category === 'shield'))
  const otherItems = computed(() => items.value.filter(i => !['weapon', 'armor', 'shield'].includes(i.category)))

  const claimedCount = computed(() => myClaims.value.size)

  function openLoot(data: LootPoolData): void {
    isOpen.value = true
    poolData.value = data
    myClaims.value = new Set(data.myClaims)
    isReady.value = false
    isResolved.value = data.pool.status === 'resolved'
  }

  function closeLoot(): void {
    isOpen.value = false
    poolData.value = null
    myClaims.value.clear()
    isReady.value = false
    isResolved.value = false
  }

  function toggleClaim(itemId: number): void {
    if (isReady.value || isResolved.value) return
    if (myClaims.value.has(itemId)) {
      myClaims.value.delete(itemId)
    } else {
      myClaims.value.add(itemId)
    }
  }

  function setReady(): void {
    isReady.value = true
  }

  function setResolved(data: LootPoolData): void {
    poolData.value = data
    isResolved.value = true
  }

  return {
    isOpen, poolData, myClaims, isReady, isResolved,
    items, players, pool,
    weaponItems, armorItems, shieldItems, otherItems,
    claimedCount,
    openLoot, closeLoot, toggleClaim, setReady, setResolved,
  }
})
