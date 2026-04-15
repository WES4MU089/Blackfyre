<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useAuthStore } from '@/stores/auth'
import { getPerkIcon } from '@/utils/perkIcons'
import { BACKEND_URL } from '@/config'
import { acquireInteractionLock, releaseInteractionLock } from '@/composables/useInteractionLock'

const characterStore = useCharacterStore()
const hudStore = useHudStore()
const authStore = useAuthStore()

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${authStore.token}` }
}

const selectedPerk = ref<string | null>(null)
const isSubmitting = ref(false)
const expandedLore = ref<string | null>(null)

interface PerkDef {
  key: string
  name: string
  category: 'offensive' | 'defensive' | 'utility'
  description: string
  lore: string
  alreadyTaken: boolean
  categoryFull: boolean
}

type Cat = 'offensive' | 'defensive' | 'utility'
const allPerks = ref<PerkDef[]>([])
const categoryCounts = ref<Record<Cat, number>>({ offensive: 0, defensive: 0, utility: 0 })
const maxPerksPerCategory = ref(3)
const isLoading = ref(true)

// Fetch all perks from backend
async function fetchPerks() {
  const charId = characterStore.character?.id
  if (!charId) return
  try {
    const res = await fetch(`${BACKEND_URL}/api/characters/${charId}/perks`, {
      headers: authHeaders(),
    })
    const data = await res.json()
    allPerks.value = data.allPerks ?? []
    if (data.categoryCounts) categoryCounts.value = data.categoryCounts
    if (data.maxPerksPerCategory) maxPerksPerCategory.value = data.maxPerksPerCategory
  } catch {
    hudStore.addNotification('error', 'Error', 'Failed to load perks')
  } finally {
    isLoading.value = false
  }
}

function isPerkDisabled(perk: PerkDef): boolean {
  return perk.alreadyTaken || perk.categoryFull
}

fetchPerks()

// Keep the window interactive while this modal is open
let lockToken: number | null = null
onMounted(() => {
  lockToken = acquireInteractionLock()
})

onBeforeUnmount(() => {
  if (lockToken !== null) {
    releaseInteractionLock(lockToken)
    lockToken = null
  }
})

const offensivePerks = computed(() => allPerks.value.filter(p => p.category === 'offensive'))
const defensivePerks = computed(() => allPerks.value.filter(p => p.category === 'defensive'))
const utilityPerks = computed(() => allPerks.value.filter(p => p.category === 'utility'))

function toggleLore(key: string) {
  expandedLore.value = expandedLore.value === key ? null : key
}

async function confirmSelection() {
  if (!selectedPerk.value || isSubmitting.value) return
  const charId = characterStore.character?.id
  if (!charId) return

  isSubmitting.value = true
  try {
    const res = await fetch(`${BACKEND_URL}/api/characters/${charId}/perk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ perkKey: selectedPerk.value }),
    })
    const data = await res.json()
    if (data.success) {
      const perkDef = allPerks.value.find(p => p.key === selectedPerk.value)
      if (perkDef) {
        characterStore.addPerk({
          key: perkDef.key,
          slot: data.slot,
          name: perkDef.name,
          category: perkDef.category,
          description: perkDef.description,
        })
      }
      hudStore.addNotification('success', 'Perk Selected', `${perkDef?.name ?? selectedPerk.value} has been chosen.`)
    } else {
      hudStore.addNotification('error', 'Error', data.error ?? 'Failed to select perk')
    }
  } catch {
    hudStore.addNotification('error', 'Error', 'Network error selecting perk')
  } finally {
    isSubmitting.value = false
  }
}

function close() {
  characterStore.closePerkSelection()
}
</script>

