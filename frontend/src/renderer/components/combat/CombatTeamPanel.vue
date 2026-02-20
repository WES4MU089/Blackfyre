<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CombatantView } from '@/stores/combat'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import CombatantCard from './CombatantCard.vue'

interface CombatantGroup {
  leader: CombatantView
  retainers: CombatantView[]
}

const props = defineProps<{
  areaId: string
  teamLabel: string
  teamColor: 'blue' | 'red'
  combatants: CombatantView[]
  myCharId: number | null
  myRetainerIds: number[]
  selectedTargetId: number | null
  currentTurnCharacterId: number | null
}>()

const emit = defineEmits<{
  select: [characterId: number]
  'hover-start': [combatant: CombatantView, e: MouseEvent]
  'hover-move': [e: MouseEvent]
  'hover-end': []
}>()

const hudStore = useHudStore()

const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable(props.areaId, panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions[props.areaId]
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  // Default positions
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
  if (props.teamColor === 'blue') {
    return { position: 'fixed' as const, left: '20px', top: `${Math.round(vh / 2 - 200)}px` }
  }
  return { position: 'fixed' as const, left: `${vw - 240}px`, top: `${Math.round(vh / 2 - 200)}px` }
})

const groupedCombatants = computed<CombatantGroup[]>(() => {
  const leaders = props.combatants.filter(c => c.ownerCharacterId === null)
  const retainers = props.combatants.filter(c => c.ownerCharacterId !== null)

  const groups: CombatantGroup[] = leaders.map(leader => ({
    leader,
    retainers: retainers.filter(r => r.ownerCharacterId === leader.characterId),
  }))

  // Orphaned retainers (owner on the other team or missing) — show as standalone
  const assignedIds = new Set(groups.flatMap(g => g.retainers.map(r => r.characterId)))
  for (const r of retainers) {
    if (!assignedIds.has(r.characterId)) {
      groups.push({ leader: r, retainers: [] })
    }
  }

  return groups
})
</script>

<template>
  <div class="combat-team-wrapper" :style="panelStyle">
    <div
      ref="panelRef"
      class="combat-team-panel panel-ornate animate-fade-in"
      :class="['team-' + teamColor, { 'is-dragging': isDragging }]"
    >
      <!-- Header / drag handle -->
      <div class="team-panel-header" @mousedown="onDragStart">
        <span class="team-panel-title">{{ teamLabel }}</span>
      </div>

      <!-- Grouped combatant cards -->
      <div class="team-panel-cards">
        <div
          v-for="group in groupedCombatants"
          :key="group.leader.characterId"
          class="combatant-group"
        >
          <!-- Leader card -->
          <CombatantCard
            :combatant="group.leader"
            :is-me="group.leader.characterId === myCharId"
            :is-my-retainer="myRetainerIds.includes(group.leader.characterId)"
            :is-selected="selectedTargetId === group.leader.characterId"
            :is-current-turn="currentTurnCharacterId === group.leader.characterId"
            :team-color="teamColor"
            @select="(id: number) => emit('select', id)"
            @hover-start="(c: CombatantView, e: MouseEvent) => emit('hover-start', c, e)"
            @hover-move="(e: MouseEvent) => emit('hover-move', e)"
            @hover-end="emit('hover-end')"
          />

          <!-- Retainer cards (nested) -->
          <div v-if="group.retainers.length > 0" class="retainer-group">
            <div
              v-for="ret in group.retainers"
              :key="ret.characterId"
              class="retainer-slot"
            >
              <div class="retainer-connector" />
              <CombatantCard
                :combatant="ret"
                :is-me="ret.characterId === myCharId"
                :is-my-retainer="myRetainerIds.includes(ret.characterId)"
                :is-selected="selectedTargetId === ret.characterId"
                :is-current-turn="currentTurnCharacterId === ret.characterId"
                :team-color="teamColor"
                class="retainer-card"
                @select="(id: number) => emit('select', id)"
                @hover-start="(c: CombatantView, e: MouseEvent) => emit('hover-start', c, e)"
                @hover-move="(e: MouseEvent) => emit('hover-move', e)"
                @hover-end="emit('hover-end')"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-team-wrapper {
  pointer-events: none;
}

.combat-team-panel {
  width: 220px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow-y: auto;
  overflow-x: hidden;
}

.combat-team-panel.is-dragging {
  z-index: 1000;
}

/* Header */
.team-panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs) var(--space-sm);
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.team-panel-title {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.combat-team-panel.team-blue .team-panel-title { color: #5b9bd5; }
.combat-team-panel.team-red .team-panel-title { color: #e06c75; }

/* Cards */
.team-panel-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-xs) var(--space-sm);
}

.combatant-group {
  display: flex;
  flex-direction: column;
}

/* Retainer nesting */
.retainer-group {
  margin-left: 16px;
  padding-left: 8px;
  border-left: 1px solid var(--color-border-dim);
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}

.retainer-slot {
  position: relative;
}

.retainer-connector {
  position: absolute;
  left: -9px;
  top: 50%;
  width: 8px;
  height: 1px;
  background: var(--color-border-dim);
}

.retainer-card {
  opacity: 0.85;
  font-size: 0.95em;
}

.retainer-card:hover {
  opacity: 1;
}

/* Scrollbar */
.combat-team-panel::-webkit-scrollbar {
  width: 4px;
}
.combat-team-panel::-webkit-scrollbar-track {
  background: transparent;
}
.combat-team-panel::-webkit-scrollbar-thumb {
  background: var(--color-border-dim);
  border-radius: 2px;
}
</style>
