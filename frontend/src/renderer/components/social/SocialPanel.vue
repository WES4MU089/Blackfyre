<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSocialStore, type SocialView } from '@/stores/social'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'
import { useHudStore } from '@/stores/hud'
import RegionList from './RegionList.vue'
import RegionDetail from './RegionDetail.vue'
import HouseDetail from './HouseDetail.vue'
import OrganizationList from './OrganizationList.vue'
import OrganizationDetail from './OrganizationDetail.vue'
import FactionList from './FactionList.vue'
import FactionDetail from './FactionDetail.vue'

const socialStore = useSocialStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('social', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'social', panelRef,
  { minWidth: 420, maxWidth: 850, minHeight: 350, maxHeight: 850 },
)

interface SocialTab {
  id: SocialView
  label: string
}

const tabs: SocialTab[] = [
  { id: 'regions', label: 'Regions' },
  { id: 'organizations', label: 'Orgs' },
  { id: 'factions', label: 'Factions' },
]

const activeRootTab = computed(() => {
  const view = socialStore.currentView
  if (view === 'regions' || view === 'region-detail' || view === 'house-detail') return 'regions'
  if (view === 'organizations' || view === 'org-detail') return 'organizations'
  if (view === 'factions' || view === 'faction-detail') return 'factions'
  return 'regions'
})

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['social']
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  return { position: 'fixed' as const, left: '20px', top: '90px' }
})

const sizeStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))

function switchTab(tabId: SocialView): void {
  socialStore.switchRootTab(tabId)
  if (tabId === 'organizations') socialStore.fetchOrganizations()
  if (tabId === 'factions') socialStore.fetchFactions()
}

function close(): void {
  socialStore.closePanel()
}
</script>

<template>
  <div class="social-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="social-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing }"
      :style="sizeStyle"
    >
      <!-- Header -->
      <div class="social-header" @mousedown="onDragStart">
        <div class="social-header-left">
          <button
            v-if="socialStore.canGoBack"
            class="social-back"
            title="Back"
            @click.stop="socialStore.goBack()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="social-header-title">Social</span>
        </div>
        <button class="social-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Tab bar -->
      <div class="social-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="social-tab"
          :class="{ 'social-tab--active': activeRootTab === tab.id }"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Body -->
      <div class="social-body">
        <div v-if="socialStore.isLoading" class="social-loading">Loading...</div>
        <template v-else>
          <RegionList v-if="socialStore.currentView === 'regions'" />
          <RegionDetail v-if="socialStore.currentView === 'region-detail'" />
          <HouseDetail v-if="socialStore.currentView === 'house-detail'" />
          <OrganizationList v-if="socialStore.currentView === 'organizations'" />
          <OrganizationDetail v-if="socialStore.currentView === 'org-detail'" />
          <FactionList v-if="socialStore.currentView === 'factions'" />
          <FactionDetail v-if="socialStore.currentView === 'faction-detail'" />
        </template>
      </div>

      <!-- Resize handle -->
      <div class="social-resize-handle" @mousedown="onResizeStart">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
          <circle cx="10" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="6" r="1.2" />
          <circle cx="10" cy="2" r="1.2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.social-panel-wrapper {
  pointer-events: none;
}

.social-panel {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: relative;
}

.social-panel.is-dragging,
.social-panel.is-resizing {
  z-index: 1000;
}

/* Header */
.social-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.social-header:active {
  cursor: grabbing;
}

.social-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.social-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-dim);
  transition: all var(--transition-fast);
}

.social-back:hover {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
}

.social-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.social-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.social-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Tabs */
.social-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.social-tab {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}

.social-tab:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.social-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

/* Body */
.social-body {
  padding: var(--space-sm);
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.social-loading {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Resize handle */
.social-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-text-muted);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.social-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
