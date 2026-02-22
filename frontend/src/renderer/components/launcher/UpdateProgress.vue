<script setup lang="ts">
import { computed } from 'vue'
import { useLauncherStore } from '@/stores/launcher'

const launcherStore = useLauncherStore()

const statusText = computed(() => {
  switch (launcherStore.updateStatus) {
    case 'checking':
      return 'Checking for updates...'
    case 'available':
      return `Update v${launcherStore.latestVersion} available`
    case 'downloading': {
      const pct = Math.round(launcherStore.downloadProgress.percent)
      const speed = formatBytes(launcherStore.downloadProgress.bytesPerSecond)
      return `Downloading update... ${pct}% (${speed}/s)`
    }
    case 'downloaded':
      return 'Update ready — restart to apply'
    case 'error':
      return launcherStore.updateError || 'Update check failed'
    case 'up-to-date':
      return 'Client is up to date'
    default:
      return ''
  }
})

const showProgress = computed(() =>
  launcherStore.updateStatus === 'downloading' || launcherStore.updateStatus === 'available'
)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="update-section" v-if="launcherStore.updateStatus !== 'idle' && launcherStore.updateStatus !== 'up-to-date'">
    <div class="update-status">
      <div class="update-icon" :class="launcherStore.updateStatus">
        <svg v-if="launcherStore.updateStatus === 'checking' || launcherStore.updateStatus === 'downloading'" width="14" height="14" viewBox="0 0 14 14" class="spin">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="20 14" />
        </svg>
        <svg v-else-if="launcherStore.updateStatus === 'downloaded'" width="14" height="14" viewBox="0 0 14 14">
          <path d="M3 7l3 3 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="launcherStore.updateStatus === 'error'" width="14" height="14" viewBox="0 0 14 14">
          <path d="M7 4v3M7 9v1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>
      <span class="update-text">{{ statusText }}</span>
    </div>

    <div v-if="showProgress" class="progress-bar-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${launcherStore.downloadProgress.percent}%` }" />
      </div>
    </div>

    <button
      v-if="launcherStore.updateStatus === 'downloaded'"
      class="update-restart-btn"
      @click="launcherStore.installAndRestart()"
    >
      Restart &amp; Update
    </button>
  </div>
</template>

<style scoped>
.update-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
}

.update-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-icon {
  color: var(--color-text-dim);
  display: flex;
}

.update-icon.checking,
.update-icon.downloading {
  color: var(--color-gold);
}

.update-icon.downloaded {
  color: var(--color-success);
}

.update-icon.error {
  color: var(--color-crimson);
}

.update-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.progress-bar-container {
  width: 100%;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-gold), #d4b04a);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.update-restart-btn {
  align-self: flex-end;
  padding: 6px 16px;
  background: linear-gradient(135deg, var(--color-gold), #b8952e);
  border: none;
  border-radius: var(--radius-sm);
  color: #1a1a2e;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-display);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.update-restart-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
