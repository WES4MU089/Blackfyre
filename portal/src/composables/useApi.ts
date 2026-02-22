import { API_URL } from '@/config'

export function useApi() {
  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('blackfyre_token')
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }

  async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_URL}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed: ${res.status}`)
    }

    // Handle 204 No Content
    if (res.status === 204) return undefined as T

    return res.json()
  }

  return { apiFetch, authHeaders }
}
