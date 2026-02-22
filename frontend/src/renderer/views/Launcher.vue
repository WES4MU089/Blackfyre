<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLauncherStore } from '@/stores/launcher'
import TosAcceptance from '@/components/launcher/TosAcceptance.vue'
import UpdateProgress from '@/components/launcher/UpdateProgress.vue'
import simLogo from '@res/images/art/logo.png'

const authStore = useAuthStore()
const launcherStore = useLauncherStore()

const initializing = ref(true)

const minimizeWindow = () => window.electronAPI.minimizeWindow()
const closeWindow = () => window.electronAPI.closeWindow()

const showTos = computed(() =>
  launcherStore.tosChecked && !launcherStore.tosAccepted
)

const canLaunch = computed(() =>
  launcherStore.tosAccepted &&
  (launcherStore.updateStatus === 'up-to-date' || launcherStore.updateStatus === 'error' || launcherStore.updateStatus === 'idle')
)

const isUpdating = computed(() =>
  launcherStore.updateStatus === 'checking' ||
  launcherStore.updateStatus === 'available' ||
  launcherStore.updateStatus === 'downloading'
)

const needsRestart = computed(() => launcherStore.updateStatus === 'downloaded')

function handleLaunch(): void {
  window.electronAPI.loginSuccess()
}

function handleTosAccepted(): void {
  // TOS accepted — update check should already be running
}

onMounted(async () => {
  // Load app version
  await launcherStore.loadAppVersion()

  // Setup updater event listeners
  launcherStore.setupUpdaterListeners()

  // Check TOS acceptance status
  if (authStore.token) {
    await launcherStore.checkTosStatus(authStore.token)
  }

  // Start update check
  launcherStore.checkForUpdates()

  initializing.value = false
})
</script>

<template>
  <div class="launcher-root">
    <!-- Background logo -->
    <img :src="simLogo" class="bg-logo" alt="" />

    <!-- Ember particles -->
    <div class="ember-container">
      <div v-for="i in 30" :key="'ember-' + i" class="ember" :style="{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 6}s`,
        animationDuration: `${5 + Math.random() * 6}s`,
        '--ember-size': `${2 + Math.random() * 3}px`,
        '--ember-drift': `${(Math.random() - 0.5) * 60}px`
      }" />
    </div>

    <!-- Window controls -->
    <div class="window-controls titlebar-drag">
      <div class="window-controls-buttons titlebar-no-drag">
        <button class="win-btn win-btn-minimize" @click="minimizeWindow">
          <svg width="10" height="1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button class="win-btn win-btn-close" @click="closeWindow">
          <svg width="10" height="10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="initializing" class="launcher-loading">
      <div class="loading-spinner" />
    </div>

    <!-- TOS Acceptance Modal -->
    <TosAcceptance v-else-if="showTos" @accepted="handleTosAccepted" />

    <!-- Launcher Content -->
    <div v-else class="launcher-content">
      <!-- Welcome -->
      <div class="launcher-header">
        <div class="launcher-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="flame-grad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stop-color="#8b1a1a" />
                <stop offset="100%" stop-color="#c9a84c" />
              </linearGradient>
            </defs>
            <path d="M20 4c0 0-8 8-8 16a8 8 0 0016 0c0-4-2-8-4-10 0 4-2 6-4 6s-4-4 0-12z"
                  fill="url(#flame-grad)" />
          </svg>
        </div>
        <h1 class="launcher-title">Dragon's Dominion</h1>
        <div class="launcher-welcome">
          Welcome, <span class="player-name">{{ authStore.user?.discordUsername || 'Adventurer' }}</span>
        </div>
      </div>

      <!-- Update Section -->
      <UpdateProgress />

      <!-- Version info -->
      <div class="version-info">
        <span class="version-label">Client Version</span>
        <span class="version-value">v{{ launcherStore.appVersion }}</span>
      </div>

      <!-- Launch Button Area -->
      <div class="launcher-actions">
        <button
          v-if="needsRestart"
          class="launch-btn restart"
          @click="launcherStore.installAndRestart()"
        >
          Restart &amp; Update
        </button>
        <button
          v-else
          class="launch-btn"
          :class="{ disabled: !canLaunch }"
          :disabled="!canLaunch"
          @click="handleLaunch"
        >
          <span v-if="isUpdating" class="launch-btn-text">Updating...</span>
          <span v-else class="launch-btn-text">Launch</span>
        </button>
      </div>

      <!-- Hotkey hints -->
      <div class="launcher-hints">
        Press F3 to show/hide HUD &middot; F4 to edit layout
      </div>
    </div>
  </div>
