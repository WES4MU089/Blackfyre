<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCombatStore, type LobbyListEntry } from '@/stores/combat'
import { useHudStore } from '@/stores/hud'
import { useCharacterStore } from '@/stores/character'
import { useCombat } from '@/composables/useCombat'
import { useDraggable } from '@/composables/useDraggable'

const combatStore = useCombatStore()
const hudStore = useHudStore()
const characterStore = useCharacterStore()
const { createLobby, joinLobby, leaveLobby, switchTeam, setReady, startCombat, cancelLobby, requestLobbies, toggleRetainers } = useCombat()

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('combat-lobby', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['combat-lobby']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

const myCharId = computed(() => characterStore.character?.id ?? null)

// Refresh lobby list on mount
onMounted(() => {
  requestLobbies()
})

function close(): void {
  combatStore.closePanel()
  hudStore.toggleSystemPanel('combat')
}

function onJoinLobby(entry: LobbyListEntry): void {
  joinLobby(entry.lobbyId)
}

function onSwitchTeam(): void {
  const current = combatStore.myTeam
  if (current === 1) switchTeam(2)
  else switchTeam(1)
}

function onToggleReady(): void {
  setReady(!combatStore.myReady)
}

function onStartCombat(): void {
  startCombat()
}

function onLeaveLobby(): void {
  leaveLobby()
}

function onCancelLobby(): void {
  cancelLobby()
}

function onCreateLobby(): void {
  createLobby()
}

function onRefreshLobbies(): void {
  requestLobbies()
}

// --- Retainers ---

const myRetainers = computed(() => characterStore.retainers)
const hasRetainers = computed(() => myRetainers.value.length > 0)

/** IDs of retainers currently in the lobby. */
const deployedRetainerIds = computed(() => {
  if (!combatStore.lobbyState) return new Set<number>()
  return new Set(
    combatStore.lobbyState.members
      .filter(m => m.isRetainer && m.ownerCharacterId === myCharId.value)
      .map(m => m.characterId)
  )
})

function tierLabel(tier: number): string {
  const labels: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
  return labels[tier] ?? `${tier}`
}

function onToggleRetainer(retainerId: number): void {
  const current = deployedRetainerIds.value
  const updated = new Set(current)
  if (updated.has(retainerId)) {
    updated.delete(retainerId)
  } else {
    updated.add(retainerId)
  }
  toggleRetainers(Array.from(updated))
}
</script>

<template>
  <div class="combat-lobby-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="combat-lobby panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging }"
    >
      <!-- Header -->
      <div class="lobby-header" @mousedown="onDragStart">
        <span class="lobby-header-title">Combat</span>
        <button class="lobby-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Browse Mode: Not in a lobby -->
      <div v-if="!combatStore.isInLobby" class="lobby-browse">
        <div class="lobby-region">
          <span class="lobby-region-label">Region:</span>
          <span class="lobby-region-name">{{ hudStore.simName || 'Unknown' }}</span>
        </div>

        <button class="btn-ornate btn-create" @click="onCreateLobby">
          Create Lobby
        </button>

        <div class="lobby-divider" />

        <div class="lobby-list-header">
          <span>Open Lobbies</span>
          <button class="btn-sm" @click="onRefreshLobbies" title="Refresh">&#x21bb;</button>
        </div>

        <div v-if="combatStore.availableLobbies.length === 0" class="lobby-empty">
          No open lobbies in this region.
        </div>

        <div
          v-for="entry in combatStore.availableLobbies"
          :key="entry.lobbyId"
          class="lobby-entry"
          @click="onJoinLobby(entry)"
        >
          <span class="lobby-entry-host">{{ entry.hostName }}</span>
          <span class="lobby-entry-count">{{ entry.memberCount }}/{{ entry.maxPlayers }}</span>
        </div>
      </div>

      <!-- In-Lobby Mode -->
      <div v-else-if="combatStore.lobbyState" class="lobby-active">
        <div class="lobby-status-bar">
          <span class="lobby-id">Lobby #{{ combatStore.lobbyState.lobbyId }}</span>
          <span class="lobby-status-badge" :class="`status-${combatStore.lobbyState.status}`">
            {{ combatStore.lobbyState.status }}
          </span>
        </div>

        <!-- Teams -->
        <div class="teams-container">
          <!-- Team 1 -->
          <div class="team-column">
            <div class="team-header team-1-header">Team 1</div>
            <div
              v-for="member in combatStore.team1Members"
              :key="member.characterId"
              class="team-member"
              :class="{
                'is-me': member.characterId === myCharId,
                'is-ready': member.isReady,
              }"
            >
              <span class="member-ready-dot" :class="{ ready: member.isReady }" />
              <span class="member-name">{{ member.characterName }}</span>
              <span v-if="member.characterId === combatStore.lobbyState.hostCharacterId" class="host-badge">HOST</span>
              <span v-if="member.isRetainer" class="retainer-badge">RET</span>
            </div>
          </div>

          <div class="teams-vs">VS</div>

          <!-- Team 2 -->
          <div class="team-column">
            <div class="team-header team-2-header">Team 2</div>
            <div
              v-for="member in combatStore.team2Members"
              :key="member.characterId"
              class="team-member"
              :class="{
                'is-me': member.characterId === myCharId,
                'is-ready': member.isReady,
              }"
            >
              <span class="member-ready-dot" :class="{ ready: member.isReady }" />
              <span class="member-name">{{ member.characterName }}</span>
              <span v-if="member.characterId === combatStore.lobbyState.hostCharacterId" class="host-badge">HOST</span>
              <span v-if="member.isRetainer" class="retainer-badge">RET</span>
            </div>
          </div>
        </div>

        <!-- Retainer Toggle -->
        <div v-if="hasRetainers" class="retainer-section">
          <div class="retainer-section-header">Retainers</div>
          <div
            v-for="ret in myRetainers"
            :key="ret.id"
            class="retainer-toggle"
            @click="onToggleRetainer(ret.id)"
          >
            <span class="retainer-checkbox" :class="{ checked: deployedRetainerIds.has(ret.id) }" />
            <span class="retainer-toggle-name">{{ ret.name }}</span>
            <span class="retainer-toggle-tier">{{ tierLabel(ret.tier) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="lobby-actions">
          <button class="btn-ornate btn-switch" @click="onSwitchTeam">
            Switch Team
          </button>
          <button
            class="btn-ornate"
            :class="combatStore.myReady ? 'btn-unready' : 'btn-ready'"
            @click="onToggleReady"
          >
            {{ combatStore.myReady ? 'Unready' : 'Ready' }}
          </button>
        </div>

        <div class="lobby-actions-bottom">
          <button
            v-if="combatStore.isHost"
            class="btn-ornate btn-start"
            :disabled="!combatStore.allReady"
            @click="onStartCombat"
          >
            Start Combat
          </button>
          <button
            v-if="combatStore.isHost"
            class="btn-ornate btn-cancel"
            @click="onCancelLobby"
          >
            Cancel
          </button>
          <button
            v-if="!combatStore.isHost"
            class="btn-ornate btn-leave"
            @click="onLeaveLobby"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-lobby-wrapper {
  pointer-events: none;
}

.combat-lobby {
  width: 380px;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
}

.lobby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid var(--color-border-dim);
}

.lobby-header-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.lobby-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 var(--space-xs);
  line-height: 1;
}
.lobby-close:hover {
  color: var(--color-gold);
}

