import { ref } from 'vue'
import type { InventoryItem, EquippedItem } from '@/stores/character'
import { acquireInteractionLock, releaseInteractionLock } from './useInteractionLock'

export interface DragPayload {
  source: 'inventory' | 'equipment'
  inventoryItem?: InventoryItem
  sourceSlot?: number
  equippedItem?: EquippedItem
  equipmentSlotId?: string
}

// Module-level singleton state — shared across all component instances
const isDragging = ref(false)
const dragPayload = ref<DragPayload | null>(null)
const dragPosition = ref({ x: 0, y: 0 })

// Minimum distance before drag activates (prevents accidental drags on clicks)
const DRAG_THRESHOLD = 4
// Safety timeout: auto-cancel stale drags (e.g. lost mouseup events from click-through toggle)
const DRAG_TIMEOUT_MS = 5000
let startX = 0
let startY = 0
let pendingPayload: DragPayload | null = null
let activated = false
let dragSafetyTimer: ReturnType<typeof setTimeout> | null = null

function onMouseMove(e: MouseEvent): void {
  if (!activated && pendingPayload) {
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
      activated = true
      isDragging.value = true
      dragPayload.value = pendingPayload
      acquireInteractionLock()
    }
  }

  if (activated) {
    dragPosition.value = { x: e.clientX, y: e.clientY }
  }
}

function onMouseUp(): void {
  cleanup()
}

function cleanup(): void {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (dragSafetyTimer) {
    clearTimeout(dragSafetyTimer)
    dragSafetyTimer = null
  }
  pendingPayload = null
  activated = false
}

export function useItemDrag() {
  function startDrag(e: MouseEvent, payload: DragPayload): void {
    e.preventDefault()
    startX = e.clientX
    startY = e.clientY
    pendingPayload = payload
    activated = false
    dragPosition.value = { x: e.clientX, y: e.clientY }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // Safety timeout: auto-cancel if drag stays active too long (e.g. lost events)
    if (dragSafetyTimer) clearTimeout(dragSafetyTimer)
    dragSafetyTimer = setTimeout(() => {
      if (isDragging.value) {
        isDragging.value = false
        dragPayload.value = null
        cleanup()
        releaseInteractionLock()
      }
    }, DRAG_TIMEOUT_MS)
  }

  /** Call on mouseup over a valid drop target. Returns the payload and resets state. */
  function endDrag(): DragPayload | null {
    const payload = dragPayload.value
    const wasActive = isDragging.value
    isDragging.value = false
    dragPayload.value = null
    cleanup()
    if (wasActive) releaseInteractionLock()
    return payload
  }

  /** Cancel drag without completing a drop */
  function cancelDrag(): void {
    const wasActive = isDragging.value
    isDragging.value = false
    dragPayload.value = null
    cleanup()
    if (wasActive) releaseInteractionLock()
  }

  return {
    isDragging,
    dragPayload,
    dragPosition,
    startDrag,
    endDrag,
    cancelDrag,
  }
}

/**
 * Check if an item's slot_type is compatible with a target equipment slot.
 * Handles flexible matching for accessory1/2 and ancillary1/2 groups.
 */
export function canEquipToSlot(slotType: string | undefined, targetSlotId: string): boolean {
  if (!slotType) return false

  // Direct match
  if (slotType === targetSlotId) return true

  // Group matching: accessory → accessory1/accessory2
  const targetGroup = targetSlotId.replace(/[12]$/, '')
  const itemGroup = slotType.replace(/[12]$/, '')
  return targetGroup === itemGroup
}
