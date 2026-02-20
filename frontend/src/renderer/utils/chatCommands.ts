export type ChatTab = 'ic' | 'whispers' | 'ooc' | 'system'
export type MessageType = 'say' | 'shout' | 'low' | 'emote' | 'ooc' | 'gooc' | 'whisper'

export interface ParsedCommand {
  type: MessageType
  content: string
  targetSessionId?: number
}

/**
 * Parse raw input text into a command payload.
 * Commands:
 *   /shout, /s  → shout
 *   /low, /l    → low
 *   /me         → emote
 *   /w <id>     → whisper to session ID
 *   /ooc        → local OOC (when in IC tab)
 *   /gooc       → global OOC
 *
 * Defaults:
 *   IC tab   → say
 *   OOC tab  → ooc
 */
export function parseCommand(input: string, activeTab: ChatTab): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // /shout or /s → shout
  if (trimmed.startsWith('/shout ') || trimmed.startsWith('/s ')) {
    const content = trimmed.startsWith('/shout ')
      ? trimmed.slice(7).trim()
      : trimmed.slice(3).trim()
    if (!content) return null
    return { type: 'shout', content }
  }

  // /low or /l → low
  if (trimmed.startsWith('/low ') || trimmed.startsWith('/l ')) {
    const content = trimmed.startsWith('/low ')
      ? trimmed.slice(5).trim()
      : trimmed.slice(3).trim()
    if (!content) return null
    return { type: 'low', content }
  }

  // /me → emote
  if (trimmed.startsWith('/me ')) {
    const content = trimmed.slice(4).trim()
    if (!content) return null
    return { type: 'emote', content }
  }

  // /w <id> <message> → whisper
  const whisperMatch = trimmed.match(/^\/w\s+(\d+)\s+(.+)$/s)
  if (whisperMatch) {
    const targetSessionId = parseInt(whisperMatch[1], 10)
    const content = whisperMatch[2].trim()
    if (!content) return null
    return { type: 'whisper', content, targetSessionId }
  }

  // /gooc → global OOC
  if (trimmed.startsWith('/gooc ')) {
    const content = trimmed.slice(6).trim()
    if (!content) return null
    return { type: 'gooc', content }
  }

  // /ooc → local OOC (useful when typing in IC tab)
  if (trimmed.startsWith('/ooc ')) {
    const content = trimmed.slice(5).trim()
    if (!content) return null
    return { type: 'ooc', content }
  }

  // Default based on active tab
  if (activeTab === 'ooc') {
    return { type: 'ooc', content: trimmed }
  }

  // IC tab default → say
  return { type: 'say', content: trimmed }
}
