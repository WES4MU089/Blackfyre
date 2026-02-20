import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useHudStore } from '@/stores/hud'
import { acquireInteractionLock, releaseInteractionLock } from './useInteractionLock'

export interface ResizableOptions {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
}

export function useResizable(
  areaId: string,
  elementRef: Ref<HTMLElement | null>,
  options: ResizableOptions
) {
  const isResizing = ref(false)
  const currentWidth = ref(options.minWidth)
  const currentHeight = ref(options.minHeight)
  const hudStore = useHudStore()

  let resizeStartX = 0
  let resizeStartY = 0
  let resizeStartW = 0
  let resizeStartH = 0

  function loadPersistedSize(): void {
    const saved = hudStore.hudPositions[areaId]
    if (saved?.width != null && saved?.height != null) {
      currentWidth.value = clamp(saved.width, options.minWidth, options.maxWidth)
      currentHeight.value = clamp(saved.height, options.minHeight, options.maxHeight)
    }
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    isResizing.value = true
    acquireInteractionLock()
    resizeStartX = e.clientX
    resizeStartY = e.clientY
    resizeStartW = currentWidth.value
    resizeStartH = currentHeight.value
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value) return
    const dx = e.clientX - resizeStartX
    const dy = e.clientY - resizeStartY
    currentWidth.value = clamp(resizeStartW + dx, options.minWidth, options.maxWidth)
    currentHeight.value = clamp(resizeStartH + dy, options.minHeight, options.maxHeight)
  }

  function onResizeEnd() {
    isResizing.value = false
    releaseInteractionLock()
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Persist size
    hudStore.setAreaSize(areaId, currentWidth.value, currentHeight.value)
    hudStore.saveLayout()
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  })

  // Load persisted size on creation
  loadPersistedSize()

  return { isResizing, onResizeStart, currentWidth, currentHeight }
}
