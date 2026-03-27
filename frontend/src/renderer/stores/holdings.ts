import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BACKEND_URL } from '@/config'
import { useCharacterStore } from './character'

const API = BACKEND_URL

// ── Types ────────────────────────────────────────────────────

export interface HoldingOverview {
  id: number
  name: string
  holding_type: string
  size: number
  owner_name: string | null
  manpower_max: number
  manpower_current: number
  settlement_hp_max: number
  settlement_hp_current: number
  warehouse_tier: number
  special_slot_name: string | null
  building_count: number
  construction_count: number
}

export interface HoldingBuilding {
  id: number
  building_type_id: number
  building_name: string
  category: string
  slot_category: string
  tier: number
  max_tier: number
  resource_node_id: number | null
  node_name: string | null
  node_resource: string | null
  is_under_construction: boolean
  construction_completes_at: string | null
  target_tier: number | null
}

export interface HoldingResource {
  resource_type: string
  quantity: number
  capacity: number
}

export interface IronStock {
  tier: number
  name: string
  quantity: number
}

export interface ResourceNode {
  id: number
  name: string
  resource_produced: string
  output_multiplier: number
}

export interface SlotSummary {
  defense: { used: number; total: number }
  gathering: { used: number; total: number }
  production: { used: number; total: number }
}

export interface HoldingDetail {
  id: number
  name: string
  holding_type: string
  holding_type_id: number
  size: number
  manpower_max: number
  manpower_current: number
  settlement_hp_max: number
  settlement_hp_current: number
  warehouse_tier: number
  special_slot_name: string | null
  special_slot_description: string | null
  special_slot_effects: unknown
  food_consumption_per_tick: number
  warehouse_capacity: number
  walls_hp_bonus: number
  walls_advantage: number
  garrison_capacity: number
  slots: SlotSummary
  buildings: HoldingBuilding[]
  resources: HoldingResource[]
  iron_stockpile: IronStock[]
  resource_nodes: ResourceNode[]
}

export interface BuildingCostRow {
  id: number
  name: string
  category: string
  max_tier: number
  node_type_required: string | null
  description: string
  tier: number
  gold_cost: number
  timber_cost: number
  stone_cost: number
  iron_cost: number
  build_time_ticks: number
}

// ── Store ────────────────────────────────────────────────────

export const useHoldingsStore = defineStore('holdings', () => {
  const holdings = ref<HoldingOverview[]>([])
  const selectedHolding = ref<HoldingDetail | null>(null)
  const buildingTypes = ref<BuildingCostRow[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function getCharacterId(): number {
    const cs = useCharacterStore()
    return cs.character?.id ?? 0
  }

  async function fetchHoldings() {
    const cid = getCharacterId()
    if (!cid) return
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}`)
      if (!res.ok) throw new Error(await res.text())
      holdings.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch holdings'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchHoldingDetail(holdingId: number) {
    const cid = getCharacterId()
    if (!cid) return
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}/${holdingId}`)
      if (!res.ok) throw new Error(await res.text())
      selectedHolding.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch holding detail'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBuildingTypes() {
    if (buildingTypes.value.length > 0) return
    try {
      const res = await fetch(`${API}/api/holdings/building-types`)
      if (!res.ok) throw new Error(await res.text())
      buildingTypes.value = await res.json()
    } catch (e) {
      console.error('Failed to fetch building types:', e)
    }
  }

  async function startConstruction(holdingId: number, buildingTypeId: number, targetTier: number) {
    const cid = getCharacterId()
    if (!cid) return
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}/${holdingId}/construct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_type_id: buildingTypeId, target_tier: targetTier }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Construction failed')
      }
      await fetchHoldingDetail(holdingId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Construction failed'
      throw e
    }
  }

  async function cancelConstruction(holdingId: number, buildingId: number) {
    const cid = getCharacterId()
    if (!cid) return
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}/${holdingId}/cancel-construction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_id: buildingId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Cancel failed')
      }
      await fetchHoldingDetail(holdingId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Cancel failed'
      throw e
    }
  }

  async function assignNode(holdingId: number, buildingId: number, resourceNodeId: number) {
    const cid = getCharacterId()
    if (!cid) return
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}/${holdingId}/assign-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_id: buildingId, resource_node_id: resourceNodeId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Assign failed')
      }
      await fetchHoldingDetail(holdingId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Assign failed'
      throw e
    }
  }

  async function upgradeWarehouse(holdingId: number) {
    const cid = getCharacterId()
    if (!cid) return
    error.value = null
    try {
      const res = await fetch(`${API}/api/holdings/${cid}/${holdingId}/upgrade-warehouse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upgrade failed')
      }
      await fetchHoldingDetail(holdingId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Upgrade failed'
      throw e
    }
  }

  function clearSelection() {
    selectedHolding.value = null
    error.value = null
  }

  return {
    holdings,
    selectedHolding,
    buildingTypes,
    isLoading,
    error,
    fetchHoldings,
    fetchHoldingDetail,
    fetchBuildingTypes,
    startConstruction,
    cancelConstruction,
    assignNode,
    upgradeWarehouse,
    clearSelection,
  }
})
