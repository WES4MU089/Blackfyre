<script setup lang="ts">
import { computed } from 'vue'
import { useCombatStore } from '@/stores/combat'
import { useCharacterStore } from '@/stores/character'

const combatStore = useCombatStore()
const characterStore = useCharacterStore()

const currentTurnName = computed(() => {
  if (!combatStore.currentTurnCharacterId) return 'Waiting...'
  const combatant = combatStore.combatants.find(
    c => c.characterId === combatStore.currentTurnCharacterId
  )
  return combatant?.characterName ?? 'Unknown'
})

const isMyTurn = computed(() => combatStore.isMyTurn)

const isRetainerTurn = computed(() => combatStore.isRetainerTurn)

const retainerName = computed(() => {
  return combatStore.currentRetainerCombatant?.characterName ?? null
})

const turnLabel = computed(() => {
  if (isRetainerTurn.value && retainerName.value) {
    return `${retainerName.value}'s Turn`
  }
  if (isMyTurn.value) return 'Your Turn!'
  return `${currentTurnName.value}'s Turn`
})

const currentTurnTeam = computed(() => {
  const combatant = combatStore.combatants.find(
    c => c.characterId === combatStore.currentTurnCharacterId
  )
  return combatant?.team ?? null
})
</script>

<template>
  <div class="turn-indicator" :class="{ 'is-my-turn': isMyTurn }">
    <div class="turn-round">
      <span class="round-label">Round</span>
      <span class="round-number">{{ combatStore.currentRound }}</span>
    </div>

    <div class="turn-divider" />

    <div class="turn-info">
      <span
        class="turn-name"
        :class="{
          'team-blue': currentTurnTeam === 1,
          'team-red': currentTurnTeam === 2,
        }"
      >
        {{ turnLabel }}
      </span>
      <span v-if="isRetainerTurn" class="retainer-tag">Retainer</span>
    </div>

    <!-- Victory / Defeat / Draw banner -->
    <div v-if="combatStore.sessionEnded" class="victory-banner">
      <span class="victory-text">
        {{ combatStore.winningTeam === null ? 'DRAW' : combatStore.winningTeam === combatStore.myCombatTeam ? 'VICTORY' : 'DEFEAT' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.turn-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.turn-indicator.is-my-turn {
  border-color: var(--color-gold);
  box-shadow: 0 0 10px rgba(201, 168, 76, 0.2);
  animation: turn-glow 2s ease-in-out infinite;
}

.turn-round {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.round-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.round-number {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
}

.turn-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-dim);
}

.turn-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.turn-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.05em;
}

.turn-name.team-blue { color: #5b9bd5; }
.turn-name.team-red { color: #e06c75; }

.is-my-turn .turn-name {
  color: var(--color-gold);
}

.retainer-tag {
  font-size: 8px;
  color: var(--color-gold);
  border: 1px solid var(--color-gold-dim);
  padding: 0 4px;
  border-radius: 2px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Victory / Defeat banner */
.victory-banner {
  margin-left: auto;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.1);
}

.victory-text {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-gold);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

@keyframes turn-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(201, 168, 76, 0.2); }
  50% { box-shadow: 0 0 16px rgba(201, 168, 76, 0.35); }
}
</style>
