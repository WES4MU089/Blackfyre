<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore, type AnyMessage, type WhisperMessage, type ChatMessage } from '@/stores/chat'
import { parseParaText, formatRelativeTime } from '@/utils/chatFormatter'
import { BACKEND_URL } from '@/config'

const props = defineProps<{
  message: AnyMessage
}>()

const chatStore = useChatStore()
const relativeTime = computed(() => formatRelativeTime(props.message.created_at))
const dimensions = computed(() => chatStore.portraitDimensions)

// Type guards
const isWhisper = computed(() => 'sender_character_id' in props.message)
const isSystem = computed(() => (props.message as ChatMessage).message_type === 'system')
const isEmote = computed(() => (props.message as ChatMessage).message_type === 'emote')
const isOoc = computed(() => {
  const mt = (props.message as ChatMessage).message_type
  return mt === 'ooc' || mt === 'gooc'
})
const isShout = computed(() => (props.message as ChatMessage).message_type === 'shout')
const isLow = computed(() => (props.message as ChatMessage).message_type === 'low')
const isGooc = computed(() => (props.message as ChatMessage).message_type === 'gooc')
const isSystemSender = computed(() => (props.message as ChatMessage).character_id === 0)

// Display name and portrait
const characterName = computed(() => {
  if (isWhisper.value) {
    const w = props.message as WhisperMessage
    const myCharId = chatStore.sessionPlayers.find(
      p => p.sessionId === chatStore.mySessionId
    )?.characterId
    return myCharId === w.sender_character_id
      ? `To ${w.target_name}`
      : `From ${w.sender_name}`
  }
  return (props.message as ChatMessage).character_name
})

function resolvePortrait(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}

const portraitUrl = computed(() => {
  if (isWhisper.value) {
    const w = props.message as WhisperMessage
    const myCharId = chatStore.sessionPlayers.find(
      p => p.sessionId === chatStore.mySessionId
    )?.characterId
    return resolvePortrait(
      myCharId === w.sender_character_id
        ? w.target_portrait_url
        : w.sender_portrait_url
    )
  }
  return resolvePortrait((props.message as ChatMessage).portrait_url)
})

const initial = computed(() => characterName.value.replace(/^(To |From )/, '').charAt(0).toUpperCase())

const fontSize = computed(() => chatStore.chatFontSize + 'px')
const segments = computed(() => parseParaText(props.message.content))

// Type prefix label
const typePrefix = computed(() => {
  if (isShout.value) return '[Shout] '
  if (isLow.value) return '[Low] '
  if (isGooc.value) return '[GLOBAL] '
  return ''
})

// Combat emote team-colored name highlighting
const isCombatEmote = computed(() => {
  const msg = props.message as ChatMessage
  return isSystemSender.value
    && msg.message_type === 'emote'
    && msg.metadata?.combatantTeams != null
})

const combatTeamMap = computed(() => {
  if (!isCombatEmote.value) return null
  return (props.message as ChatMessage).metadata?.combatantTeams ?? null
})

const retainerOwnersMap = computed(() => {
  if (!isCombatEmote.value) return null
  return (props.message as ChatMessage).metadata?.retainerOwners ?? null
})

