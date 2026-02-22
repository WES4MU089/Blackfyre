<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useCharacterStore, type EquippedItem, type InventoryItem } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useCreationStore } from '@/stores/creation'
import { useAilmentsStore } from '@/stores/ailments'
import { useDraggable } from '@/composables/useDraggable'
import { useSocket } from '@/composables/useSocket'
import { useItemDrag, type DragPayload } from '@/composables/useItemDrag'
import EquipmentSlot from './EquipmentSlot.vue'
import AptitudeBar from './AptitudeBar.vue'
import ItemTooltip from './ItemTooltip.vue'
import ItemContextMenu from './ItemContextMenu.vue'
import StatsPanel from './StatsPanel.vue'
import HealthPanel from './HealthPanel.vue'
import paperdollImg from '@res/images/art/paperdoll.png'

const characterStore = useCharacterStore()
const hudStore = useHudStore()
const creationStore = useCreationStore()
const ailmentsStore = useAilmentsStore()
const { selectCharacter, requestCharacterList, requestTemplates, dismissRetainer, deleteCharacter, allocateAptitude } = useSocket()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('character', panelRef, { alwaysDraggable: true })

const activeTab = ref<'equipment' | 'retainer' | 'health'>('equipment')
const showStats = ref(false)
const showHealth = computed(() => activeTab.value === 'health')

function toggleStats() {
  showStats.value = !showStats.value
}

// Fetch ailments when Health tab is activated
watch(activeTab, (tab) => {
  if (tab === 'health' && characterStore.character?.id) {
    ailmentsStore.fetchAilments(characterStore.character.id)
  }
})

/** Character switcher dropdown */
const showCharacterDropdown = ref(false)

function toggleCharacterDropdown() {
  if (!showCharacterDropdown.value) {
    requestCharacterList()
  }
  showCharacterDropdown.value = !showCharacterDropdown.value
}

function switchCharacter(characterId: number) {
  selectCharacter(characterId)
  showCharacterDropdown.value = false
}

function openCreationWizard() {
  showCharacterDropdown.value = false
  creationStore.open()
  requestTemplates()
}

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['character']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const characterName = computed(() => characterStore.character?.name ?? 'Unknown')

const otherCharacters = computed(() =>
  characterStore.characterList.filter(c => c.id !== characterStore.character?.id)
)

function isPlayable(status?: string): boolean {
  return !status || status === 'none' || status === 'approved'
}

function statusLabel(status?: string): string | null {
  if (!status || status === 'none' || status === 'approved') return null
  const labels: Record<string, string> = { pending: 'Pending', denied: 'Denied', revision: 'Revision' }
  return labels[status] ?? null
}

/** Character deletion */
const deleteTarget = ref<{ id: number; name: string } | null>(null)
const deleteConfirmInput = ref('')
const deleteConfirmValid = computed(() =>
  deleteTarget.value != null && deleteConfirmInput.value === deleteTarget.value.name
)

function promptDelete(characterId: number, characterName: string) {
  deleteTarget.value = { id: characterId, name: characterName }
  deleteConfirmInput.value = ''
  showCharacterDropdown.value = false
}

function promptDeleteCurrent() {
  if (!characterStore.character) return
  promptDelete(characterStore.character.id, characterStore.character.name)
}

function confirmDelete() {
  if (!deleteTarget.value || !deleteConfirmValid.value) return
  deleteCharacter(deleteTarget.value.id, deleteConfirmInput.value)
  deleteTarget.value = null
  deleteConfirmInput.value = ''
}

function cancelDelete() {
  deleteTarget.value = null
  deleteConfirmInput.value = ''
}

onMounted(() => {
  requestCharacterList()
})

/** Equipment slot definitions — flanking paperdoll with armor centered */
const leftSlots = [
  { id: 'mainHand',   label: 'Main\nHand' },
  { id: 'accessory1', label: 'Accessory' },
  { id: 'ancillary1', label: 'Ancillary' },
] as const

