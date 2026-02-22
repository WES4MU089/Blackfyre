import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BACKEND_URL } from '@/config'
import { useAuthStore } from './auth'
import { useHudStore } from './hud'

export interface PersistentNotification {
  id: number
  playerId: number
  characterId: number | null
  type: string
  title: string
  message: string
  icon: string | null
  actionUrl: string | null
  metadata: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
  expiresAt: string | null
}

type ToastType = 'info' | 'success' | 'warning' | 'danger'

function toToastType(type: string): ToastType {
  switch (type) {
    case 'success': case 'achievement': case 'levelup': return 'success'
    case 'warning': case 'ailment': return 'warning'
    case 'error': case 'combat': return 'danger'
    default: return 'info'
  }
}

function transformRow(r: any): PersistentNotification {
  return {
    id: r.id,
    playerId: r.player_id ?? r.playerId,
    characterId: r.character_id ?? r.characterId ?? null,
    type: r.notification_type ?? r.type,
    title: r.title,
    message: r.message,
    icon: r.icon ?? null,
    actionUrl: r.action_url ?? r.actionUrl ?? null,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata ?? null),
    isRead: !!(r.is_read ?? r.isRead),
    createdAt: r.created_at ?? r.createdAt,
    expiresAt: r.expires_at ?? r.expiresAt ?? null,
  }
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<PersistentNotification[]>([])
  const unreadCount = ref(0)
  const isOpen = ref(false)
  const isLoading = ref(false)

  function authHeaders(): Record<string, string> {
    const auth = useAuthStore()
    return { Authorization: `Bearer ${auth.token}` }
  }

  async function fetchNotifications(): Promise<void> {
    isLoading.value = true
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications?limit=50`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        notifications.value = (data.notifications ?? []).map(transformRow)
        unreadCount.value = data.unreadCount ?? 0
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      isLoading.value = false
    }
  }

  function onNewNotification(data: { notification: any; showToast: boolean }): void {
    const notif = transformRow(data.notification)
    notifications.value.unshift(notif)
    unreadCount.value++

    if (data.showToast) {
      const hudStore = useHudStore()
      hudStore.addNotification(toToastType(notif.type), notif.title, notif.message)
    }
  }

  function setUnreadCount(count: number): void {
    unreadCount.value = count
  }

  async function markAsRead(notificationId: number): Promise<void> {
    const notif = notifications.value.find(n => n.id === notificationId)
    if (!notif || notif.isRead) return

    notif.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
    } catch (err) {
      notif.isRead = false
      unreadCount.value++
      console.error('Failed to mark notification read:', err)
    }
  }

  async function markAllAsRead(): Promise<void> {
    const prev = notifications.value.map(n => ({ id: n.id, isRead: n.isRead }))
    const prevCount = unreadCount.value

    notifications.value.forEach(n => { n.isRead = true })
    unreadCount.value = 0

    try {
      await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: authHeaders(),
      })
    } catch (err) {
      prev.forEach(p => {
        const n = notifications.value.find(x => x.id === p.id)
        if (n) n.isRead = p.isRead
      })
      unreadCount.value = prevCount
      console.error('Failed to mark all read:', err)
    }
  }

  async function deleteNotification(notificationId: number): Promise<void> {
    const idx = notifications.value.findIndex(n => n.id === notificationId)
    if (idx === -1) return
    const removed = notifications.value.splice(idx, 1)[0]
    if (!removed.isRead) unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
    } catch (err) {
      notifications.value.splice(idx, 0, removed)
      if (!removed.isRead) unreadCount.value++
      console.error('Failed to delete notification:', err)
    }
  }

  function togglePanel(): void {
    isOpen.value = !isOpen.value
    if (isOpen.value && notifications.value.length === 0) {
      fetchNotifications()
    }
  }

  function closePanel(): void {
    isOpen.value = false
  }

  function clear(): void {
    notifications.value = []
    unreadCount.value = 0
    isOpen.value = false
  }

  return {
    notifications,
    unreadCount,
    isOpen,
    isLoading,
    fetchNotifications,
    onNewNotification,
    setUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    togglePanel,
    closePanel,
    clear,
  }
})
