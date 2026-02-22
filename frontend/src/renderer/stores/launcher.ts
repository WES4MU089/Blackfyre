import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BACKEND_URL } from '@/config'

const API_BASE = BACKEND_URL

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface TosDocument {
  version: string
  content: string
  lastUpdated: string
}

export const useLauncherStore = defineStore('launcher', () => {
  // Update state
  const updateStatus = ref<UpdateStatus>('idle')
  const downloadProgress = ref<DownloadProgress>({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 })
  const latestVersion = ref('')
  const releaseNotes = ref('')
  const appVersion = ref('')
  const updateError = ref<string | null>(null)

  // TOS state
  const tosAccepted = ref(false)
  const tosChecked = ref(false)
  const tosDocument = ref<TosDocument | null>(null)
  const privacyDocument = ref<TosDocument | null>(null)

  async function loadAppVersion(): Promise<void> {
    appVersion.value = await window.electronAPI.getAppVersion()
  }

  // --- Updater ---

  function setupUpdaterListeners(): void {
    window.electronAPI.onUpdateAvailable((info) => {
      updateStatus.value = 'available'
      latestVersion.value = info.version
      releaseNotes.value = info.releaseNotes
      // Auto-start download
      downloadUpdate()
    })

    window.electronAPI.onUpdateUpToDate(() => {
      updateStatus.value = 'up-to-date'
    })

    window.electronAPI.onUpdateProgress((progress) => {
      updateStatus.value = 'downloading'
      downloadProgress.value = progress
    })

    window.electronAPI.onUpdateDownloaded(() => {
      updateStatus.value = 'downloaded'
    })

    window.electronAPI.onUpdateError((message) => {
      updateStatus.value = 'error'
      updateError.value = message
    })
  }

  async function checkForUpdates(): Promise<void> {
    updateStatus.value = 'checking'
    updateError.value = null
    const result = await window.electronAPI.checkForUpdates()
    if (!result.success && result.error) {
      // If it fails (e.g. no releases yet), treat as up-to-date
      updateStatus.value = 'up-to-date'
      updateError.value = null
    }
  }

  async function downloadUpdate(): Promise<void> {
    updateStatus.value = 'downloading'
    downloadProgress.value = { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 }
    await window.electronAPI.downloadUpdate()
  }

  async function installAndRestart(): Promise<void> {
    await window.electronAPI.installUpdate()
  }

  // --- TOS ---

  async function checkTosStatus(token: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/tos/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        tosAccepted.value = false
        tosChecked.value = true
        return
      }
      const data = await res.json()
      tosAccepted.value = data.tosAccepted
      tosChecked.value = true
    } catch {
      tosAccepted.value = false
      tosChecked.value = true
    }
  }

  async function fetchTosDocuments(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/tos/documents`)
      if (!res.ok) return
      const data = await res.json()
      tosDocument.value = data.tos
      privacyDocument.value = data.privacy
    } catch {
      // Silently fail — component will show fallback
    }
  }

  async function acceptTos(token: string): Promise<boolean> {
    if (!tosDocument.value || !privacyDocument.value) return false
    try {
      const res = await fetch(`${API_BASE}/api/tos/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tosVersion: tosDocument.value.version,
          privacyVersion: privacyDocument.value.version,
        }),
      })
      if (!res.ok) return false
      tosAccepted.value = true
      return true
    } catch {
      return false
    }
  }

  return {
    // Update
    updateStatus,
    downloadProgress,
    latestVersion,
    releaseNotes,
    appVersion,
    updateError,
    // TOS
    tosAccepted,
    tosChecked,
    tosDocument,
    privacyDocument,
    // Actions
    loadAppVersion,
    setupUpdaterListeners,
    checkForUpdates,
    downloadUpdate,
    installAndRestart,
    checkTosStatus,
    fetchTosDocuments,
    acceptTos,
  }
})