const rightSlots = [
  { id: 'offHand',    label: 'Off\nHand' },
  { id: 'accessory2', label: 'Accessory' },
  { id: 'ancillary2', label: 'Ancillary' },
] as const

/** Ordered aptitude layout — left column, then right column */
const aptitudeOrder = [
  { col: 'left',  ids: ['prowess', 'command', 'stewardship', 'lore'] },
  { col: 'right', ids: ['fortitude', 'cunning', 'presence', 'faith'] },
] as const

const leftAptitudes = computed(() =>
  characterStore.aptitudes.filter(a => aptitudeOrder[0].ids.includes(a.id as any))
)

const rightAptitudes = computed(() =>
  characterStore.aptitudes.filter(a => aptitudeOrder[1].ids.includes(a.id as any))
)

const retainerCount = computed(() => characterStore.retainers.length)

const woundBadgeClass = computed(() => {
  const sev = ailmentsStore.woundSeverity
  if (sev === 'healthy' && ailmentsStore.ailments.length === 0) return ''
  return `health-badge--${sev}`
})

/** Tier label for display */
function tierLabel(tier: number): string {
  const labels: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
  return labels[tier] ?? `${tier}`
}

/** Dismiss confirmation — tracks which retainer ID is pending dismissal */
const confirmDismissId = ref<number | null>(null)

function onDismissClick(retainerId: number): void {
  if (confirmDismissId.value === retainerId) {
    // Second click = confirm
    dismissRetainer(retainerId)
    confirmDismissId.value = null
  } else {
    // First click = show confirm state
    confirmDismissId.value = retainerId
  }
}

function cancelDismiss(): void {
  confirmDismissId.value = null
}

const { isDragging: isItemDragging, dragPayload } = useItemDrag()

// --- Equipment tooltip state ---
const tooltipItem = ref<EquippedItem | InventoryItem | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

