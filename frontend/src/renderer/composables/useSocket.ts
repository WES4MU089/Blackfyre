import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useCharacterStore, type CharacterListEntry, type RetainerTierInfo } from '@/stores/character'
import { useHudStore } from '@/stores/hud'
import { useCreationStore, type ClassTemplate } from '@/stores/creation'
import {
  useCombatStore,
  type LobbyStateView, type LobbyListEntry,
  type CombatantView, type ActionResultView, type RoundStartView,
} from '@/stores/combat'
import { useNpcDialogStore, type DialogPayload } from '@/stores/npcDialog'
import { useAilmentsStore } from '@/stores/ailments'
import { useShopStore, type ShopOpenPayload } from '@/stores/shop'
import { useContainerStore, type ContainerOpenPayload } from '@/stores/container'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useNotificationStore } from '@/stores/notifications'
import { BACKEND_URL } from '@/config'

const SOCKET_URL = BACKEND_URL

let socket: Socket | null = null
const isConnected = ref(false)

export function getSocket(): Socket | null {
  return socket
}

export function useSocket() {
  const characterStore = useCharacterStore()
  const hudStore = useHudStore()

  function connect(token: string): void {
    if (socket?.connected) return

    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      auth: { token }
    })

    socket.on('connect', () => {
      isConnected.value = true
      hudStore.setConnected(true)
      // characters:list and hud:sync are sent by server after JWT auth completes,
      // so we don't emit them here — they'd race and fail before auth is done.
      startPing()
    })

    socket.on('disconnect', (reason) => {
      isConnected.value = false
      hudStore.setConnected(false)
      console.warn('Socket disconnected:', reason)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
      hudStore.setConnected(false)
    })

    // Auth response — populate permissions for staff features
    socket.on('player:authenticated', async (data: {
      playerId: number
      roleName?: string | null
      permissions?: string[]
      isSuperAdmin?: boolean
    }) => {
      console.log('Player authenticated:', data.playerId)
      const authStore = useAuthStore()
      if (authStore.user) {
        authStore.user = {
          ...authStore.user,
          roleName: data.roleName ?? null,
          permissions: data.permissions ?? [],
          isSuperAdmin: data.isSuperAdmin ?? false,
        }
      }

      // Session resumption: if we already had an active character before
      // disconnect, re-select it on the server so the new socket joins
      // the character room and receives character-scoped events again.
      const activeCharId = characterStore.character?.id
      if (activeCharId) {
        console.log('Reconnect: re-selecting active character', activeCharId)
        socket?.emit('character:select', { characterId: activeCharId })
      } else {
        // No active character — check electron-store for last played
        const lastId = await window.electronAPI.getLastCharacter()
        if (lastId !== null) {
          // characters:list handler will also try this, but that may arrive
          // later; doing it here ensures faster resumption
          console.log('Reconnect: restoring last character from storage', lastId)
        }
      }

      hudStore.addNotification('success', 'Connected', 'Authenticated with server')
    })

    // --- Persistent notification events ---
    const notificationStore = useNotificationStore()

    socket.on('notification:new', (data: { notification: Record<string, unknown>; showToast?: boolean }) => {
      notificationStore.onNewNotification(data)
    })

    socket.on('notifications:unread-count', (data: { unreadCount: number }) => {
      notificationStore.setUnreadCount(data.unreadCount)
    })

    // Character data loaded
    socket.on('character:loaded', (data: Record<string, unknown>) => {
      characterStore.loadCharacterData(data)
      hudStore.addNotification('info', 'Character Loaded', `Playing as ${characterStore.character?.name ?? 'Unknown'}`)
      // Prefetch wound/ailment data so Health tab is ready
      const ailmentsStore = useAilmentsStore()
      if (characterStore.character?.id) {
        ailmentsStore.fetchAilments(characterStore.character.id)
      }
    })

    // Characters list (for character switcher + auto-trigger creation)
    socket.on('characters:list', async (data: CharacterListEntry[]) => {
      characterStore.setCharacterList(data)
      // Only count playable characters (not pending/denied/revision)
      const playableChars = data.filter(c =>
        !c.application_status || c.application_status === 'none' || c.application_status === 'approved'
      )
      if (playableChars.length === 0 && data.length === 0) {
        // Auto-trigger creation wizard if player has no characters at all
        const creationStore = useCreationStore()
        if (!creationStore.isOpen) {
          creationStore.open()
          requestTemplates()
        }
      } else if (!characterStore.character) {
        // Auto-select last played character only if no character is active yet
        const lastId = await window.electronAPI.getLastCharacter()
        if (lastId !== null && playableChars.some(c => c.id === lastId)) {
          selectCharacter(lastId)
        }
      }
    })

    // Character deleted confirmation
    socket.on('character:deleted', (data: { characterId: number }) => {
      // If we just deleted the active character, clear state (but list will be refreshed by server)
      if (characterStore.character?.id === data.characterId) {
        characterStore.character = null
      }
      hudStore.addNotification('info', 'Character Deleted', 'The character has been permanently deleted.')
    })

    // Real-time vitals updates
    socket.on('vitals:changed', (data: Record<string, number>) => {
      characterStore.updateVitals(data)
    })

    // Full HUD state sync
    socket.on('hud:state', (data: Record<string, unknown>) => {
      characterStore.loadCharacterData(data)
    })

    // Pong for latency measurement
    socket.on('pong', (timestamp: number) => {
      const latency = Date.now() - timestamp
      hudStore.setLatency(latency)
    })

    // Location updates from SL keepalive
    socket.on('location:update', (data: {
      simName: string
      gridX: number
      gridY: number
      posX: number
      posY: number
      posZ: number
    }) => {
      hudStore.updateLocation(data)
    })

    // Region player count
    socket.on('region:player-count', (data: { count: number }) => {
      hudStore.setRegionPlayerCount(data.count)
    })

    // SL account linking required (no verified SL account for this Discord user)
    socket.on('sl:link-required', (data: { code: string; expiresAt: string }) => {
      hudStore.setSLLinkingCode(data.code, data.expiresAt)
    })

    // SL account successfully linked
    socket.on('sl:linked', (data: { playerId: number; slUuid: string }) => {
      hudStore.clearSLLinking()
      hudStore.addNotification('success', 'Account Linked', 'Your Second Life avatar is now connected to Blackfyre.')
      console.log('SL account linked:', data)
    })

    // Character creation - templates list response
    socket.on('templates:list', (data: ClassTemplate[]) => {
      const creationStore = useCreationStore()
      creationStore.templates = data
    })

    // Character creation - success response
    socket.on('character:created', (data: { characterId: number; characterName: string; applicationStatus?: string; tier?: number }) => {
      const creationStore = useCreationStore()
      creationStore.isSubmitting = false
      creationStore.close()

      if (data.applicationStatus === 'pending') {
        // Tier 2/3: application submitted, character not playable yet
        hudStore.addNotification('info', 'Application Submitted', `${data.characterName} is pending staff review and cannot be played until approved.`)
        // Refresh character list to show pending badge
        socket?.emit('characters:list')
      } else {
        // Tier 1: auto-select the newly created character
        socket?.emit('character:select', { characterId: data.characterId })
        window.electronAPI.setLastCharacter(data.characterId)
        hudStore.addNotification('success', 'Character Created', `Welcome, ${data.characterName}!`)
      }
    })

    // Character creation - error response
    socket.on('character:create:error', (data: { message: string; field?: string }) => {
      const creationStore = useCreationStore()
      creationStore.isSubmitting = false
      creationStore.submitError = data.message
    })

    // --- Combat Lobby events ---
    const combatStore = useCombatStore()

    socket.on('lobby:created', (data: LobbyStateView) => {
      combatStore.updateLobbyState(data)
      hudStore.addNotification('info', 'Lobby', 'Combat lobby created')
    })

    socket.on('lobby:state', (data: LobbyStateView) => {
      combatStore.updateLobbyState(data)
    })

    socket.on('lobby:left', () => {
      combatStore.clearLobby()
    })

    socket.on('lobby:cancelled', (data: { lobbyId: number; reason: string }) => {
      combatStore.clearLobby()
      hudStore.addNotification('warning', 'Lobby', data.reason)
    })

    socket.on('lobby:starting', () => {
      hudStore.addNotification('info', 'Combat', 'Combat is starting...')
    })

    socket.on('lobby:list', (data: { lobbies: LobbyListEntry[] }) => {
      combatStore.setAvailableLobbies(data.lobbies)
    })

    socket.on('lobby:region-update', () => {
      // Refresh lobby list when a lobby is created/cancelled in our region
      socket?.emit('lobby:list')
    })

    socket.on('lobby:error', (data: { message: string }) => {
      hudStore.addNotification('danger', 'Combat', data.message)
    })

    // --- Combat Session events ---

    socket.on('combat:session-start', (data: {
      sessionId: number
      combatants: CombatantView[]
      turnOrder: { characterId: number; initiative: number; team: number }[]
      currentTurnCharacterId: number
      currentRound: number
    }) => {
      combatStore.initCombatSession(data)
      hudStore.addNotification('info', 'Combat', 'Combat has begun!')
    })

    socket.on('combat:turn-start', (data: { sessionId: number; characterId: number; round: number }) => {
      combatStore.processTurnStart(data)
    })

    socket.on('combat:action-result', (data: { sessionId: number; result: ActionResultView; combatants?: CombatantView[] }) => {
      combatStore.processActionResult(data.result, data.combatants)
    })

    socket.on('combat:round-start', (data: { sessionId: number; combatants?: CombatantView[] } & RoundStartView) => {
      combatStore.processRoundStart(data)
    })

    socket.on('combat:turn-skipped', (data: { sessionId: number; characterId: number; reason: string }) => {
      // Turn skip is informational — turn-start follows
    })

    socket.on('combat:combatant-defeated', (data: { sessionId: number; characterId: number; killedBy: number }) => {
      combatStore.processCombatantDefeated(data.characterId)
    })

    socket.on('combat:combatant-yielded', (data: { sessionId: number; characterId: number }) => {
      combatStore.processCombatantYielded(data.characterId)
    })

    socket.on('combat:session-end', (data: { sessionId: number; winningTeam: number | null }) => {
      // Sync combat health back to character store before processing end
      const myCombatant = combatStore.myCombatant
      if (myCombatant) {
        characterStore.updateVitals({ health: myCombatant.currentHealth })
      }
      combatStore.processSessionEnd(data)
      // Persistent notification + toast handled by notification:new from server
    })

    socket.on('combat:wound-assessment', (data: { sessionId: number; results: any[] }) => {
      combatStore.processWoundAssessment(data.results)
    })

    socket.on('combat:error', (data: { message: string }) => {
      hudStore.addNotification('danger', 'Combat', data.message)
    })

    // --- Ailment events ---
    const ailmentsStore = useAilmentsStore()

    socket.on('ailment:onset', (data: any) => {
      ailmentsStore.onAilmentOnset(data)
      hudStore.addNotification('warning', 'Ailment', `${data.name} has taken hold`)
    })

    socket.on('ailment:progressed', (data: any) => {
      ailmentsStore.onAilmentProgressed(data)
      hudStore.addNotification('danger', 'Ailment', `Condition has worsened to ${data.stageName}`)
    })

    socket.on('ailment:improved', (data: any) => {
      ailmentsStore.onAilmentImproved(data)
      hudStore.addNotification('info', 'Ailment', `Condition improved to ${data.stageName}`)
    })

    socket.on('ailment:cured', (data: any) => {
      ailmentsStore.onAilmentCured(data)
      hudStore.addNotification('success', 'Cured', 'Ailment has been cured')
    })

    socket.on('wound:updated', (data: any) => {
      ailmentsStore.onWoundUpdated(data)
    })

    socket.on('character:death', (data: { characterId: number; cause: string }) => {
      // Persistent notification + toast handled by notification:new from server
    })

    // --- NPC Dialog events ---
    const npcDialogStore = useNpcDialogStore()

    socket.on('npc:dialog-open', (data: DialogPayload) => {
      npcDialogStore.openDialog(data)
    })

    socket.on('npc:dialog-node', (data: DialogPayload) => {
      npcDialogStore.updateNode(data)
    })

    socket.on('npc:dialog-close', () => {
      npcDialogStore.closeDialog()
    })

    socket.on('npc:error', (data: { message: string }) => {
      hudStore.addNotification('danger', 'NPC', data.message)
    })

    // --- Shop events ---
    const shopStore = useShopStore()

    socket.on('shop:open', (data: ShopOpenPayload) => {
      shopStore.openShop(data)
    })

    socket.on('shop:buy-result', (data: { success: boolean; message: string; itemName?: string; cash?: number }) => {
      shopStore.setMessage(data.success, data.message)
      if (data.success && data.cash != null) {
        shopStore.updateCash(data.cash)
      }
    })

    // --- Container events ---
    const containerStore = useContainerStore()

    socket.on('container:open', (data: ContainerOpenPayload) => {
      containerStore.openContainer(data)
      // Auto-open inventory panel so player can drag items between both
      if (!hudStore.isPanelOpen('inventory')) {
        hudStore.toggleSystemPanel('inventory')
      }
    })

    socket.on('container:updated', (data: { containerId: number; items: ContainerOpenPayload['items'] }) => {
      containerStore.updateItems(data.items)
    })

    socket.on('container:error', (data: { message: string }) => {
      if (containerStore.isOpen) {
        containerStore.setMessage(false, data.message)
      } else {
        hudStore.addNotification('danger', 'Container', data.message)
      }
    })

    socket.on('container:lock-changed', (data: { containerId: number; isLocked: boolean }) => {
      if (containerStore.containerId === data.containerId) {
        containerStore.setLocked(data.isLocked)
      }
    })

    socket.on('container:renamed', (data: { containerId: number; name: string }) => {
      if (containerStore.containerId === data.containerId) {
        containerStore.setName(data.name)
      }
    })

    // --- Finances updates ---
    socket.on('finances:changed', (data: Record<string, number>) => {
      characterStore.updateFinances(data)
      // Also update shop cash if shop is open
      if (shopStore.isOpen && data.cash != null) {
        shopStore.updateCash(data.cash)
      }
    })

    // --- Inventory updates (from shop purchases, etc.) ---
    socket.on('inventory:changed', (data: unknown[]) => {
      characterStore.setInventory(data)
    })

    // --- Retainer updates (from hire/dismiss via NPC or character panel) ---
    socket.on('retainers:changed', (data: unknown[]) => {
      characterStore.setRetainers(data)
    })

    // Retainer Captain opens the hiring UI for a specific tier
    socket.on('retainer:open-hire', (data: RetainerTierInfo) => {
      characterStore.openRetainerHire(data)
    })

    // --- XP events ---
    socket.on('xp:character-gain', (data: { segments: number; totalSegments: number; source: string }) => {
      characterStore.updateCharacterXp(data)
      hudStore.addNotification('info', 'Experience', `+${data.segments} segment${data.segments > 1 ? 's' : ''}`)
    })

    socket.on('xp:character-levelup', (data: { newLevel: number; segments: number; aptitudePoints: number }) => {
      characterStore.applyLevelUp(data)
      // Persistent notification + toast handled by notification:new from server
    })

    // --- Point allocation responses ---
    socket.on('aptitude:updated', (data: { aptitudeKey: string; newValue: number; unspentAptitudePoints: number }) => {
      characterStore.applyAptitudeAllocation(data)
    })

    // --- Application events ---
    socket.on('application:updated', (data: {
      characterId: number
      characterName: string
      status: string
    }) => {
      // Persistent notification + toast handled by notification:new from server
      // Just refresh character list to pick up new status
      socket?.emit('characters:list')
    })

    // application:comment for players is now handled by persistent notification:new from server

    socket.on('application:submitted', (data: { characterName: string; tier: number }) => {
      // Staff notification — refresh admin queue if open
      hudStore.addNotification('info', 'New Application', `${data.characterName} (Tier ${data.tier})`)
      const admin = useAdminStore()
      if (admin.isOpen) {
        admin.fetchApplicationQueue()
      }
    })

    // Server errors
    socket.on('error', (data: { message: string }) => {
      hudStore.addNotification('danger', 'Error', data.message)
    })
  }

  let pingInterval: ReturnType<typeof setInterval> | null = null

  function startPing(): void {
    if (pingInterval) clearInterval(pingInterval)
    pingInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('ping', Date.now())
      }
    }, 10000)
  }

  function authenticate(slUuid: string, slName: string): void {
    socket?.emit('player:auth', { slUuid, slName })
  }

  function selectCharacter(characterId: number): void {
    socket?.emit('character:select', { characterId })
    window.electronAPI.setLastCharacter(characterId)
  }

  function requestCharacterList(): void {
    socket?.emit('characters:list')
  }

  function requestSync(): void {
    socket?.emit('hud:sync')
  }

  function requestTemplates(): void {
    socket?.emit('templates:list')
  }

  function submitCharacterCreation(payload: {
    templateKey: string
    aptitudes: Record<string, number>
    name: string
    backstory?: string
  }): void {
    socket?.emit('character:create', payload)
  }

  function selectNpcOption(optionId: string): void {
    socket?.emit('npc:select-option', { optionId })
  }

  function closeNpcDialog(): void {
    socket?.emit('npc:close')
  }

  function closeShop(): void {
    socket?.emit('shop:close')
  }

  function dismissRetainer(retainerId: number): void {
    socket?.emit('retainer:dismiss', { retainerId })
  }

  function deleteCharacter(characterId: number, confirmName: string): void {
    socket?.emit('character:delete', { characterId, confirmName })
  }

  function allocateAptitude(aptitudeKey: string): void {
    socket?.emit('aptitude:allocate', { aptitudeKey })
  }

  function disconnect(): void {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
    socket?.disconnect()
    socket = null
    isConnected.value = false
  }

  onUnmounted(() => {
    // Don't disconnect on unmount - socket persists across views
  })

  return {
    isConnected,
    connect,
    authenticate,
    selectCharacter,
    requestCharacterList,
    requestSync,
    requestTemplates,
    submitCharacterCreation,
    selectNpcOption,
    closeNpcDialog,
    closeShop,
    dismissRetainer,
    deleteCharacter,
    allocateAptitude,
    disconnect
  }
}
