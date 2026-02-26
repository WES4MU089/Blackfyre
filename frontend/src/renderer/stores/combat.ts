import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCharacterStore } from './character'

export interface LobbyMemberView {
  characterId: number
  characterName: string
  team: number
  isReady: boolean
  ownerCharacterId: number | null
  isRetainer: boolean
}

export interface LobbyStateView {
  lobbyId: number
  hostCharacterId: number
  hostName: string
  region: string
  status: 'open' | 'starting' | 'started' | 'cancelled'
  maxPlayers: number
  members: LobbyMemberView[]
}

export interface LobbyListEntry {
  lobbyId: number
  hostName: string
  region: string
  memberCount: number
  maxPlayers: number
}

// --- Combat session types ---

export interface StatusEffectView {
  type: string
  stacks: number
  roundsRemaining: number
  sourceCharacterId: number
}

export interface CombatantView {
  characterId: number
  characterName: string
  team: number
  initiative: number
  currentHealth: number
  maxHealth: number
  isAlive: boolean
  isYielded: boolean
  statusEffects: StatusEffectView[]
  engagedTo: number[]
  protectingId: number | null
  isBracing: boolean
  ownerCharacterId: number | null

  // Observable equipment
  weaponType: string
  weaponTier: number
  weaponMaterial: string
  isTwoHanded: boolean
  armorClass: string
  armorTier: number
  shieldClass: string
  shieldTier: number
  hasShield: boolean
  combatRating: number
  thumbnailUrl: string | null
}

export interface WoundAssessmentView {
  characterId: number
  characterName: string
  healthPercent: number
  severity: 'healthy' | 'light' | 'serious' | 'severe' | 'grave'
  dicePenalty: number
  requiresTending: boolean
  infectionRisk: boolean
  narrative: string
}

export interface AttackResultView {
  attackerCharacterId: number
  defenderCharacterId: number

  // Dice pool results
  attackPoolSize: number
  defensePoolSize: number
  attackSuccesses: number
  defenseSuccesses: number
  netSuccesses: number
  attackDice: number[]
  defenseDice: number[]

  // Outcome
  hit: boolean
  defenseReversal: boolean
  dodged: boolean
  hitQuality: 'normal' | 'strong' | 'critical' | null
  damage: number
  damageLabel: string
  isCrit: boolean
  critEffectsApplied: string[]
  statusEffectsApplied: StatusEffectView[]
  bonuses: string[]

  // Counter-attack (defense reversal with shield)
  counterAttack: {
    damage: number
    targetCharacterId: number
    statusEffectsApplied: StatusEffectView[]
  } | null

  // Dodge riposte (defense reversal for light/no armor)
  dodgeRiposte: {
    damage: number
    targetCharacterId: number
  } | null
}

export interface ActionResultView {
  sessionId: number
  roundNumber: number
  turnNumber: number
  actorCharacterId: number
  actorName: string
  actionType: string
  targetCharacterId: number | null
  targetName: string | null
  attackResult: AttackResultView | null
  statusEffectsApplied: StatusEffectView[]
  statusEffectsRemoved: { characterId: number; type: string }[]
  narrative: string
  opportunityAttacks: ActionResultView[]
}

export interface RoundStartView {
  roundNumber: number
  bleedingDamage: { characterId: number; damage: number; stacks: number }[]
  expiredEffects: { characterId: number; type: string }[]
  deaths: { characterId: number; cause: string }[]
}

