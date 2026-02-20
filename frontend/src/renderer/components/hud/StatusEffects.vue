<script setup lang="ts">
import { useCharacterStore } from '@/stores/character'

const store = useCharacterStore()
</script>

<template>
  <div v-if="store.activeEffects.length > 0" class="effects-container animate-fade-in">
    <div
      v-for="effect in store.activeEffects"
      :key="effect.effect_id"
      class="effect-icon"
      :class="effect.effect_type"
      :title="`${effect.name} (${effect.effect_type})`"
    >
      <!-- If effect has an icon URL, show image; otherwise show first letter -->
      <img
        v-if="effect.icon_url"
        :src="effect.icon_url"
        :alt="effect.name"
        class="effect-img"
      />
      <span v-else class="effect-letter">{{ effect.name.charAt(0) }}</span>
    </div>
  </div>
</template>

<style scoped>
.effects-container {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
  max-width: 220px;
}

.effect-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: default;
  transition: all var(--transition-fast);
}

.effect-icon:hover {
  border-color: var(--color-border-bright);
  transform: scale(1.1);
}

/* Effect type colors */
.effect-icon.buff {
  border-color: rgba(45, 138, 78, 0.4);
}

.effect-icon.debuff {
  border-color: rgba(196, 43, 43, 0.4);
  animation: pulse 2s ease-in-out infinite;
}

.effect-icon.neutral {
  border-color: var(--color-border-dim);
}

.effect-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.effect-letter {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  font-weight: 700;
}
</style>
