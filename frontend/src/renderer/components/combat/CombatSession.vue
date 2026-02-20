<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCombatStore, type CombatantView } from '@/stores/combat'
import { useCharacterStore } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import CombatTeamPanel from './CombatTeamPanel.vue'
import CombatControlPanel from './CombatControlPanel.vue'
import CombatantTooltip from './CombatantTooltip.vue'
import WoundAssessmentOverlay from './WoundAssessmentOverlay.vue'

const combatStore = useCombatStore()
const characterStore = useCharacterStore()
const hudStore = useHudStore()

const myCharId = computed(() => characterStore.character?.id ?? null)
const myRetainerIds = computed(() => combatStore.myRetainerIds)

const team1Combatants = computed(() =>
  combatStore.combatants.filter(c => c.team === 1)
)
const team2Combatants = computed(() =>
  combatStore.combatants.filter(c => c.team === 2)
)

const sessionOver = computed(() => combatStore.sessionEnded)

function onSelectCombatant(characterId: number): void {
  if (combatStore.selectedTargetId === characterId) {
    combatStore.selectTarget(null)
  } else {
    combatStore.selectTarget(characterId)
  }
}

function onClose(): void {
  if (!sessionOver.value) return
  combatStore.clearCombatSession()
}

// --- Combatant hover tooltip ---
const hoveredCombatant = ref<CombatantView | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

const myRating = computed(() => {
  const me = combatStore.combatants.find(c => c.characterId === myCharId.value)
  return me?.combatRating ?? 0
})

function onHoverStart(combatant: CombatantView, e: MouseEvent): void {
  hoveredCombatant.value = combatant
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverMove(e: MouseEvent): void {
  tooltipPos.value = { x: e.clientX, y: e.clientY }
}

function onHoverEnd(): void {
  hoveredCombatant.value = null
}

// Clean up legacy single-panel position key
onMounted(() => {
  if (hudStore.hudPositions['combat-session']) {
    delete hudStore.hudPositions['combat-session']
    hudStore.saveLayout()
  }
})
</script>

<template>
  <div class="combat-session-orchestrator">
    <!-- Team Blue (left) -->
    <CombatTeamPanel
      area-id="combat-team-blue"
      team-label="Team Blue"
      team-color="blue"
      :combatants="team1Combatants"
      :my-char-id="myCharId"
      :my-retainer-ids="myRetainerIds"
      :selected-target-id="combatStore.selectedTargetId"
      :current-turn-character-id="combatStore.currentTurnCharacterId"
      @select="onSelectCombatant"
      @hover-start="onHoverStart"
      @hover-move="onHoverMove"
      @hover-end="onHoverEnd"
    />

    <!-- Controls (center) -->
    <CombatControlPanel
      :session-over="sessionOver"
      @close="onClose"
    />

    <!-- Team Red (right) -->
    <CombatTeamPanel
      area-id="combat-team-red"
      team-label="Team Red"
      team-color="red"
      :combatants="team2Combatants"
      :my-char-id="myCharId"
      :my-retainer-ids="myRetainerIds"
      :selected-target-id="combatStore.selectedTargetId"
      :current-turn-character-id="combatStore.currentTurnCharacterId"
      @select="onSelectCombatant"
      @hover-start="onHoverStart"
      @hover-move="onHoverMove"
      @hover-end="onHoverEnd"
    />

    <!-- Combatant hover tooltip (teleports to body) -->
    <CombatantTooltip
      v-if="hoveredCombatant"
      :combatant="hoveredCombatant"
      :my-rating="myRating"
      :x="tooltipPos.x"
      :y="tooltipPos.y"
    />

    <!-- Post-combat wound assessment results -->
    <WoundAssessmentOverlay />
  </div>
</template>

<style scoped>
.combat-session-orchestrator {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}
</style>