export const useCombatStore = defineStore('combat', () => {
  // Lobby state
  const currentLobbyId = ref<number | null>(null)
  const lobbyState = ref<LobbyStateView | null>(null)
  const availableLobbies = ref<LobbyListEntry[]>([])

  // View mode
  const activeView = ref<'none' | 'lobby' | 'combat'>('none')

  // Combat session state
  const sessionId = ref<number | null>(null)
  const combatants = ref<CombatantView[]>([])
  const turnOrder = ref<{ characterId: number; initiative: number; team: number }[]>([])
  const currentTurnCharacterId = ref<number | null>(null)
  const currentRound = ref(1)
  const combatLog = ref<ActionResultView[]>([])
  const winningTeam = ref<number | null>(null)
  const sessionEnded = ref(false)
  const selectedTargetId = ref<number | null>(null)
  const woundAssessments = ref<WoundAssessmentView[]>([])

  // Character store for identity checks
  const characterStore = useCharacterStore()

  // --- Computed ---

  const isInLobby = computed(() => currentLobbyId.value !== null)

  const isHost = computed(() => {
    if (!lobbyState.value || !characterStore.character) return false
    return lobbyState.value.hostCharacterId === characterStore.character.id
  })

  const myTeam = computed(() => {
    if (!lobbyState.value || !characterStore.character) return null
    const member = lobbyState.value.members.find(
      m => m.characterId === characterStore.character!.id
    )
    return member?.team ?? null
  })

  const myReady = computed(() => {
    if (!lobbyState.value || !characterStore.character) return false
    const member = lobbyState.value.members.find(
      m => m.characterId === characterStore.character!.id
    )
    return member?.isReady ?? false
  })

  const allReady = computed(() => {
    if (!lobbyState.value || lobbyState.value.members.length < 2) return false
    const team1 = lobbyState.value.members.filter(m => m.team === 1)
    const team2 = lobbyState.value.members.filter(m => m.team === 2)
    if (team1.length === 0 || team2.length === 0) return false
    return lobbyState.value.members.every(m => m.isReady)
  })

  const team1Members = computed(() =>
    lobbyState.value?.members.filter(m => m.team === 1) ?? []
  )

  const team2Members = computed(() =>
    lobbyState.value?.members.filter(m => m.team === 2) ?? []
  )

  // --- Combat session computed ---

  const isInCombat = computed(() => sessionId.value !== null && activeView.value === 'combat')

  const myRetainerIds = computed(() => {
    if (!characterStore.character) return []
    return combatants.value
      .filter(c => c.ownerCharacterId === characterStore.character!.id)
      .map(c => c.characterId)
  })

  const isMyTurn = computed(() => {
    if (!characterStore.character || !currentTurnCharacterId.value) return false
    const myId = characterStore.character.id
    const turnId = currentTurnCharacterId.value
    // My turn if it's my character OR one of my retainers
    return turnId === myId || myRetainerIds.value.includes(turnId)
  })

  /** The character ID whose turn it is (may be me or my retainer). */
  const currentActorId = computed(() => currentTurnCharacterId.value)

  /** True if the current turn belongs to one of my retainers (not me directly). */
  const isRetainerTurn = computed(() => {
    if (!characterStore.character || !currentTurnCharacterId.value) return false
    return myRetainerIds.value.includes(currentTurnCharacterId.value)
  })

  /** The retainer combatant whose turn it currently is (null if not a retainer turn). */
  const currentRetainerCombatant = computed(() => {
    if (!isRetainerTurn.value || !currentTurnCharacterId.value) return null
    return combatants.value.find(c => c.characterId === currentTurnCharacterId.value) ?? null
  })

  const myCombatTeam = computed(() => {
    if (!characterStore.character) return null
    const c = combatants.value.find(c => c.characterId === characterStore.character!.id)
    return c?.team ?? null
  })

  const enemies = computed(() =>
    combatants.value.filter(c => c.team !== myCombatTeam.value && c.isAlive && !c.isYielded)
  )

  const allies = computed(() =>
    combatants.value.filter(c => c.team === myCombatTeam.value && c.characterId !== characterStore.character?.id && c.isAlive && !c.isYielded)
  )

  const myCombatant = computed(() =>
    combatants.value.find(c => c.characterId === characterStore.character?.id) ?? null
  )

  // --- Actions ---

  function updateLobbyState(state: LobbyStateView): void {
    lobbyState.value = state
    currentLobbyId.value = state.lobbyId
    if (activeView.value === 'none') {
      activeView.value = 'lobby'
    }
  }

  function setAvailableLobbies(lobbies: LobbyListEntry[]): void {
    availableLobbies.value = lobbies
  }

  function clearLobby(): void {
    currentLobbyId.value = null
    lobbyState.value = null
    activeView.value = 'none'
  }

  function openPanel(): void {
    if (activeView.value === 'none') {
      activeView.value = 'lobby'
    }
  }

  function closePanel(): void {
    activeView.value = 'none'
  }

  // --- Combat session actions ---

  function initCombatSession(data: {
    sessionId: number
    combatants: CombatantView[]
    turnOrder: { characterId: number; initiative: number; team: number }[]
    currentTurnCharacterId: number
    currentRound: number
  }): void {
    sessionId.value = data.sessionId
    combatants.value = data.combatants
    turnOrder.value = data.turnOrder
    currentTurnCharacterId.value = data.currentTurnCharacterId
    currentRound.value = data.currentRound
    combatLog.value = []
    winningTeam.value = null
    sessionEnded.value = false
    selectedTargetId.value = null
    activeView.value = 'combat'
    // Clear lobby state
    currentLobbyId.value = null
    lobbyState.value = null
  }

  function applyAttackResult(atk: AttackResultView): void {
    // Apply main hit damage to defender
    if (atk.hit && atk.damage > 0) {
      const target = combatants.value.find(c => c.characterId === atk.defenderCharacterId)
      if (target) {
        target.currentHealth = Math.max(0, target.currentHealth - atk.damage)
        if (target.currentHealth <= 0) {
          target.isAlive = false
        }
      }
    }

    // Apply counter-attack damage to the attacker (defense reversal with shield)
    if (atk.counterAttack && atk.counterAttack.damage > 0) {
      const attacker = combatants.value.find(c => c.characterId === atk.counterAttack!.targetCharacterId)
      if (attacker) {
        attacker.currentHealth = Math.max(0, attacker.currentHealth - atk.counterAttack.damage)
        if (attacker.currentHealth <= 0) {
          attacker.isAlive = false
        }
      }
    }

    // Apply dodge riposte damage to the attacker (defense reversal for light/no armor)
    if (atk.dodgeRiposte && atk.dodgeRiposte.damage > 0) {
      const attacker = combatants.value.find(c => c.characterId === atk.dodgeRiposte!.targetCharacterId)
      if (attacker) {
        attacker.currentHealth = Math.max(0, attacker.currentHealth - atk.dodgeRiposte.damage)
        if (attacker.currentHealth <= 0) {
          attacker.isAlive = false
        }
      }
    }
  }

  function processActionResult(result: ActionResultView, updatedCombatants?: CombatantView[]): void {
    // Log main action first (the active combatant's turn)
    combatLog.value.push(result)

    // Then log opportunity attacks that were triggered
    for (const opp of result.opportunityAttacks) {
      combatLog.value.push(opp)
    }

    // Sync full combatant state from backend (handles HP, status effects,
    // engagement, protection, bracing — everything in one authoritative update)
    if (updatedCombatants) {
      combatants.value = updatedCombatants
    } else {
      // Fallback: apply HP changes manually if no state sync available
      for (const opp of result.opportunityAttacks) {
        if (opp.attackResult) applyAttackResult(opp.attackResult)
      }
      if (result.attackResult) applyAttackResult(result.attackResult)
    }
  }

  function processTurnStart(data: {
    characterId: number
    round: number
  }): void {
    currentTurnCharacterId.value = data.characterId
    currentRound.value = data.round
  }

  function processRoundStart(data: RoundStartView & { combatants?: CombatantView[] }): void {
    currentRound.value = data.roundNumber

    // Add bleeding tick entries to the combat log
    for (const bleed of data.bleedingDamage) {
      const c = combatants.value.find(c => c.characterId === bleed.characterId)
      const name = c?.characterName ?? `Character ${bleed.characterId}`
      const died = data.deaths.some(d => d.characterId === bleed.characterId)
      let narrative = `${name} takes ${bleed.damage} bleeding damage (${bleed.stacks} stack${bleed.stacks > 1 ? 's' : ''})`
      if (died) narrative += ` and bleeds out!`
      combatLog.value.push({
        sessionId: 0,
        roundNumber: data.roundNumber,
        turnNumber: 0,
        actorCharacterId: bleed.characterId,
        actorName: name,
        actionType: 'bleeding',
        targetCharacterId: null,
        targetName: null,
        attackResult: null,
        statusEffectsApplied: [],
        statusEffectsRemoved: [],
        narrative,
        opportunityAttacks: [],
      })
    }

    // Sync full combatant state if provided
    if (data.combatants) {
      combatants.value = data.combatants
      return
    }

    // Fallback: manual state updates
    // Apply bleeding damage
    for (const bleed of data.bleedingDamage) {
      const c = combatants.value.find(c => c.characterId === bleed.characterId)
      if (c) {
        c.currentHealth = Math.max(0, c.currentHealth - bleed.damage)
      }
    }

    // Process deaths
    for (const death of data.deaths) {
      const c = combatants.value.find(c => c.characterId === death.characterId)
      if (c) {
        c.isAlive = false
      }
    }

    // Remove expired effects
    for (const expired of data.expiredEffects) {
      const c = combatants.value.find(c => c.characterId === expired.characterId)
      if (c) {
        c.statusEffects = c.statusEffects.filter(e => e.type !== expired.type)
      }
    }
  }

  function processCombatantDefeated(characterId: number): void {
    const c = combatants.value.find(c => c.characterId === characterId)
    if (c) c.isAlive = false
  }

  function processCombatantYielded(characterId: number): void {
    const c = combatants.value.find(c => c.characterId === characterId)
    if (c) c.isYielded = true
  }

  function processSessionEnd(data: { winningTeam: number | null }): void {
    winningTeam.value = data.winningTeam
    sessionEnded.value = true
  }

  function processWoundAssessment(results: WoundAssessmentView[]): void {
    woundAssessments.value = results
  }

  function selectTarget(characterId: number | null): void {
    selectedTargetId.value = characterId
  }

  // ── Combat callouts (NPC speech bubbles) ──

  interface ActiveCallout {
    characterId: number
    text: string
    id: number
  }

  let nextCalloutId = 0
  const activeCallouts = ref<ActiveCallout[]>([])

  function addCallout(characterId: number, text: string): void {
    const id = nextCalloutId++
    activeCallouts.value.push({ characterId, text, id })
    setTimeout(() => {
      activeCallouts.value = activeCallouts.value.filter(c => c.id !== id)
    }, 4000)
  }

  function getCalloutFor(characterId: number): ActiveCallout | null {
    return activeCallouts.value.find(c => c.characterId === characterId) ?? null
  }

  function clearCombatSession(): void {
    sessionId.value = null
    combatants.value = []
    turnOrder.value = []
    currentTurnCharacterId.value = null
    currentRound.value = 1
    combatLog.value = []
    winningTeam.value = null
    sessionEnded.value = false
    selectedTargetId.value = null
    woundAssessments.value = []
    activeCallouts.value = []
    activeView.value = 'none'
  }

  return {
    // Lobby state
    currentLobbyId,
    lobbyState,
    availableLobbies,
    activeView,
    // Lobby computed
    isInLobby,
    isHost,
    myTeam,
    myReady,
    allReady,
    team1Members,
    team2Members,
    // Lobby actions
    updateLobbyState,
    setAvailableLobbies,
    clearLobby,
    openPanel,
    closePanel,
    // Combat session state
    sessionId,
    combatants,
    turnOrder,
    currentTurnCharacterId,
    currentRound,
    combatLog,
    winningTeam,
    sessionEnded,
    selectedTargetId,
    // Combat session computed
    isInCombat,
    isMyTurn,
    isRetainerTurn,
    currentActorId,
    currentRetainerCombatant,
    myRetainerIds,
    myCombatTeam,
    enemies,
    allies,
    myCombatant,
    // Combat session actions
    initCombatSession,
    processActionResult,
    processTurnStart,
    processRoundStart,
    processCombatantDefeated,
    processCombatantYielded,
    processSessionEnd,
    processWoundAssessment,
    woundAssessments,
    selectTarget,
    clearCombatSession,
    // Callouts
    activeCallouts,
    addCallout,
    getCalloutFor,
  }
})