function onEquipHoverStart(item: EquippedItem, e: MouseEvent): void {
  tooltipItem.value = item
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onEquipHoverMove(e: MouseEvent): void {
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onEquipHoverEnd(): void {
  tooltipItem.value = null
}

// --- Equipment context menu state ---
const ctxItem = ref<EquippedItem | null>(null)
const ctxPos = ref({ x: 0, y: 0 })

function onEquipContextMenu(item: EquippedItem, e: MouseEvent): void {
  tooltipItem.value = null
  ctxItem.value = item
  ctxPos.value = { x: e.clientX, y: e.clientY }
}

function closeContextMenu(): void {
  ctxItem.value = null
}

async function onContextAction(action: string): Promise<void> {
  if (!ctxItem.value) return
  const item = ctxItem.value
  closeContextMenu()

  switch (action) {
    case 'unequip':
      await characterStore.unequipItem(item.slotId)
      break
    case 'inspect':
      console.log('Inspect:', item)
      break
  }
}

// --- Drop handling on equipment slots ---
async function onEquipDrop(slotId: string, payload: DragPayload): Promise<void> {
  if (payload.source === 'inventory' && payload.inventoryItem) {
    await characterStore.equipItem(payload.inventoryItem.inventory_id, slotId)
  }
}

function close() {
  hudStore.toggleSystemPanel('character')
}
</script>

<template>
  <div class="char-panel-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="char-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
    <!-- Header (drag handle) -->
    <div class="char-header" @mousedown="onDragStart">
      <span class="char-header-title">Character</span>
      <div class="char-header-actions">
        <button
          class="char-stats-toggle"
          :class="{ 'char-stats-toggle--active': showStats }"
          title="Toggle detailed stats"
          @click.stop="toggleStats"
        >
          Stats
        </button>
        <button class="char-close" @click="close" title="Close">&times;</button>
      </div>
    </div>

    <!-- Character identity + switcher + level + HP -->
    <div class="char-identity">
      <!-- Character name with dropdown toggle -->
      <div class="char-name-row">
        <button class="char-name-btn" @click="toggleCharacterDropdown" title="Switch character">
          <span class="char-name">{{ characterName }}</span>
          <span class="char-name-arrow" :class="{ 'char-name-arrow--open': showCharacterDropdown }">&#9662;</span>
        </button>
      </div>

      <!-- Character switcher dropdown -->
      <Transition name="dropdown-fade">
        <div v-if="showCharacterDropdown" class="char-dropdown">
          <div class="char-dropdown-label">Switch Character</div>
          <div
            v-for="c in otherCharacters"
            :key="c.id"
            class="char-dropdown-row"
          >
            <button
              class="char-dropdown-item"
              :class="{ 'char-dropdown-item--disabled': !isPlayable(c.application_status) }"
              :disabled="!isPlayable(c.application_status)"
              @click="isPlayable(c.application_status) && switchCharacter(c.id)"
            >
              <span class="char-dropdown-name">{{ c.name }}</span>
              <span v-if="statusLabel(c.application_status)" class="char-dropdown-status" :class="`char-dropdown-status--${c.application_status}`">
                {{ statusLabel(c.application_status) }}
              </span>
              <span v-else class="char-dropdown-level">Lv {{ c.level }}</span>
            </button>
            <button
              class="char-dropdown-delete"
              title="Delete character"
              @click.stop="promptDelete(c.id, c.name)"
            >
              &times;
            </button>
          </div>
          <div v-if="otherCharacters.length === 0" class="char-dropdown-empty">
            No other characters
          </div>
          <button class="char-dropdown-item char-dropdown-create" @click="openCreationWizard">
            + New Character
          </button>
          <button class="char-dropdown-item char-dropdown-delete-current" @click="promptDeleteCurrent">
            Delete Current Character
          </button>
        </div>
      </Transition>

      <!-- Delete confirmation modal -->
      <Transition name="dropdown-fade">
        <div v-if="deleteTarget" class="char-delete-overlay" @click.self="cancelDelete">
          <div class="char-delete-modal">
            <div class="char-delete-title">Delete Character</div>
            <p class="char-delete-warning">
              This will <strong>permanently</strong> delete
              <span class="char-delete-name">{{ deleteTarget.name }}</span>
              and all associated data. This cannot be undone.
            </p>
            <label class="char-delete-label">
              Type the character's full name to confirm:
            </label>
            <input
              v-model="deleteConfirmInput"
              class="char-delete-input"
              type="text"
              :placeholder="deleteTarget.name"
              spellcheck="false"
              autocomplete="off"
            />
            <div class="char-delete-actions">
              <button class="char-delete-cancel" @click="cancelDelete">Cancel</button>
              <button
                class="char-delete-confirm"
                :disabled="!deleteConfirmValid"
                @click="confirmDelete"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Level + XP segment bar -->
      <div class="char-level-row">
        <span class="char-level-label">Level {{ characterStore.level }}</span>
        <div class="char-xp-segments">
          <div
            v-for="i in characterStore.segmentsPerLevel"
            :key="i"
            class="char-xp-seg"
            :class="{ 'char-xp-seg--filled': i <= characterStore.xpSegments }"
          />
        </div>
        <span class="char-xp-text">{{ characterStore.xpSegments }}/{{ characterStore.segmentsPerLevel }}</span>
      </div>

      <!-- HP bar -->
      <div class="char-hp-row">
        <span class="char-hp-label">HP</span>
        <div class="char-hp-track">
          <div
            class="char-hp-fill"
            :class="{ 'char-hp-fill--critical': characterStore.isCriticalHealth }"
            :style="{ width: `${characterStore.healthPercent}%` }"
          />
        </div>
        <span class="char-hp-text">{{ Math.floor(characterStore.vitals.health) }} / {{ Math.floor(characterStore.vitals.maxHealth) }}</span>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="char-tabs">
      <button
        class="char-tab"
        :class="{ 'char-tab--active': activeTab === 'equipment' }"
        @click="activeTab = 'equipment'"
      >
        Equipment
      </button>
      <button
        class="char-tab"
        :class="{ 'char-tab--active': activeTab === 'retainer' }"
        @click="activeTab = 'retainer'"
      >
        Retainers
        <span class="retainer-count">{{ retainerCount }}/4</span>
      </button>
      <button
        class="char-tab"
        :class="{ 'char-tab--active': activeTab === 'health' }"
        @click="activeTab = 'health'"
      >
        Health
        <span v-if="woundBadgeClass" class="health-badge" :class="woundBadgeClass">&bull;</span>
      </button>
    </div>

    <!-- Equipment tab -->
    <template v-if="activeTab === 'equipment'">
      <!-- Paperdoll + Equipment section -->
      <div class="char-paperdoll-area">
        <!-- Dimmed paperdoll background image -->
        <img :src="paperdollImg" alt="" class="paperdoll-image" draggable="false" />

        <!-- Equipment slots flanking the paperdoll, armor centered -->
        <div class="equip-layout">
          <div class="equip-col">
            <EquipmentSlot
              v-for="slot in leftSlots"
              :key="slot.id"
              :slot-id="slot.id"
              :slot-label="slot.label"
              :item="characterStore.equipment[slot.id] ?? null"
              @hover-start="onEquipHoverStart"
              @hover-move="onEquipHoverMove"
              @hover-end="onEquipHoverEnd"
              @context-menu="onEquipContextMenu"
              @drop="onEquipDrop"
            />
          </div>
          <div class="equip-center">
            <EquipmentSlot
              slot-id="armor"
              slot-label="Armor"
              :item="characterStore.equipment['armor'] ?? null"
              @hover-start="onEquipHoverStart"
              @hover-move="onEquipHoverMove"
              @hover-end="onEquipHoverEnd"
              @context-menu="onEquipContextMenu"
              @drop="onEquipDrop"
            />
          </div>
          <div class="equip-col">
            <EquipmentSlot
              v-for="slot in rightSlots"
              :key="slot.id"
              :slot-id="slot.id"
              :slot-label="slot.label"
              :item="characterStore.equipment[slot.id] ?? null"
              @hover-start="onEquipHoverStart"
              @hover-move="onEquipHoverMove"
              @hover-end="onEquipHoverEnd"
              @context-menu="onEquipContextMenu"
              @drop="onEquipDrop"
            />
          </div>
        </div>
      </div>

      <!-- Aptitudes section -->
      <div class="char-aptitudes">
        <div class="aptitudes-label">Aptitudes</div>

        <!-- Unspent points banner -->
        <div v-if="characterStore.unspentAptitudePoints > 0" class="unspent-banner">
          <span class="unspent-tag">
            {{ characterStore.unspentAptitudePoints }} aptitude {{ characterStore.unspentAptitudePoints === 1 ? 'point' : 'points' }}
          </span>
        </div>

        <div class="aptitudes-grid">
          <div class="aptitudes-col">
            <div v-for="apt in leftAptitudes" :key="apt.id" class="aptitude-group">
              <AptitudeBar
                :name="apt.name"
                :value="apt.currentValue"
                :show-plus="characterStore.unspentAptitudePoints > 0"
                @allocate="allocateAptitude(apt.id)"
              />
            </div>
          </div>
          <div class="aptitudes-col">
            <div v-for="apt in rightAptitudes" :key="apt.id" class="aptitude-group">
              <AptitudeBar
                :name="apt.name"
                :value="apt.currentValue"
                :show-plus="characterStore.unspentAptitudePoints > 0"
                @allocate="allocateAptitude(apt.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Health tab -->
    <template v-if="activeTab === 'health'">
      <div class="health-area">
        <div v-if="ailmentsStore.woundSeverity === 'healthy' && ailmentsStore.ailments.length === 0" class="health-area-empty">
          <span class="health-area-empty-text">No wounds or ailments</span>
          <span class="health-area-empty-hint">See detailed status in the panel to the right</span>
        </div>
        <template v-else>
          <div class="health-summary">
            <div class="health-summary-row">
              <span class="health-summary-label">Wound Status</span>
              <span class="wound-severity-tag" :class="`wound-severity-tag--${ailmentsStore.woundSeverity}`">
                {{ ailmentsStore.woundSeverity }}
              </span>
            </div>
            <div v-if="ailmentsStore.ailments.length > 0" class="health-summary-row">
              <span class="health-summary-label">Active Ailments</span>
              <span class="health-summary-value">{{ ailmentsStore.ailments.length }}</span>
            </div>
            <div v-for="a in ailmentsStore.ailments" :key="a.id" class="health-ailment-brief">
              <span class="health-ailment-name">{{ a.name }}</span>
              <span class="health-ailment-stage">Stage {{ a.currentStage }}: {{ a.stageName }}</span>
            </div>
          </div>
          <div class="health-area-hint">See detailed timers in the panel to the right</div>
        </template>
      </div>
    </template>

    <!-- Retainer tab -->
    <template v-if="activeTab === 'retainer'">
      <div class="retainer-area">
        <div class="retainer-header-row">
          <span class="retainer-label">Retainers</span>
          <span class="retainer-cap">{{ retainerCount }} / 4</span>
        </div>

        <!-- Retainer list -->
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
                  :style="{ width: `${(ret.health / ret.maxHealth) * 100}%` }"
                />
              </div>
              <span class="retainer-hp-text">{{ Math.floor(ret.health) }}/{{ Math.floor(ret.maxHealth) }}</span>
            </div>
            <div class="retainer-card-footer">
              <span v-if="!ret.isAvailable" class="retainer-status retainer-status--wounded">Wounded</span>
              <span v-else class="retainer-status retainer-status--ready">Ready</span>
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

        <!-- Empty state -->
        <div v-else class="retainer-empty">
          <span class="retainer-empty-text">No retainers in service.</span>
          <span class="retainer-empty-hint">Visit the Retainer Captain to hire fighters.</span>
        </div>
      </div>
    </template>
    </div>

    <!-- Stats side panel -->
    <Transition name="stats-slide">
      <StatsPanel v-if="showStats" />
    </Transition>

    <!-- Health side panel -->
    <Transition name="health-slide">
      <HealthPanel v-if="showHealth" />
    </Transition>
  </div>

  <!-- Equipment tooltip (teleported to body) -->
  <ItemTooltip
    v-if="tooltipItem && !isItemDragging"
    :item="tooltipItem"
    :x="tooltipPos.x"
    :y="tooltipPos.y"
  />

  <!-- Equipment context menu (teleported to body) -->
  <ItemContextMenu
    v-if="ctxItem"
    :item="ctxItem"
    source="equipment"
    :x="ctxPos.x"
    :y="ctxPos.y"
    @action="onContextAction"
    @close="closeContextMenu"
  />
</template>

<style scoped>
/* Wrapper for char-panel + stats side panel */
.char-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  pointer-events: none;
}

.char-panel {
  width: 440px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.char-panel.is-dragging {
  z-index: 1000;
}

/* Header (drag handle) */
.char-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.char-header:active {
  cursor: grabbing;
}

.char-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.char-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.char-stats-toggle {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.char-stats-toggle:hover {
  color: var(--color-gold-dim);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.06);
}

.char-stats-toggle--active {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
}

/* Slide transition for stats panel */
.stats-slide-enter-active,
.stats-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.stats-slide-enter-from,
.stats-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.char-close {
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

.char-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Character identity */
.char-identity {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.char-name-row {
  display: flex;
  justify-content: center;
}

.char-name-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.char-name-btn:hover {
  background: var(--color-surface-hover);
}

.char-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.08em;
}

.char-name-arrow {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.char-name-arrow--open {
  transform: rotate(180deg);
}

/* Character switcher dropdown */
.char-dropdown {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.char-dropdown-label {
  font-family: var(--font-display);
  font-size: 8px;
  color: var(--color-text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
}

.char-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 4px 8px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.char-dropdown-item:hover {
  background: var(--color-surface-hover);
}

.char-dropdown-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.char-dropdown-level {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
}

.char-dropdown-empty {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  font-style: italic;
  padding: 4px 8px;
  text-align: center;
}

.char-dropdown-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.char-dropdown-item--disabled:hover {
  background: none;
}

.char-dropdown-status {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
}

.char-dropdown-status--pending {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.15);
}

.char-dropdown-status--denied {
  color: var(--color-crimson-light);
  background: rgba(139, 26, 26, 0.15);
}

.char-dropdown-status--revision {
  color: #c87830;
  background: rgba(200, 120, 48, 0.15);
}

.char-dropdown-create {
  border-top: 1px solid var(--color-border-dim);
  margin-top: 2px;
  color: var(--color-gold-dark);
  font-family: var(--font-display);
  letter-spacing: 0.06em;
}

.char-dropdown-create:hover {
  color: var(--color-gold);
}

/* Dropdown row with delete button */
.char-dropdown-row {
  display: flex;
  align-items: center;
  gap: 0;
}

.char-dropdown-row .char-dropdown-item {
  flex: 1;
  min-width: 0;
}

.char-dropdown-delete {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  color: var(--color-crimson-light, #b33);
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all var(--transition-fast);
}

.char-dropdown-row:hover .char-dropdown-delete {
  opacity: 0.7;
}

.char-dropdown-delete:hover {
  opacity: 1 !important;
  background: rgba(139, 26, 26, 0.2);
  color: #e44;
}

/* Delete current character button */
.char-dropdown-delete-current {
  border-top: 1px solid var(--color-border-dim);
  margin-top: 2px;
  color: var(--color-crimson-light, #b33);
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.06em;
  opacity: 0.7;
}

.char-dropdown-delete-current:hover {
  opacity: 1;
  color: #e44;
  background: rgba(139, 26, 26, 0.15);
}

/* Delete confirmation modal */
.char-delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.char-delete-modal {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-crimson-light, #b33);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.char-delete-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-crimson-light, #b33);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.char-delete-warning {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 0;
}

.char-delete-name {
  color: var(--color-gold);
  font-family: var(--font-display);
}

.char-delete-label {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.char-delete-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.06em;
  outline: none;
  transition: border-color var(--transition-fast);
}

.char-delete-input:focus {
  border-color: var(--color-crimson-light, #b33);
}

.char-delete-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.char-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.char-delete-cancel {
  padding: 5px 14px;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.char-delete-cancel:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.char-delete-confirm {
  padding: 5px 14px;
  background: rgba(139, 26, 26, 0.3);
  border: 1px solid var(--color-crimson-light, #b33);
  border-radius: var(--radius-sm);
  color: var(--color-crimson-light, #b33);
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.char-delete-confirm:hover:not(:disabled) {
  background: rgba(139, 26, 26, 0.5);
  color: #e44;
}

.char-delete-confirm:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Dropdown transition */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all var(--transition-fast);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Level + XP bar */
.char-level-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.char-level-label {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
  min-width: 52px;
  text-align: left;
}

.char-xp-segments {
  flex: 1;
  display: flex;
  gap: 2px;
}

.char-xp-seg {
  flex: 1;
  height: 10px;
  background: rgba(147, 112, 219, 0.08);
  border: 1px solid rgba(147, 112, 219, 0.15);
  border-radius: 1px;
  transition: all 300ms ease;
}

.char-xp-seg--filled {
  background: linear-gradient(180deg, #a855f7, #7c3aed);
  border-color: rgba(168, 85, 247, 0.5);
  box-shadow: 0 0 4px rgba(147, 112, 219, 0.3);
}

.char-xp-text {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  min-width: 28px;
  text-align: right;
}

/* HP bar */
.char-hp-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.char-hp-label {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-health);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
  min-width: 52px;
  text-align: left;
}

.char-hp-track {
  flex: 1;
  height: 6px;
  background: var(--color-health-bg);
  border: 1px solid rgba(196, 43, 43, 0.15);
  border-radius: 1px;
  overflow: hidden;
}

.char-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b1a1a, var(--color-health));
  border-radius: 1px;
  transition: width var(--transition-normal);
}

.char-hp-fill--critical {
  animation: hp-pulse 1s ease-in-out infinite;
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.char-hp-text {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

/* Tab bar */
.char-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.char-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
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

.char-tab:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.char-tab--active {
  color: var(--color-gold);
  border-bottom-color: var(--color-gold);
}

.retainer-count {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.char-tab--active .retainer-count {
  color: var(--color-gold-dark);
}

/* Paperdoll + Equipment area */
.char-paperdoll-area {
  position: relative;
  height: 380px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* The dimmed paperdoll background */
.paperdoll-image {
  position: absolute;
  height: 100%;
  object-fit: contain;
  opacity: 0.18;
  filter: brightness(0.35) saturate(0.4);
  pointer-events: none;
  user-select: none;
}

/* Equipment slots — 3 on each side of the paperdoll */
.equip-layout {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
}

.equip-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.equip-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Aptitudes section */
.char-aptitudes {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border);
  max-height: 320px;
  overflow-y: auto;
}

.char-aptitudes::-webkit-scrollbar {
  width: 4px;
}

.char-aptitudes::-webkit-scrollbar-track {
  background: transparent;
}

.char-aptitudes::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.aptitudes-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold-dim);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: var(--space-xs);
}

/* Unspent points banner */
.unspent-banner {
  display: flex;
  gap: 6px;
  margin-bottom: var(--space-xs);
  flex-wrap: wrap;
}

.unspent-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 2px;
  padding: 1px 6px;
  letter-spacing: 0.04em;
  animation: tag-pulse 2.5s ease-in-out infinite;
}

@keyframes tag-pulse {
  0%, 100% { border-color: rgba(201, 168, 76, 0.3); }
  50% { border-color: rgba(201, 168, 76, 0.6); }
}

.aptitudes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xs) var(--space-md);
}

.aptitudes-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aptitude-group {
  display: flex;
  flex-direction: column;
}

/* ========= Retainer tab ========= */
.retainer-area {
  padding: var(--space-md);
  min-height: 300px;
}

.retainer-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.retainer-label {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.retainer-cap {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.retainer-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* Retainer card */
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

.retainer-card--deployed {
  border-color: var(--color-armor);
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
  background: rgba(196, 43, 43, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.retainer-hp-fill {
  height: 100%;
  background: var(--color-health);
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

.retainer-empty-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.retainer-empty-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

/* Health slide transition (same as stats-slide) */
.health-slide-enter-active,
.health-slide-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.health-slide-enter-from,
.health-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

/* Health tab badge (wound severity dot) */
.health-badge {
  font-size: 14px;
  line-height: 1;
}

.health-badge--light {
  color: var(--color-gold);
}

.health-badge--serious {
  color: #c87830;
}

.health-badge--severe {
  color: var(--color-crimson);
}

.health-badge--grave {
  color: #cc2222;
  animation: badge-pulse 1.5s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ========= Health tab content ========= */
.health-area {
  padding: var(--space-md);
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.health-area-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 200px;
}

.health-area-empty-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.health-area-empty-hint {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
}

.health-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.health-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.health-summary-label {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.health-summary-value {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text);
}

.wound-severity-tag {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 2px;
}

.wound-severity-tag--healthy {
  color: var(--color-success);
  background: rgba(45, 138, 78, 0.12);
}

.wound-severity-tag--light {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.12);
}

.wound-severity-tag--serious {
  color: #c87830;
  background: rgba(200, 120, 48, 0.12);
}

.wound-severity-tag--severe {
  color: var(--color-crimson);
  background: rgba(139, 26, 26, 0.12);
}

.wound-severity-tag--grave {
  color: #cc2222;
  background: rgba(204, 34, 34, 0.12);
}

.health-ailment-brief {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 8px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.health-ailment-name {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.health-ailment-stage {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
}

.health-area-hint {
  margin-top: auto;
  padding-top: var(--space-md);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  font-style: italic;
  text-align: center;
}
</style>
