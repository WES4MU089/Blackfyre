<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  // Handle OAuth callback — token comes as query param
  const token = route.query.token as string | undefined
  if (token) {
    const success = await auth.handleOAuthCallback(token)
    if (success) {
      const dest = auth.redirectAfterLogin || '/'
      auth.redirectAfterLogin = null
      router.replace(dest)
      return
    }
  }
})
</script>

<template>
  <div class="home">
    <div class="hero">
      <h1 class="hero-title">Dragon's Dominion</h1>
      <p class="hero-subtitle">A Game of Thrones-inspired RPG for Second Life</p>
      <div class="hero-ornament" />
    </div>

    <div class="home-grid">
      <router-link to="/social/regions" class="home-card card card-clickable">
        <h3>Regions & Houses</h3>
        <p class="dim">Explore the great houses, their seats of power, and the noble families that shape the realm.</p>
      </router-link>

      <router-link to="/codex" class="home-card card card-clickable">
        <h3>Codex</h3>
        <p class="dim">Lore, faiths, orders, and the player guide — everything you need to know about the world.</p>
      </router-link>

      <router-link v-if="auth.isLoggedIn" to="/my/applications" class="home-card card card-clickable">
        <h3>My Applications</h3>
        <p class="dim">View and manage your character applications, track approval status.</p>
      </router-link>

      <div v-else class="home-card card">
        <h3>Join the Realm</h3>
        <p class="dim">Login with Discord to submit character applications and join the world.</p>
        <button class="btn-discord home-login-btn" @click="auth.loginWithDiscord()">
          <svg width="16" height="12" viewBox="0 0 71 55" fill="currentColor">
            <path d="M60.1 4.9A58.5 58.5 0 0045.3.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.3.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.3 4.9a.2.2 0 00-.1.1C1.5 17.6-.9 30 .3 42.2a.2.2 0 00.1.2 58.8 58.8 0 0017.7 9 .2.2 0 00.3-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4c.4-.3.7-.6 1.1-.9a.2.2 0 01.2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 01.2 0c.4.3.7.6 1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3c1.1 2.1 2.3 4.1 3.6 6a.2.2 0 00.3.1 58.6 58.6 0 0017.7-9 .2.2 0 00.1-.1c1.4-14.3-2.3-26.7-9.8-37.7a.2.2 0 00-.1-.1zM23.7 34.6c-3.3 0-6-3-6-6.6 0-3.7 2.7-6.6 6-6.6s6.1 3 6 6.6c0 3.7-2.7 6.6-6 6.6zm22.2 0c-3.3 0-6-3-6-6.6 0-3.7 2.7-6.6 6-6.6s6.1 3 6 6.6c0 3.7-2.6 6.6-6 6.6z"/>
          </svg>
          Login with Discord
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: var(--space-2xl) 0 var(--space-xl);
}

.hero-title {
  font-size: var(--font-size-3xl);
  text-shadow: 0 0 24px rgba(201, 168, 76, 0.3);
}

.hero-subtitle {
  margin-top: var(--space-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-dim);
}

.hero-ornament {
  width: 120px;
  height: 1px;
  margin: var(--space-lg) auto 0;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.home-card {
  text-decoration: none;
}

.home-card h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-sm);
}

.home-card p {
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.home-login-btn {
  margin-top: var(--space-md);
  font-size: 12px;
  padding: 6px 12px;
}

.btn-discord {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-discord);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-discord:hover {
  background: var(--color-discord-hover);
}
</style>
