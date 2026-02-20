import { getSocket } from './useSocket'
import { useCombatStore } from '@/stores/combat'

export function useCombat() {
  const combatStore = useCombatStore()

  function createLobby(): void {
    getSocket()?.emit('lobby:create')
  }

  function joinLobby(lobbyId: number): void {
    getSocket()?.emit('lobby:join', { lobbyId })
  }

  function leaveLobby(): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:leave', { lobbyId: combatStore.currentLobbyId })
  }

  function switchTeam(team: number): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:switch-team', { lobbyId: combatStore.currentLobbyId, team })
  }

  function setReady(ready: boolean): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:ready', { lobbyId: combatStore.currentLobbyId, ready })
  }

  function startCombat(): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:start', { lobbyId: combatStore.currentLobbyId })
  }

  function cancelLobby(): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:cancel', { lobbyId: combatStore.currentLobbyId })
  }

  function requestLobbies(): void {
    getSocket()?.emit('lobby:list')
  }

  // --- Combat session actions ---

  function submitAction(actionType: string, targetCharacterId?: number): void {
    if (!combatStore.sessionId) return
    const actorCharacterId = combatStore.isRetainerTurn
      ? combatStore.currentActorId ?? undefined
      : undefined
    getSocket()?.emit('combat:action', {
      sessionId: combatStore.sessionId,
      actionType,
      targetCharacterId,
      actorCharacterId,
    })
  }

  function yieldCombat(): void {
    if (!combatStore.sessionId) return
    const actorCharacterId = combatStore.isRetainerTurn
      ? combatStore.currentActorId ?? undefined
      : undefined
    getSocket()?.emit('combat:yield', {
      sessionId: combatStore.sessionId,
      actorCharacterId,
    })
  }

  function skipTurn(): void {
    if (!combatStore.sessionId) return
    const actorCharacterId = combatStore.isRetainerTurn
      ? combatStore.currentActorId ?? undefined
      : undefined
    getSocket()?.emit('combat:skip', {
      sessionId: combatStore.sessionId,
      actorCharacterId,
    })
  }

  function toggleRetainers(retainerIds: number[]): void {
    if (!combatStore.currentLobbyId) return
    getSocket()?.emit('lobby:toggle-retainers', {
      lobbyId: combatStore.currentLobbyId,
      retainerIds,
    })
  }

  return {
    // Lobby
    createLobby,
    joinLobby,
    leaveLobby,
    switchTeam,
    setReady,
    startCombat,
    cancelLobby,
    requestLobbies,
    // Combat session
    submitAction,
    yieldCombat,
    skipTurn,
    // Retainers
    toggleRetainers,
  }
}
