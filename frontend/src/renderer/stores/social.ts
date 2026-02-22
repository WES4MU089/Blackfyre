import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'
import { useAuthStore } from './auth'

// ===== Interfaces =====

export interface RegionSummary {
  id: number
  name: string
  description: string | null
  banner_url: string | null
  ruling_house_id: number | null
  ruling_house_name: string | null
}

export interface HouseSummary {
  id: number
  name: string
  motto: string | null
  sigil_url: string | null
  seat: string | null
  region_id: number | null
  is_great_house: boolean
  is_royal_house: boolean
  head_character_id: number | null
  region_name: string | null
}

export interface HouseDetail extends HouseSummary {
  description: string | null
  head_character_name: string | null
  is_extinct: boolean
}

export interface OrganizationSummary {
  id: number
  name: string
  org_type: string
  description: string | null
  sigil_url: string | null
  region_id: number | null
  leader_character_id: number | null
  requires_approval: boolean
  region_name: string | null
  leader_name: string | null
  member_count: number
}

export interface OrgMember {
  id: number
  character_id: number
  rank: string | null
  joined_at: string
  character_name: string
  portrait_url: string | null
  title: string | null
  level: number
}

export interface FactionSummary {
  id: number
  name: string
  description: string | null
  banner_url: string | null
  leader_character_id: number | null
  leader_name: string | null
  public_member_count: number
}

export interface FactionMember {
  character_id: number
  joined_at: string
  character_name: string
  portrait_url: string | null
  title: string | null
  house_name: string | null
}

export interface FamilyTreeNpc {
  id: number
  name: string
  title: string | null
  epithet: string | null
  portrait_url: string | null
  public_bio: string | null
  is_deceased: boolean
}

export interface FamilyTreeEdge {
  id: number
  relationship: 'parent' | 'spouse' | 'sibling'
  from_character_id: number | null
  from_npc_id: number | null
  to_character_id: number | null
  to_npc_id: number | null
}

export interface FamilyTreeCharacter {
  id: number
  name: string
  title: string | null
  epithet: string | null
  portrait_url: string | null
  is_active: boolean
  public_bio: string | null
  level: number
}

export type SocialView =
  | 'regions'
  | 'region-detail'
  | 'house-detail'
  | 'organizations'
  | 'org-detail'
  | 'factions'
  | 'faction-detail'

const ROOT_VIEWS: SocialView[] = ['regions', 'organizations', 'factions']