<template>
  <Teleport to="#hud-popover-root">
    <div class="perk-modal-overlay" @click.self="close">
      <div class="perk-modal">
        <div class="perk-modal-header">
          <h2 class="perk-modal-title">Choose a Combat Perk</h2>
          <span class="perk-modal-subtitle">
            Slot {{ characterStore.availablePerkSlot }} &mdash; This choice is permanent
          </span>
          <button class="perk-modal-close" @click="close">&times;</button>
        </div>

        <div v-if="isLoading" class="perk-modal-loading">Loading perks...</div>

        <div v-else class="perk-columns">
          <!-- Offensive -->
          <div class="perk-column">
            <div class="perk-column-header perk-cat--offensive">Offensive ({{ categoryCounts.offensive }}/{{ maxPerksPerCategory }})</div>
            <div
              v-for="perk in offensivePerks"
              :key="perk.key"
              class="perk-card"
              :class="{
                'perk-card--selected': selectedPerk === perk.key,
                'perk-card--taken': perk.alreadyTaken,
                'perk-card--disabled': perk.categoryFull && !perk.alreadyTaken,
              }"
              @click="!isPerkDisabled(perk) && (selectedPerk = perk.key)"
            >
              <div class="perk-card-top">
                <img v-if="getPerkIcon(perk.key)" :src="getPerkIcon(perk.key)!" class="perk-card-icon" :alt="perk.name" />
                <div class="perk-card-info">
                  <span class="perk-card-name">{{ perk.name }}</span>
                  <span v-if="perk.alreadyTaken" class="perk-card-taken-badge">Taken</span>
                  <span v-else-if="perk.categoryFull" class="perk-card-taken-badge">Category Full</span>
                </div>
              </div>
              <p class="perk-card-desc">{{ perk.description }}</p>
              <button v-if="perk.lore" class="perk-lore-toggle" @click.stop="toggleLore(perk.key)">
                {{ expandedLore === perk.key ? 'Hide lore' : 'Show lore' }}
              </button>
              <p v-if="expandedLore === perk.key" class="perk-card-lore">{{ perk.lore }}</p>
            </div>
          </div>

          <!-- Defensive -->
          <div class="perk-column">
            <div class="perk-column-header perk-cat--defensive">Defensive ({{ categoryCounts.defensive }}/{{ maxPerksPerCategory }})</div>
            <div
              v-for="perk in defensivePerks"
              :key="perk.key"
              class="perk-card"
              :class="{
                'perk-card--selected': selectedPerk === perk.key,
                'perk-card--taken': perk.alreadyTaken,
                'perk-card--disabled': perk.categoryFull && !perk.alreadyTaken,
              }"
              @click="!isPerkDisabled(perk) && (selectedPerk = perk.key)"
            >
              <div class="perk-card-top">
                <img v-if="getPerkIcon(perk.key)" :src="getPerkIcon(perk.key)!" class="perk-card-icon" :alt="perk.name" />
                <div class="perk-card-info">
                  <span class="perk-card-name">{{ perk.name }}</span>
                  <span v-if="perk.alreadyTaken" class="perk-card-taken-badge">Taken</span>
                  <span v-else-if="perk.categoryFull" class="perk-card-taken-badge">Category Full</span>
                </div>
              </div>
              <p class="perk-card-desc">{{ perk.description }}</p>
              <button v-if="perk.lore" class="perk-lore-toggle" @click.stop="toggleLore(perk.key)">
                {{ expandedLore === perk.key ? 'Hide lore' : 'Show lore' }}
              </button>
              <p v-if="expandedLore === perk.key" class="perk-card-lore">{{ perk.lore }}</p>
            </div>
          </div>

          <!-- Utility -->
          <div class="perk-column">
            <div class="perk-column-header perk-cat--utility">Utility ({{ categoryCounts.utility }}/{{ maxPerksPerCategory }})</div>
            <div
              v-for="perk in utilityPerks"
              :key="perk.key"
              class="perk-card"
              :class="{
                'perk-card--selected': selectedPerk === perk.key,
                'perk-card--taken': perk.alreadyTaken,
                'perk-card--disabled': perk.categoryFull && !perk.alreadyTaken,
              }"
              @click="!isPerkDisabled(perk) && (selectedPerk = perk.key)"
            >
              <div class="perk-card-top">
                <img v-if="getPerkIcon(perk.key)" :src="getPerkIcon(perk.key)!" class="perk-card-icon" :alt="perk.name" />
                <div class="perk-card-info">
                  <span class="perk-card-name">{{ perk.name }}</span>
                  <span v-if="perk.alreadyTaken" class="perk-card-taken-badge">Taken</span>
                  <span v-else-if="perk.categoryFull" class="perk-card-taken-badge">Category Full</span>
                </div>
              </div>
              <p class="perk-card-desc">{{ perk.description }}</p>
              <button v-if="perk.lore" class="perk-lore-toggle" @click.stop="toggleLore(perk.key)">
                {{ expandedLore === perk.key ? 'Hide lore' : 'Show lore' }}
              </button>
              <p v-if="expandedLore === perk.key" class="perk-card-lore">{{ perk.lore }}</p>
            </div>
          </div>
        </div>

        <div class="perk-modal-footer">
          <button class="perk-cancel-btn" @click="close">Cancel</button>
          <button
            class="perk-confirm-btn"
            :disabled="!selectedPerk || isSubmitting"
            @click="confirmSelection"
          >
            {{ isSubmitting ? 'Selecting...' : 'Confirm Selection' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.perk-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  pointer-events: auto;
}

.perk-modal {
  background: var(--color-bg-panel, #1a1a1a);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-md);
  width: 90vw;
  max-width: 960px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.perk-modal-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border-dim);
  position: relative;
}

.perk-modal-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  margin: 0;
}

