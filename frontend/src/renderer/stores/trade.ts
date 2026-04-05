import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { InventoryItem } from './character'

export interface TradeItem {
  inventory_id: number
  item_id: number
  item_key: string
  name: string
  description?: string
  icon_url?: string
  category: string
  rarity: string
  tier: number
  material?: string
  slot_type?: string
  is_two_handed: boolean
  weight: number
  max_stack: number
  is_usable: boolean
  is_tradeable: boolean
  base_price: number
  model_data?: Record<string, number | boolean | string>
  quantity: number
  slot_number: number
  durability: number
  metadata?: Record<string, unknown>
}

export interface TradeOffer {
  items: TradeItem[]
  coins: number // copper
  isReady: boolean
}

export interface TradeState {
  tradeId: string
  partnerCharacterId: number
  partnerCharacterName: string
  myOffer: TradeOffer
  partnerOffer: TradeOffer
}

export interface TradeRequestPayload {
  tradeId: string
  fromCharacterId: number
  fromCharacterName: string
}

export interface TradeStartedPayload {
  tradeId: string
  partnerCharacterId: number
  partnerCharacterName: string
}

export interface TradeUpdatedPayload {
  tradeId: string
  myOffer: TradeOffer
  partnerOffer: TradeOffer
}

export const useTradeStore = defineStore('trade', () => {
  const isOpen = ref(false)
  const tradeId = ref<string | null>(null)
  const partnerCharacterId = ref<number | null>(null)
  const partnerCharacterName = ref('')

  // Pending incoming request
  const pendingRequest = ref<TradeRequestPayload | null>(null)

  // My offer
  const myItems = ref<TradeItem[]>([])
  const myCoins = ref(0)
  const myReady = ref(false)

  // Partner's offer
  const partnerItems = ref<TradeItem[]>([])
  const partnerCoins = ref(0)
  const partnerReady = ref(false)

  // Status message
  const lastMessage = ref<{ success: boolean; text: string } | null>(null)

  // Both sides ready = show confirm phase
  const bothReady = computed(() => myReady.value && partnerReady.value)

  function openTrade(data: TradeStartedPayload): void {
    isOpen.value = true
    tradeId.value = data.tradeId
    partnerCharacterId.value = data.partnerCharacterId
    partnerCharacterName.value = data.partnerCharacterName
    myItems.value = []
    myCoins.value = 0
    myReady.value = false
    partnerItems.value = []
    partnerCoins.value = 0
    partnerReady.value = false
    lastMessage.value = null
    pendingRequest.value = null
  }

  function closeTrade(): void {
    isOpen.value = false
    tradeId.value = null
    partnerCharacterId.value = null
    partnerCharacterName.value = ''
    myItems.value = []
    myCoins.value = 0
    myReady.value = false
    partnerItems.value = []
    partnerCoins.value = 0
    partnerReady.value = false
    lastMessage.value = null
    pendingRequest.value = null
  }

  function updateOffers(data: TradeUpdatedPayload): void {
    myItems.value = data.myOffer.items
    myCoins.value = data.myOffer.coins
    myReady.value = data.myOffer.isReady
    partnerItems.value = data.partnerOffer.items
    partnerCoins.value = data.partnerOffer.coins
    partnerReady.value = data.partnerOffer.isReady
  }

  function setPendingRequest(data: TradeRequestPayload): void {
    pendingRequest.value = data
  }

  function clearPendingRequest(): void {
    pendingRequest.value = null
  }

  function setMessage(success: boolean, text: string): void {
    lastMessage.value = { success, text }
  }

  return {
    isOpen,
    tradeId,
    partnerCharacterId,
    partnerCharacterName,
    pendingRequest,
    myItems,
    myCoins,
    myReady,
    partnerItems,
    partnerCoins,
    partnerReady,
    bothReady,
    lastMessage,
    openTrade,
    closeTrade,
    updateOffers,
    setPendingRequest,
    clearPendingRequest,
    setMessage,
  }
})
