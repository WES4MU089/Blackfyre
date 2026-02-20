<script setup lang="ts">
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
</script>

<template>
  <button class="chat-toggle" @click="chatStore.toggleOpen" title="Open chat">
    <!-- Quill / scroll icon -->
    <svg class="chat-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="13" y2="12" />
    </svg>

    <!-- Unread badge -->
    <span v-if="chatStore.totalUnread > 0" class="chat-toggle__badge">
      {{ chatStore.totalUnread > 99 ? '99+' : chatStore.totalUnread }}
    </span>
  </button>
</template>

<style scoped>
.chat-toggle {
  position: relative;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  backdrop-filter: var(--blur-sm);
  -webkit-backdrop-filter: var(--blur-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chat-toggle:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-gold-dim);
  box-shadow: var(--shadow-gold);
}

.chat-toggle__icon {
  width: 20px;
  height: 20px;
  color: var(--color-gold);
}

.chat-toggle__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  background: var(--color-crimson);
  color: var(--color-text-bright);
  font-family: var(--font-body);
  font-size: 0.6rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-surface-solid);
}
</style>
