import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { useChatStore } from './chat'

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'danger'
  title: string
  message: string
  duration: number
  createdAt: number
}

export interface HudPosition {
  x?: number
  y?: number
  width?: number
  height?: number
}

export const useHudStore = defineStore('hud', () => {
  const isConnected = ref(false)
  const latency = ref(0)
  const notifications = ref<Notification[]>([])
  const openSystemPanels = ref(new Set<string>())
  const layoutEditMode = ref(false)
  const hudPositions = ref<Record<string, HudPosition>>({})

  // SL account linking
  const slLinkingCode = ref<string | null>(null)
  const slLinkingExpiresAt = ref<string | null>(null)

  // Location data (from SL keepalive via WebSocket)
  const simName = ref('')
  const gridCoords = ref({ x: 0, y: 0 })
  const avatarPosition = ref({ x: 0, y: 0, z: 0 })
  const regionPlayerCount = ref(0)

  let notifCounter = 0

  function addNotification(
    type: Notification['type'],
    title: string,
    message: string,
    duration = 5000
  ): void {
    const id = `notif-${++notifCounter}`
    notifications.value.push({
      id,
      type,
      title,
      message,
      duration,
      createdAt: Date.now()
    })

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration)
    }
  }

  function removeNotification(id: string): void {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) {
      notifications.value.splice(idx, 1)
    }
  }

  function setConnected(connected: boolean): void {
    isConnected.value = connected
    if (!connected) {
      addNotification('warning', 'Disconnected', 'Lost connection to server', 0)
    }
  }

  function setLatency(ms: number): void {
    latency.value = ms
  }

  function toggleSystemPanel(id: string): void {
    const next = new Set(openSystemPanels.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    openSystemPanels.value = next
    savePanelStates()
  }

  function isPanelOpen(id: string): boolean {
    return openSystemPanels.value.has(id)
  }

  function setLayoutEditMode(enabled: boolean): void {
    layoutEditMode.value = enabled
    if (!enabled) {
      saveLayout()
    }
  }

  function setAreaPosition(areaId: string, x: number, y: number): void {
    const existing = hudPositions.value[areaId]
    hudPositions.value[areaId] = { ...existing, x, y }
  }

  function setAreaSize(areaId: string, width: number, height: number): void {
    const existing = hudPositions.value[areaId]
    hudPositions.value[areaId] = { ...existing, width, height }
  }

  function resetLayout(): void {
    hudPositions.value = {}
    saveLayout()
  }

  function loadLayout(positions: Record<string, HudPosition>): void {
    if (positions && typeof positions === 'object') {
      hudPositions.value = positions
    }
  }

  function saveLayout(): void {
    // toRaw() strips Vue reactive proxies for clean IPC serialization
    const raw = JSON.parse(JSON.stringify(toRaw(hudPositions.value)))
    window.electronAPI.saveHudLayout(raw)
  }

  function savePanelStates(): void {
    const chatStore = useChatStore()
    window.electronAPI.savePanelStates({
      openPanels: Array.from(openSystemPanels.value),
      chat: {
        open: chatStore.isOpen,
        minimized: chatStore.isMinimized
      }
    })
  }

  function loadPanelStates(states: { openPanels?: string[]; chat?: { open?: boolean; minimized?: boolean } }): void {
    if (states.openPanels && Array.isArray(states.openPanels)) {
      openSystemPanels.value = new Set(states.openPanels)
    }
  }

  function updateLocation(data: {
    simName: string
    gridX: number
    gridY: number
    posX: number
    posY: number
    posZ: number
  }): void {
    simName.value = data.simName
    gridCoords.value = { x: data.gridX, y: data.gridY }
    avatarPosition.value = { x: data.posX, y: data.posY, z: data.posZ }
  }

  function setRegionPlayerCount(count: number): void {
    regionPlayerCount.value = count
  }

  function setSLLinkingCode(code: string, expiresAt: string): void {
    slLinkingCode.value = code
    slLinkingExpiresAt.value = expiresAt
  }

  function clearSLLinking(): void {
    slLinkingCode.value = null
    slLinkingExpiresAt.value = null
  }

  return {
    isConnected,
    latency,
    notifications,
    openSystemPanels,
    addNotification,
    removeNotification,
    setConnected,
    setLatency,
    toggleSystemPanel,
    isPanelOpen,
    layoutEditMode,
    hudPositions,
    setLayoutEditMode,
    setAreaPosition,
    setAreaSize,
    resetLayout,
    loadLayout,
    saveLayout,
    savePanelStates,
    loadPanelStates,
    simName,
    gridCoords,
    avatarPosition,
    regionPlayerCount,
    updateLocation,
    setRegionPlayerCount,
    slLinkingCode,
    slLinkingExpiresAt,
    setSLLinkingCode,
    clearSLLinking
  }
})