function highlightCombatNames(text: string): string {
  const teamMap = combatTeamMap.value
  if (!teamMap || Object.keys(teamMap).length === 0) return escapeHtml(text)

  const retainers = retainerOwnersMap.value

  // Sort names longest-first so "Ser Rodrik the Bold" matches before "Ser Rodrik"
  const names = Object.keys(teamMap).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${names.map(escapeRegex).join('|')})`, 'g')

  const parts = text.split(pattern)
  return parts.map(part => {
    const team = teamMap[part]
    if (team != null) {
      const isRetainer = retainers && retainers[part]
      const cls = isRetainer ? `combat-name-team-${team}-retainer` : `combat-name-team-${team}`
      return `<span class="${cls}">${escapeHtml(part)}</span>`
    }
    return escapeHtml(part)
  }).join('')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<template>
  <div
    class="chat-bubble"
    :class="{
      'chat-bubble--ooc': isOoc,
      'chat-bubble--emote': isEmote,
      'chat-bubble--shout': isShout,
      'chat-bubble--low': isLow,
      'chat-bubble--whisper': isWhisper,
      'chat-bubble--system': isSystem,
    }"
  >
    <!-- Portrait (hidden for system messages and system senders like Combat) -->
    <div
      v-if="!isSystem && !isSystemSender"
      class="chat-portrait"
      :style="{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }"
    >
      <img
        v-if="portraitUrl"
        :src="portraitUrl"
        :alt="characterName"
        class="chat-portrait__img"
      />
      <div v-else class="chat-portrait__fallback">
        <span class="chat-portrait__initial">{{ initial }}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="chat-content">
      <!-- Header: name + timestamp -->
      <div class="chat-header">
        <span class="chat-name" :class="{ 'chat-name--system': isSystem, 'chat-name--whisper': isWhisper }">
          {{ characterName }}
        </span>
        <span class="chat-time">{{ relativeTime }}</span>
      </div>

      <!-- Message body -->
      <div class="chat-body" :style="{ fontSize }" :class="{
        'chat-body--emote': isEmote,
        'chat-body--shout': isShout,
        'chat-body--low': isLow,
        'chat-body--system': isSystem,
      }">
        <!-- Type prefix -->
        <span v-if="typePrefix" class="chat-type-prefix">{{ typePrefix }}</span>

        <!-- OOC wrapper -->
        <template v-if="isOoc && !isGooc">
          <span class="chat-ooc-bracket">(( </span>
        </template>

        <!-- Emote prefix (skipped for system senders — combat emotes are self-contained) -->
        <template v-if="isEmote && !isSystemSender">
          <span class="chat-emote-name">{{ (message as ChatMessage).character_name }} </span>
        </template>

        <!-- Combat emote with team-colored names -->
        <template v-if="isCombatEmote">
          <span class="chat-seg-text" v-html="highlightCombatNames(message.content)"></span>
        </template>

        <!-- Normal message rendering -->
        <template v-else>
          <template v-for="(seg, i) in segments" :key="i">
            <br v-if="seg.type === 'paragraph-break'" class="chat-para-break" />
            <span v-else-if="seg.type === 'emote'" class="chat-seg-emote">{{ seg.content }}</span>
            <span v-else-if="seg.type === 'speech'" class="chat-seg-speech">{{ seg.content }}</span>
            <span v-else class="chat-seg-text">{{ seg.content }}</span>
          </template>
        </template>

        <template v-if="isOoc && !isGooc">
          <span class="chat-ooc-bracket"> ))</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-bubble {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border-dim);
  transition: background var(--transition-fast);
}

.chat-bubble:hover {
  background: var(--color-surface-hover);
}

.chat-bubble--ooc {
  background: rgba(90, 94, 107, 0.1);
}

.chat-bubble--ooc:hover {
  background: rgba(90, 94, 107, 0.18);
}

.chat-bubble--shout {
  background: rgba(201, 168, 76, 0.08);
}

.chat-bubble--low {
  opacity: 0.7;
}

.chat-bubble--whisper {
  background: rgba(167, 139, 250, 0.08);
  border-left: 2px solid #a78bfa;
}

.chat-bubble--system {
  background: rgba(100, 116, 139, 0.1);
  border-left: 2px solid var(--color-text-muted);
  padding-left: var(--space-md);
}

/* Portrait */
.chat-portrait {
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-dark);
}

.chat-portrait__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-portrait__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-gold-dim);
  background: var(--color-surface);
}

.chat-portrait__initial {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-gold);
}

/* Content area */
.chat-content {
  flex: 1;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: 2px;
}

.chat-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  font-weight: 600;
}

.chat-name--system {
  color: var(--color-text-muted);
  font-style: italic;
}

.chat-name--whisper {
  color: #a78bfa;
}

.chat-time {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Message body */
.chat-body {
  font-family: var(--font-body);
  color: var(--color-text);
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.chat-body--emote {
  font-style: italic;
}

.chat-body--shout {
  font-weight: 700;
  font-size: 1.15em !important;
}

.chat-body--low {
  font-size: 0.85em !important;
  font-style: italic;
  opacity: 0.7;
}

.chat-body--system {
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.85em !important;
}

.chat-type-prefix {
  font-weight: 700;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-right: 4px;
}

.chat-bubble--shout .chat-type-prefix {
  color: var(--color-gold);
}

.chat-bubble--whisper .chat-type-prefix {
  color: #a78bfa;
}

.chat-para-break {
  display: block;
  content: '';
  margin-top: var(--space-sm);
}

/* =========================================================
   IC Para RP syntax highlighting:
   Narration (non-quoted) → warm gold, dimmed
   "Dialogue" (quoted)    → bright off-white
   ========================================================= */
.chat-seg-text {
  color: #bfad7a;
}

.chat-seg-speech {
  color: var(--color-text-bright);
  font-weight: 500;
}

.chat-seg-emote {
  font-style: italic;
  color: var(--color-gold);
}

/* Non-IC messages: revert to neutral text colors */
.chat-bubble--ooc .chat-seg-text,
.chat-bubble--ooc .chat-seg-speech,
.chat-bubble--whisper .chat-seg-text,
.chat-bubble--whisper .chat-seg-speech,
.chat-bubble--system .chat-seg-text,
.chat-bubble--system .chat-seg-speech {
  color: inherit;
  font-weight: inherit;
}

.chat-ooc-bracket {
  color: var(--color-iron-light);
  font-weight: 600;
}

.chat-emote-name {
  color: var(--color-gold);
  font-weight: 600;
}

/* Team-colored combatant names in combat emotes */
.chat-body :deep(.combat-name-team-1) {
  color: #5b9bd5;
  font-weight: 600;
}
.chat-body :deep(.combat-name-team-2) {
  color: #e06c75;
  font-weight: 600;
}
/* Lighter shades for retainer names */
.chat-body :deep(.combat-name-team-1-retainer) {
  color: #a3d4f7;
  font-weight: 600;
}
.chat-body :deep(.combat-name-team-2-retainer) {
  color: #f0a8b0;
  font-weight: 600;
}

/* Scale initial based on portrait size */
.chat-bubble :deep(.chat-portrait__initial) {
  font-size: clamp(0.8rem, 2vw, 2rem);
}
</style>
