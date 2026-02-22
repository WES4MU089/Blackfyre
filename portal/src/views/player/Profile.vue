<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/layout/PageHeader.vue'

const auth = useAuthStore()

const user = computed(() => auth.user)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
</script>

<template>
  <div class="profile">
    <PageHeader title="Profile" subtitle="Your account details" />

    <div v-if="user" class="profile-card card">
      <div class="profile-header">
        <div class="avatar">{{ user.discordUsername.charAt(0).toUpperCase() }}</div>
        <div>
          <h2>{{ user.discordUsername }}</h2>
          <div class="profile-badges">
            <span v-if="user.roleName" class="badge badge-gold">{{ user.roleName }}</span>
            <span v-if="user.isSuperAdmin" class="badge badge-crimson">Super Admin</span>
          </div>
        </div>
      </div>

      <div class="profile-fields">
        <div class="profile-field">
          <span class="muted label">Discord ID</span>
          <span class="mono">{{ user.discordId }}</span>
        </div>
        <div v-if="user.slName" class="profile-field">
          <span class="muted label">Second Life Name</span>
          <span>{{ user.slName }}</span>
        </div>
        <div v-if="user.createdAt" class="profile-field">
          <span class="muted label">Member Since</span>
          <span>{{ formatDate(user.createdAt) }}</span>
        </div>
      </div>

      <div class="profile-actions">
        <button class="btn-danger" @click="auth.logout()">Logout</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile {
  max-width: 600px;
  margin: 0 auto;
}

.profile-card {
  margin-top: var(--space-lg);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-ember));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-surface-solid);
  flex-shrink: 0;
}

.profile-header h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-xs);
}

.profile-badges {
  display: flex;
  gap: var(--space-xs);
}

.profile-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.profile-actions {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-dim);
}
</style>
