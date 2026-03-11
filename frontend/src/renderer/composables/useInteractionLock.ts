import { ref } from 'vue'

/**
 * Token-based interaction lock system.
 *
 * Each acquireInteractionLock() returns a unique token. Calling
 * releaseInteractionLock(token) only decrements if that token hasn't
 * already been released — making double-release impossible.
 *
 * Legacy callers that don't use tokens still work via the counter,
 * but the token pattern should be preferred.
 */

let nextToken = 1
const activeTokens = new Set<number>()
const lockCount = ref(0)

/** Acquire a lock and return a release token. */
export function acquireInteractionLock(): number {
  const token = nextToken++
  activeTokens.add(token)
  lockCount.value = activeTokens.size
  return token
}

/**
 * Release a lock by token. Safe to call multiple times with the same
 * token — only the first call has any effect.
 */
export function releaseInteractionLock(token?: number): void {
  if (token !== undefined) {
    activeTokens.delete(token)
  } else {
    // Legacy path: remove the oldest token (FIFO)
    const first = activeTokens.values().next().value
    if (first !== undefined) activeTokens.delete(first)
  }
  lockCount.value = activeTokens.size
}

export function isInteractionLocked(): boolean {
  return activeTokens.size > 0
}

/**
 * Nuclear reset — clears ALL locks. Use sparingly, e.g. when the
 * combat session is fully torn down and we know no locks should remain.
 */
export function resetAllInteractionLocks(): void {
  activeTokens.clear()
  lockCount.value = 0
}
