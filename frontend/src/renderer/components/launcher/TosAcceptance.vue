<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLauncherStore } from '@/stores/launcher'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ accepted: [] }>()

const launcherStore = useLauncherStore()
const authStore = useAuthStore()

const activeTab = ref<'tos' | 'privacy'>('tos')
const tosAgreed = ref(false)
const privacyAgreed = ref(false)
const isSubmitting = ref(false)
const errorMsg = ref<string | null>(null)

const canAccept = computed(() => tosAgreed.value && privacyAgreed.value && !isSubmitting.value)

onMounted(() => {
  launcherStore.fetchTosDocuments()
})

async function handleAccept(): Promise<void> {
  if (!canAccept.value || !authStore.token) return
  isSubmitting.value = true
  errorMsg.value = null

  const success = await launcherStore.acceptTos(authStore.token)
  isSubmitting.value = false

  if (success) {
    emit('accepted')
  } else {
    errorMsg.value = 'Failed to record acceptance. Please try again.'
  }
}
</script>

<template>
  <div class="tos-overlay">
    <div class="tos-modal">
      <h2 class="tos-title">Legal Agreements</h2>
      <p class="tos-subtitle">
        Please review and accept the following before continuing.
      </p>

      <!-- Tab buttons -->
      <div class="tos-tabs">
        <button
          class="tos-tab"
          :class="{ active: activeTab === 'tos' }"
          @click="activeTab = 'tos'"
        >
          Terms of Service
        </button>
        <button
          class="tos-tab"
          :class="{ active: activeTab === 'privacy' }"
          @click="activeTab = 'privacy'"
        >
          Privacy Policy
        </button>
      </div>

      <!-- Content area -->
      <div class="tos-content">
        <template v-if="activeTab === 'tos'">
          <pre v-if="launcherStore.tosDocument" class="tos-text">{{ launcherStore.tosDocument.content }}</pre>
          <div v-else class="tos-loading">Loading Terms of Service...</div>
        </template>
        <template v-else>
          <pre v-if="launcherStore.privacyDocument" class="tos-text">{{ launcherStore.privacyDocument.content }}</pre>
          <div v-else class="tos-loading">Loading Privacy Policy...</div>
        </template>
      </div>

      <!-- Checkboxes -->
      <div class="tos-checkboxes">
        <label class="tos-checkbox">
          <input type="checkbox" v-model="tosAgreed" />
          <span>I have read and agree to the <strong>Terms of Service</strong>
            <span v-if="launcherStore.tosDocument" class="version-tag">v{{ launcherStore.tosDocument.version }}</span>
          </span>
        </label>
        <label class="tos-checkbox">
          <input type="checkbox" v-model="privacyAgreed" />
          <span>I have read and agree to the <strong>Privacy Policy</strong>
            <span v-if="launcherStore.privacyDocument" class="version-tag">v{{ launcherStore.privacyDocument.version }}</span>
          </span>
        </label>
      </div>

      <div v-if="errorMsg" class="tos-error">{{ errorMsg }}</div>

      <button class="tos-accept-btn" :disabled="!canAccept" @click="handleAccept">
        <span v-if="isSubmitting">Submitting...</span>
        <span v-else>Accept &amp; Continue</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tos-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 24px;
}

.tos-modal {
  width: 100%;
  max-width: 720px;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  overflow: hidden;
}

.tos-title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--color-gold);
  margin: 0 0 4px;
  text-align: center;
}

.tos-subtitle {
  font-size: 12px;
  color: var(--color-text-dim);
  text-align: center;
  margin: 0 0 16px;
}

.tos-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.tos-tab {
  flex: 1;
  padding: 8px 12px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tos-tab:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.tos-tab.active {
  background: rgba(201, 168, 76, 0.1);
  border-color: var(--color-gold);
  color: var(--color-gold);
}

.tos-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  margin-bottom: 16px;
  max-height: 320px;
}

.tos-text {
  font-family: var(--font-body);
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-muted);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

.tos-loading {
  color: var(--color-text-dim);
  font-size: 12px;
  text-align: center;
  padding: 40px 0;
}

.tos-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.tos-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
}

.tos-checkbox input[type="checkbox"] {
  accent-color: var(--color-gold);
  width: 14px;
  height: 14px;
}

.version-tag {
  font-size: 10px;
  color: var(--color-text-dim);
  margin-left: 4px;
}

.tos-error {
  font-size: 11px;
  color: var(--color-crimson);
  margin-bottom: 8px;
  text-align: center;
}

.tos-accept-btn {
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--color-gold), #b8952e);
  border: none;
  border-radius: var(--radius-sm);
  color: #1a1a2e;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-display);
  cursor: pointer;
  transition: all var(--transition-fast);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.tos-accept-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.tos-accept-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Scrollbar for TOS content */
.tos-content::-webkit-scrollbar {
  width: 6px;
}
.tos-content::-webkit-scrollbar-track {
  background: transparent;
}
.tos-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
</style>
