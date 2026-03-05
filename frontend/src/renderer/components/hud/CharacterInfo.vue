<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'

const characterStore = useCharacterStore()
const hudStore = useHudStore()

const hp = computed(() => characterStore.vitals.health)
const maxHp = computed(() => characterStore.vitals.maxHealth)
const hpPct = computed(() => maxHp.value > 0 ? Math.min(100, (hp.value / maxHp.value) * 100) : 0)

function hpBarColor(pct: number): string {
  if (pct > 60) return 'var(--color-health, #2d8a4e)'
  if (pct > 30) return '#d4a932'
  return '#c42b2b'
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
</script>

<template>
  <div v-if="characterStore.isLoaded" class="char-info animate-fade-in">
    <!-- Portrait -->
    <div class="ci-portrait">
      <img
        v-if="characterStore.character?.portrait_url"
        :src="characterStore.character.portrait_url"
        :alt="characterStore.character?.name"
        class="ci-portrait-img"
      />
      <span v-else class="ci-portrait-initials">{{ getInitials(characterStore.character?.name || '?') }}</span>
    </div>

    <!-- Right side -->
    <div class="ci-details">
      <!-- Name row -->
      <div class="ci-name-row">
        <span class="ci-name font-display">{{ characterStore.character?.name }}</span>
        <span class="ci-meta">
          <span class="connection-dot" :class="{ connected: hudStore.isConnected }" />
          <span v-if="hudStore.latency > 0" class="ci-latency">{{ hudStore.latency }}ms</span>
        </span>
      </div>

      <!-- Health bar -->
      <div class="ci-hp-track">
        <div
          class="ci-hp-fill"
          :style="{ width: hpPct + '%', background: hpBarColor(hpPct) }"
        />
        <span class="ci-hp-text">{{ hp }} / {{ maxHp }}</span>
      </div>

      <!-- Status effects -->
      <div v-if="characterStore.activeEffects.length > 0" class="ci-effects">
        <div
          v-for="effect in characterStore.activeEffects"
          :key="effect.effect_id"
          class="ci-effect"
          :class="effect.effect_type"
          :title="`${effect.name} (${effect.effect_type})`"
        >
          <img v-if="effect.icon_url" :src="effect.icon_url" :alt="effect.name" class="ci-effect-img" />
          <span v-else class="ci-effect-letter">{{ effect.name.charAt(0) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.char-info {
  background: linear-gradient(
    135deg,
    rgba(8, 6, 12, 0.94) 0%,
    rgba(12, 10, 18, 0.92) 100%
  );
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(201, 168, 76, 0.06);
  position: relative;
  min-width: 260px;
}

.char-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

/* Portrait */
.ci-portrait {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(201, 168, 76, 0.1);
  border: 2px solid var(--color-border-ornate);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ci-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ci-portrait-initials {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-gold-dim);
  letter-spacing: 0.05em;
}

/* Details column */
.ci-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Name row */
.ci-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
}

.ci-name {
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.06em;
  text-shadow: 0 0 8px rgba(201, 168, 76, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ci-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-crimson);
}

.connection-dot.connected {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(45, 138, 78, 0.5);
}

.ci-latency {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

/* HP bar */
.ci-hp-track {
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.ci-hp-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.ci-hp-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  line-height: 1;
}

/* Status effects */
.ci-effects {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  margin-top: 1px;
}

.ci-effect {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.ci-effect.buff {
  border-color: rgba(45, 138, 78, 0.4);
}

.ci-effect.debuff {
  border-color: rgba(196, 43, 43, 0.4);
}

.ci-effect-img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.ci-effect-letter {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold);
  font-weight: 700;
}
</style>
