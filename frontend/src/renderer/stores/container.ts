import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface ContainerItem {
  container_inventory_id: number
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

export interface ContainerOpenPayload {
  containerId: number
  containerKey: string
  name: string
  description: string | null
  capacity: number
  isLocked: boolean
  lockType: string
  items: ContainerItem[]
}

export const useContainerStore = defineStore('container', () => {
  const isOpen = ref(false)
  const containerId = ref<number | null>(null)
  const containerKey = ref('')
  const name = ref('')
  const description = ref<string | null>(null)
  const capacity = ref(10)
  const items = ref<ContainerItem[]>([])
  const lastMessage = ref<{ success: boolean; text: string } | null>(null)

  const slotMap = computed(() => {
    const map = new Map<number, ContainerItem>()
    for (const item of items.value) {
      if (item.slot_number >= 1 && item.slot_number <= capacity.value) {
        map.set(item.slot_number, item)
      }
    }
    return map
  })

  const itemCount = computed(() => items.value.length)
  const isFull = computed(() => itemCount.value >= capacity.value)

  function openContainer(data: ContainerOpenPayload): void {
    isOpen.value = true
    containerId.value = data.containerId
    containerKey.value = data.containerKey
    name.value = data.name
    description.value = data.description
    capacity.value = data.capacity
    items.value = data.items
    lastMessage.value = null
  }

  function closeContainer(): void {
    isOpen.value = false
    containerId.value = null
    containerKey.value = ''
    name.value = ''
    description.value = null
    capacity.value = 10
    items.value = []
    lastMessage.value = null
  }

  function updateItems(newItems: ContainerItem[]): void {
    items.value = newItems
  }

  function setMessage(success: boolean, text: string): void {
    lastMessage.value = { success, text }
  }

  return {
    isOpen,
    containerId,
    containerKey,
    name,
    description,
    capacity,
    items,
    lastMessage,
    slotMap,
    itemCount,
    isFull,
    openContainer,
    closeContainer,
    updateItems,
    setMessage,
  }
})
