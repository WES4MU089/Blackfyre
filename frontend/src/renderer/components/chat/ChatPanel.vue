<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChatStore, type PortraitSize } from '@/stores/chat'
import { getSocket } from '@/composables/useSocket'
import { useChat } from '@/composables/useChat'
import { useResizable } from '@/composables/useResizable'
import { parseCommand, type ChatTab } from '@/utils/chatCommands'
import ChatTabs from './ChatTabs.vue'
import ChatMessages from './ChatMessages.vue'
import ChatToggle from './ChatToggle.vue'
import ChatPlayerList from './ChatPlayerList.vue'

const props = defineProps<{
  onDragStart?: (e: MouseEvent) => void
}>()

const chatStore = useChatStore()
const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

const socket = getSocket()
const chat = socket ? useChat(socket) : null

// Initialize chat on mount
if (chat) {
  chat.init()
}

// --- Resize via composable (persists to config.json) ---
// Uses area ID 'chat' to share the same hudPositions entry as the DraggableArea parent
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'chat', panelRef,
  { minWidth: 280, maxWidth: 800, minHeight: 200, maxHeight: 900 }
)

const panelStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: chatStore.isMinimized ? 'auto' : currentHeight.value + 'px',
}))

const isSystemTab = computed(() => chatStore.activeTab === 'system')
const isWhispersTab = computed(() => chatStore.activeTab === 'whispers')

const inputPlaceholder = computed(() => {
  switch (chatStore.activeTab) {
    case 'ic': return 'Say something... (/shout, /low, /me, /w)'
    case 'whispers': return '/w <id> <message>'
    case 'ooc': return 'OOC chat... (/gooc for global)'
    case 'system': return ''
    default: return 'Write your tale...'
  }
})

// Load history when switching tabs
watch(() => chatStore.activeTab, (tab) => {
  if (tab && chat) {
    const existing = chatStore.messagesByTab.get(tab)
    if (!existing || existing.length === 0) {
      chat.loadHistory(tab)
    }
  }
}, { immediate: true })

function onSwitchTab(tab: ChatTab): void {
  chatStore.setActiveTab(tab)
}

function onLoadMore(before: string): void {
  if (chat) {
    chat.loadHistory(chatStore.activeTab, before)
  }
}

function sendMessage(): void {
  const content = inputText.value.trim()
  if (!content || !chat || isSystemTab.value) return

  const parsed = parseCommand(content, chatStore.activeTab)
  if (!parsed) return

  // Determine the correct tab to send on
  let sendTab: ChatTab = chatStore.activeTab
  if (parsed.type === 'whisper') sendTab = 'whispers'
  else if (parsed.type === 'gooc' || parsed.type === 'ooc') sendTab = 'ooc'
  else if (parsed.type === 'say' || parsed.type === 'shout' || parsed.type === 'low' || parsed.type === 'emote') sendTab = 'ic'

  chat.sendMessage(sendTab, parsed.content, parsed.type, parsed.targetSessionId)
  inputText.value = ''
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function setSize(size: PortraitSize): void {
  chatStore.setPortraitSize(size)
}

const sizeOptions: { key: PortraitSize; label: string }[] = [
  { key: 'sm', label: 'S' },
  { key: 'md', label: 'M' },
  { key: 'lg', label: 'L' },
]
</script>

<template>
  <!-- Closed state: just the toggle button -->
  <ChatToggle v-if="!chatStore.isOpen" />

  <!-- Open state: full chat panel -->
  <div v-else ref="panelRef" class="chat-panel panel-ornate" :style="panelStyle">
    <!-- Panel header (also serves as drag handle) -->
    <div class="chat-panel__header" @mousedown="onDragStart">
      <span class="chat-panel__title">Chat</span>

      <!-- Portrait size selector -->
      <div class="chat-panel__sizes">
        <button
          v-for="opt in sizeOptions"
          :key="opt.key"
          class="chat-size-btn"
          :class="{ 'chat-size-btn--active': chatStore.portraitSize === opt.key }"
          @click="setSize(opt.key)"
          :title="`${opt.label === 'S' ? 'Small' : opt.label === 'M' ? 'Medium' : 'Large'} portraits`"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Font size controls -->
      <div class="chat-panel__font-size">
        <button
          class="chat-font-btn"
          :disabled="chatStore.chatFontSize <= 10"
          @click="chatStore.decreaseFontSize()"
          title="Decrease font size"
        >A-</button>
        <span class="chat-font-value">{{ chatStore.chatFontSize }}</span>
        <button
          class="chat-font-btn"
          :disabled="chatStore.chatFontSize >= 22"
          @click="chatStore.increaseFontSize()"
          title="Increase font size"
        >A+</button>
      </div>

      <!-- Minimize / Close -->
      <div class="chat-panel__controls">
        <button class="chat-control-btn" @click="chatStore.toggleMinimize" title="Minimize">
          &mdash;
        </button>
        <button class="chat-control-btn" @click="chatStore.toggleOpen" title="Close">
          &times;
        </button>
      </div>
    </div>

    <!-- Minimized state -->
    <template v-if="!chatStore.isMinimized">
      <!-- Tabs -->
      <ChatTabs @switch-tab="onSwitchTab" />

      <!-- Player list (shown in Whispers tab) -->
      <ChatPlayerList v-if="isWhispersTab" />

      <!-- Messages -->
      <ChatMessages @load-more="onLoadMore" />

      <!-- Input area (hidden for System tab) -->
      <div v-if="!isSystemTab" class="chat-input">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input__textarea"
          :placeholder="inputPlaceholder"
          rows="3"
          @keydown="handleKeydown"
        />
        <button
          class="chat-input__send"
          :disabled="!inputText.trim()"
          @click="sendMessage"
          title="Send message"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <!-- Resize handle (bottom-right corner) -->
      <div class="chat-resize-handle" @mousedown="onResizeStart">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
          <circle cx="10" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="6" r="1.2" />
          <circle cx="10" cy="2" r="1.2" />
        </svg>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  min-height: 200px;
  background: var(--color-surface);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  overflow: hidden;
  position: relative;
}

/* Header */
.chat-panel__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  cursor: grab;
}

.chat-panel__header:active {
  cursor: grabbing;
}

.chat-panel__title {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.chat-panel__sizes {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.chat-size-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.chat-size-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border);
}

.chat-size-btn--active {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
  background: var(--color-gold-glow);
}

/* Font size controls */
.chat-panel__font-size {
  display: flex;
  align-items: center;
  gap: 2px;
}

.chat-font-btn {
  width: 26px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.chat-font-btn:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-border);
}

.chat-font-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

.chat-font-value {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  min-width: 16px;
  text-align: center;
}

.chat-panel__controls {
  display: flex;
  gap: 2px;
}

.chat-control-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.chat-control-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Input area */
.chat-input {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.chat-input__textarea {
  flex: 1;
  resize: none;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.chat-input__textarea:focus {
  outline: none;
  border-color: var(--color-gold-dim);
}

.chat-input__textarea::placeholder {
  color: var(--color-text-muted);
  font-style: italic;
}

.chat-input__send {
  align-self: flex-end;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gold-dim);
  border: 1px solid var(--color-gold-dark);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-bright);
  transition: all var(--transition-fast);
}

.chat-input__send:hover:not(:disabled) {
  background: var(--color-gold-dark);
}

.chat-input__send:disabled {
  opacity: 0.3;
  cursor: default;
}

.chat-input__send svg {
  width: 14px;
  height: 14px;
}

/* Resize handle */
.chat-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-gold-dark);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.chat-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
