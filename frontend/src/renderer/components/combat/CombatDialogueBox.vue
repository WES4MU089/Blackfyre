<script setup lang="ts">
import { computed } from 'vue'
import { useCombatStore } from '@/stores/combat'

const combatStore = useCombatStore()
const callout = computed(() => combatStore.currentCallout)

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>

<template>
  <Transition name="dialogue-box">
    <div
      v-if="callout"
      :key="callout.id"
      class="combat-dialogue-box"
      :class="callout.team === 1 ? 'team-blue' : 'team-red'"
    >
      <!-- Portrait -->
      <div class="dialogue-portrait">
        <img
          v-if="callout.thumbnailUrl"
          :src="callout.thumbnailUrl"
          :alt="callout.characterName"
          class="dialogue-portrait-img"
        />
        <span v-else class="dialogue-portrait-initials">
          {{ getInitials(callout.characterName) }}
        </span>
      </div>

      <!-- Text block -->
      <div class="dialogue-content">
        <span class="dialogue-speaker">{{ callout.characterName }}</span>
        <span class="dialogue-text">&ldquo;{{ callout.text }}&rdquo;</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.combat-dialogue-box {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 55;
  pointer-events: none;

  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  min-width: 320px;
  max-width: 520px;

  background: rgba(8, 6, 12, 0.92);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border-ornate);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
}

/* Gold accent line (matches CharacterInfo / TargetPanel pattern) */
.combat-dialogue-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

/* Team accents */
.combat-dialogue-box.team-blue {
  border-left: 3px solid rgba(91, 155, 213, 0.5);
  box-shadow: var(--shadow-md), 0 0 12px rgba(91, 155, 213, 0.1);
}
.combat-dialogue-box.team-red {
  border-left: 3px solid rgba(224, 108, 117, 0.5);
  box-shadow: var(--shadow-md), 0 0 12px rgba(224, 108, 117, 0.1);
}

/* Portrait */
.dialogue-portrait {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialogue-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-portrait-initials {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold-dim);
  letter-spacing: 0.05em;
}

/* Content */
.dialogue-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dialogue-speaker {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.04em;
  line-height: 1.2;
}

.dialogue-text {
  font-family: var(--font-body);
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-style: italic;
  line-height: 1.4;
}

/* Transition */
.dialogue-box-enter-active {
  transition: all 0.35s ease-out;
}
.dialogue-box-leave-active {
  transition: all 0.3s ease-in;
}
.dialogue-box-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
.dialogue-box-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
