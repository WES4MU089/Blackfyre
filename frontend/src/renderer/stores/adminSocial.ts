import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BACKEND_URL } from '@/config'
import { useAuthStore } from './auth'

// ===== Interfaces =====

export interface PendingEdge {
  id: number
  house_id: number
  relationship: string
  status: string
  from_character_id: number | null
  from_npc_id: number | null
  to_character_id: number | null
  to_npc_id: number | null
  created_at: string
  house_name: string
  submitted_by: string
  from_character_name: string | null
  from_npc_name: string | null
  to_character_name: string | null
  to_npc_name: string | null
}

export interface StaffOrganization {
  id: number
  name: string
  org_type: string
  description: string | null
  sigil_url: string | null
  region_id: number | null
  leader_character_id: number | null
  requires_approval: boolean
  is_active: boolean
  region_name: string | null
  leader_name: string | null
  member_count: number
}

export interface StaffOrgMember {
  id: number
  character_id: number
  rank: string | null
  joined_at: string
  character_name: string
  portrait_url: string | null
  title: string | null
  level: number
}

export interface StaffFaction {
  id: number
  name: string
  description: string | null
  banner_url: string | null
  leader_character_id: number | null
  leader_name: string | null
  is_active: boolean
  total_member_count: number
  secret_member_count: number
}

export interface StaffFactionMember {
  id: number
  character_id: number
  declared_publicly: boolean
  joined_at: string
  character_name: string
  portrait_url: string | null
  title: string | null
  house_name: string | null
}

export interface AuditLogEntry {
  id: number
  actor_id: number
  action_key: string
  description: string
  target_type: string | null
  target_id: number | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor_name: string
  actor_role: string | null
}

