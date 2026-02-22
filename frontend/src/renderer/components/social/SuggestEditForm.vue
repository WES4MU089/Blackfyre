<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSocialStore, type FamilyTreeNpc, type FamilyTreeCharacter } from '@/stores/social'
import { useHudStore } from '@/stores/hud'

interface Props {
  houseId: number
  characters: FamilyTreeCharacter[]
  npcs: FamilyTreeNpc[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ submitted: [] }>()

const store = useSocialStore()
const hudStore = useHudStore()

const mode = ref<'npc' | 'edge'>('edge')
const isSubmitting = ref(false)

// NPC form
const npcName = ref('')
const npcTitle = ref('')
const npcIsDeceased = ref(false)

// Edge form
const edgeRelationship = ref<'parent' | 'spouse' | 'sibling'>('parent')
const edgeFrom = ref('')
const edgeTo = ref('')

const nodeOptions = computed(() => {
  const opts: Array<{ value: string; label: string }> = []
  for (const c of props.characters) {
    opts.push({ value: `character:${c.id}`, label: `${c.name} (character)` })
  }
  for (const n of props.npcs) {
    opts.push({ value: `npc:${n.id}`, label: `${n.name} (NPC)` })
  }
  return opts
})

function parseNode(val: string): { characterId?: number; npcId?: number } {
  const [type, id] = val.split(':')
  if (type === 'character') return { characterId: Number(id) }
  if (type === 'npc') return { npcId: Number(id) }
  return {}
}

async function submit(): Promise<void> {
  isSubmitting.value = true
  let success = false

  if (mode.value === 'npc') {
    if (!npcName.value.trim()) {
      isSubmitting.value = false
      return
    }
    success = await store.submitSuggestion(props.houseId, {
      type: 'npc',
      name: npcName.value.trim(),
      title: npcTitle.value.trim() || null,
      isDeceased: npcIsDeceased.value,
    })
  } else {
    if (!edgeFrom.value || !edgeTo.value) {
      isSubmitting.value = false
      return
    }
    const from = parseNode(edgeFrom.value)
    const to = parseNode(edgeTo.value)
    success = await store.submitSuggestion(props.houseId, {
      type: 'edge',
      relationship: edgeRelationship.value,
      fromCharacterId: from.characterId ?? null,
      fromNpcId: from.npcId ?? null,
      toCharacterId: to.characterId ?? null,
      toNpcId: to.npcId ?? null,
    })
  }

  isSubmitting.value = false

  if (success) {
    hudStore.addNotification('success', 'Suggestion Submitted', 'Your suggestion has been submitted for staff review.')
    // Reset form
    npcName.value = ''
    npcTitle.value = ''
    npcIsDeceased.value = false
    edgeFrom.value = ''
    edgeTo.value = ''
    emit('submitted')
  } else {
    hudStore.addNotification('error', 'Submission Failed', 'Could not submit your suggestion. Please try again.')
  }
}
</script>

<template>
  <div class="suggest-form">
    <!-- Mode toggle -->
    <div class="mode-toggle">
      <button
        class="mode-btn"
        :class="{ 'mode-btn--active': mode === 'edge' }"
        @click="mode = 'edge'"
      >
        Suggest Relationship
      </button>
      <button
        class="mode-btn"
        :class="{ 'mode-btn--active': mode === 'npc' }"
        @click="mode = 'npc'"
      >
        Suggest NPC
      </button>
    </div>

    <!-- NPC form -->
    <div v-if="mode === 'npc'" class="form-fields">
      <label class="field-label">
        Name
        <input v-model="npcName" type="text" class="field-input" placeholder="NPC name" maxlength="150" />
      </label>
      <label class="field-label">
        Title (optional)
        <input v-model="npcTitle" type="text" class="field-input" placeholder="e.g. Lord, Septa" maxlength="100" />
      </label>
      <label class="field-checkbox">
        <input v-model="npcIsDeceased" type="checkbox" />
        Deceased
      </label>
    </div>

    <!-- Edge form -->
    <div v-if="mode === 'edge'" class="form-fields">
      <label class="field-label">
        Relationship
        <select v-model="edgeRelationship" class="field-select">
          <option value="parent">Parent</option>
          <option value="spouse">Spouse</option>
          <option value="sibling">Sibling</option>
        </select>
      </label>
      <label class="field-label">
        From
        <select v-model="edgeFrom" class="field-select">
          <option value="" disabled>Select a person...</option>
          <option v-for="opt in nodeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label class="field-label">
        To
        <select v-model="edgeTo" class="field-select">
          <option value="" disabled>Select a person...</option>
          <option v-for="opt in nodeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
    </div>

    <button class="submit-btn" :disabled="isSubmitting" @click="submit">
      {{ isSubmitting ? 'Submitting...' : 'Submit for Review' }}
    </button>
  </div>
</template>

<style scoped>
.suggest-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-sm);
}

.mode-toggle {
  display: flex;
  gap: 4px;
}

.mode-btn {
  flex: 1;
  padding: 4px 8px;
  font-family: var(--font-body);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mode-btn:hover {
  border-color: var(--color-border);
  color: var(--color-text-dim);
}

.mode-btn--active {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
  background: rgba(201, 168, 76, 0.08);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-input,
.field-select {
  padding: 4px 8px;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color var(--transition-fast);
}

.field-input:focus,
.field-select:focus {
  border-color: var(--color-gold-dim);
}

.field-select {
  cursor: pointer;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  cursor: pointer;
}

.submit-btn {
  padding: 6px 12px;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: all var(--transition-fast);
}

.submit-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.15);
  border-color: var(--color-gold);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
