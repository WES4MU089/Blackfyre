export interface TextSegment {
  type: 'text' | 'speech' | 'emote' | 'paragraph-break'
  content: string
}

export function parseParaText(raw: string): TextSegment[] {
  const segments: TextSegment[] = []
  const paragraphs = raw.split(/\n\n+/)

  paragraphs.forEach((para, index) => {
    if (index > 0) {
      segments.push({ type: 'paragraph-break', content: '' })
    }

    // Match *emotes* and "speech" (straight quotes, smart quotes)
    const regex = /(\*[^*]+\*)|("[^"]+"|[\u201c][^\u201d]+[\u201d])/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(para)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: para.slice(lastIndex, match.index) })
      }

      const matched = match[0]
      if (matched.startsWith('*')) {
        segments.push({ type: 'emote', content: matched.slice(1, -1) })
      } else {
        segments.push({ type: 'speech', content: matched })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < para.length) {
      segments.push({ type: 'text', content: para.slice(lastIndex) })
    }
  })

  return segments
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
