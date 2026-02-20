<script setup lang="ts">
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
</script>

<template>
  <div class="player-list" v-if="chatStore.sessionPlayers.length > 0">
    <div class="player-list__header">
      <span class="player-list__title">Online Players</span>
      <span class="player-list__count">{{ chatStore.sessionPlayers.length }}</span>
    </div>
    <div class="player-list__items">
      <div
        v-for="player in chatStore.sessionPlayers"
        :key="player.sessionId"
        class="player-list__item"
        :class="{ 'player-list__item--self': player.sessionId === chatStore.mySessionId }"
      >
        <span class="player-list__id">{{ player.sessionId }}</span>
        <span class="player-list__name">{{ player.characterName }}</span>
        <span v-if="player.sessionId === chatStore.mySessionId" class="player-list__you">(you)</span>
      </div>
    </div>
    <div class="player-list__hint">
      /w &lt;id&gt; &lt;message&gt; to whisper
    </div>
  </div>
</template>

<style scoped>
.player-list {
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-xs) var(--space-sm);
  flex-shrink: 0;
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.player-list__header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.player-list__title {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.player-list__count {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dim);
  background: var(--color-surface-dark);
  padding: 0 4px;
  border-radius: var(--radius-sm);
}

.player-list__items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.player-list__item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.player-list__item--self {
  border-color: var(--color-gold-dim);
}

.player-list__id {
  font-family: var(--font-mono);
  font-weight: 700;
  color: #a78bfa;
  min-width: 16px;
  text-align: center;
}

.player-list__name {
  font-family: var(--font-body);
  color: var(--color-text);
}

.player-list__you {
  font-family: var(--font-body);
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.65rem;
}

.player-list__hint {
  margin-top: var(--space-xs);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
