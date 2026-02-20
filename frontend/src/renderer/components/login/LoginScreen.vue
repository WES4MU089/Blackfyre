<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div class="login-card animate-fade-in-up">
    <!-- Decorative top border -->
    <div class="card-ornament top" />

    <div class="card-content">
      <!-- Logo / Title -->
      <div class="logo-section">
        <div class="logo-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <!-- Stylized dragon/flame icon -->
            <path d="M24 4L28 16L40 20L28 24L24 36L20 24L8 20L20 16Z" fill="url(#goldGrad)" />
            <path d="M24 10L26 18L34 20L26 22L24 30L22 22L14 20L22 18Z" fill="url(#darkGrad)" />
            <defs>
              <linearGradient id="goldGrad" x1="8" y1="4" x2="40" y2="36">
                <stop stop-color="#e0c878" />
                <stop offset="1" stop-color="#9a7b2e" />
              </linearGradient>
              <linearGradient id="darkGrad" x1="14" y1="10" x2="34" y2="30">
                <stop stop-color="#0a0a0f" />
                <stop offset="1" stop-color="#1a1520" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 class="title font-display">Dragon's Dominion</h1>
      </div>

      <!-- Divider -->
      <div class="divider">
        <span class="divider-ornament">&#9830;</span>
      </div>

      <!-- Status -->
      <div class="status-row">
        <span class="status-dot" :class="{ online: authStore.backendOnline, offline: !authStore.backendOnline }" />
        <span class="status-text">
          {{ authStore.backendOnline ? 'Server Online' : 'Server Offline' }}
        </span>
      </div>

      <!-- Login Button -->
      <button
        class="btn btn-discord login-btn"
        :disabled="!authStore.backendOnline || authStore.isLoading"
        @click="authStore.startDiscordLogin()"
      >
        <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor">
          <path d="M60.1 4.9A58.5 58.5 0 0045.7.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.7.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.4 4.7.2.2 0 00-.1.1C1.6 18.4-.9 31.5.3 44.4v.1a59 59 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42.1 42.1 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1 58.8 58.8 0 0018-9.1v-.1c1.4-15-2.3-28-9.8-39.6a.2.2 0 00-.1-.1zM23.7 36.4c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.8 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.7-7 6.2-7 6.3 3.2 6.2 7-2.7 7-6.2 7z"/>
        </svg>
        <span v-if="authStore.isLoading">Waiting for Discord...</span>
        <span v-else>Login with Discord</span>
      </button>

      <!-- Error display -->
      <p v-if="authStore.error" class="error-text">{{ authStore.error }}</p>

      <!-- Footer hint -->
      <p class="hint-text">
        Press <kbd>F3</kbd> to show/hide HUD &middot; <kbd>F4</kbd> to edit layout
      </p>
    </div>

    <!-- Decorative bottom border -->
    <div class="card-ornament bottom" />
  </div>
</template>

<style scoped>
.login-card {
  position: relative;
  width: 380px;
  background: rgba(8, 6, 12, 0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  overflow: hidden;
}

.card-ornament {
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-gold-dark) 20%,
    var(--color-gold) 50%,
    var(--color-gold-dark) 80%,
    transparent 100%
  );
}

.card-content {
  padding: var(--space-2xl) var(--space-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

/* Logo */
.logo-section {
  text-align: center;
}

.logo-icon {
  margin-bottom: var(--space-md);
  animation: breathe 4s ease-in-out infinite;
}

.title {
  font-size: var(--font-size-3xl);
  color: var(--color-gold);
  letter-spacing: 0.15em;
  text-shadow: 0 0 20px rgba(201, 168, 76, 0.3);
  margin: 0;
  line-height: 1;
}

/* Divider */
.divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--color-border),
    transparent
  );
}

.divider-ornament {
  color: var(--color-gold-dim);
  font-size: var(--font-size-xs);
}

/* Status */
.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all var(--transition-normal);
}

.status-dot.online {
  background: var(--color-success);
  box-shadow: 0 0 8px rgba(45, 138, 78, 0.5);
}

.status-dot.offline {
  background: var(--color-crimson);
  box-shadow: 0 0 8px rgba(139, 26, 26, 0.5);
  animation: pulse 2s infinite;
}

.status-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Login button */
.login-btn {
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-md);
  gap: var(--space-md);
}

.login-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Error */
.error-text {
  color: var(--color-crimson-light);
  font-size: var(--font-size-sm);
  text-align: center;
}

/* Hint */
.hint-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
}

.hint-text kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}
</style>
