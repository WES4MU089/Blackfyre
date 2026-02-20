<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import LoginScreen from '@/components/login/LoginScreen.vue'
import simLogo from '@res/images/art/logo.png'

const authStore = useAuthStore()
const initializing = ref(true)

const minimizeWindow = () => window.electronAPI.minimizeWindow()
const closeWindow = () => window.electronAPI.closeWindow()

onMounted(async () => {
  // Check backend health
  await authStore.checkBackendHealth()

  // Try to load stored token for auto-login
  const hasToken = await authStore.loadStoredToken()
  if (hasToken) {
    window.electronAPI.loginSuccess()
    return
  }

  initializing.value = false

  // Listen for Discord OAuth callback
  window.electronAPI.onAuthSuccess(async (data) => {
    await authStore.handleAuthSuccess(data.token)
  })
})
</script>

<template>
  <div class="login-root">
    <!-- Sim logo background -->
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

    <!-- Window controls (frameless) -->
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

    <div v-if="initializing" class="login-loading">
      <div class="loading-spinner" />
    </div>

    <LoginScreen v-else />
  </div>
</template>

<style scoped>
.login-root {
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

/* Background logo — spans the full window */
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

/* Window controls */
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
  5% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-350px) translateX(var(--ember-drift, 20px)) scale(0.2);
    opacity: 0;
  }
}

/* Loading state */
.login-loading {
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
</style>
