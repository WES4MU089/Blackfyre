<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'
import { useHudStore } from '@/stores/hud'
import ApplicationQueue from './ApplicationQueue.vue'
import ApplicationReview from './ApplicationReview.vue'
import FamilyTreeAdmin from './FamilyTreeAdmin.vue'
import OrganizationAdmin from './OrganizationAdmin.vue'
import FactionAdmin from './FactionAdmin.vue'
import AuditLogViewer from './AuditLogViewer.vue'

type AdminTab = 'applications' | 'family-trees' | 'organizations' | 'factions' | 'audit-log'

interface TabDef {
  id: AdminTab
  label: string
  perm?: string
}

const ALL_TABS: TabDef[] = [
  { id: 'applications', label: 'Apps' },
  { id: 'family-trees', label: 'Trees', perm: 'family_tree.approve_suggestions' },
  { id: 'organizations', label: 'Orgs', perm: 'content.manage_organizations' },
  { id: 'factions', label: 'Factions', perm: 'content.manage_factions' },
  { id: 'audit-log', label: 'Audit', perm: 'system.view_audit_log' },
]

const adminStore = useAdminStore()
const authStore = useAuthStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const activeTab = ref<AdminTab>('applications')
const { isDragging, onDragStart } = useDraggable('admin', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'admin', panelRef,
  { minWidth: 400, maxWidth: 1000, minHeight: 300, maxHeight: 900 },
)

const visibleTabs = computed(() =>
  ALL_TABS.filter(t => !t.perm || authStore.hasPermission(t.perm))
)

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['admin']
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  return { position: 'fixed' as const, right: '20px', top: '90px' }
})

const sizeStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))

function close() {
  adminStore.closePanel()
}
</script>

<template>
  <div class="admin-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="admin-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing }"
      :style="sizeStyle"
    >
      <!-- Header -->
      <div class="admin-header" @mousedown="onDragStart">
        <span class="admin-header-title">Staff Panel</span>
        <button class="admin-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Tab bar -->
      <div class="admin-tabs">
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          class="admin-tab"
          :class="{ 'admin-tab--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Body -->
      <div class="admin-body">
        <template v-if="activeTab === 'applications'">
          <ApplicationQueue v-if="adminStore.activeView === 'queue'" />
          <ApplicationReview v-if="adminStore.activeView === 'detail'" />
        </template>
        <FamilyTreeAdmin v-if="activeTab === 'family-trees'" />
        <OrganizationAdmin v-if="activeTab === 'organizations'" />
        <FactionAdmin v-if="activeTab === 'factions'" />
        <AuditLogViewer v-if="activeTab === 'audit-log'" />
      </div>

      <!-- Resize handle -->
      <div class="admin-resize-handle" @mousedown="onResizeStart">
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
.admin-panel-wrapper {
  pointer-events: none;
}

.admin-panel {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: relative;
}

.admin-panel.is-dragging,
.admin-panel.is-resizing {
  z-index: 1000;
}

/* Header */
.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.admin-header:active {
  cursor: grabbing;
}

.admin-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.admin-close {
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

.admin-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Tabs */
.admin-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.admin-tab {
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
  white-space: nowrap;
}

.admin-tab:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.admin-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

/* Body */
.admin-body {
  padding: var(--space-sm) 0;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

/* Resize handle */
.admin-resize-handle {
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

.admin-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
