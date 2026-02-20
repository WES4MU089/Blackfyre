<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useCreationStore } from '@/stores/creation'
import { useSocket } from '@/composables/useSocket'
import { useItemDrag } from '@/composables/useItemDrag'
import { startAutoClickThrough, stopAutoClickThrough } from '@/composables/useAutoClickThrough'
import TopBar from '@/components/hud/TopBar.vue'
import CharacterInfo from '@/components/hud/CharacterInfo.vue'
import StatusEffects from '@/components/hud/StatusEffects.vue'
import Notifications from '@/components/hud/Notifications.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import InventoryPanel from '@/components/hud/InventoryPanel.vue'
import CharacterPanel from '@/components/hud/CharacterPanel.vue'
import WikiPanel from '@/components/hud/WikiPanel.vue'
import DragGhost from '@/components/hud/DragGhost.vue'
import DraggableArea from '@/components/hud/DraggableArea.vue'
import BottomBar from '@/components/hud/BottomBar.vue'
import SLLinkingModal from '@/components/modals/SLLinkingModal.vue'
import CharacterCreation from '@/components/creation/CharacterCreation.vue'
import CombatLobby from '@/components/combat/CombatLobby.vue'
import CombatSession from '@/components/combat/CombatSession.vue'
import NPCDialog from '@/components/npc/NPCDialog.vue'
import ShopPanel from '@/components/shop/ShopPanel.vue'
import RetainerPanel from '@/components/retainers/RetainerPanel.vue'
import RetainerHire from '@/components/retainers/RetainerHire.vue'
import { useCombatStore } from '@/stores/combat'
import { useNpcDialogStore } from '@/stores/npcDialog'
import { useShopStore } from '@/stores/shop'
import { useChatStore } from '@/stores/chat'
import '@/styles/hud.css'

const authStore = useAuthStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()
const creationStore = useCreationStore()
const combatStore = useCombatStore()
const npcDialogStore = useNpcDialogStore()
const shopStore = useShopStore()
const chatStore = useChatStore()
const { connect } = useSocket()
const { isDragging: isItemDragging, cancelDrag } = useItemDrag()

// Global safety: cancel drag if mouseup happens without a valid drop target
function onGlobalMouseUp(): void {
  if (isItemDragging.value) {
    cancelDrag()
  }
}

onMounted(() => {
  document.addEventListener('mouseup', onGlobalMouseUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onGlobalMouseUp)
  stopAutoClickThrough()
})

const ready = ref(false)

onMounted(async () => {
  // Load token from storage (HUD runs in a separate renderer process)
  await authStore.loadStoredToken()

  // Connect to backend via Socket.IO
  if (authStore.token) {
    connect(authStore.token)
  }

  // Start auto click-through detection
  startAutoClickThrough()

  // Listen for layout edit mode toggle from main process (F4)
  window.electronAPI.onLayoutEditModeChanged((enabled) => {
    hudStore.setLayoutEditMode(enabled)
  })

  // Load saved HUD positions
  const savedPositions = await window.electronAPI.loadHudLayout()
  if (savedPositions) {
    hudStore.loadLayout(savedPositions)
  }

  // Restore panel open/closed states
  const savedPanelStates = await window.electronAPI.loadPanelStates()
  if (savedPanelStates) {
    hudStore.loadPanelStates(savedPanelStates)
    if (savedPanelStates.chat?.open) {
      chatStore.isOpen = true
      chatStore.isMinimized = savedPanelStates.chat.minimized ?? false
    }
  }

  ready.value = true
})
</script>

<template>
  <div v-if="ready" class="hud-root">
    <!-- Top Bar: Title + System Navigation -->
    <div class="hud-area-topbar">
      <TopBar />
    </div>

    <!-- Main HUD overlay area -->
    <div class="hud-container" :class="{ 'layout-edit-active': hudStore.layoutEditMode }">
      <DraggableArea area-id="char-info" label="Character" class="hud-area-char-info">
        <CharacterInfo />
      </DraggableArea>

      <DraggableArea area-id="chat" label="Chat" class="hud-area-chat" always-draggable v-slot="{ dragStart }">
        <ChatPanel :on-drag-start="dragStart" />
      </DraggableArea>

      <DraggableArea area-id="notifications" label="Notifications" class="hud-area-notifications">
        <Notifications />
      </DraggableArea>

      <DraggableArea area-id="effects" label="Effects" class="hud-area-effects">
        <StatusEffects />
      </DraggableArea>

    </div>

    <!-- Character Creation Wizard -->
    <CharacterCreation v-if="creationStore.isOpen" />

    <!-- SL Account Linking Modal -->
    <SLLinkingModal v-if="hudStore.slLinkingCode" />

    <!-- NPC Dialog -->
    <NPCDialog v-if="npcDialogStore.isOpen" />

    <!-- Shop / Trade Panel -->
    <ShopPanel v-if="shopStore.isOpen" />

    <!-- Retainer Hire Wizard (opens from NPC dialog or panel) -->
    <RetainerHire v-if="characterStore.isHiringRetainer" />

    <!-- System panel overlay -->
    <div v-if="hudStore.openSystemPanels.size > 0 || combatStore.activeView !== 'none'" class="hud-system-overlay">
      <InventoryPanel v-if="hudStore.isPanelOpen('inventory')" />
      <CharacterPanel v-if="hudStore.isPanelOpen('character')" />
      <WikiPanel v-if="hudStore.isPanelOpen('wiki')" />
      <RetainerPanel v-if="hudStore.isPanelOpen('retainers')" />
      <CombatLobby v-if="hudStore.isPanelOpen('combat') && combatStore.activeView !== 'combat'" />
      <CombatSession v-if="combatStore.activeView === 'combat'" />
    </div>

    <!-- Drag ghost (follows cursor during item drag) -->
    <DragGhost v-if="isItemDragging" />

    <!-- Bottom Bar: Status footer -->
    <div class="hud-area-bottombar">
      <BottomBar />
    </div>

    <!-- Layout edit mode banner -->
    <div v-if="hudStore.layoutEditMode" class="layout-edit-banner animate-fade-in">
      <span class="interact-dot" />
      LAYOUT EDIT MODE
      <span class="interact-hint">Drag widgets to reposition. F4 to save.</span>
    </div>

  </div>
</template>

<style scoped>
/* Make #app transparent to pointer events so elementFromPoint only hits
   real interactive children (topbar, bottombar, panels).  This is scoped to
   the HUD window — the Login window has its own renderer and is unaffected. */
:global(#app) {
  pointer-events: none;
}

.hud-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.hud-area-topbar {
  flex-shrink: 0;
  pointer-events: auto;
}

.hud-area-bottombar {
  flex-shrink: 0;
  pointer-events: auto;
}

.hud-system-overlay {
  position: fixed;
  top: 76px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: var(--space-xl);
  pointer-events: none;
  z-index: 100;
}

.layout-edit-banner {
  position: fixed;
  top: 82px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: rgba(139, 26, 26, 0.9);
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  letter-spacing: 0.15em;
  pointer-events: none;
  z-index: 9999;
  text-transform: uppercase;
}

.interact-hint {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
  margin-left: var(--space-xs);
}

.interact-dot {
  width: 6px;
  height: 6px;
  background: var(--color-gold);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}
</style>
