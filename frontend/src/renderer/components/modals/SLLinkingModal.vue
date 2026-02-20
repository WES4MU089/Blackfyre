<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useHudStore } from '@/stores/hud'

const hudStore = useHudStore()

const remaining = ref('')
let timer: ReturnType<typeof setInterval> | null = null

function updateCountdown(): void {
  if (!hudStore.slLinkingExpiresAt) {
    remaining.value = ''
    return
  }
  const diff = new Date(hudStore.slLinkingExpiresAt).getTime() - Date.now()
  if (diff <= 0) {
    remaining.value = 'Expired'
    return
  }
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  remaining.value = `${mins}:${secs.toString().padStart(2, '0')}`
}

const isExpired = computed(() => remaining.value === 'Expired')

const copyText = computed(() => `/bf verify ${hudStore.slLinkingCode}`)
const copied = ref(false)

async function copyCommand(): Promise<void> {
  try {
    await navigator.clipboard.writeText(copyText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback for environments where clipboard API is unavailable
  }
}

onMounted(() => {
  updateCountdown()
  timer = setInterval(updateCountdown, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="sl-link-backdrop">
    <div class="sl-link-modal panel-ornate animate-fade-in">
      <div class="sl-link-header">
        <h2 class="sl-link-title">Link Second Life Account</h2>
        <p class="sl-link-subtitle">Connect your SL avatar to Blackfyre</p>
      </div>

      <div class="sl-link-body">
        <p class="sl-link-instruction">
          Open <strong>local chat</strong> in Second Life and type:
        </p>

        <div class="sl-link-command" @click="copyCommand" title="Click to copy">
          <span class="sl-link-prefix">/bf verify</span>
          <span class="sl-link-code">{{ hudStore.slLinkingCode }}</span>
          <span class="sl-link-copy-hint">{{ copied ? 'Copied!' : 'Click to copy' }}</span>
        </div>

        <div class="sl-link-timer" :class="{ 'sl-link-timer--expired': isExpired }">
          <template v-if="!isExpired">
            Code expires in <span class="sl-link-countdown">{{ remaining }}</span>
          </template>
          <template v-else>
            Code expired. Reconnect to generate a new one.
          </template>
        </div>
      </div>

      <div class="sl-link-footer">
        <button class="btn" @click="hudStore.clearSLLinking()">Dismiss</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sl-link-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 200;
  pointer-events: auto;
}

.sl-link-modal {
  width: 420px;
  padding: var(--space-lg);
  text-align: center;
}

.sl-link-header {
  margin-bottom: var(--space-lg);
}

.sl-link-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--color-gold);
  letter-spacing: 0.08em;
  margin-bottom: var(--space-xs);
}

.sl-link-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.sl-link-body {
  margin-bottom: var(--space-lg);
}

.sl-link-instruction {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  margin-bottom: var(--space-md);
  line-height: 1.5;
}

.sl-link-instruction strong {
  color: var(--color-text);
}

.sl-link-command {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s, background 0.2s;
}

.sl-link-command:hover {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.05);
}

.sl-link-command:active {
  background: rgba(201, 168, 76, 0.1);
}

.sl-link-copy-hint {
  position: absolute;
  right: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.sl-link-command:hover .sl-link-copy-hint {
  color: var(--color-gold);
}

.sl-link-prefix {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.sl-link-code {
  font-family: var(--font-mono);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-gold-light);
  letter-spacing: 0.2em;
  text-shadow: 0 0 8px rgba(201, 168, 76, 0.3);
}

.sl-link-timer {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.sl-link-timer--expired {
  color: var(--color-danger);
}

.sl-link-countdown {
  font-family: var(--font-mono);
  color: var(--color-text-dim);
}

.sl-link-footer {
  display: flex;
  justify-content: center;
}
</style>
