<script setup lang="ts">
import { computed, watch } from 'vue'
import { useCreationStore } from '@/stores/creation'
import { useSocket } from '@/composables/useSocket'
import StepTemplate from './StepTemplate.vue'
import StepAptitudes from './StepAptitudes.vue'
import StepIdentity from './StepIdentity.vue'
import StepReview from './StepReview.vue'

const store = useCreationStore()
const { submitCharacterCreation } = useSocket()

const STEP_LABELS = ['Class', 'Aptitudes', 'Identity', 'Review']

const currentStepComponent = computed(() => {
  switch (store.currentStep) {
    case 'template': return StepTemplate
    case 'aptitudes': return StepAptitudes
    case 'identity': return StepIdentity
    case 'review': return StepReview
    default: return StepTemplate
  }
})

const footerHint = computed(() => {
  switch (store.currentStep) {
    case 'aptitudes':
      return store.freeAptitudePointsRemaining > 0
        ? `${store.freeAptitudePointsRemaining} aptitude points remaining`
        : 'All points allocated'
    default:
      return null
  }
})

function handleSubmit(): void {
  const payload = store.getCreatePayload()
  if (!payload) return
  store.isSubmitting = true
  store.submitError = null
  submitCharacterCreation(payload)
}
</script>

<template>
  <div class="creation-backdrop">
    <div class="creation-container">
      <!-- Header -->
      <div class="creation-header">
        <div class="creation-title-row">
          <h1 class="creation-title">Forge Your Character</h1>
          <button class="creation-close" title="Cancel" @click="store.close()">&#x2715;</button>
        </div>

        <!-- Step indicator -->
        <div class="step-indicator">
          <template v-for="(label, idx) in STEP_LABELS" :key="idx">
            <button
              class="step-item"
              :class="{
                'step-item--active': idx === store.currentStepIndex,
                'step-item--completed': idx < store.currentStepIndex,
                'step-item--disabled': !store.canGoToStep(store.STEP_ORDER[idx]),
              }"
              :disabled="!store.canGoToStep(store.STEP_ORDER[idx])"
              @click="store.goToStep(store.STEP_ORDER[idx])"
            >
              <span class="step-number">{{ idx + 1 }}</span>
              <span class="step-label">{{ label }}</span>
            </button>
            <div v-if="idx < STEP_LABELS.length - 1" class="step-connector" :class="{ 'step-connector--done': idx < store.currentStepIndex }" />
          </template>
        </div>
      </div>

      <!-- Step content -->
      <div class="creation-body">
        <Transition name="step-fade" mode="out-in">
          <component :is="currentStepComponent" :key="store.currentStep" />
        </Transition>
      </div>

      <!-- Footer -->
      <div class="creation-footer">
        <button
          v-if="store.currentStep !== 'template'"
          class="btn btn-dim"
          @click="store.prevStep()"
        >
          Back
        </button>
        <div class="creation-footer-center">
          <span v-if="footerHint" class="footer-hint" :class="{ 'footer-hint--done': footerHint.includes('All') }">
            {{ footerHint }}
          </span>
          <span v-if="store.submitError" class="footer-error">{{ store.submitError }}</span>
        </div>
        <button
          v-if="store.currentStep !== 'review'"
          class="btn btn-gold"
          :disabled="!store.canAdvance"
          @click="store.nextStep()"
        >
          Continue
        </button>
        <button
          v-if="store.currentStep === 'review'"
          class="btn btn-gold btn-submit"
          :disabled="store.isSubmitting"
          @click="handleSubmit"
        >
          {{ store.isSubmitting ? 'Creating...' : 'Forge Your Destiny' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.creation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
}

.creation-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--space-lg);
}

/* Header */
.creation-header {
  padding: var(--space-lg) 0 var(--space-md);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.creation-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: var(--space-md);
}

.creation-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-gold);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: center;
  margin: 0;
}

.creation-close {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.creation-close:hover {
  border-color: var(--color-crimson);
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.1);
}

/* Step indicator */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.step-item:not(.step-item--disabled):hover {
  background: var(--color-surface-hover);
}

.step-item--disabled {
  cursor: default;
  opacity: 0.4;
}

.step-item--active {
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

.step-number {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.step-item--active .step-number {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.15);
}

.step-item--completed .step-number {
  border-color: var(--color-gold-dim);
  color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.1);
}

.step-label {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.step-item--active .step-label {
  color: var(--color-gold);
}

.step-item--completed .step-label {
  color: var(--color-text-dim);
}

.step-connector {
  width: 32px;
  height: 1px;
  background: var(--color-border-dim);
  transition: background var(--transition-fast);
}

.step-connector--done {
  background: var(--color-gold-dim);
}

/* Body */
.creation-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-md) 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.creation-body::-webkit-scrollbar {
  width: 4px;
}

.creation-body::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

/* Footer */
.creation-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) 0 var(--space-lg);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--space-md);
}

.creation-footer-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.footer-hint {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dim);
  letter-spacing: 0.04em;
}

.footer-hint--done {
  color: var(--color-text-muted);
}

.footer-error {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-crimson-light);
}

/* Buttons */
.btn {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-bright);
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn-gold {
  border-color: var(--color-gold-dark);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
}

.btn-gold:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.18);
  border-color: var(--color-gold);
}

.btn-dim {
  color: var(--color-text-muted);
}

.btn-submit {
  padding: 10px 28px;
  font-size: var(--font-size-md);
}

/* Step transition */
.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 200ms ease;
}

.step-fade-enter-from,
.step-fade-leave-to {
  opacity: 0;
}
</style>
