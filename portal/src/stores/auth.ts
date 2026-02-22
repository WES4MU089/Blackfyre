import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { API_URL } from '@/config'

interface UserInfo {
  id: number
  discordId: string
  discordUsername: string
  slName: string | null
  createdAt: string | null
  roleName: string | null
  permissions: string[]
  isSuperAdmin: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserInfo | null>(null)
  const redirectAfterLogin = ref<string | null>(null)

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isSuperAdmin = computed(() => user.value?.isSuperAdmin === true)
  const isStaff = computed(() => {
    if (!user.value) return false
    return user.value.isSuperAdmin || (user.value.permissions.length > 0)
  })

  function hasPermission(perm: string): boolean {
    if (!user.value) return false
    if (user.value.isSuperAdmin) return true
    return user.value.permissions.includes(perm)
  }

  function loadFromStorage(): void {
    const stored = localStorage.getItem('blackfyre_token')
    const storedUser = localStorage.getItem('blackfyre_user')
    if (stored && storedUser) {
      token.value = stored
      try {
        user.value = JSON.parse(storedUser)
      } catch {
        logout()
      }
    }
  }

  function setAuth(newToken: string, userInfo: UserInfo): void {
    token.value = newToken
    user.value = userInfo
    localStorage.setItem('blackfyre_token', newToken)
    localStorage.setItem('blackfyre_user', JSON.stringify(userInfo))
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem('blackfyre_token')
    localStorage.removeItem('blackfyre_user')
  }

  async function loginWithDiscord(): Promise<void> {
    // Redirect to Discord OAuth — backend handles the flow
    // The callback URL will include the token as a query parameter
    window.location.href = `${API_URL}/api/auth/discord?redirect=portal`
  }

  async function handleOAuthCallback(callbackToken: string): Promise<boolean> {
    try {
      // Verify the token and get user info by calling /api/auth/me
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${callbackToken}` },
      })
      if (!res.ok) return false

      const data = await res.json()
      const u = data.user
      setAuth(callbackToken, {
        id: u.id,
        discordId: u.discord_id,
        discordUsername: u.discord_username,
        slName: u.sl_name || null,
        createdAt: u.created_at || null,
        roleName: u.roleName || null,
        permissions: u.permissions || [],
        isSuperAdmin: u.isSuperAdmin || false,
      })
      return true
    } catch {
      return false
    }
  }

  return {
    token,
    user,
    redirectAfterLogin,
    isLoggedIn,
    isSuperAdmin,
    isStaff,
    hasPermission,
    loadFromStorage,
    setAuth,
    logout,
    loginWithDiscord,
    handleOAuthCallback,
  }
})
