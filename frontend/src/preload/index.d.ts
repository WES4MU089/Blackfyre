export interface ElectronAPI {
  // Auth
  getToken: () => Promise<string | null>
  setToken: (token: string) => Promise<void>
  clearToken: () => Promise<void>
  openDiscordAuth: (url: string) => Promise<void>
  onAuthSuccess: (callback: (data: { token: string }) => void) => void
  loginSuccess: () => void

  // Window controls
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>

  // HUD — auto click-through
  setAutoClickThrough: (interactive: boolean, seq: number) => void

  // HUD Visibility
  onHudVisibilityChanged: (callback: (visible: boolean) => void) => void

  // HUD Layout
  saveHudLayout: (positions: Record<string, { x: number; y: number; width?: number; height?: number }>) => Promise<void>
  loadHudLayout: () => Promise<Record<string, { x: number; y: number; width?: number; height?: number }> | null>
  onLayoutEditModeChanged: (callback: (enabled: boolean) => void) => void

  // HUD Panel States
  savePanelStates: (states: { openPanels: string[]; chat: { open: boolean; minimized: boolean } }) => Promise<void>
  loadPanelStates: () => Promise<{ openPanels: string[]; chat: { open: boolean; minimized: boolean } } | null>

  // Last Character
  setLastCharacter: (characterId: number) => Promise<void>
  getLastCharacter: () => Promise<number | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
