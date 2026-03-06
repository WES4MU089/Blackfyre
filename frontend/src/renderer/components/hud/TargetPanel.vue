<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useTargetStore } from '@/stores/target'
import { useProximityStore } from '@/stores/proximity'
import { useDraggable } from '@/composables/useDraggable'
import { useHudStore } from '@/stores/hud'
import { BACKEND_URL } from '@/config'

const targetStore = useTargetStore()
const proximityStore = useProximityStore()
const hudStore = useHudStore()

function resolvePortrait(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}
const panelRef = ref<HTMLElement | null>(null)
const { onDragStart } = useDraggable('target-info', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['target-info']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const t = computed(() => targetStore.target)

const portraitSrc = computed(() => t.value ? resolvePortrait(t.value.portraitUrl) : null)

const hpPct = computed(() => {
  if (!t.value || t.value.maxHealth <= 0) return 0
  return Math.min(100, (t.value.health / t.value.maxHealth) * 100)
})

// Keep target data fresh from proximity updates
watchEffect(() => {
  if (!t.value) return
  const fresh = proximityStore.nearbyPlayers.find(p => p.characterId === t.value!.characterId)
  if (fresh) {
    targetStore.updateTarget(fresh)
  }
})

function hpBarColor(pct: number): string {
  if (pct > 60) return 'var(--color-health, #2d8a4e)'
  if (pct > 30) return '#d4a932'
  return '#c42b2b'
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function close(): void {
  targetStore.clearTarget()
}
</script>

<template>
  <div v-if="t" ref="panelRef" class="target-info panel-ornate animate-fade-in" :style="panelStyle">
    <!-- Header -->
    <div class="tp-header" @mousedown="onDragStart">
      <span class="tp-title">Target</span>
      <button class="tp-close" title="Close" @click="close">&times;</button>
    </div>

    <!-- Body -->
    <div class="tp-body">
      <!-- Portrait -->
      <div class="tp-portrait">
        <img
          v-if="portraitSrc"
          :src="portraitSrc"
          :alt="t.characterName"
          class="tp-portrait-img"
        />
        <div v-else class="tp-portrait-fallback">
          <span class="tp-portrait-initial">{{ getInitials(t.characterName) }}</span>
        </div>
      </div>

      <!-- Details -->
      <div class="tp-details">
        <!-- Name row -->
        <div class="tp-name-row">
          <span class="tp-name font-display">{{ t.characterName }}</span>
          <span class="tp-distance">{{ t.distance }}m</span>
        </div>

        <!-- Health bar -->
        <div class="tp-hp-track">
          <div
            class="tp-hp-fill"
            :style="{ width: hpPct + '%', background: hpBarColor(hpPct) }"
          />
          <span class="tp-hp-text">{{ t.health }} / {{ t.maxHealth }}</span>
        </div>

        <!-- Status effects -->
        <div v-if="t.statusEffects.length > 0" class="tp-effects">
          <div
            v-for="(effect, i) in t.statusEffects"
            :key="effect.name + '-' + i"
            class="tp-effect"
            :class="effect.effectType"
            :title="`${effect.name} (${effect.effectType})`"
          >
            <img v-if="effect.iconUrl" :src="effect.iconUrl" :alt="effect.name" class="tp-effect-img" />
            <span v-else class="tp-effect-letter">{{ effect.name.charAt(0) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.target-info {
  width: 260px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.tp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.tp-title {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tp-close {
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tp-close:hover {
  color: var(--color-text-bright);
}

.tp-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
}

/* Portrait — matches chat small size (60×90, 2:3 ratio) */
.tp-portrait {
  width: 60px;
  height: 90px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface-dark);
}

.tp-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tp-portrait-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
}

.tp-portrait-initial {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-gold);
  font-weight: 700;
}

/* Details column */
.tp-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Name row */
.tp-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
}

.tp-name {
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.06em;
  text-shadow: 0 0 8px rgba(201, 168, 76, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-distance {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* HP bar */
.tp-hp-track {
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.tp-hp-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.tp-hp-text {
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
.tp-effects {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  margin-top: 1px;
}

.tp-effect {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.tp-effect.buff {
  border-color: rgba(45, 138, 78, 0.4);
}

.tp-effect.debuff {
  border-color: rgba(196, 43, 43, 0.4);
}

.tp-effect-img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.tp-effect-letter {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold);
  font-weight: 700;
}
</style>
