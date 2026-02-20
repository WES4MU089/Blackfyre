import { ref } from 'vue'

/** Shared lock counter — when > 0, auto click-through stays in interactive mode */
const lockCount = ref(0)

export function acquireInteractionLock(): void {
  lockCount.value++
}

export function releaseInteractionLock(): void {
  lockCount.value = Math.max(0, lockCount.value - 1)
}

export function isInteractionLocked(): boolean {
  return lockCount.value > 0
}
