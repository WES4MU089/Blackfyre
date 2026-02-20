import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'

const API_BASE = BACKEND_URL

export interface Vitals {
  health: number
  maxHealth: number
  armor: number
}

export interface Finances {
  cash: number
  bank: number
  crypto: number
  dirty_money: number
}

export interface CharacterInfo {
  id: number
  player_id: number
  name: string
  backstory?: string
  portrait_url?: string
  created_at: string
}

export interface Job {
  job_id: number
  job_name: string
  grade: number
  grade_name: string
  salary: number
}

export interface StatusEffect {
  effect_id: number
  name: string
  effect_type: string
  icon_url?: string
  expires_at?: string
}

export interface InventoryItem {
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
  model_data?: Record<string, number | boolean>
  quantity: number
  slot_number: number
  durability: number
  metadata?: Record<string, unknown>
}

export interface Aptitude {
  id: string
  name: string
  baseValue: number
  currentValue: number
}

export interface EquippedItem {
  equipmentId: number
  slotId: string
  itemId: number
  itemKey: string
  itemName: string
  description?: string
  iconUrl?: string
  category: string
  rarity: string
  tier: number
  material?: string
  slotType?: string
  isTwoHanded: boolean
  weight: number
  basePrice: number
  modelData?: Record<string, number | boolean>
}

export interface RetainerInfo {
  id: number
  name: string
  tier: number
  tierName: string
  level: number
  health: number
  maxHealth: number
  isAvailable: boolean
}

export interface RetainerTierInfo {
  tier: number
  name: string
  hireCost: number
  aptitudeBudget: number
  aptitudeCap: number
  weaponKey: string
  armorKey: string | null
  shieldKey: string | null
  description: string | null
}

export interface RetainerDetailInfo {
  characterId: number
  name: string
  tier: number
  tierName: string
  aptitudeCap: number
  level: number
  xpSegments: number
  health: number
  maxHealth: number
  unspentAptitudePoints: number
  aptitudes: { key: string; baseValue: number; currentValue: number }[]
  equipment: { slotId: string; itemId: number; itemKey: string; itemName: string; iconUrl: string | null }[]
  inventory: { id: number; itemId: number; itemKey: string; itemName: string; iconUrl: string | null; quantity: number; slotNumber: number }[]
}

export interface CharacterListEntry {
  id: number
  name: string
  level: number
  is_active: boolean
  portrait_url?: string
  health?: number
  max_health?: number
}