</template>

<style scoped>
.launcher-root {
  width: 100%;
  height: 100%;
  background: var(--color-surface-solid);
  background-image:
    radial-gradient(ellipse at 20% 80%, rgba(139, 26, 26, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(201, 168, 76, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(10, 10, 15, 1) 0%, rgba(15, 12, 20, 1) 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid var(--color-border-dim);
}

.bg-logo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 125%;
  height: 125%;
  object-fit: contain;
  opacity: 0.18;
  pointer-events: none;
  z-index: 0;
}

/* Window controls (same as Login) */
.window-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  z-index: 100;
}

.window-controls-buttons {
  display: flex;
  gap: 2px;
  padding-right: 8px;
}

.win-btn {
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.win-btn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.08);
}

.win-btn-close:hover {
  background: var(--color-crimson);
  color: white;
}

/* Ember particles */
.ember-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 180px;
  overflow: visible;
  pointer-events: none;
  z-index: 2;
}

.ember {
  position: absolute;
  bottom: 0;
  width: var(--ember-size, 3px);
  height: var(--ember-size, 3px);
  background: var(--color-gold);
  border-radius: 50%;
  box-shadow: 0 0 4px var(--color-gold), 0 0 8px rgba(201, 168, 76, 0.4);
  animation: emberRise linear infinite;
  opacity: 0;
}

@keyframes emberRise {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0;
  }
  5% { opacity: 1; }
  50% { opacity: 0.8; }
  100% {
    transform: translateY(-350px) translateX(var(--ember-drift, 20px)) scale(0.2);
    opacity: 0;
  }
}

/* Loading state */
.launcher-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border-dim);
  border-top-color: var(--color-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Launcher content */
.launcher-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px;
  max-width: 480px;
  width: 100%;
}

.launcher-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.launcher-icon {
  filter: drop-shadow(0 0 12px rgba(201, 168, 76, 0.4));
}

.launcher-title {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--color-gold);
  margin: 0;
  text-shadow: 0 0 20px rgba(201, 168, 76, 0.3);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.launcher-welcome {
  font-size: 13px;
  color: var(--color-text-muted);
}

.player-name {
  color: var(--color-gold);
  font-weight: 600;
}

/* Version info */
.version-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.version-label {
  font-size: 10px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.version-value {
  font-size: 12px;
  color: var(--color-text);
  font-weight: 600;
  font-family: var(--font-mono, monospace);
}

/* Launch button */
.launcher-actions {
  width: 100%;
  max-width: 320px;
}

.launch-btn {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, var(--color-gold), #b8952e);
  border: 2px solid rgba(201, 168, 76, 0.6);
  border-radius: var(--radius-md);
  color: #1a1a2e;
  font-size: 16px;
  font-weight: 800;
  font-family: var(--font-display);
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 2px;
  text-transform: uppercase;
  box-shadow: 0 4px 20px rgba(201, 168, 76, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.launch-btn:hover:not(:disabled) {
  filter: brightness(1.15);
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(201, 168, 76, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.launch-btn:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.95);
}

.launch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.launch-btn.restart {
  background: linear-gradient(135deg, #4a8c5c, #3a7a4a);
  border-color: rgba(74, 140, 92, 0.6);
  box-shadow: 0 4px 20px rgba(74, 140, 92, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  color: white;
}

.launch-btn.restart:hover {
  filter: brightness(1.15);
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(74, 140, 92, 0.35);
}

.launch-btn-text {
  display: block;
}

/* Hints */
.launcher-hints {
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.3px;
}
</style>
