<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface ChatMessage {
  id: number
  channel_key: string
  character_name: string | null
  portrait_url: string | null
  content: string
  message_type: string
  region: string
  created_at: string
}

interface Whisper {
  id: number
  sender_name: string
  sender_portrait_url: string | null
  target_name: string
  target_portrait_url: string | null
  content: string
  region: string
  created_at: string
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const activeTab = ref<'messages' | 'whispers'>('messages')
const messages = ref<ChatMessage[]>([])
const whispers = ref<Whisper[]>([])
const messagesTotal = ref(0)
const whispersTotal = ref(0)
const loading = ref(true)
const error = ref('')

const filterChannel = ref((route.query.channelKey as string) || '')
const filterRegion = ref((route.query.region as string) || '')
const filterMessageType = ref('')
const filterSearch = ref('')
const filterCharacterName = ref('')
const offset = ref(0)
const limit = 200

const date = computed(() => route.params.date as string)

const dayLabel = computed(() => {
  const d = new Date(date.value + 'T00:00:00Z')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `CHAT_${months[d.getUTCMonth()]}_${d.getUTCDate()}_${d.getUTCFullYear()}`
})

const formattedDate = computed(() => {
  const d = new Date(date.value + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
})

onMounted(() => {
  loadMessages()
  loadWhispers()
})

async function loadMessages() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      date: date.value,
      limit: String(limit),
      offset: String(offset.value),
    })
    if (filterChannel.value) params.set('channelKey', filterChannel.value)
    if (filterRegion.value) params.set('region', filterRegion.value)
    if (filterMessageType.value) params.set('messageType', filterMessageType.value)
    if (filterSearch.value) params.set('search', filterSearch.value)

    const data = await apiFetch<{ entries: ChatMessage[]; total: number }>(
      `/api/staff/chat-log/messages?${params}`
    )
    messages.value = data.entries
    messagesTotal.value = data.total
  } catch (e: any) {
    error.value = e.message || 'Failed to load messages'
  } finally {
    loading.value = false
  }
}

async function loadWhispers() {
  try {
    const params = new URLSearchParams({
      date: date.value,
      limit: String(limit),
      offset: '0',
    })
    if (filterCharacterName.value) params.set('characterName', filterCharacterName.value)

    const data = await apiFetch<{ entries: Whisper[]; total: number }>(
      `/api/staff/chat-log/whispers?${params}`
    )
    whispers.value = data.entries
    whispersTotal.value = data.total
  } catch {
    // Whisper errors are non-critical
  }
}

function applyFilter() {
  offset.value = 0
  if (activeTab.value === 'messages') {
    loadMessages()
  } else {
    loadWhispers()
  }
}

