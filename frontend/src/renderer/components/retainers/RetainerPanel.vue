<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { useSocket } from '@/composables/useSocket'
import { hpBarColor } from '@/utils/healthColor'
import RetainerDetail from './RetainerDetail.vue'

const characterStore = useCharacterStore()
const hudStore = useHudStore()
const { dismissRetainer } = useSocket()

async function openDetail(retainerId: number): Promise<void> {
  await characterStore.fetchRetainerDetail(retainerId)
}

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('retainers', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['retainers']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const retainerCount = computed(() => characterStore.retainers.length)

function tierLabel(tier: number): string {
  const labels: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
  return labels[tier] ?? `${tier}`
}

/** Dismiss confirmation — tracks which retainer ID is pending dismissal */
const confirmDismissId = ref<number | null>(null)

function onDismissClick(retainerId: number): void {
  if (confirmDismissId.value === retainerId) {
    dismissRetainer(retainerId)
    confirmDismissId.value = null
  } else {
    confirmDismissId.value = retainerId
  }
}

function cancelDismiss(): void {
  confirmDismissId.value = null
}

onMounted(() => {
  characterStore.fetchRetainers()
})

function close(): void {
  characterStore.clearRetainerDetail()
  hudStore.toggleSystemPanel('retainers')
}
</script>

<template>
  <div class="retainer-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="retainer-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
      <!-- Header (drag handle) -->
      <div class="retainer-panel-header" @mousedown="onDragStart">
        <span class="retainer-panel-title">Retainers</span>
        <div class="retainer-panel-header-right">
          <span class="retainer-panel-count">{{ retainerCount }} / 4</span>
          <button class="retainer-panel-close" @click="close" title="Close">&times;</button>
        </div>
      </div>

      <!-- List view (when no detail is open) -->
      <template v-if="!characterStore.retainerDetail">
        <div class="retainer-panel-body">
          <div v-if="retainerCount > 0" class="retainer-list">
            <div
              v-for="ret in characterStore.retainers"
              :key="ret.id"
              class="retainer-card"
              :class="{ 'retainer-card--unavailable': !ret.isAvailable }"
            >
              <div class="retainer-card-top">
                <span class="retainer-name">{{ ret.name }}</span>
                <span class="retainer-tier">{{ tierLabel(ret.tier) }}</span>
              </div>
              <div class="retainer-card-type">{{ tierLabel(ret.tier) }} {{ ret.tierName }}</div>
              <div class="retainer-card-stats">
                <div class="retainer-hp-bar">
                  <div
                    class="retainer-hp-fill"
                    :style="{ width: `${(ret.health / ret.maxHealth) * 100}%`, background: hpBarColor((ret.health / ret.maxHealth) * 100) }"
                  />
                </div>
                <span class="retainer-hp-text">{{ Math.floor(ret.health) }}/{{ Math.floor(ret.maxHealth) }}</span>
              </div>
              <div class="retainer-card-footer">
                <span v-if="!ret.isAvailable" class="retainer-status retainer-status--wounded">Wounded</span>
                <span v-else class="retainer-status retainer-status--ready">Ready</span>
                <div class="retainer-card-actions">
                  <button
                    class="retainer-view-btn"
                    @click.stop="openDetail(ret.id)"
                  >Manage</button>
                  <button
                    class="retainer-dismiss-btn"
                    :class="{ 'retainer-dismiss-btn--confirm': confirmDismissId === ret.id }"
                    @click.stop="onDismissClick(ret.id)"
                    @mouseleave="cancelDismiss"
                  >
                    {{ confirmDismissId === ret.id ? 'Confirm?' : 'Dismiss' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="retainer-empty">
            <span class="retainer-empty-text">No retainers in service.</span>
            <span class="retainer-empty-hint">Visit the Retainer Captain to hire fighters.</span>
          </div>
        </div>
      </template>

      <!-- Detail view -->
      <template v-else>
        <RetainerDetail />
      </template>
    </div>
  </div>
</template>

<style scoped>
.retainer-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  pointer-events: none;
}

.retainer-panel {
  width: 360px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.retainer-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.retainer-panel-header:active {
  cursor: grabbing;
}

.retainer-panel-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.retainer-panel-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.retainer-panel-count {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.retainer-panel-close {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.retainer-panel-close:hover { color: var(--color-text); }

.retainer-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

/* ========= Retainer cards (matches CharacterPanel retainer tab) ========= */

.retainer-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.retainer-card {
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
  transition: all var(--transition-fast);
}

.retainer-card:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.retainer-card--unavailable {
  opacity: 0.6;
  border-color: var(--color-crimson-dark);
}

.retainer-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.retainer-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.retainer-tier {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  letter-spacing: 0.1em;
}

.retainer-card-type {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.retainer-card-stats {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.retainer-hp-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.retainer-hp-fill {
  height: 100%;
  border-radius: 2px;
  transition: width var(--transition-normal);
}

.retainer-hp-text {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  min-width: 48px;
  text-align: right;
}

.retainer-card-footer {
  margin-top: var(--space-xs);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.retainer-status {
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.retainer-status--ready {
  color: var(--color-success);
}

.retainer-status--wounded {
  color: var(--color-crimson-light);
}

.retainer-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.retainer-view-btn {
  padding: 1px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.retainer-view-btn:hover {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.06);
}

.retainer-dismiss-btn {
  padding: 1px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.retainer-dismiss-btn:hover {
  border-color: rgba(139, 26, 26, 0.4);
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.06);
}

.retainer-dismiss-btn--confirm {
  border-color: rgba(139, 26, 26, 0.6);
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.1);
}

/* Empty state */
.retainer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 200px;
}

.retainer-empty-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.retainer-empty-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}
</style>
