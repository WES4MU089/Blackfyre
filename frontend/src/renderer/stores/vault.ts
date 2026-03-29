import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface VaultItem {
  vault_item_id: number
  item_id: number
  item_key: string
  name: string
  description: string | null
  icon_url: string | null
  category: string
  rarity: string
  tier: number
  material: string | null
  slot_type: string | null
  is_two_handed: boolean
  weight: number
  max_stack: number
  quantity: number
  slot_number: number
  durability: number
  metadata: Record<string, unknown> | null
  model_data: Record<string, number | boolean> | null
}

export interface VaultOpenPayload {
  tier: number
  slots: number
  items: VaultItem[]
}

export const useVaultStore = defineStore('vault', () => {
  const isOpen = ref(false)
  const tier = ref(1)
  const slots = ref(25)
  const items = ref<VaultItem[]>([])
  const lastMessage = ref<{ success: boolean; text: string } | null>(null)

  const itemCount = computed(() => items.value.length)
  const isFull = computed(() => itemCount.value >= slots.value)

  function openVault(data: VaultOpenPayload): void {
    isOpen.value = true
    tier.value = data.tier
    slots.value = data.slots
    items.value = data.items
    lastMessage.value = null
  }

  function closeVault(): void {
    isOpen.value = false
    items.value = []
    lastMessage.value = null
  }

  function updateItems(newItems: VaultItem[]): void {
    items.value = newItems
  }

  function setTier(newTier: number, newSlots: number): void {
    tier.value = newTier
    slots.value = newSlots
  }

  function setMessage(success: boolean, text: string): void {
    lastMessage.value = { success, text }
  }

  return {
    isOpen, tier, slots, items, lastMessage,
    itemCount, isFull,
    openVault, closeVault, updateItems, setTier, setMessage,
  }
})