export const useAdminSocialStore = defineStore('adminSocial', () => {
  // ===== State =====

  // Family tree
  const pendingEdges = ref<PendingEdge[]>([])

  // Organizations (staff)
  const staffOrganizations = ref<StaffOrganization[]>([])
  const selectedStaffOrg = ref<StaffOrganization | null>(null)
  const staffOrgMembers = ref<StaffOrgMember[]>([])
  const orgActiveView = ref<'list' | 'detail' | 'create'>('list')

  // Factions (staff)
  const staffFactions = ref<StaffFaction[]>([])
  const selectedStaffFaction = ref<StaffFaction | null>(null)
  const staffFactionMembers = ref<StaffFactionMember[]>([])
  const factionActiveView = ref<'list' | 'detail' | 'create'>('list')

  // Audit log
  const auditEntries = ref<AuditLogEntry[]>([])
  const auditTotal = ref(0)
  const auditFilters = ref({
    actionKey: '',
    targetType: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  })

  const isLoading = ref(false)

  // ===== Helpers =====
  function authHeaders(): Record<string, string> {
    const auth = useAuthStore()
    return { Authorization: `Bearer ${auth.token}` }
  }

  // ===== Family Tree =====
  async function fetchPendingEdges(): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/family-tree/pending`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        pendingEdges.value = data.edges
      }
    } catch (err) {
      console.error('Failed to fetch pending edges:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function approveEdge(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/family-tree/edges/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (res.ok) {
        pendingEdges.value = pendingEdges.value.filter(e => e.id !== id)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to approve edge:', err)
      return false
    }
  }

  async function denyEdge(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/family-tree/edges/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied' }),
      })
      if (res.ok) {
        pendingEdges.value = pendingEdges.value.filter(e => e.id !== id)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to deny edge:', err)
      return false
    }
  }

  // ===== Organizations (Staff) =====
  async function fetchStaffOrgs(): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        staffOrganizations.value = data.organizations
      }
    } catch (err) {
      console.error('Failed to fetch staff organizations:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStaffOrgDetail(id: number): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations/${id}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        selectedStaffOrg.value = data.organization
        staffOrgMembers.value = data.members ?? []
        orgActiveView.value = 'detail'
      }
    } catch (err) {
      console.error('Failed to fetch staff org detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createOrg(data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchStaffOrgs()
        orgActiveView.value = 'list'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to create organization:', err)
      return false
    }
  }

  async function updateOrg(id: number, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchStaffOrgs()
        if (selectedStaffOrg.value?.id === id) {
          await fetchStaffOrgDetail(id)
        }
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update organization:', err)
      return false
    }
  }

  async function deactivateOrg(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        await fetchStaffOrgs()
        orgActiveView.value = 'list'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to deactivate organization:', err)
      return false
    }
  }

  async function addOrgMember(orgId: number, characterId: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      })
      if (res.ok) {
        await fetchStaffOrgDetail(orgId)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to add org member:', err)
      return false
    }
  }

  async function removeOrgMember(orgId: number, characterId: number): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/organizations/${orgId}/members/${characterId}`,
        { method: 'DELETE', headers: authHeaders() },
      )
      if (res.ok) {
        staffOrgMembers.value = staffOrgMembers.value.filter(m => m.character_id !== characterId)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to remove org member:', err)
      return false
    }
  }

  // ===== Factions (Staff) =====
  async function fetchStaffFactions(): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/factions`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        staffFactions.value = data.factions
      }
    } catch (err) {
      console.error('Failed to fetch staff factions:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStaffFactionDetail(id: number): Promise<void> {
    isLoading.value = true
    try {
      // Use the public detail endpoint which returns members — staff sees all via staff list
      const res = await fetch(`${BACKEND_URL}/api/factions/${id}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        selectedStaffFaction.value = data.faction
        staffFactionMembers.value = data.members ?? []
        factionActiveView.value = 'detail'
      }
    } catch (err) {
      console.error('Failed to fetch staff faction detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createFaction(data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/factions`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchStaffFactions()
        factionActiveView.value = 'list'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to create faction:', err)
      return false
    }
  }

  async function updateFaction(id: number, data: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/factions/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchStaffFactions()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update faction:', err)
      return false
    }
  }

  async function deactivateFaction(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/factions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        await fetchStaffFactions()
        factionActiveView.value = 'list'
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to deactivate faction:', err)
      return false
    }
  }

  async function addFactionMember(
    factionId: number,
    characterId: number,
    declaredPublicly: boolean,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/factions/${factionId}/members`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, declaredPublicly }),
      })
      if (res.ok) {
        await fetchStaffFactionDetail(factionId)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to add faction member:', err)
      return false
    }
  }

  async function toggleMemberVisibility(
    factionId: number,
    characterId: number,
    declaredPublicly: boolean,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/factions/${factionId}/members/${characterId}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ declaredPublicly }),
        },
      )
      if (res.ok) {
        const member = staffFactionMembers.value.find(m => m.character_id === characterId)
        if (member) member.declared_publicly = declaredPublicly
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to toggle member visibility:', err)
      return false
    }
  }

  async function removeFactionMember(factionId: number, characterId: number): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/factions/${factionId}/members/${characterId}`,
        { method: 'DELETE', headers: authHeaders() },
      )
      if (res.ok) {
        staffFactionMembers.value = staffFactionMembers.value.filter(
          m => m.character_id !== characterId,
        )
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to remove faction member:', err)
      return false
    }
  }

  // ===== Audit Log =====
  async function fetchAuditLog(): Promise<void> {
    isLoading.value = true
    try {
      const params = new URLSearchParams()
      const f = auditFilters.value
      if (f.actionKey) params.set('actionKey', f.actionKey)
      if (f.targetType) params.set('targetType', f.targetType)
      if (f.startDate) params.set('startDate', f.startDate)
      if (f.endDate) params.set('endDate', f.endDate)
      params.set('limit', String(f.limit))
      params.set('offset', String(f.offset))

      const res = await fetch(`${BACKEND_URL}/api/staff/audit-log?${params}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        auditEntries.value = data.entries
        auditTotal.value = data.total
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err)
    } finally {
      isLoading.value = false
    }
  }

  function setAuditFilter(key: string, value: string): void {
    ;(auditFilters.value as Record<string, unknown>)[key] = value
    auditFilters.value.offset = 0
    fetchAuditLog()
  }

  function nextAuditPage(): void {
    const f = auditFilters.value
    if (f.offset + f.limit < auditTotal.value) {
      f.offset += f.limit
      fetchAuditLog()
    }
  }

  function prevAuditPage(): void {
    const f = auditFilters.value
    if (f.offset > 0) {
      f.offset = Math.max(0, f.offset - f.limit)
      fetchAuditLog()
    }
  }

  // ===== Reset helpers =====
  function resetOrgView(): void {
    orgActiveView.value = 'list'
    selectedStaffOrg.value = null
    staffOrgMembers.value = []
  }

  function resetFactionView(): void {
    factionActiveView.value = 'list'
    selectedStaffFaction.value = null
    staffFactionMembers.value = []
  }

  return {
    // State
    pendingEdges,
    staffOrganizations,
    selectedStaffOrg,
    staffOrgMembers,
    orgActiveView,
    staffFactions,
    selectedStaffFaction,
    staffFactionMembers,
    factionActiveView,
    auditEntries,
    auditTotal,
    auditFilters,
    isLoading,
    // Family tree
    fetchPendingEdges,
    approveEdge,
    denyEdge,
    // Organizations
    fetchStaffOrgs,
    fetchStaffOrgDetail,
    createOrg,
    updateOrg,
    deactivateOrg,
    addOrgMember,
    removeOrgMember,
    resetOrgView,
    // Factions
    fetchStaffFactions,
    fetchStaffFactionDetail,
    createFaction,
    updateFaction,
    deactivateFaction,
    addFactionMember,
    toggleMemberVisibility,
    removeFactionMember,
    resetFactionView,
    // Audit log
    fetchAuditLog,
    setAuditFilter,
    nextAuditPage,
    prevAuditPage,
  }
})
