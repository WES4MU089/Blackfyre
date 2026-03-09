import { useHudStore } from '@/stores/hud'
import { isInteractionLocked } from './useInteractionLock'

let isOverInteractive = false
let seq = 0
let clickThroughTimer: ReturnType<typeof setTimeout> | null = null
let mouseDown = false
let mouseDownSince = 0
let recoveryInterval: ReturnType<typeof setInterval> | null = null
let lastMouseX = 0
let lastMouseY = 0

// Delay before enabling click-through (ms). Prevents flicker when
// the cursor briefly crosses a gap between widgets. Switching back
// to interactive is always instant.
const CLICK_THROUGH_DELAY = 120

// If mouseDown has been true longer than this, force-release it.
// Catches stuck state when mouseup fires in another window.
const MOUSE_DOWN_TIMEOUT = 3000

// Recovery check interval (ms). Periodically verifies click-through
// state is correct and fixes desync.
const RECOVERY_INTERVAL = 2000

function checkInteractive(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  // elementFromPoint skips pointer-events: none elements.
  // If it returns html/body, the cursor is over empty space.
  if (el && el !== document.documentElement && el !== document.body) return true

  // Teleported overlays inside pointer-events: none containers may not be found
  // by elementFromPoint. If any overlay is active, keep the window interactive.
  const popoverRoot = document.getElementById('hud-popover-root')
  if (popoverRoot && popoverRoot.children.length > 0) return true

  return false
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

function forceClickThrough(): void {
  if (clickThroughTimer !== null) {
    clearTimeout(clickThroughTimer)
    clickThroughTimer = null
  }
  if (isOverInteractive) {
    isOverInteractive = false
    seq++
    window.electronAPI.setAutoClickThrough(false, seq)
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
  lastMouseX = e.clientX
  lastMouseY = e.clientY

  const hudStore = useHudStore()

  // During layout edit or active drag/resize, stay interactive
  if (hudStore.layoutEditMode || isInteractionLocked()) {
    setInteractive()
    return
  }

  // Safety: release stuck mouseDown after timeout
  if (mouseDown && mouseDownSince > 0 && Date.now() - mouseDownSince > MOUSE_DOWN_TIMEOUT) {
    mouseDown = false
    mouseDownSince = 0
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
  mouseDownSince = Date.now()
  setInteractive()
}

function onMouseUp(): void {
  mouseDown = false
  mouseDownSince = 0
}

// When window loses focus, mouseup may fire in another window.
// Reset mouseDown to prevent permanent stuck state.
function onWindowBlur(): void {
  mouseDown = false
  mouseDownSince = 0
}

/**
 * Periodic recovery: if the window is interactive but cursor is over
 * empty space (and no mouse button / lock), force click-through.
 * Catches any desync caused by missed events or Electron IPC races.
 */
function recoveryCheck(): void {
  if (!isOverInteractive) return

  const hudStore = useHudStore()
  if (hudStore.layoutEditMode || isInteractionLocked()) return
  if (mouseDown) return

  // Re-check cursor position
  if (lastMouseX === 0 && lastMouseY === 0) return
  const interactive = checkInteractive(lastMouseX, lastMouseY)
  if (!interactive) {
    forceClickThrough()
  }
}

export function startAutoClickThrough(): void {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('mouseup', onMouseUp, true)
  window.addEventListener('blur', onWindowBlur)

  // Start periodic recovery check
  if (recoveryInterval !== null) clearInterval(recoveryInterval)
  recoveryInterval = setInterval(recoveryCheck, RECOVERY_INTERVAL)
}

export function stopAutoClickThrough(): void {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mousedown', onMouseDown, true)
  document.removeEventListener('mouseup', onMouseUp, true)
  window.removeEventListener('blur', onWindowBlur)

  if (clickThroughTimer !== null) {
    clearTimeout(clickThroughTimer)
    clickThroughTimer = null
  }
  if (recoveryInterval !== null) {
    clearInterval(recoveryInterval)
    recoveryInterval = null
  }
}

/**
 * Reset internal state after the HUD is re-shown or socket reconnects.
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
  mouseDownSince = 0
}