/* Browse mode */
.lobby-browse {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.lobby-region {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
}

.lobby-region-label {
  color: var(--color-text-muted);
}

.lobby-region-name {
  color: var(--color-gold-dim);
  font-family: var(--font-display);
}

.lobby-divider {
  height: 1px;
  background: var(--color-border-dim);
  margin: var(--space-xs) 0;
}

.lobby-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.lobby-list-header .btn-sm {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
}
.lobby-list-header .btn-sm:hover {
  color: var(--color-gold);
}

.lobby-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  text-align: center;
  padding: var(--space-md) 0;
}

.lobby-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.15s;
}
.lobby-entry:hover {
  border-color: var(--color-gold-dim);
}

.lobby-entry-host {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.lobby-entry-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* In-lobby mode */
.lobby-active {
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.lobby-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-xs);
}

.lobby-id {
  color: var(--color-text-muted);
}

.lobby-status-badge {
  padding: 1px var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xxs, 0.6rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.status-open { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
.status-starting { background: rgba(201, 168, 76, 0.2); color: var(--color-gold); }
.status-started { background: rgba(139, 26, 26, 0.2); color: var(--color-crimson); }
.status-cancelled { background: rgba(100, 100, 100, 0.2); color: var(--color-text-dim); }

/* Teams */
.teams-container {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.team-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.team-header {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border-dim);
  margin-bottom: var(--space-xs);
}
.team-1-header { color: #5b9bd5; }
.team-2-header { color: #e06c75; }

.teams-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold-dim);
  padding-top: 28px;
  min-width: 32px;
}

.team-member {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 3px var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  transition: background 0.15s;
}

.team-member.is-me {
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
}

.team-member.empty {
  opacity: 0.3;
}

.member-ready-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-dim);
  flex-shrink: 0;
}
.member-ready-dot.ready {
  background: #4caf50;
}

