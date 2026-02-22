<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationStore, type PersistentNotification } from '@/stores/notifications'
import { useDraggable } from '@/composables/useDraggable'
import { useHudStore } from '@/stores/hud'

const notificationStore = useNotificationStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('notif-panel', panelRef, { alwaysDraggable: true })

function getTypeIcon(type: string): string {
  switch (type) {
    case 'success': case 'levelup': case 'achievement': return '✓'
    case 'warning': case 'ailment': return '!'
    case 'error': return '✕'
    case 'combat': return '⚔'
    case 'application': case 'staff': return '✉'
    case 'raven': return '❧'
    case 'money': case 'trade': return '⚜'
    default: return 'i'
  }
}

function getAccentClass(type: string): string {
  switch (type) {
    case 'success': case 'levelup': case 'achievement': return 'accent-success'
    case 'warning': case 'ailment': return 'accent-warning'
    case 'error': case 'combat': return 'accent-danger'
    default: return 'accent-info'
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function handleCardClick(notif: PersistentNotification): void {
  if (!notif.isRead) {
    notificationStore.markAsRead(notif.id)
  }
}
</script>

<template>
  <div class="notif-panel-wrapper">
    <div
      ref="panelRef"
      class="notif-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
      <!-- Header -->
      <div class="notif-header" @mousedown="onDragStart">
        <span class="notif-header-title">Notifications</span>
        <div class="notif-header-actions">
          <button
            v-if="notificationStore.unreadCount > 0"
            class="notif-mark-all"
            @click="notificationStore.markAllAsRead()"
          >Mark all read</button>
          <button class="notif-close" @click="notificationStore.closePanel()" title="Close">&times;</button>
        </div>
      </div>

      <!-- Body -->
      <div class="notif-body">
        <div v-if="notificationStore.isLoading" class="notif-empty">Loading...</div>
        <div v-else-if="notificationStore.notifications.length === 0" class="notif-empty">
          No notifications
        </div>
        <TransitionGroup v-else name="notif-card" tag="div" class="notif-list">
          <div
            v-for="notif in notificationStore.notifications"
            :key="notif.id"
            class="notif-card"
            :class="[getAccentClass(notif.type), { 'notif-unread': !notif.isRead }]"
            @click="handleCardClick(notif)"
          >
            <div v-if="!notif.isRead" class="notif-unread-dot" />

            <div class="notif-type-icon">{{ getTypeIcon(notif.type) }}</div>

            <div class="notif-card-content">
              <div class="notif-card-title">{{ notif.title }}</div>
              <div class="notif-card-message">{{ notif.message }}</div>
              <div class="notif-card-time">{{ timeAgo(notif.createdAt) }}</div>
            </div>

            <button
              class="notif-card-delete"
              @click.stop="notificationStore.deleteNotification(notif.id)"
              title="Dismiss"
            >&times;</button>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-panel-wrapper {
  position: fixed;
  right: 20px;
  bottom: 50px;
  pointer-events: none;
  z-index: 200;
}

.notif-panel {
  width: 340px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.notif-panel.is-dragging {
  z-index: 1000;
}

/* Header */
.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.notif-header:active {
  cursor: grabbing;
}

.notif-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.notif-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.notif-mark-all {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dim);
  transition: color var(--transition-fast);
  padding: 0;
}

.notif-mark-all:hover {
  color: var(--color-gold);
}

.notif-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.notif-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Body */
.notif-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs) 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.notif-empty {
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.notif-list {
  display: flex;
  flex-direction: column;
}

/* Card */
.notif-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  position: relative;
  border-left: 3px solid transparent;
}

.notif-card:hover {
  background: rgba(255, 255, 255, 0.03);
}

/* Accent borders */
.notif-card.accent-info {
  border-left-color: var(--color-gold-dim);
}

.notif-card.accent-success {
  border-left-color: var(--color-success);
}

.notif-card.accent-warning {
  border-left-color: var(--color-warning);
}

.notif-card.accent-danger {
  border-left-color: var(--color-crimson);
}

/* Unread glow */
.notif-card.notif-unread {
  background: rgba(201, 168, 76, 0.04);
}

.notif-card.notif-unread.accent-info {
  border-left-color: var(--color-gold);
}

/* Unread dot */
.notif-unread-dot {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: var(--color-gold);
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(201, 168, 76, 0.6);
  flex-shrink: 0;
}

.notif-type-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  margin-top: 1px;
}

.notif-card-content {
  flex: 1;
  min-width: 0;
}

.notif-card-title {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.3;
}

.notif-unread .notif-card-title {
  color: var(--color-gold);
}

.notif-card-message {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notif-card-time {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
  opacity: 0.7;
}

.notif-card-delete {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-muted);
  opacity: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}

.notif-card:hover .notif-card-delete {
  opacity: 1;
}

.notif-card-delete:hover {
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.15);
}

/* Transition */
.notif-card-enter-active {
  transition: all 0.3s ease;
}

.notif-card-leave-active {
  transition: all 0.2s ease;
}

.notif-card-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.notif-card-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