.perk-modal-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.perk-modal-close {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  cursor: pointer;
  padding: 2px 6px;
}

.perk-modal-close:hover {
  color: var(--color-text);
}

.perk-modal-loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-dim);
  font-style: italic;
}

.perk-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-sm);
  padding: var(--space-sm);
  overflow-y: auto;
  flex: 1;
}

.perk-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.perk-column-header {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: var(--space-xs) var(--space-sm);
  text-align: center;
  border-bottom: 1px solid;
}

.perk-cat--offensive {
  color: #e06c75;
  border-color: rgba(224, 108, 117, 0.3);
}

.perk-cat--defensive {
  color: #5b9bd5;
  border-color: rgba(91, 155, 213, 0.3);
}

.perk-cat--utility {
  color: #6ec86e;
  border-color: rgba(110, 200, 110, 0.3);
}

.perk-card {
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
}

.perk-card:hover:not(.perk-card--taken):not(.perk-card--disabled) {
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.04);
}

.perk-card--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.perk-card--selected {
  border-color: var(--color-gold) !important;
  background: rgba(201, 168, 76, 0.1) !important;
  box-shadow: 0 0 8px rgba(201, 168, 76, 0.15);
}

.perk-card--taken {
  opacity: 0.4;
  cursor: not-allowed;
}

.perk-card-top {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.perk-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  border: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.perk-card-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.perk-card-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
}

.perk-card-taken-badge {
  font-size: 8px;
  color: var(--color-text-dim);
  border: 1px solid var(--color-border-dim);
  padding: 0 3px;
  border-radius: 2px;
  text-transform: uppercase;
}

.perk-card-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.perk-lore-toggle {
  font-size: 9px;
  color: var(--color-text-dim);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 4px;
}

.perk-lore-toggle:hover {
  color: var(--color-gold);
}

.perk-card-lore {
  font-size: 10px;
  color: var(--color-text-dim);
  font-style: italic;
  line-height: 1.5;
  margin: 4px 0 0;
  padding-left: var(--space-xs);
  border-left: 2px solid var(--color-border-dim);
}

.perk-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border-top: 1px solid var(--color-border-dim);
}

.perk-cancel-btn {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.perk-cancel-btn:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.perk-confirm-btn {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-lg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.perk-confirm-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

.perk-confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
