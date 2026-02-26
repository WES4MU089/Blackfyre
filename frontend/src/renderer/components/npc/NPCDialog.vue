<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useNpcDialogStore } from '@/stores/npcDialog'
import { getSocket } from '@/composables/useSocket'
import { useDraggable } from '@/composables/useDraggable'
import { useTypewriter } from '@/composables/useTypewriter'

const store = useNpcDialogStore()
const panelRef = ref<HTMLElement | null>(null)
const historyRef = ref<HTMLElement | null>(null)
const typewriter = useTypewriter({ intervalMs: 30 })

const { onDragStart } = useDraggable('npc-dialog', panelRef, { alwaysDraggable: true })

// Auto-scroll dialog history and trigger typewriter for new NPC entries
watch(
  () => store.dialogHistory.length,
  async (newLen) => {
    await nextTick()
    if (historyRef.value) {
      historyRef.value.scrollTop = historyRef.value.scrollHeight
    }
    // Start typewriter for the latest NPC entry
    if (newLen > 0) {
      const last = store.dialogHistory[newLen - 1]
      if (last.speaker === 'npc') {
        typewriter.start(last.text)
      }
    }
  },
)

function selectOption(optionId: string, text: string): void {
  if (store.isClosing) return
  typewriter.skip()
  store.addPlayerChoice(text)
  getSocket()?.emit('npc:select-option', { optionId })
}

function close(): void {
  typewriter.skip()
  getSocket()?.emit('npc:close')
  store.closeDialog()
}
</script>

<template>
  <div class="npc-dialog-wrapper">
    <div ref="panelRef" class="npc-dialog panel-ornate animate-fade-in">
      <!-- Header -->
      <div class="npc-header" @mousedown="onDragStart">
        <div class="npc-identity">
          <div class="npc-portrait">
            <img
              v-if="store.npcPortrait"
              :src="store.npcPortrait"
              :alt="store.npcName"
              class="npc-portrait-img"
            />
            <div v-else class="npc-portrait-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z" />
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              </svg>
            </div>
          </div>
          <div class="npc-name-block">
            <span class="npc-name">{{ store.npcName }}</span>
            <span class="npc-role">{{ store.npcType }}</span>
          </div>
        </div>
        <button class="npc-close" @click="close">&times;</button>
      </div>

      <!-- Dialog history -->
      <div ref="historyRef" class="npc-history">
        <div
          v-for="(entry, i) in store.dialogHistory"
          :key="i"
          class="npc-history-entry"
          :class="{ 'is-player': entry.speaker === 'player' }"
        >
          <span class="npc-history-speaker">
            {{ entry.speaker === 'npc' ? store.npcName : 'You' }}:
          </span>
          <!-- Typewriter for the latest NPC entry while animating -->
          <span
            v-if="entry.speaker === 'npc' && i === store.dialogHistory.length - 1 && typewriter.isAnimating.value"
            class="npc-history-text"
          >&ldquo;{{ typewriter.fullText.value.slice(0, typewriter.visibleCount.value) }}<span class="tw-cursor">|</span>&rdquo;</span>
          <!-- Normal full text (history or completed animation) -->
          <span v-else class="npc-history-text">
            {{ entry.speaker === 'npc' ? `\u201C${entry.text}\u201D` : entry.text }}
          </span>
        </div>
      </div>

      <!-- Response options -->
      <div v-if="store.hasOptions" class="npc-options">
        <button
          v-for="(opt, i) in store.options"
          :key="opt.id"
          class="npc-option"
          @click="selectOption(opt.id, opt.text)"
        >
          <span class="npc-option-num">{{ i + 1 }}.</span>
          <span class="npc-option-text">{{ opt.text }}</span>
        </button>
      </div>

      <!-- Closing indicator -->
      <div v-else-if="store.isClosing" class="npc-closing">
        <span class="npc-closing-text">The conversation ends...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 150;
}

.npc-dialog {
  width: 480px;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
}

/* ── Header ── */

.npc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.npc-header:active {
  cursor: grabbing;
}

.npc-identity {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.npc-portrait {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-gold-dim);
  overflow: hidden;
  flex-shrink: 0;
}

.npc-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.npc-portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-dark);
  color: var(--color-gold-dim);
  padding: 8px;
}

.npc-portrait-placeholder svg {
  width: 100%;
  height: 100%;
}

.npc-name-block {
  display: flex;
  flex-direction: column;
}

.npc-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.npc-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: capitalize;
  letter-spacing: 0.08em;
}

.npc-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 var(--space-xs);
  line-height: 1;
  transition: color var(--transition-fast);
}

.npc-close:hover {
  color: var(--color-crimson-light);
}

/* ── Dialog history ── */

.npc-history {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 200px;
  max-height: 320px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.npc-history-entry {
  line-height: 1.5;
}

.npc-history-speaker {
  font-weight: 600;
  margin-right: 4px;
}

.npc-history-entry:not(.is-player) .npc-history-speaker {
  color: var(--color-gold);
}

.npc-history-entry:not(.is-player) .npc-history-text {
  color: var(--color-text);
  font-style: italic;
}

.npc-history-entry.is-player .npc-history-speaker {
  color: var(--color-gold-light);
}

.npc-history-entry.is-player .npc-history-text {
  color: var(--color-text-dim);
}

/* ── Typewriter cursor ── */

.tw-cursor {
  display: inline;
  color: var(--color-gold-dim);
  animation: tw-blink 0.6s step-end infinite;
  font-weight: 300;
}

@keyframes tw-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ── Response options ── */

.npc-options {
  border-top: 1px solid var(--color-border);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.npc-option {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-md);
}

.npc-option:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-gold-dim);
}

.npc-option:active {
  background: var(--color-surface-dark);
}

.npc-option-num {
  color: var(--color-gold);
  font-weight: 700;
  min-width: 18px;
  flex-shrink: 0;
}

.npc-option-text {
  color: var(--color-text);
}

.npc-option:hover .npc-option-text {
  color: var(--color-gold-light);
}

/* ── Closing indicator ── */

.npc-closing {
  border-top: 1px solid var(--color-border);
  padding: var(--space-sm) var(--space-md);
  text-align: center;
}

.npc-closing-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
  letter-spacing: 0.04em;
}
</style>
