import { useHudStore } from '@/stores/hud'
import { isInteractionLocked } from './useInteractionLock'

let isOverInteractive = false
let seq = 0
let clickThroughTimer: ReturnType<typeof setTimeout> | null = null
let mouseDown = false

// Delay before enabling click-through (ms). Prevents flicker when
// the cursor briefly crosses a gap between widgets. Switching back
// to interactive is always instant.
const CLICK_THROUGH_DELAY = 120

function checkInteractive(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) return false
  // elementFromPoint skips pointer-events: none elements.
  // If it returns html/body, the cursor is over empty space.
  if (el === document.documentElement || el === document.body) return false
  return true
}

function setInteractive(): void {
  // Cancel any pending click-through transition
  if (clickThroughTimer !== null) {
    clearTimeout(clickThroughTimer)
    clickThroughTimer = null
  }
  if (!isOverInteractive) {
    isOverInteractive = true
    seq++
    window.electronAPI.setAutoClickThrough(true, seq)
  }
}

function scheduleClickThrough(): void {
  // Already click-through or already scheduled
  if (!isOverInteractive || clickThroughTimer !== null) return

  clickThroughTimer = setTimeout(() => {
    clickThroughTimer = null
    // Re-check: mouse may have moved back over a widget during the delay
    if (mouseDown) return
    isOverInteractive = false
    seq++
    window.electronAPI.setAutoClickThrough(false, seq)
  }, CLICK_THROUGH_DELAY)
}

function onMouseMove(e: MouseEvent): void {
  const hudStore = useHudStore()

  // During layout edit or active drag/resize, stay interactive
  if (hudStore.layoutEditMode || isInteractionLocked()) {
    setInteractive()
    return
  }

  // Never go click-through while a mouse button is held
  if (mouseDown) {
    setInteractive()
    return
  }

  const interactive = checkInteractive(e.clientX, e.clientY)

  if (interactive) {
    setInteractive()
  } else {
    scheduleClickThrough()
  }
}

function onMouseDown(): void {
  mouseDown = true
  setInteractive()
}

function onMouseUp(): void {
  mouseDown = false
}

export function startAutoClickThrough(): void {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('mouseup', onMouseUp, true)
}

export function stopAutoClickThrough(): void {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mousedown', onMouseDown, true)
  document.removeEventListener('mouseup', onMouseUp, true)
  if (clickThroughTimer !== null) {
    clearTimeout(clickThroughTimer)
    clickThroughTimer = null
  }
}

/**
 * Reset internal state after the HUD is re-shown.
 * The main process resets lastAutoSeq to 0 and sets the window interactive,
 * so we reset seq to match and mark ourselves as interactive to stay in sync.
 */
export function resetAutoClickThrough(): void {
  if (clickThroughTimer !== null) {
    clearTimeout(clickThroughTimer)
    clickThroughTimer = null
  }
  isOverInteractive = true
  seq = 0
  mouseDown = false
}