export const useSocialStore = defineStore('social', () => {
  // ===== State =====
  const isOpen = ref(false)
  const isLoading = ref(false)
  const currentView = ref<SocialView>('regions')
  const navHistory = ref<SocialView[]>([])

  // Region data
  const regions = ref<RegionSummary[]>([])
  const houses = ref<HouseSummary[]>([])
  const selectedRegionId = ref<number | null>(null)
  const regionHouses = ref<HouseSummary[]>([])

  // House detail
  const selectedHouseId = ref<number | null>(null)
  const houseDetail = ref<HouseDetail | null>(null)
  const familyTreeNpcs = ref<FamilyTreeNpc[]>([])
  const familyTreeEdges = ref<FamilyTreeEdge[]>([])
  const familyTreeCharacters = ref<FamilyTreeCharacter[]>([])

  // Organizations
  const organizations = ref<OrganizationSummary[]>([])
  const selectedOrg = ref<OrganizationSummary | null>(null)
  const selectedOrgMembers = ref<OrgMember[]>([])

  // Factions
  const factions = ref<FactionSummary[]>([])
  const selectedFaction = ref<FactionSummary | null>(null)
  const selectedFactionMembers = ref<FactionMember[]>([])

  // ===== Computed =====
  const isRootView = computed(() => ROOT_VIEWS.includes(currentView.value))
  const canGoBack = computed(() => navHistory.value.length > 0)

  const selectedRegion = computed(() =>
    regions.value.find(r => r.id === selectedRegionId.value) ?? null
  )

  // ===== Helpers =====
  function authHeaders(): Record<string, string> {
    const auth = useAuthStore()
    return { Authorization: `Bearer ${auth.token}` }
  }

  // ===== Navigation =====
  function navigateTo(view: SocialView): void {
    navHistory.value.push(currentView.value)
    currentView.value = view
  }

  function goBack(): void {
    const prev = navHistory.value.pop()
    if (prev) {
      currentView.value = prev
    }
  }

  function switchRootTab(view: SocialView): void {
    navHistory.value = []
    currentView.value = view
  }

  // ===== Panel lifecycle =====
  function openPanel(): void {
    isOpen.value = true
    currentView.value = 'regions'
    navHistory.value = []
    if (regions.value.length === 0) fetchRegions()
  }

  function closePanel(): void {
    isOpen.value = false
  }

  // ===== Data fetching =====
  async function fetchRegions(): Promise<void> {
    if (regions.value.length > 0) return
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/houses/regions/list`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        regions.value = data.regions
      }
    } catch (err) {
      console.error('Failed to fetch regions:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchHouses(): Promise<void> {
    if (houses.value.length > 0) return
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/houses`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        houses.value = data.houses
      }
    } catch (err) {
      console.error('Failed to fetch houses:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function viewRegion(id: number): Promise<void> {
    selectedRegionId.value = id
    // Ensure houses are loaded
    if (houses.value.length === 0) await fetchHouses()
    regionHouses.value = houses.value.filter(h => h.region_id === id)
    navigateTo('region-detail')
  }

  async function viewHouse(id: number): Promise<void> {
    selectedHouseId.value = id
    isLoading.value = true
    try {
      const [houseRes, treeRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/houses/${id}`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/family-tree/houses/${id}/tree`, { headers: authHeaders() }),
      ])
      if (houseRes.ok) {
        const data = await houseRes.json()
        houseDetail.value = data.house
      }
      if (treeRes.ok) {
        const data = await treeRes.json()
        familyTreeNpcs.value = data.npcs ?? []
        familyTreeEdges.value = data.edges ?? []
        familyTreeCharacters.value = data.characters ?? []
      }
      navigateTo('house-detail')
    } catch (err) {
      console.error('Failed to fetch house detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchOrganizations(): Promise<void> {
    if (organizations.value.length > 0) return
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        organizations.value = data.organizations
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function viewOrganization(id: number): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/organizations/${id}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        selectedOrg.value = data.organization
        selectedOrgMembers.value = data.members ?? []
      }
      navigateTo('org-detail')
    } catch (err) {
      console.error('Failed to fetch organization detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchFactions(): Promise<void> {
    if (factions.value.length > 0) return
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/factions`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        factions.value = data.factions
      }
    } catch (err) {
      console.error('Failed to fetch factions:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function viewFaction(id: number): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/factions/${id}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        selectedFaction.value = data.faction
        selectedFactionMembers.value = data.members ?? []
      }
      navigateTo('faction-detail')
    } catch (err) {
      console.error('Failed to fetch faction detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function submitSuggestion(
    houseId: number,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/family-tree/houses/${houseId}/suggestions`,
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      return res.ok
    } catch (err) {
      console.error('Failed to submit family tree suggestion:', err)
      return false
    }
  }

  return {
    // State
    isOpen,
    isLoading,
    currentView,
    navHistory,
    regions,
    houses,
    selectedRegionId,
    regionHouses,
    selectedHouseId,
    houseDetail,
    familyTreeNpcs,
    familyTreeEdges,
    familyTreeCharacters,
    organizations,
    selectedOrg,
    selectedOrgMembers,
    factions,
    selectedFaction,
    selectedFactionMembers,
    // Computed
    isRootView,
    canGoBack,
    selectedRegion,
    // Actions
    openPanel,
    closePanel,
    navigateTo,
    goBack,
    switchRootTab,
    fetchRegions,
    fetchHouses,
    viewRegion,
    viewHouse,
    fetchOrganizations,
    viewOrganization,
    fetchFactions,
    viewFaction,
    submitSuggestion,
  }
})
