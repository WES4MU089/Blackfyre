<script setup lang="ts">
import { useTradeStore } from '@/stores/trade'
import { getSocket } from '@/composables/useSocket'

const tradeStore = useTradeStore()

function accept(): void {
  if (!tradeStore.pendingRequest) return
  getSocket()?.emit('trade:accept', { tradeId: tradeStore.pendingRequest.tradeId })
  tradeStore.clearPendingRequest()
}

function decline(): void {
  if (!tradeStore.pendingRequest) return
  getSocket()?.emit('trade:decline', { tradeId: tradeStore.pendingRequest.tradeId })
  tradeStore.clearPendingRequest()
}
</script>

<template>
  <div v-if="tradeStore.pendingRequest" class="trade-prompt animate-fade-in">
    <div class="tp-icon">&#9878;</div>
    <div class="tp-body">
      <div class="tp-title">Trade Request</div>
      <div class="tp-text">
        <strong>{{ tradeStore.pendingRequest.fromCharacterName }}</strong> wants to trade with you.
      </div>
    </div>
    <div class="tp-actions">
      <button class="tp-btn tp-btn--accept" @click="accept">Accept</button>
      <button class="tp-btn tp-btn--decline" @click="decline">Decline</button>
    </div>
  </div>
</template>

<style scoped>
.trade-prompt {
  position: fixed;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(18, 14, 10, 0.95);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
  pointer-events: auto;
  z-index: 9000;
}

.tp-icon {
  font-size: 20px;
  color: var(--color-gold);
}

.tp-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp-title {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tp-text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.tp-text strong {
  color: var(--color-text-bright);
}

.tp-actions {
  display: flex;
  gap: var(--space-xs);
  margin-left: var(--space-sm);
}

.tp-btn {
  padding: 4px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: none;
  transition: all var(--transition-fast);
}

.tp-btn--accept {
  border-color: #2d8a4e;
  color: #4a9e4a;
}
.tp-btn--accept:hover {
  background: rgba(45, 138, 78, 0.15);
}

.tp-btn--decline {
  color: var(--color-text-muted);
}
.tp-btn--decline:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
</style>