function nextPage() {
  const currentTotal = activeTab.value === 'messages' ? messagesTotal.value : whispersTotal.value
  if (offset.value + limit < currentTotal) {
    offset.value += limit
    if (activeTab.value === 'messages') loadMessages()
    else loadWhispers()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit)
    if (activeTab.value === 'messages') loadMessages()
    else loadWhispers()
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

const typeColors: Record<string, string> = {
  say: 'type-say',
  shout: 'type-shout',
  low: 'type-low',
  emote: 'type-emote',
  ooc: 'type-ooc',
  gooc: 'type-gooc',
  system: 'type-system',
}

const channelColors: Record<string, string> = {
  ic: 'badge-gold',
  ooc: 'badge-info',
  whispers: 'badge-gold',
  system: 'badge-gold',
}
</script>

<template>
  <div class="chat-day">
    <button class="btn-secondary back-btn" @click="router.push({ name: 'chat-log' })">
      &larr; Back to Chat Log
    </button>

    <PageHeader :title="dayLabel" :subtitle="formattedDate" />

    <!-- Filters -->
    <div class="filter-bar">
      <template v-if="activeTab === 'messages'">
        <select v-model="filterChannel" @change="applyFilter">
          <option value="">All channels</option>
          <option value="ic">IC</option>
          <option value="ooc">OOC</option>
          <option value="system">System</option>
        </select>
        <input v-model="filterRegion" placeholder="Region" @keyup.enter="applyFilter" />
        <select v-model="filterMessageType" @change="applyFilter">
          <option value="">All types</option>
          <option value="say">Say</option>
          <option value="shout">Shout</option>
          <option value="low">Low</option>
          <option value="emote">Emote</option>
          <option value="ooc">OOC</option>
          <option value="gooc">GOOC</option>
          <option value="system">System</option>
        </select>
        <input v-model="filterSearch" placeholder="Search content..." @keyup.enter="applyFilter" />
      </template>
      <template v-else>
        <input v-model="filterCharacterName" placeholder="Character name" @keyup.enter="applyFilter" />
      </template>
      <button class="btn-secondary" @click="applyFilter">Filter</button>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button :class="['tab', { active: activeTab === 'messages' }]" @click="activeTab = 'messages'; offset = 0">
        Messages ({{ messagesTotal }})
      </button>
      <button :class="['tab', { active: activeTab === 'whispers' }]" @click="activeTab = 'whispers'; offset = 0">
        Whispers ({{ whispersTotal }})
      </button>
    </div>

    <p v-if="error" class="crimson">{{ error }}</p>

    <!-- Messages -->
    <div v-if="activeTab === 'messages'" class="message-log">
      <div v-if="loading" class="dim" style="padding: var(--space-md)">Loading...</div>
      <div v-else-if="messages.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No messages for this date.</div>
      <div v-else v-for="m in messages" :key="m.id" class="msg-row" :class="typeColors[m.message_type]">
        <span class="msg-time">{{ formatTime(m.created_at) }}</span>
        <span class="badge" :class="channelColors[m.channel_key] || 'badge-gold'" style="font-size: 9px; padding: 0 4px">{{ m.channel_key.toUpperCase() }}</span>
        <span class="msg-type">[{{ m.message_type.toUpperCase() }}]</span>
        <span class="msg-author">{{ m.character_name || 'System' }}</span>
        <span class="msg-content">{{ m.content }}</span>
        <span class="msg-region muted">{{ m.region }}</span>
      </div>
    </div>

    <!-- Whispers -->
    <div v-if="activeTab === 'whispers'" class="message-log">
      <div v-if="whispers.length === 0" class="dim" style="padding: var(--space-md); text-align: center">No whispers for this date.</div>
      <div v-else v-for="w in whispers" :key="w.id" class="msg-row type-whisper">
        <span class="msg-time">{{ formatTime(w.created_at) }}</span>
        <span class="msg-type">[WHISPER]</span>
        <span class="msg-author">{{ w.sender_name }}</span>
        <span class="whisper-arrow">&rarr;</span>
        <span class="msg-author">{{ w.target_name }}</span>
        <span class="msg-content">{{ w.content }}</span>
        <span class="msg-region muted">{{ w.region }}</span>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination">
      <button class="btn-secondary" :disabled="offset === 0" @click="prevPage">Prev</button>
      <span class="muted">
        {{ offset + 1 }}&ndash;{{ Math.min(offset + limit, activeTab === 'messages' ? messagesTotal : whispersTotal) }}
        of {{ activeTab === 'messages' ? messagesTotal : whispersTotal }}
      </span>
      <button class="btn-secondary" :disabled="offset + limit >= (activeTab === 'messages' ? messagesTotal : whispersTotal)" @click="nextPage">Next</button>
    </div>
  </div>
</template>

<style scoped>
.chat-day {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-btn {
  margin-bottom: var(--space-md);
}

.filter-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.filter-bar input,
.filter-bar select {
  min-width: 120px;
}

.tab-bar {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border-dim);
}

.tab {
  padding: var(--space-xs) var(--space-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-dim);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text);
}

.tab.active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.message-log {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  max-height: 70vh;
  overflow-y: auto;
}

.msg-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  padding: 2px var(--space-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  line-height: 1.6;
}

.msg-row:hover {
  background: var(--color-surface-hover);
}

.msg-time {
  color: var(--color-text-dim);
  font-size: 10px;
  min-width: 70px;
  flex-shrink: 0;
}

.msg-type {
  font-size: 9px;
  font-weight: 700;
  min-width: 50px;
  flex-shrink: 0;
}

.msg-author {
  font-weight: 700;
  color: var(--color-gold);
  flex-shrink: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-content {
  color: var(--color-text);
  font-family: var(--font-body);
  flex: 1;
  word-break: break-word;
}

.msg-region {
  font-size: 9px;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.whisper-arrow {
  color: var(--color-text-dim);
  flex-shrink: 0;
}

/* Message type coloring */
.type-say .msg-type { color: var(--color-gold); }
.type-shout .msg-type { color: var(--color-crimson); }
.type-shout .msg-content { font-weight: 600; }
.type-low .msg-type { color: var(--color-text-dim); }
.type-low .msg-content { opacity: 0.7; }
.type-emote .msg-type { color: #b89f65; }
.type-emote .msg-content { font-style: italic; color: #b89f65; }
.type-ooc .msg-type { color: #6b9bc3; }
.type-ooc .msg-content { color: #6b9bc3; }
.type-gooc .msg-type { color: #6b9bc3; }
.type-gooc .msg-content { color: #6b9bc3; }
.type-system .msg-type { color: var(--color-text-dim); }
.type-system .msg-content { color: var(--color-text-dim); font-style: italic; }
.type-whisper .msg-type { color: #a87bc9; }
.type-whisper .msg-content { color: #a87bc9; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
</style>
