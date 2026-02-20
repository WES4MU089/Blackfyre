<script setup lang="ts">
import { useChatStore, TABS } from '@/stores/chat'
import type { ChatTab } from '@/utils/chatCommands'

const emit = defineEmits<{
  switchTab: [tab: ChatTab]
}>()

const chatStore = useChatStore()

function onTabClick(tab: ChatTab): void {
  emit('switchTab', tab)
}

function getUnread(tab: ChatTab): number {
  return chatStore.unreadByTab.get(tab) ?? 0
}
</script>

<template>
  <div class="chat-tabs">
    <div class="chat-tabs__list">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="chat-tab"
        :class="{
          'chat-tab--active': tab.key === chatStore.activeTab,
          'chat-tab--ic': tab.key === 'ic',
          'chat-tab--ooc': tab.key === 'ooc',
          'chat-tab--whispers': tab.key === 'whispers',
          'chat-tab--system': tab.key === 'system',
        }"
        @click="onTabClick(tab.key)"
      >
        <span class="chat-tab__label">{{ tab.label }}</span>
        <span v-if="getUnread(tab.key) > 0" class="chat-tab__badge">
          {{ getUnread(tab.key) }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-tabs {
  position: relative;
  flex-shrink: 0;
}

.chat-tabs__list {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.chat-tabs__list::-webkit-scrollbar {
  display: none;
}

/* Tab button */
.chat-tab {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: all var(--transition-fast);
}

.chat-tab:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.chat-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.chat-tab--ic.chat-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.chat-tab--ooc.chat-tab--active {
  color: var(--color-iron-light);
  border-bottom-color: var(--color-iron-light);
}

.chat-tab--whispers.chat-tab--active {
  color: #a78bfa;
  border-bottom-color: #a78bfa;
}

.chat-tab--system.chat-tab--active {
  color: var(--color-text-muted);
  border-bottom-color: var(--color-text-muted);
}

/* Unread badge */
.chat-tab__badge {
  font-size: 0.6rem;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  background: var(--color-crimson);
  color: var(--color-text-bright);
  border-radius: var(--radius-full);
  font-weight: 700;
}
</style>
