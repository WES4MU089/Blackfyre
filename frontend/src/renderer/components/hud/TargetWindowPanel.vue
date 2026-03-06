<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useProximityStore, type NearbyPlayer } from '@/stores/proximity'
import { useTargetStore } from '@/stores/target'
import { useDraggable } from '@/composables/useDraggable'
import { hpBarColor } from '@/utils/healthColor'

const hudStore = useHudStore()
const proximityStore = useProximityStore()
const targetStore = useTargetStore()
const panelRef = ref<HTMLElement | null>(null)
const { onDragStart } = useDraggable('target-window', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['target-window']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function close() {
  hudStore.toggleSystemPanel('target-window')
}

// --- Context menu state ---
const ctxPlayer = ref<NearbyPlayer | null>(null)
const ctxPos = ref({ x: 0, y: 0 })
const ctxMenuEl = ref<HTMLElement | null>(null)
const ctxAdjustedX = ref(0)
const ctxAdjustedY = ref(0)

function onContextMenu(player: NearbyPlayer, e: MouseEvent): void {
  e.preventDefault()
  ctxPlayer.value = player
  ctxPos.value = { x: e.clientX, y: e.clientY }
  ctxAdjustedX.value = e.clientX
  ctxAdjustedY.value = e.clientY
  requestAnimationFrame(positionCtxMenu)
}

function closeCtxMenu(): void {
  ctxPlayer.value = null
}

function positionCtxMenu(): void {
  if (!ctxMenuEl.value) return
  const rect = ctxMenuEl.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x = ctxPos.value.x
  let y = ctxPos.value.y
  if (x + rect.width > vw) x = vw - rect.width - 4
  if (y + rect.height > vh) y = vh - rect.height - 4
  ctxAdjustedX.value = Math.max(4, x)
  ctxAdjustedY.value = Math.max(4, y)
}

function onCtxClickOutside(e: MouseEvent): void {
  if (ctxMenuEl.value && !ctxMenuEl.value.contains(e.target as Node)) {
    closeCtxMenu()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onCtxClickOutside, { capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onCtxClickOutside, { capture: true })
})

// --- Context menu options ---
interface CtxOption {
  key: string
  label: string
}

const ctxOptions = computed<CtxOption[]>(() => {
  if (!ctxPlayer.value) return []
  const opts: CtxOption[] = []
  opts.push({ key: 'inspect', label: 'Inspect' })
  if (!ctxPlayer.value.isAlive) {
    opts.push({ key: 'stabilize', label: 'Stabilize' })
  } else if (ctxPlayer.value.health < ctxPlayer.value.maxHealth) {
    opts.push({ key: 'heal', label: 'Heal' })
  }
  opts.push({ key: 'trade', label: 'Trade' })
  opts.push({ key: 'challenge', label: 'Challenge' })
  return opts
})

function handleCtxAction(key: string): void {
  closeCtxMenu()
  hudStore.addNotification('info', 'Coming Soon', `${key.charAt(0).toUpperCase() + key.slice(1)} is not yet available.`)
}

// --- Target selection ---
function onSelectTarget(player: NearbyPlayer): void {
  targetStore.setTarget(player)
}

// --- Helpers ---
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function hpPercent(player: NearbyPlayer): number {
  if (player.maxHealth <= 0) return 0
  return Math.min(100, (player.health / player.maxHealth) * 100)
}



function woundDotColor(severity: string): string {
  switch (severity) {
    case 'healthy': return '#2d8a4e'
    case 'light': return '#d4a932'
    case 'serious': return '#d48f32'
    case 'severe': return '#c42b2b'
    case 'grave': return '#8b1a1a'
    default: return '#787878'
  }
}
</script>

<template>
  <div ref="panelRef" class="target-panel panel-ornate animate-fade-in" :style="panelStyle">
    <!-- Header -->
    <div class="tw-header" @mousedown="onDragStart">
      <span class="tw-title">Nearby</span>
      <button class="tw-close" title="Close" @click="close">&times;</button>
    </div>

    <!-- Player list -->
    <div class="tw-body">
      <div v-if="proximityStore.nearbyPlayers.length === 0" class="tw-empty">
        No players nearby
      </div>
      <div
        v-for="player in proximityStore.nearbyPlayers"
        :key="player.characterId"
        class="tw-row"
        :class="{ 'tw-row--dead': !player.isAlive, 'tw-row--targeted': targetStore.target?.characterId === player.characterId }"
        @click="onSelectTarget(player)"
        @contextmenu="onContextMenu(player, $event)"
      >
        <!-- Thumbnail -->
        <div class="tw-thumb">
          <img
            v-if="player.thumbnailUrl"
            :src="player.thumbnailUrl"
            :alt="player.characterName"
            class="tw-thumb-img"
          />
          <span v-else class="tw-thumb-initials">{{ getInitials(player.characterName) }}</span>
        </div>

        <!-- Name + HP bar -->
        <div class="tw-info">
          <div class="tw-name-row">
            <span class="tw-name">{{ player.characterName }}</span>
            <span class="tw-distance">{{ player.distance }}m</span>
          </div>
          <div class="tw-hp-track">
            <div
              class="tw-hp-fill"
              :style="{
                width: hpPercent(player) + '%',
                background: hpBarColor(hpPercent(player)),
              }"
            />
          </div>
        </div>

        <!-- Wound severity dot -->
        <div
          class="tw-wound-dot"
          :style="{ background: woundDotColor(player.woundSeverity) }"
          :title="player.woundSeverity"
        />
      </div>
    </div>

    <!-- Context menu -->
    <Teleport to="#hud-popover-root">
      <div
        v-if="ctxPlayer"
        ref="ctxMenuEl"
        class="ctx-menu"
        :style="{ left: ctxAdjustedX + 'px', top: ctxAdjustedY + 'px' }"
      >
        <div class="ctx-menu__header">{{ ctxPlayer.characterName }}</div>
        <button
          v-for="opt in ctxOptions"
          :key="opt.key"
          class="ctx-menu__item"
          @click.stop="handleCtxAction(opt.key)"
        >
          {{ opt.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.target-panel {
  width: 240px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  max-height: 400px;
}

.tw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.tw-title {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tw-close {
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
.tw-close:hover {
  color: var(--color-text-bright);
}

.tw-body {
  overflow-y: auto;
  padding: var(--space-xs) 0;
  flex: 1;
}

.tw-empty {
  padding: var(--space-md);
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.tw-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.tw-row:hover {
  background: rgba(201, 168, 76, 0.06);
}
.tw-row--targeted {
  background: rgba(201, 168, 76, 0.1);
  border-left: 2px solid var(--color-gold-dim);
}
.tw-row--dead {
  opacity: 0.45;
}

/* Thumbnail */
.tw-thumb {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-border-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tw-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tw-thumb-initials {
  font-size: 8px;
  font-weight: bold;
  color: var(--color-text-dim);
  letter-spacing: 0.05em;
}

/* Info column */
.tw-info {
  flex: 1;
  min-width: 0;
}

.tw-name-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
}

.tw-name {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tw-distance {
  font-size: 9px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* HP bar */
.tw-hp-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1px;
  margin-top: 2px;
  overflow: hidden;
}
.tw-hp-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.3s ease;
}

/* Wound dot */
.tw-wound-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* Context menu */
.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 130px;
  pointer-events: auto;
  padding: 4px 0;
  background: rgba(18, 14, 10, 0.97);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}

.ctx-menu__header {
  padding: 4px 14px 6px;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--color-border-dim);
  margin-bottom: 2px;
}

.ctx-menu__item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.ctx-menu__item:hover {
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-gold-light);
}
</style>
