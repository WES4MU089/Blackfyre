<script setup lang="ts">
import { computed } from 'vue'
import { useCreationStore } from '@/stores/creation'

const store = useCreationStore()

const NAME_REGEX = /^[a-zA-Z\s'-]+$/

const nameValid = computed(() => {
  const name = store.characterName.trim()
  return name.length >= 2 && name.length <= 100 && NAME_REGEX.test(name)
})

const nameError = computed(() => {
  const name = store.characterName.trim()
  if (name.length === 0) return null
  if (name.length < 2) return 'Name must be at least 2 characters'
  if (name.length > 100) return 'Name must be under 100 characters'
  if (!NAME_REGEX.test(name)) return 'Only letters, spaces, hyphens, and apostrophes allowed'
  return null
})

const backstoryLength = computed(() => store.backstory.length)
</script>

<template>
  <div class="step-identity">
    <!-- Character name -->
    <div class="name-section">
      <label class="name-label" for="char-name">Character Name</label>
      <input
        id="char-name"
        v-model="store.characterName"
        type="text"
        class="name-input"
        :class="{
          'name-input--valid': nameValid,
          'name-input--error': nameError,
        }"
        placeholder="Enter your character's name..."
        maxlength="100"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="name-feedback">
        <span v-if="nameError" class="name-error">{{ nameError }}</span>
        <span v-else-if="nameValid" class="name-ok">Valid name</span>
      </div>
    </div>

    <!-- Backstory -->
    <div class="backstory-section">
      <label class="backstory-label" for="char-backstory">
        Backstory
        <span class="backstory-optional">(optional)</span>
      </label>
      <textarea
        id="char-backstory"
        v-model="store.backstory"
        class="backstory-input"
        placeholder="Write your character's history, motivations, and personality..."
        maxlength="5000"
        rows="10"
        spellcheck="true"
      />
      <div class="backstory-footer">
        <span class="backstory-count" :class="{ 'backstory-count--warn': backstoryLength > 4500 }">
          {{ backstoryLength }} / 5,000
        </span>
      </div>
    </div>

    <!-- Portrait placeholder -->
    <div class="portrait-placeholder">
      <div class="portrait-frame">
        <span class="portrait-icon">?</span>
      </div>
      <span class="portrait-label">Portrait — coming soon</span>
    </div>
  </div>
</template>

<style scoped>
.step-identity {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 600px;
  margin: 0 auto;
}

/* Name section */
.name-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.name-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.name-input {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-gold);
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  letter-spacing: 0.08em;
  text-align: center;
  outline: none;
  transition: all var(--transition-fast);
}

.name-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  letter-spacing: 0.02em;
}

.name-input:focus {
  border-color: var(--color-gold-dark);
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.1);
}

.name-input--valid {
  border-color: var(--color-gold-dim);
}

.name-input--error {
  border-color: var(--color-crimson-dark);
}

.name-feedback {
  min-height: 18px;
}

.name-error {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-crimson-light);
}

.name-ok {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Backstory section */
.backstory-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.backstory-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.backstory-optional {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: none;
  letter-spacing: 0;
}

.backstory-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.backstory-input::placeholder {
  color: var(--color-text-muted);
}

.backstory-input:focus {
  border-color: var(--color-gold-dark);
}

.backstory-footer {
  display: flex;
  justify-content: flex-end;
}

.backstory-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
}

.backstory-count--warn {
  color: var(--color-warning);
}

/* Portrait placeholder */
.portrait-placeholder {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px dashed var(--color-border-dim);
  border-radius: var(--radius-sm);
  opacity: 0.5;
}

.portrait-frame {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
  flex-shrink: 0;
}

.portrait-icon {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.portrait-label {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
