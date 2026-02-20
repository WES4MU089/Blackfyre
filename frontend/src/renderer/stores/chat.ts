import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatTab } from '@/utils/chatCommands'
import { useHudStore } from './hud'

export type PortraitSize = 'sm' | 'md' | 'lg'

export interface ChatMessage {
  id: number
  tab: string
  character_id: number
  character_name: string
  portrait_url: string | null
  content: string
  message_type: string
  region: string
  created_at: string
  metadata?: {
    combatantTeams?: Record<string, number>
    retainerOwners?: Record<string, string>
  }
}

export interface WhisperMessage {
  id: number
  tab: 'whispers'
  sender_character_id: number
  sender_name: string
  sender_portrait_url: string | null
  target_character_id: number
  target_name: string
  target_portrait_url: string | null
  content: string
  region: string
  created_at: string
}

export interface SessionPlayer {
  sessionId: number
  characterId: number
  characterName: string
}

export type AnyMessage = ChatMessage | WhisperMessage

export const TABS: { key: ChatTab; label: string }[] = [
  { key: 'ic', label: 'IC' },
  { key: 'whispers', label: 'Whispers' },
  { key: 'ooc', label: 'OOC' },
  { key: 'system', label: 'System' },
]

export const useChatStore = defineStore('chat', () => {
  const messagesByTab = ref<Map<ChatTab, AnyMessage[]>>(new Map())
  const activeTab = ref<ChatTab>('ic')
  const isOpen = ref(false)
  const isMinimized = ref(false)
  const portraitSize = ref<PortraitSize>('md')
  const hasMoreByTab = ref<Map<ChatTab, boolean>>(new Map())
  const unreadByTab = ref<Map<ChatTab, number>>(new Map())
  const autoScroll = ref(true)
  const panelWidth = ref(380)
  const panelHeight = ref(500)
  const chatFontSize = ref(14) // px, range 10–22

  // Session players (GTA World-style IDs)
  const sessionPlayers = ref<SessionPlayer[]>([])
  const mySessionId = ref<number | null>(null)

  const activeMessages = computed(() =>
    messagesByTab.value.get(activeTab.value) ?? []
  )

  const totalUnread = computed(() => {
    let count = 0
    unreadByTab.value.forEach(v => { count += v })
    return count
  })

  const portraitDimensions = computed(() => {
    switch (portraitSize.value) {
      case 'sm': return { width: 60, height: 90 }
      case 'lg': return { width: 200, height: 300 }
      default:   return { width: 120, height: 180 }
    }
  })

  function setActiveTab(tab: ChatTab): void {
    activeTab.value = tab
    unreadByTab.value.set(tab, 0)
    autoScroll.value = true
  }

  function setHistory(tab: ChatTab, messages: AnyMessage[], hasMore: boolean): void {
    messagesByTab.value.set(tab, messages)
    hasMoreByTab.value.set(tab, hasMore)
  }

  function prependHistory(tab: ChatTab, messages: AnyMessage[], hasMore: boolean): void {
    const existing = messagesByTab.value.get(tab) ?? []
    messagesByTab.value.set(tab, [...messages, ...existing])
    hasMoreByTab.value.set(tab, hasMore)
  }

  function addMessage(message: AnyMessage): void {
    const tab = (message.tab ?? 'ic') as ChatTab
    const tabMessages = messagesByTab.value.get(tab) ?? []
    tabMessages.push(message)
    messagesByTab.value.set(tab, tabMessages)

    if (tab !== activeTab.value || !isOpen.value) {
      const current = unreadByTab.value.get(tab) ?? 0
      unreadByTab.value.set(tab, current + 1)
    }
  }

  function toggleOpen(): void {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
      isMinimized.value = false
      unreadByTab.value.set(activeTab.value, 0)
    }
    useHudStore().savePanelStates()
  }

  function toggleMinimize(): void {
    isMinimized.value = !isMinimized.value
    useHudStore().savePanelStates()
  }

  function setPortraitSize(size: PortraitSize): void {
    portraitSize.value = size
  }

  function increaseFontSize(): void {
    chatFontSize.value = Math.min(22, chatFontSize.value + 1)
  }

  function decreaseFontSize(): void {
    chatFontSize.value = Math.max(10, chatFontSize.value - 1)
  }

  function setAutoScroll(enabled: boolean): void {
    autoScroll.value = enabled
  }

  function setPanelSize(width: number, height: number): void {
    panelWidth.value = Math.max(280, Math.min(800, width))
    panelHeight.value = Math.max(200, Math.min(900, height))
  }

  function setSessionPlayers(players: SessionPlayer[]): void {
    sessionPlayers.value = players
  }

  function setMySessionId(id: number): void {
    mySessionId.value = id
  }

  function clear(): void {
    messagesByTab.value = new Map()
    activeTab.value = 'ic'
    isOpen.value = false
    unreadByTab.value = new Map()
    sessionPlayers.value = []
    mySessionId.value = null
  }

  return {
    messagesByTab,
    activeTab,
    isOpen,
    isMinimized,
    portraitSize,
    hasMoreByTab,
    unreadByTab,
    autoScroll,
    panelWidth,
    panelHeight,
    chatFontSize,
    sessionPlayers,
    mySessionId,
    activeMessages,
    totalUnread,
    portraitDimensions,
    setActiveTab,
    setHistory,
    prependHistory,
    addMessage,
    toggleOpen,
    toggleMinimize,
    setPortraitSize,
    increaseFontSize,
    decreaseFontSize,
    setAutoScroll,
    setPanelSize,
    setSessionPlayers,
    setMySessionId,
    clear,
  }
})
