import { ref, onUnmounted } from 'vue'

/**
 * Typewriter composable — reveals text character by character.
 * Used for NPC dialog text to give a "speaking" feel.
 */
export function useTypewriter(options: { intervalMs?: number } = {}) {
  const fullText = ref('')
  const visibleCount = ref(0)
  const isAnimating = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  function start(text: string): void {
    stop()
    fullText.value = text
    visibleCount.value = 0
    isAnimating.value = true
    timer = setInterval(() => {
      visibleCount.value++
      if (visibleCount.value >= fullText.value.length) {
        stop()
      }
    }, options.intervalMs ?? 30)
  }

  /** Instantly reveal all text (e.g. when player clicks an option). */
  function skip(): void {
    if (timer) clearInterval(timer)
    timer = null
    visibleCount.value = fullText.value.length
    isAnimating.value = false
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = null
    isAnimating.value = false
  }

  onUnmounted(() => stop())

  return { fullText, visibleCount, isAnimating, start, skip }
}
