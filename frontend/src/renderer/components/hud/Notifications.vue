<script setup lang="ts">
import { useHudStore, type Notification } from '@/stores/hud'

const hudStore = useHudStore()

function getTypeIcon(type: Notification['type']): string {
  switch (type) {
    case 'success': return '✓'
    case 'warning': return '!'
    case 'danger': return '✕'
    default: return 'i'
  }
}
</script>

<template>
  <TransitionGroup name="notif" tag="div" class="notif-stack">
    <div
      v-for="notif in hudStore.notifications"
      :key="notif.id"
      class="notif-card"
      :class="`notif-${notif.type}`"
      @click="hudStore.removeNotification(notif.id)"
    >
      <div class="notif-accent" />
      <div class="notif-icon">{{ getTypeIcon(notif.type) }}</div>
      <div class="notif-content">
        <div class="notif-title">{{ notif.title }}</div>
        <div class="notif-message">{{ notif.message }}</div>
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.notif-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  pointer-events: auto;
}

.notif-card {
  display: flex;
  align-items: stretch;
  background: var(--color-surface);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 260px;
  max-width: 350px;
}

.notif-card:hover {
  border-color: var(--color-border);
  transform: translateX(-4px);
}

.notif-accent {
  width: 3px;
  flex-shrink: 0;
}

.notif-info .notif-accent { background: var(--color-info); }
.notif-success .notif-accent { background: var(--color-success); }
.notif-warning .notif-accent { background: var(--color-warning); }
.notif-danger .notif-accent { background: var(--color-danger); }

.notif-icon {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: 700;
  flex-shrink: 0;
}

.notif-info .notif-icon { color: var(--color-info); }
.notif-success .notif-icon { color: var(--color-success); }
.notif-warning .notif-icon { color: var(--color-warning); }
.notif-danger .notif-icon { color: var(--color-danger); }

.notif-content {
  padding: var(--space-sm) var(--space-sm) var(--space-sm) 0;
  min-width: 0;
}

.notif-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 2px;
}

.notif-message {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Transition animations */
.notif-enter-active {
  animation: slideInRight var(--transition-normal) ease forwards;
}

.notif-leave-active {
  animation: slideOutRight var(--transition-normal) ease forwards;
}

.notif-move {
  transition: transform var(--transition-normal) ease;
}
</style>
