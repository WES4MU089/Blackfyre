<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <nav class="navbar">
    <div class="nav-left">
      <router-link to="/" class="nav-brand">
        <span class="brand-text">Dragon's Dominion</span>
      </router-link>
      <div class="nav-links">
        <router-link to="/social/regions" class="nav-link">Regions</router-link>
        <router-link to="/codex" class="nav-link">Codex</router-link>
      </div>
    </div>

    <div class="nav-right">
      <template v-if="auth.isLoggedIn">
        <router-link to="/my/applications" class="nav-link">My Apps</router-link>
        <div class="nav-user">
          <span class="nav-username">{{ auth.user?.discordUsername }}</span>
          <span v-if="auth.user?.roleName" class="nav-role badge badge-gold">{{ auth.user.roleName }}</span>
          <button class="btn-secondary nav-logout" @click="auth.logout()">Logout</button>
        </div>
      </template>
      <template v-else>
        <button class="btn-discord" @click="auth.loginWithDiscord()">
          <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor">
            <path d="M60.1 4.9A58.5 58.5 0 0045.3.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.3.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.3 4.9a.2.2 0 00-.1.1C1.5 17.6-.9 30 .3 42.2a.2.2 0 00.1.2 58.8 58.8 0 0017.7 9 .2.2 0 00.3-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4c.4-.3.7-.6 1.1-.9a.2.2 0 01.2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 01.2 0c.4.3.7.6 1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3c1.1 2.1 2.3 4.1 3.6 6a.2.2 0 00.3.1 58.6 58.6 0 0017.7-9 .2.2 0 00.1-.1c1.4-14.3-2.3-26.7-9.8-37.7a.2.2 0 00-.1-.1zM23.7 34.6c-3.3 0-6-3-6-6.6 0-3.7 2.7-6.6 6-6.6s6.1 3 6 6.6c0 3.7-2.7 6.6-6 6.6zm22.2 0c-3.3 0-6-3-6-6.6 0-3.7 2.7-6.6 6-6.6s6.1 3 6 6.6c0 3.7-2.6 6.6-6 6.6z"/>
          </svg>
          Login with Discord
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 var(--space-lg);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-dim);
  flex-shrink: 0;
  z-index: 100;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.nav-brand {
  text-decoration: none;
}

.brand-text {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(201, 168, 76, 0.25);
}

.nav-links {
  display: flex;
  gap: var(--space-sm);
}

.nav-link {
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.nav-link:hover {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.06);
}
.nav-link.router-link-active {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.nav-user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.nav-username {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.nav-role {
  font-size: 9px;
}

.nav-logout {
  padding: 4px 10px;
  font-size: 11px;
}

.btn-discord {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-discord);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-weight: 700;
  font-size: var(--font-size-sm);
  letter-spacing: 0.04em;
  transition: background var(--transition-fast);
}
.btn-discord:hover {
  background: var(--color-discord-hover);
}
</style>
