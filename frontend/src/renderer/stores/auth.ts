import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BACKEND_URL } from '@/config'

const API_BASE = BACKEND_URL

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<{
    id: number
    discordId: string
    discordUsername: string
    slName?: string | null
    slAccountId?: number
    roleName?: string | null
    permissions?: string[]
    isSuperAdmin?: boolean
  } | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const backendOnline = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  const isSuperAdmin = computed(() => !!user.value?.isSuperAdmin)

  const permissions = computed(() => new Set(user.value?.permissions ?? []))

  function hasPermission(key: string): boolean {
    if (isSuperAdmin.value) return true
    return permissions.value.has(key)
  }

  const isStaff = computed(() =>
    isSuperAdmin.value || (user.value?.permissions?.length ?? 0) > 0
  )

  async function checkBackendHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      backendOnline.value = data.status === 'ok'
      return backendOnline.value
    } catch {
      backendOnline.value = false
      return false
    }
  }

  async function loadStoredToken(): Promise<boolean> {
    try {
      const storedToken = await window.electronAPI.getToken()
      if (!storedToken) return false

      token.value = storedToken
      // Validate token with backend
      const valid = await validateToken(storedToken)
      if (!valid) {
        token.value = null
        await window.electronAPI.clearToken()
        return false
      }
      return true
    } catch {
      return false
    }
  }

  async function validateToken(jwt: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` }
      })
      if (!res.ok) return false
      const data = await res.json()
      user.value = data.user
      return true
    } catch {
      return false
    }
  }

  function startDiscordLogin(): void {
    isLoading.value = true
    error.value = null
    window.electronAPI.openDiscordAuth(`${API_BASE}/api/auth/discord`)
  }

  async function handleAuthSuccess(jwt: string): Promise<boolean> {
    token.value = jwt
    await window.electronAPI.setToken(jwt)
    const valid = await validateToken(jwt)
    isLoading.value = false
    if (valid) {
      return true
    } else {
      error.value = 'Failed to validate authentication'
      token.value = null
      await window.electronAPI.clearToken()
      return false
    }
  }

  async function logout(): Promise<void> {
    token.value = null
    user.value = null
    await window.electronAPI.clearToken()
  }

  return {
    token,
    user,
    isLoading,
    error,
    backendOnline,
    isAuthenticated,
    isSuperAdmin,
    permissions,
    isStaff,
    hasPermission,
    checkBackendHealth,
    loadStoredToken,
    startDiscordLogin,
    handleAuthSuccess,
    logout
  }
})
