import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useHudStore } from '@/stores/hud'
import { acquireInteractionLock, releaseInteractionLock } from './useInteractionLock'

export interface DraggableOptions {
  /** Allow dragging without layout edit mode (e.g. window panels with header handles) */
  alwaysDraggable?: boolean
}

export function useDraggable(areaId: string, elementRef: Ref<HTMLElement | null>, options?: DraggableOptions) {
  const isDragging = ref(false)
  const hudStore = useHudStore()

  let startMouseX = 0
  let startMouseY = 0
  let startElX = 0
  let startElY = 0

  function onDragStart(e: MouseEvent) {
    if (!options?.alwaysDraggable && !hudStore.layoutEditMode) return
    if (!elementRef.value) return
    e.preventDefault()
    e.stopPropagation()

    isDragging.value = true
    acquireInteractionLock()

    const rect = elementRef.value.getBoundingClientRect()
    startMouseX = e.clientX
    startMouseY = e.clientY
    startElX = rect.left
    startElY = rect.top

    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging.value) return

    const dx = e.clientX - startMouseX
    const dy = e.clientY - startMouseY

    let newX = startElX + dx
    let newY = startElY + dy

    // Clamp to viewport
    if (elementRef.value) {
      const rect = elementRef.value.getBoundingClientRect()
      const maxX = window.innerWidth - rect.width
      const maxY = window.innerHeight - rect.height
      newX = Math.max(0, Math.min(maxX, newX))
      newY = Math.max(0, Math.min(maxY, newY))
    }

    hudStore.setAreaPosition(areaId, newX, newY)
  }

  function onDragEnd() {
    isDragging.value = false
    releaseInteractionLock()
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Auto-save when using alwaysDraggable (layout edit mode saves on exit)
    if (options?.alwaysDraggable) {
      hudStore.saveLayout()
    }
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  })

  return { isDragging, onDragStart }
}
