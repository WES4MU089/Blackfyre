import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ShopItem {
  id: number
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
  base_price: number
  model_data: Record<string, number | boolean> | null
}

export type ShopCategory = 'weapon' | 'armor' | 'shield'

export interface ShopOpenPayload {
  npcName: string
  npcType: string
  items: ShopItem[]
  cash: number
}

export const useShopStore = defineStore('shop', () => {
  const isOpen = ref(false)
  const npcName = ref('')
  const npcType = ref('')
  const items = ref<ShopItem[]>([])
  const playerCash = ref(0)
  const activeCategory = ref<ShopCategory>('weapon')
  const buyingItemKey = ref<string | null>(null)
  const lastMessage = ref<{ success: boolean; text: string } | null>(null)

  const weaponItems = computed(() => items.value.filter(i => i.category === 'weapon'))
  const armorItems = computed(() => items.value.filter(i => i.category === 'armor'))
  const shieldItems = computed(() => items.value.filter(i => i.category === 'shield'))

  const categories = computed(() => {
    const cats: { key: ShopCategory; label: string; count: number }[] = []
    if (weaponItems.value.length > 0) cats.push({ key: 'weapon', label: 'Weapons', count: weaponItems.value.length })
    if (armorItems.value.length > 0) cats.push({ key: 'armor', label: 'Armor', count: armorItems.value.length })
    if (shieldItems.value.length > 0) cats.push({ key: 'shield', label: 'Shields', count: shieldItems.value.length })
    return cats
  })

  const activeItems = computed(() => {
    switch (activeCategory.value) {
      case 'weapon': return weaponItems.value
      case 'armor': return armorItems.value
      case 'shield': return shieldItems.value
      default: return items.value
    }
  })

  function openShop(data: ShopOpenPayload): void {
    isOpen.value = true
    npcName.value = data.npcName
    npcType.value = data.npcType
    items.value = data.items
    playerCash.value = data.cash
    buyingItemKey.value = null
    lastMessage.value = null

    // Default to first available category
    if (weaponItems.value.length > 0) activeCategory.value = 'weapon'
    else if (armorItems.value.length > 0) activeCategory.value = 'armor'
    else if (shieldItems.value.length > 0) activeCategory.value = 'shield'
  }

  function closeShop(): void {
    isOpen.value = false
    npcName.value = ''
    npcType.value = ''
    items.value = []
    buyingItemKey.value = null
    lastMessage.value = null
  }

  function setCategory(cat: ShopCategory): void {
    activeCategory.value = cat
    lastMessage.value = null
  }

  function setBuying(itemKey: string | null): void {
    buyingItemKey.value = itemKey
  }

  function updateCash(cash: number): void {
    playerCash.value = cash
  }

  function setMessage(success: boolean, text: string): void {
    lastMessage.value = { success, text }
    buyingItemKey.value = null
  }

  function canAfford(price: number): boolean {
    return playerCash.value >= price
  }

  return {
    isOpen,
    npcName,
    npcType,
    items,
    playerCash,
    activeCategory,
    buyingItemKey,
    lastMessage,
    weaponItems,
    armorItems,
    shieldItems,
    categories,
    activeItems,
    openShop,
    closeShop,
    setCategory,
    setBuying,
    updateCash,
    setMessage,
    canAfford,
  }
})
