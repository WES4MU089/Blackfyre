import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  setToken: (token: string) => ipcRenderer.invoke('auth:set-token', token),
  clearToken: () => ipcRenderer.invoke('auth:clear-token'),
  openDiscordAuth: (url: string) => ipcRenderer.invoke('auth:open-discord', url),
  onAuthSuccess: (callback: (data: { token: string }) => void) => {
    ipcRenderer.on('auth:success', (_event, data) => callback(data))
  },
  loginSuccess: () => ipcRenderer.send('auth:login-success'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // HUD — auto click-through
  setAutoClickThrough: (interactive: boolean, seq: number) =>
    ipcRenderer.send('hud:set-auto-clickthrough', { interactive, seq }),

  // HUD Visibility
  onHudVisibilityChanged: (callback: (visible: boolean) => void) => {
    ipcRenderer.on('hud:visibility-changed', (_event, visible) => callback(visible))
  },

  // HUD Layout
  saveHudLayout: (positions: Record<string, { x: number; y: number; width?: number; height?: number }>) =>
    ipcRenderer.invoke('hud:save-layout', positions),
  loadHudLayout: (): Promise<Record<string, { x: number; y: number; width?: number; height?: number }> | null> =>
    ipcRenderer.invoke('hud:load-layout'),
  onLayoutEditModeChanged: (callback: (enabled: boolean) => void) => {
    ipcRenderer.on('hud:layout-edit-changed', (_event, enabled) => callback(enabled))
  },

  // HUD Panel States
  savePanelStates: (states: { openPanels: string[]; chat: { open: boolean; minimized: boolean } }) =>
    ipcRenderer.invoke('hud:save-panel-states', states),
  loadPanelStates: (): Promise<{ openPanels: string[]; chat: { open: boolean; minimized: boolean } } | null> =>
    ipcRenderer.invoke('hud:load-panel-states'),

  // Last Character
  setLastCharacter: (characterId: number) =>
    ipcRenderer.invoke('character:set-last', characterId),
  getLastCharacter: (): Promise<number | null> =>
    ipcRenderer.invoke('character:get-last'),

  // Auto-updater
  checkForUpdates: (): Promise<{ success: boolean; version?: string; error?: string }> =>
    ipcRenderer.invoke('updater:check'),
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => {
    ipcRenderer.on('updater:update-available', (_event, info) => callback(info))
  },
  onUpdateUpToDate: (callback: () => void) => {
    ipcRenderer.on('updater:up-to-date', () => callback())
  },
  onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on('updater:progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('updater:downloaded', () => callback())
  },
  onUpdateError: (callback: (message: string) => void) => {
    ipcRenderer.on('updater:error', (_event, message) => callback(message))
  },

  // App version
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version')
})
