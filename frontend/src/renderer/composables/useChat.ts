import { useChatStore, type ChatMessage, type WhisperMessage, type SessionPlayer, type AnyMessage } from '@/stores/chat'
import type { ChatTab, MessageType } from '@/utils/chatCommands'
import type { Socket } from 'socket.io-client'

let initialized = false

export function useChat(socket: Socket) {
  const chatStore = useChatStore()

  function init(): void {
    if (initialized) return
    initialized = true

    // Regular chat messages (IC say/shout/low/emote, OOC, GOOC, System)
    socket.on('chat:message', (data: ChatMessage) => {
      chatStore.addMessage(data)
    })

    // Whisper messages (sender + target only)
    socket.on('chat:whisper', (data: WhisperMessage) => {
      chatStore.addMessage({ ...data, tab: 'whispers' })
    })

    // History responses (tab-based)
    socket.on('chat:history', (data: {
      tab: ChatTab
      messages: AnyMessage[]
      hasMore: boolean
    }) => {
      const existing = chatStore.messagesByTab.get(data.tab)
      if (existing && existing.length > 0) {
        chatStore.prependHistory(data.tab, data.messages, data.hasMore)
      } else {
        chatStore.setHistory(data.tab, data.messages, data.hasMore)
      }
    })

    // Session ID assigned to this client
    socket.on('session:assigned', (data: { sessionId: number }) => {
      chatStore.setMySessionId(data.sessionId)
    })

    // Player list updates
    socket.on('session:player-list', (data: SessionPlayer[]) => {
      chatStore.setSessionPlayers(data)
    })

    // Request initial player list
    socket.emit('session:request-list')
  }

  function sendMessage(
    tab: ChatTab,
    content: string,
    messageType: MessageType,
    targetSessionId?: number
  ): void {
    socket.emit('chat:send', { tab, content, messageType, targetSessionId })
  }

  function loadHistory(tab: ChatTab, before?: string, limit = 50): void {
    socket.emit('chat:history', { tab, before, limit })
  }

  return {
    init,
    sendMessage,
    loadHistory,
  }
}
