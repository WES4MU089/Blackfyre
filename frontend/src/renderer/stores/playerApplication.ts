import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BACKEND_URL } from '@/config'
import { useAuthStore } from './auth'

export interface PlayerApplication {
  id: number
  character_id: number
  character_name: string
  house_name: string | null
  status: string
  requested_role: string
  is_bastard: boolean
  is_dragon_seed: boolean
  is_featured_role: boolean
  application_bio: string | null
  public_bio: string | null
  hoh_contact: string | null
  father_name: string | null
  mother_name: string | null
  backstory: string | null
  template_key: string | null
  submitted_at: string
  updated_at: string
}

export interface ApplicationComment {
  id: number
  author_id: number
  author_name: string
  body: string
  is_private: boolean
  edited_at: string | null
  created_at: string
}

export const usePlayerApplicationStore = defineStore('playerApplication', () => {
  const application = ref<PlayerApplication | null>(null)
  const comments = ref<ApplicationComment[]>([])
  const isOpen = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function authHeaders(): Record<string, string> {
    const auth = useAuthStore()
    return {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    }
  }

  async function fetchApplication(characterId: number): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      // Get player's applications list, find the one for this character
      const res = await fetch(`${BACKEND_URL}/api/applications`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch applications')
      const data = await res.json()
      const app = (data.applications as any[]).find(
        (a: any) => a.character_id === characterId
      )
      if (!app) {
        error.value = 'No application found for this character'
        application.value = null
        comments.value = []
        return
      }

      // Now fetch the detail with comments
      const detailRes = await fetch(`${BACKEND_URL}/api/applications/${app.id}`, {
        headers: authHeaders(),
      })
      if (!detailRes.ok) throw new Error('Failed to fetch application detail')
      const detail = await detailRes.json()
      application.value = detail.application
      comments.value = detail.comments ?? []
    } catch (err: any) {
      error.value = err.message ?? 'Failed to load application'
      application.value = null
      comments.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function postComment(body: string): Promise<boolean> {
    if (!application.value) return false
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/applications/${application.value.id}/comments`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ body }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        error.value = data.error ?? 'Failed to post comment'
        return false
      }
      const data = await res.json()
      if (data.comment) {
        comments.value.push(data.comment)
      }
      return true
    } catch (err: any) {
      error.value = err.message ?? 'Failed to post comment'
      return false
    }
  }

  function open(characterId: number): void {
    isOpen.value = true
    fetchApplication(characterId)
  }

  function close(): void {
    isOpen.value = false
    application.value = null
    comments.value = []
    error.value = null
  }

  return {
    application,
    comments,
    isOpen,
    isLoading,
    error,
    fetchApplication,
    postComment,
    open,
    close,
  }
})
