<script setup lang="ts">
import { useNotificationStore } from '@/stores/notifications'

const notificationStore = useNotificationStore()
</script>

<template>
  <button class="notif-bell" @click="notificationStore.togglePanel()" title="Notifications">
    <svg class="notif-bell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    <span v-if="notificationStore.unreadCount > 0" class="notif-bell__badge">
      {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
    </span>
  </button>
</template>

<style scoped>
.notif-bell {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-radius: var(--radius-sm);
  padding: 0;
}

.notif-bell:hover {
  background: rgba(201, 168, 76, 0.1);
}

.notif-bell__icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-dim);
  transition: color var(--transition-fast);
}

.notif-bell:hover .notif-bell__icon {
  color: var(--color-gold);
}

.notif-bell__badge {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  background: var(--color-crimson);
  color: var(--color-text-bright);
  font-family: var(--font-body);
  font-size: 0.55rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  border: 1px solid #0a0a0f;
  line-height: 1;
}
</style>