.member-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-badge {
  font-size: var(--font-size-xxs, 0.55rem);
  color: var(--color-gold);
  border: 1px solid var(--color-gold-dim);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
}

.retainer-badge {
  font-size: var(--font-size-xxs, 0.55rem);
  color: #5b9bd5;
  border: 1px solid rgba(91, 155, 213, 0.4);
  padding: 0 3px;
  border-radius: 2px;
  letter-spacing: 0.05em;
}

/* Retainer toggle section */
.retainer-section {
  border-top: 1px solid var(--color-border-dim);
  padding-top: var(--space-xs);
}

.retainer-section-header {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-xs);
}

.retainer-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 2px var(--space-xs);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  transition: background 0.15s;
}
.retainer-toggle:hover {
  background: rgba(201, 168, 76, 0.06);
}

.retainer-checkbox {
  width: 12px;
  height: 12px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  flex-shrink: 0;
  position: relative;
}
.retainer-checkbox.checked {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.2);
}
.retainer-checkbox.checked::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 0;
  width: 5px;
  height: 8px;
  border: solid var(--color-gold);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.retainer-toggle-name {
  color: var(--color-text);
}

.retainer-toggle-tier {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  padding: 0 4px;
  border-radius: 2px;
  letter-spacing: 0.05em;
}

/* Action buttons */
.lobby-actions {
  display: flex;
  gap: var(--space-sm);
}

.lobby-actions-bottom {
  display: flex;
  gap: var(--space-sm);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--color-border-dim);
}

.btn-ornate {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-ornate:hover {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
}
.btn-ornate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-create {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
}
.btn-create:hover {
  background: rgba(201, 168, 76, 0.1);
}

.btn-ready {
  border-color: rgba(76, 175, 80, 0.4);
  color: #4caf50;
}
.btn-ready:hover {
  background: rgba(76, 175, 80, 0.1);
}

.btn-unready {
  border-color: rgba(255, 152, 0, 0.4);
  color: #ff9800;
}

.btn-start {
  border-color: var(--color-gold);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
}
.btn-start:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
}

.btn-cancel,
.btn-leave {
  border-color: rgba(139, 26, 26, 0.4);
  color: var(--color-crimson, #8b1a1a);
}
.btn-cancel:hover,
.btn-leave:hover {
  background: rgba(139, 26, 26, 0.1);
}
</style>
