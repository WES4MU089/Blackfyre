<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import ChatMessageBubble from './ChatMessageBubble.vue'

const emit = defineEmits<{
  loadMore: [before: string]
}>()

const chatStore = useChatStore()
const scrollContainer = ref<HTMLElement | null>(null)
const isLoadingMore = ref(false)

const emptyState = computed(() => {
  switch (chatStore.activeTab) {
    case 'ic': return { icon: '\u270E', text: 'No messages yet.', sub: 'Begin your tale...' }
    case 'whispers': return { icon: '\uD83D\uDCAC', text: 'No whispers.', sub: 'Use /w <id> <message> to whisper' }
    case 'ooc': return { icon: '\uD83D\uDDE8', text: 'No OOC messages.', sub: 'Speak freely...' }
    case 'system': return { icon: '\u2699', text: 'No system messages.', sub: 'Announcements appear here' }
    default: return { icon: '\u270E', text: 'No messages yet.', sub: '' }
  }
})

function scrollToBottom(): void {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
}

function handleScroll(): void {
  if (!scrollContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value

  // Auto-scroll: pause when user scrolls up, resume when near bottom
  const nearBottom = scrollHeight - scrollTop - clientHeight < 30
  chatStore.setAutoScroll(nearBottom)

  // Infinite scroll up: load more when at top
  if (scrollTop < 40 && !isLoadingMore.value) {
    const messages = chatStore.activeMessages
    const hasMore = chatStore.hasMoreByTab.get(chatStore.activeTab) ?? false

    if (hasMore && messages.length > 0) {
      isLoadingMore.value = true
      emit('loadMore', messages[0].created_at)

      // Reset loading after a reasonable time
      setTimeout(() => { isLoadingMore.value = false }, 2000)
    }
  }
}

// Watch for new messages and auto-scroll
watch(() => chatStore.activeMessages.length, async () => {
  if (chatStore.autoScroll) {
    await nextTick()
    scrollToBottom()
  }
})

// Watch for tab switches
watch(() => chatStore.activeTab, async () => {
  chatStore.setAutoScroll(true)
  isLoadingMore.value = false
  await nextTick()
  scrollToBottom()
})

onMounted(() => {
  nextTick(() => scrollToBottom())
})
</script>

<template>
  <div class="chat-messages" ref="scrollContainer" @scroll="handleScroll">
    <!-- Loading indicator for older messages -->
    <div v-if="isLoadingMore" class="chat-loading">
      <span class="chat-loading__text">Loading history...</span>
    </div>

    <!-- Empty state -->
    <div v-if="chatStore.activeMessages.length === 0" class="chat-empty">
      <div class="chat-empty__icon">{{ emptyState.icon }}</div>
      <p class="chat-empty__text">{{ emptyState.text }}</p>
      <p class="chat-empty__sub">{{ emptyState.sub }}</p>
    </div>

    <!-- Messages -->
    <TransitionGroup name="message-fade">
      <ChatMessageBubble
        v-for="msg in chatStore.activeMessages"
        :key="msg.id"
        :message="msg"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--color-gold-dim);
  border-radius: var(--radius-full);
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--color-gold-dark);
}

/* Loading */
.chat-loading {
  text-align: center;
  padding: var(--space-sm);
}

.chat-loading__text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

/* Empty state */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-xl);
  text-align: center;
}

.chat-empty__icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-sm);
  opacity: 0.3;
}

.chat-empty__text {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text-dim);
}

.chat-empty__sub {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

/* Message transition */
.message-fade-enter-active {
  transition: all var(--transition-normal);
}

.message-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
</style>