export const useCharacterStore = defineStore('character', () => {
  const character = ref<CharacterInfo | null>(null)
  const characterList = ref<CharacterListEntry[]>([])
  const level = ref(1)
  const xpSegments = ref(0)
  const segmentsPerLevel = ref(10)
  const unspentAptitudePoints = ref(0)

  const vitals = ref<Vitals>({
    health: 100,
    maxHealth: 100,
    armor: 0,
  })
  const finances = ref<Finances>({
    cash: 0,
    bank: 0,
    crypto: 0,
    dirty_money: 0
  })
  const jobs = ref<Job[]>([])
  const activeEffects = ref<StatusEffect[]>([])
  const deathState = ref<'alive' | 'dead'>('alive')
  const woundSeverity = ref<'healthy' | 'light' | 'serious' | 'severe' | 'grave'>('healthy')
  const inventory = ref<InventoryItem[]>([])
  const aptitudes = ref<Aptitude[]>([
    { id: 'prowess', name: 'Prowess', baseValue: 5, currentValue: 5 },
    { id: 'fortitude', name: 'Fortitude', baseValue: 4, currentValue: 4 },
    { id: 'command', name: 'Command', baseValue: 3, currentValue: 3 },
    { id: 'cunning', name: 'Cunning', baseValue: 5, currentValue: 5 },
    { id: 'stewardship', name: 'Stewardship', baseValue: 4, currentValue: 4 },
    { id: 'presence', name: 'Presence', baseValue: 3, currentValue: 3 },
    { id: 'lore', name: 'Lore', baseValue: 3, currentValue: 3 },
    { id: 'faith', name: 'Faith', baseValue: 2, currentValue: 2 },
  ])
  const equipment = ref<Record<string, EquippedItem | null>>({
    mainHand: null,
    offHand: null,
    armor: null,
    accessory1: null,
    accessory2: null,
    ancillary1: null,
    ancillary2: null,
  })
  const retainers = ref<RetainerInfo[]>([])

  // Retainer management state
  const retainerDetail = ref<RetainerDetailInfo | null>(null)
  const retainerHireTier = ref<RetainerTierInfo | null>(null)
  const isHiringRetainer = ref(false)

  const isLoaded = computed(() => !!character.value)

  const healthPercent = computed(() =>
    vitals.value.maxHealth > 0
      ? (vitals.value.health / vitals.value.maxHealth) * 100
      : 0
  )
  const armorPercent = computed(() => vitals.value.armor)

  const isCriticalHealth = computed(() => vitals.value.health < vitals.value.maxHealth * 0.2)

  const xpPercent = computed(() =>
    segmentsPerLevel.value > 0
      ? (xpSegments.value / segmentsPerLevel.value) * 100
      : 0
  )

  function loadCharacterData(data: Record<string, unknown>): void {
    if (data.character) {
      character.value = data.character as CharacterInfo
    }
    if (data.level != null) level.value = data.level as number
    if (data.xpSegments != null) xpSegments.value = data.xpSegments as number
    if (data.segmentsPerLevel != null) segmentsPerLevel.value = data.segmentsPerLevel as number
    if (data.unspentAptitudePoints != null) unspentAptitudePoints.value = data.unspentAptitudePoints as number
    if (data.vitals) {
      const v = data.vitals as Record<string, number>
      vitals.value = {
        health: v.health ?? 100,
        maxHealth: v.max_health ?? v.maxHealth ?? 100,
        armor: v.armor ?? 0,
      }
    }
    if (data.finances) {
      const f = data.finances as Record<string, number>
      finances.value = {
        cash: f.cash ?? 0,
        bank: f.bank ?? 0,
        crypto: f.crypto ?? 0,
        dirty_money: f.dirty_money ?? 0
      }
    }
    if (data.jobs) jobs.value = data.jobs as Job[]
    if (data.activeEffects) activeEffects.value = data.activeEffects as StatusEffect[]
    if (data.death_state) deathState.value = data.death_state as typeof deathState.value
    if (data.wound_severity) woundSeverity.value = data.wound_severity as typeof woundSeverity.value
    if (data.inventory) inventory.value = data.inventory as InventoryItem[]
    if (data.aptitudes) aptitudes.value = data.aptitudes as Aptitude[]
    if (data.equipment) equipment.value = data.equipment as Record<string, EquippedItem | null>
    if (data.retainers) retainers.value = data.retainers as RetainerInfo[]
  }

  function setCharacterList(list: CharacterListEntry[]): void {
    characterList.value = list
  }

  function updateVitals(data: Partial<Vitals>): void {
    Object.assign(vitals.value, data)
  }

  function updateFinances(data: Record<string, number>): void {
    if (data.cash !== undefined) finances.value.cash = data.cash
    if (data.bank !== undefined) finances.value.bank = data.bank
    if (data.crypto !== undefined) finances.value.crypto = data.crypto
    if (data.dirty_money !== undefined) finances.value.dirty_money = data.dirty_money
  }

  function setInventory(items: unknown[]): void {
    inventory.value = items as InventoryItem[]
  }

  function setRetainers(data: unknown[]): void {
    retainers.value = data as RetainerInfo[]
  }

  // --- Retainer management ---

  function openRetainerHire(tierData: RetainerTierInfo): void {
    retainerHireTier.value = tierData
    isHiringRetainer.value = true
  }

  function closeRetainerHire(): void {
    retainerHireTier.value = null
    isHiringRetainer.value = false
  }

  async function hireRetainer(
    tier: number,
    name: string,
    aptitudes: Record<string, number>,
  ): Promise<{ success: boolean; error?: string }> {
    const charId = character.value?.id
    if (!charId) return { success: false, error: 'No character loaded' }

    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, name, aptitudes }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error ?? 'Failed to hire retainer' }

      // Refresh retainer list
      await fetchRetainers()
      closeRetainerHire()
      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  async function fetchRetainers(): Promise<void> {
    const charId = character.value?.id
    if (!charId) return
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}`)
      const data = await res.json()
      retainers.value = (data as RetainerInfo[]).map(r => ({
        ...r,
        isAvailable: r.health > 0,
      }))
    } catch { /* swallow */ }
  }

  async function fetchRetainerDetail(retainerId: number): Promise<void> {
    const charId = character.value?.id
    if (!charId) return
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}`)
      if (res.ok) {
        retainerDetail.value = await res.json() as RetainerDetailInfo
      }
    } catch { /* swallow */ }
  }

  function clearRetainerDetail(): void {
    retainerDetail.value = null
  }

  async function dismissRetainerApi(retainerId: number): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}`, { method: 'DELETE' })
      if (res.ok) {
        retainers.value = retainers.value.filter(r => r.id !== retainerId)
        if (retainerDetail.value?.characterId === retainerId) {
          retainerDetail.value = null
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function transferItem(
    retainerId: number,
    inventoryId: number,
    direction: 'to_retainer' | 'to_player',
  ): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: inventoryId, direction }),
      })
      const data = await res.json()
      if (data.success) {
        // Update player inventory from response
        if (data.playerInventory) inventory.value = data.playerInventory as InventoryItem[]
        // Refresh retainer detail to get updated retainer inventory
        await fetchRetainerDetail(retainerId)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function equipRetainerItem(
    retainerId: number,
    inventoryId: number,
    slotId: string,
  ): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: inventoryId, slot_id: slotId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchRetainerDetail(retainerId)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function unequipRetainerItem(retainerId: number, slotId: string): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchRetainerDetail(retainerId)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function allocateRetainerAptitude(retainerId: number, aptitudeKey: string): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/retainers/${charId}/${retainerId}/aptitude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aptitude_key: aptitudeKey }),
      })
      if (res.ok) {
        await fetchRetainerDetail(retainerId)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // --- Helpers for optimistic updates ---

  function findFirstEmptySlotLocal(): number {
    const used = new Set(inventory.value.map(i => i.slot_number))
    for (let i = 1; i <= 25; i++) {
      if (!used.has(i)) return i
    }
    return 26
  }

  function inventoryToEquipped(inv: InventoryItem, slotId: string): EquippedItem {
    return {
      equipmentId: -1,
      slotId,
      itemId: inv.item_id,
      itemKey: inv.item_key,
      itemName: inv.name,
      description: inv.description,
      iconUrl: inv.icon_url,
      category: inv.category,
      rarity: inv.rarity,
      tier: inv.tier,
      material: inv.material,
      slotType: inv.slot_type,
      isTwoHanded: inv.is_two_handed,
      weight: inv.weight,
      basePrice: inv.base_price,
      modelData: inv.model_data,
    }
  }

  function equippedToInventory(eq: EquippedItem, slotNumber: number): InventoryItem {
    return {
      inventory_id: -1,
      item_id: eq.itemId,
      item_key: eq.itemKey,
      name: eq.itemName,
      description: eq.description,
      icon_url: eq.iconUrl,
      category: eq.category,
      rarity: eq.rarity,
      tier: eq.tier,
      material: eq.material,
      slot_type: eq.slotType,
      is_two_handed: eq.isTwoHanded,
      weight: eq.weight,
      max_stack: 1,
      is_usable: false,
      is_tradeable: true,
      base_price: eq.basePrice,
      model_data: eq.modelData,
      quantity: 1,
      slot_number: slotNumber,
      durability: 100,
      metadata: undefined,
    }
  }

  // --- Inventory / Equipment actions (optimistic) ---

  async function moveItem(sourceSlot: number, targetSlot: number): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false

    // Snapshot for rollback
    const snapshot = inventory.value.map(i => ({ ...i }))

    // Optimistic: swap slot numbers
    const sourceItem = inventory.value.find(i => i.slot_number === sourceSlot)
    const targetItem = inventory.value.find(i => i.slot_number === targetSlot)
    if (sourceItem) sourceItem.slot_number = targetSlot
    if (targetItem) targetItem.slot_number = sourceSlot

    try {
      const res = await fetch(`${API_BASE}/api/inventory/${charId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSlot, targetSlot }),
      })
      const data = await res.json()
      if (data.inventory) inventory.value = data.inventory as InventoryItem[]
      return data.success === true
    } catch {
      inventory.value = snapshot
      return false
    }
  }

  async function equipItem(inventoryId: number, slotId: string): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false

    // Snapshot for rollback
    const invSnapshot = inventory.value.map(i => ({ ...i }))
    const equipSnapshot = { ...equipment.value }

    // Find the inventory item
    const itemIdx = inventory.value.findIndex(i => i.inventory_id === inventoryId)
    if (itemIdx === -1) return false
    const invItem = inventory.value[itemIdx]
    const freedSlot = invItem.slot_number

    // Optimistic: remove from inventory
    inventory.value = inventory.value.filter(i => i.inventory_id !== inventoryId)

    // If replacing an equipped item, move it to inventory
    const oldEquip = equipment.value[slotId]
    if (oldEquip) {
      inventory.value = [...inventory.value, equippedToInventory(oldEquip, freedSlot)]
    }

    // Two-handed: also clear offHand
    if (invItem.is_two_handed && slotId === 'mainHand' && equipment.value.offHand) {
      const offHand = equipment.value.offHand
      inventory.value = [...inventory.value, equippedToInventory(offHand, findFirstEmptySlotLocal())]
      equipment.value = { ...equipment.value, offHand: null }
    }

    // Place in equipment slot
    equipment.value = { ...equipment.value, [slotId]: inventoryToEquipped(invItem, slotId) }

    try {
      const res = await fetch(`${API_BASE}/api/equipment/character/${charId}/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: inventoryId, slot_id: slotId }),
      })
      const data = await res.json()
      // Server response is authoritative — replace with real IDs
      if (data.inventory) inventory.value = data.inventory as InventoryItem[]
      if (data.equipment) equipment.value = data.equipment as Record<string, EquippedItem | null>
      return data.success === true
    } catch {
      inventory.value = invSnapshot
      equipment.value = equipSnapshot
      return false
    }
  }

  async function unequipItem(slotId: string, targetSlotNumber?: number): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false

    // Snapshot for rollback
    const invSnapshot = inventory.value.map(i => ({ ...i }))
    const equipSnapshot = { ...equipment.value }

    const equippedItem = equipment.value[slotId]
    if (!equippedItem) return false

    // Optimistic: remove from equipment, add to inventory
    const target = targetSlotNumber ?? findFirstEmptySlotLocal()
    equipment.value = { ...equipment.value, [slotId]: null }
    inventory.value = [...inventory.value, equippedToInventory(equippedItem, target)]

    try {
      const res = await fetch(`${API_BASE}/api/equipment/character/${charId}/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId, target_slot_number: targetSlotNumber }),
      })
      const data = await res.json()
      // Server response is authoritative
      if (data.inventory) inventory.value = data.inventory as InventoryItem[]
      if (data.equipment) equipment.value = data.equipment as Record<string, EquippedItem | null>
      return data.success === true
    } catch {
      inventory.value = invSnapshot
      equipment.value = equipSnapshot
      return false
    }
  }

  async function useItem(inventoryId: number): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${charId}/items/${inventoryId}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        // Remove or decrement the used item locally
        const idx = inventory.value.findIndex(i => i.inventory_id === inventoryId)
        if (idx !== -1) {
          if (inventory.value[idx].quantity > 1) {
            inventory.value[idx].quantity--
          } else {
            inventory.value.splice(idx, 1)
          }
        }
      }
      return data.success === true
    } catch {
      return false
    }
  }

  async function dropItem(inventoryId: number): Promise<boolean> {
    const charId = character.value?.id
    if (!charId) return false
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${charId}/items/${inventoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        inventory.value = inventory.value.filter(i => i.inventory_id !== inventoryId)
      }
      return data.success === true
    } catch {
      return false
    }
  }

  function sortInventory(by: 'type' | 'name'): void {
    const sorted = [...inventory.value]
    if (by === 'type') {
      sorted.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    // Reassign slot_number 1..N
    sorted.forEach((item, i) => { item.slot_number = i + 1 })
    inventory.value = sorted
  }

  // --- XP mutation methods (called from socket event handlers) ---

  function updateCharacterXp(data: { segments: number; totalSegments: number; source: string }): void {
    xpSegments.value = data.totalSegments
  }

  function applyLevelUp(data: { newLevel: number; segments: number; aptitudePoints: number }): void {
    level.value = data.newLevel
    xpSegments.value = data.segments
    unspentAptitudePoints.value += data.aptitudePoints
  }

  function applyAptitudeAllocation(data: { aptitudeKey: string; newValue: number; unspentAptitudePoints: number }): void {
    const apt = aptitudes.value.find(a => a.id === data.aptitudeKey)
    if (apt) apt.currentValue = data.newValue
    unspentAptitudePoints.value = data.unspentAptitudePoints
  }

  function clear(): void {
    character.value = null
    characterList.value = []
    level.value = 1
    xpSegments.value = 0
    segmentsPerLevel.value = 10
    unspentAptitudePoints.value = 0
    vitals.value = { health: 100, maxHealth: 100, armor: 0 }
    finances.value = { cash: 0, bank: 0, crypto: 0, dirty_money: 0 }
    jobs.value = []
    activeEffects.value = []
    deathState.value = 'alive'
    woundSeverity.value = 'healthy'
    inventory.value = []
    aptitudes.value = []
    equipment.value = { mainHand: null, offHand: null, armor: null, accessory1: null, accessory2: null, ancillary1: null, ancillary2: null }
    retainers.value = []
    retainerDetail.value = null
    retainerHireTier.value = null
    isHiringRetainer.value = false
  }

  return {
    character,
    characterList,
    level,
    xpSegments,
    segmentsPerLevel,
    unspentAptitudePoints,
    vitals,
    finances,
    jobs,
    activeEffects,
    deathState,
    woundSeverity,
    inventory,
    aptitudes,
    equipment,
    retainers,
    retainerDetail,
    retainerHireTier,
    isHiringRetainer,
    isLoaded,
    healthPercent,
    armorPercent,
    isCriticalHealth,
    xpPercent,
    loadCharacterData,
    setCharacterList,
    updateVitals,
    updateFinances,
    setInventory,
    setRetainers,
    openRetainerHire,
    closeRetainerHire,
    hireRetainer,
    fetchRetainers,
    fetchRetainerDetail,
    clearRetainerDetail,
    dismissRetainerApi,
    transferItem,
    equipRetainerItem,
    unequipRetainerItem,
    allocateRetainerAptitude,
    moveItem,
    equipItem,
    unequipItem,
    useItem,
    dropItem,
    sortInventory,
    updateCharacterXp,
    applyLevelUp,
    applyAptitudeAllocation,
    clear
  }
})
