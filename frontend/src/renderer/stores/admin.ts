import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'
import { useAuthStore } from './auth'

export interface ApplicationSummary {
  id: number
  character_id: number
  character_name: string
  player_id: number
  discord_username: string
  house_name: string | null
  tier: number
  status: string
  is_featured_role: boolean
  requested_role: string
  created_at: string
}

export interface ApplicationDetail extends ApplicationSummary {
  template_key: string
  father_name: string
  mother_name: string
  is_bastard: boolean
  is_dragon_seed: boolean
  hoh_contact: string | null
  application_bio: string
  public_bio: string | null
  backstory: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
}

export interface ApplicationComment {
  id: number
  application_id: number
  author_id: number
  author_name: string
  body: string
  is_private: boolean
  is_visible: boolean
  edited_at: string | null
  created_at: string
}

export const useAdminStore = defineStore('admin', () => {
  const applications = ref<ApplicationSummary[]>([])
  const selectedApplication = ref<ApplicationDetail | null>(null)
  const comments = ref<ApplicationComment[]>([])
  const statusFilter = ref<string>('pending')
  const isLoading = ref(false)
  const isOpen = ref(false)
  const activeView = ref<'queue' | 'detail'>('queue')

  const filteredApplications = computed(() => {
    if (!statusFilter.value || statusFilter.value === 'all') return applications.value
    return applications.value.filter(a => a.status === statusFilter.value)
  })

  function authHeaders(): Record<string, string> {
    const auth = useAuthStore()
    return { Authorization: `Bearer ${auth.token}` }
  }

  async function fetchApplicationQueue(): Promise<void> {
    isLoading.value = true
    try {
      const params = new URLSearchParams()
      if (statusFilter.value && statusFilter.value !== 'all') {
        params.set('status', statusFilter.value)
      }
      const res = await fetch(`${BACKEND_URL}/api/staff/applications?${params}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        applications.value = data.applications
      }
    } catch (err) {
      console.error('Failed to fetch application queue:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchApplicationDetail(id: number): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/applications/${id}`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        selectedApplication.value = data.application
        comments.value = data.comments ?? []
        activeView.value = 'detail'
      }
    } catch (err) {
      console.error('Failed to fetch application detail:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function updateApplicationStatus(
    id: number,
    status: 'approved' | 'denied' | 'revision',
    notes?: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/applications/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
      if (res.ok) {
        // Refresh detail and queue
        await fetchApplicationDetail(id)
        await fetchApplicationQueue()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update application status:', err)
      return false
    }
  }

  async function postComment(id: number, body: string, isPrivate: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff/applications/${id}/comments`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, isPrivate }),
      })
      if (res.ok) {
        // Refresh comments
        await fetchApplicationDetail(id)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to post comment:', err)
      return false
    }
  }

  function openPanel(): void {
    isOpen.value = true
    activeView.value = 'queue'
    fetchApplicationQueue()
  }

  function closePanel(): void {
    isOpen.value = false
    selectedApplication.value = null
    comments.value = []
  }

  function backToQueue(): void {
    activeView.value = 'queue'
    selectedApplication.value = null
    comments.value = []
  }

  async function editComment(appId: number, commentId: number, body: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/applications/${appId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }
      )
      if (res.ok) {
        const c = comments.value.find(c => c.id === commentId)
        if (c) {
          c.body = body
          c.edited_at = new Date().toISOString()
        }
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to edit comment:', err)
      return false
    }
  }

  async function toggleCommentVisibility(appId: number, commentId: number): Promise<boolean> {
    const c = comments.value.find(c => c.id === commentId)
    if (!c) return false
    const newVisible = !c.is_visible
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/applications/${appId}/comments/${commentId}/visibility`,
        {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ isVisible: newVisible }),
        }
      )
      if (res.ok) {
        c.is_visible = newVisible
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to toggle comment visibility:', err)
      return false
    }
  }

  async function deleteComment(appId: number, commentId: number): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/staff/applications/${appId}/comments/${commentId}`,
        { method: 'DELETE', headers: authHeaders() }
      )
      if (res.ok) {
        comments.value = comments.value.filter(c => c.id !== commentId)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to delete comment:', err)
      return false
    }
  }

  return {
    applications,
    selectedApplication,
    comments,
    statusFilter,
    isLoading,
    isOpen,
    activeView,
    filteredApplications,
    fetchApplicationQueue,
    fetchApplicationDetail,
    updateApplicationStatus,
    postComment,
    editComment,
    toggleCommentVisibility,
    deleteComment,
    openPanel,
    closePanel,
    backToQueue,
  }
})
