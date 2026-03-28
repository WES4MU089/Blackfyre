import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface DialogTextInput {
  placeholder: string
  maxLength: number
  submitId: string
  submitText: string
  cancelId?: string
  cancelText?: string
}

export interface DialogPayload {
  npcType: string
  npcName: string
  npcPortrait: string | null
  nodeId: string
  npcText: string
  options: { id: string; text: string }[]
  closeAfter: boolean
  textInput?: DialogTextInput
}

export interface DialogHistoryEntry {
  speaker: 'npc' | 'player'
  text: string
}

export const useNpcDialogStore = defineStore('npcDialog', () => {
  const isOpen = ref(false)
  const npcName = ref('')
  const npcType = ref('')
  const npcPortrait = ref<string | null>(null)
  const currentNodeId = ref('')
  const currentNpcText = ref('')
  const options = ref<{ id: string; text: string }[]>([])
  const textInput = ref<DialogTextInput | null>(null)
  const dialogHistory = ref<DialogHistoryEntry[]>([])
  const isClosing = ref(false)

  let closeTimer: ReturnType<typeof setTimeout> | null = null

  function openDialog(payload: DialogPayload): void {
    // Clear any pending close timer
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }

    isOpen.value = true
    isClosing.value = false
    npcName.value = payload.npcName
    npcType.value = payload.npcType
    npcPortrait.value = payload.npcPortrait
    currentNodeId.value = payload.nodeId
    currentNpcText.value = payload.npcText
    options.value = payload.options
    textInput.value = payload.textInput ?? null
    dialogHistory.value = [{ speaker: 'npc', text: payload.npcText }]

    if (payload.closeAfter) {
      scheduleClose()
    }
  }

  function updateNode(payload: DialogPayload): void {
    currentNodeId.value = payload.nodeId
    currentNpcText.value = payload.npcText
    options.value = payload.options
    textInput.value = payload.textInput ?? null
    dialogHistory.value.push({ speaker: 'npc', text: payload.npcText })

    if (payload.closeAfter) {
      scheduleClose()
    } else {
      isClosing.value = false
    }
  }

  function addPlayerChoice(text: string): void {
    dialogHistory.value.push({ speaker: 'player', text })
  }

  function closeDialog(): void {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    isOpen.value = false
    isClosing.value = false
    npcName.value = ''
    npcType.value = ''
    npcPortrait.value = null
    currentNodeId.value = ''
    currentNpcText.value = ''
    options.value = []
    textInput.value = null
    dialogHistory.value = []
  }

  function scheduleClose(): void {
    isClosing.value = true
    options.value = []
    closeTimer = setTimeout(() => {
      closeDialog()
    }, 2500)
  }

  const hasOptions = computed(() => options.value.length > 0 && !isClosing.value && !textInput.value)
  const hasTextInput = computed(() => textInput.value !== null && !isClosing.value)

  return {
    isOpen,
    npcName,
    npcType,
    npcPortrait,
    currentNodeId,
    currentNpcText,
    options,
    textInput,
    dialogHistory,
    isClosing,
    hasOptions,
    hasTextInput,
    openDialog,
    updateNode,
    addPlayerChoice,
    closeDialog,
  }
})
