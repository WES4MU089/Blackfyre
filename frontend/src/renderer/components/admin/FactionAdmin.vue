<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminSocialStore } from '@/stores/adminSocial'

const store = useAdminSocialStore()

// Create form
const createName = ref('')
const createDescription = ref('')

// Edit form
const editName = ref('')
const editDescription = ref('')
const editIsActive = ref(true)

// Add member
const addMemberCharId = ref('')
const addMemberPublic = ref(true)

onMounted(() => {
  store.fetchStaffFactions()
})

function viewDetail(id: number): void {
  store.fetchStaffFactionDetail(id)
}

function startCreate(): void {
  createName.value = ''
  createDescription.value = ''
  store.factionActiveView = 'create'
}

async function submitCreate(): Promise<void> {
  if (!createName.value.trim()) return
  await store.createFaction({
    name: createName.value.trim(),
    description: createDescription.value.trim() || null,
  })
}

function openEdit(): void {
  if (!store.selectedStaffFaction) return
  editName.value = store.selectedStaffFaction.name
  editDescription.value = store.selectedStaffFaction.description ?? ''
  editIsActive.value = store.selectedStaffFaction.is_active
}

async function saveEdit(): Promise<void> {
  if (!store.selectedStaffFaction) return
  await store.updateFaction(store.selectedStaffFaction.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim() || null,
    isActive: editIsActive.value,
  })
}

async function addMember(): Promise<void> {
  if (!store.selectedStaffFaction || !addMemberCharId.value) return
  const charId = parseInt(addMemberCharId.value, 10)
  if (isNaN(charId)) return
  await store.addFactionMember(store.selectedStaffFaction.id, charId, addMemberPublic.value)
  addMemberCharId.value = ''
}

async function toggleVisibility(characterId: number, current: boolean): Promise<void> {
  if (!store.selectedStaffFaction) return
  await store.toggleMemberVisibility(store.selectedStaffFaction.id, characterId, !current)
}

async function removeMember(characterId: number): Promise<void> {
  if (!store.selectedStaffFaction) return
  await store.removeFactionMember(store.selectedStaffFaction.id, characterId)
}
</script>

<template>
  <div class="faction-admin">
    <!-- LIST VIEW -->
    <template v-if="store.factionActiveView === 'list'">
      <div class="list-header">
        <span class="list-title">Factions</span>
        <button class="create-btn" @click="startCreate">+ Create</button>
      </div>

      <div v-if="store.isLoading" class="loading">Loading...</div>
      <div v-else-if="store.staffFactions.length === 0" class="empty-state">No factions</div>

      <div v-else class="item-list">
        <button
          v-for="f in store.staffFactions"
          :key="f.id"
          class="list-item"
          :class="{ 'list-item--inactive': !f.is_active }"
          @click="viewDetail(f.id)"
        >
          <div class="list-item-top">
            <span class="list-item-name">{{ f.name }}</span>
            <span v-if="!f.is_active" class="badge badge--inactive">Inactive</span>
          </div>
          <div class="list-item-meta">
            {{ f.total_member_count }} total
            <span v-if="f.secret_member_count > 0"> &middot; {{ f.secret_member_count }} secret</span>
          </div>
        </button>
      </div>
    </template>

    <!-- CREATE VIEW -->
    <template v-if="store.factionActiveView === 'create'">
      <button class="back-btn" @click="store.resetFactionView()">&larr; Back</button>
      <div class="form-title">Create Faction</div>
      <div class="form-fields">
        <label class="field-label">
          Name
          <input v-model="createName" type="text" class="field-input" maxlength="100" />
        </label>
        <label class="field-label">
          Description
          <textarea v-model="createDescription" class="field-textarea" rows="3" maxlength="5000" />
        </label>
        <button class="submit-btn" @click="submitCreate">Create</button>
      </div>
    </template>

    <!-- DETAIL VIEW -->
    <template v-if="store.factionActiveView === 'detail' && store.selectedStaffFaction">
      <button class="back-btn" @click="store.resetFactionView()">&larr; Back</button>
      <div class="form-title">{{ store.selectedStaffFaction.name }}</div>

      <div class="form-fields">
        <label class="field-label">
          Name
          <input v-model="editName" type="text" class="field-input" maxlength="100" @focus="openEdit" />
        </label>
        <label class="field-label">
          Description
          <textarea v-model="editDescription" class="field-textarea" rows="3" maxlength="5000" @focus="openEdit" />
        </label>
        <label class="field-checkbox">
          <input v-model="editIsActive" type="checkbox" />
          Active
        </label>
        <button class="submit-btn" @click="saveEdit">Save Changes</button>
      </div>

      <!-- Members -->
      <div class="section-label">Members ({{ store.staffFactionMembers.length }})</div>
      <div class="add-member">
        <input
          v-model="addMemberCharId"
          type="text"
          class="field-input field-input--small"
          placeholder="Character ID"
        />
        <label class="field-checkbox-inline">
          <input v-model="addMemberPublic" type="checkbox" />
          Public
        </label>
        <button class="add-btn" @click="addMember">Add</button>
      </div>

      <div class="member-list">
        <div v-for="m in store.staffFactionMembers" :key="m.character_id" class="member-row">
          <span class="member-name">{{ m.character_name }}</span>
          <button
            class="visibility-btn"
            :class="{ 'visibility-btn--secret': !m.declared_publicly }"
            :title="m.declared_publicly ? 'Public (click to hide)' : 'Secret (click to reveal)'"
            @click="toggleVisibility(m.character_id, m.declared_publicly)"
          >
            {{ m.declared_publicly ? 'Public' : 'Secret' }}
          </button>
          <button class="remove-btn" @click="removeMember(m.character_id)" title="Remove">&times;</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.faction-admin {
  padding: 0 var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.create-btn {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all var(--transition-fast);
}

.create-btn:hover {
  background: rgba(201, 168, 76, 0.15);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.list-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}

.list-item:hover {
  border-color: var(--color-border-bright);
  background: var(--color-surface-hover);
}

.list-item--inactive {
  opacity: 0.5;
}

.list-item-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.list-item-name {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 600;
}

.list-item-meta {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.badge--inactive {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
  color: #b22222;
  border: 1px solid rgba(139, 26, 26, 0.4);
}

.back-btn {
  align-self: flex-start;
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  background: none;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  color: var(--color-gold);
  border-color: var(--color-gold-dim);
}

.form-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
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
.field-textarea {
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
.field-textarea:focus {
  border-color: var(--color-gold-dim);
}

.field-textarea {
  resize: vertical;
}

.field-checkbox,
.field-checkbox-inline {
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
  align-self: flex-start;
}

.submit-btn:hover {
  background: rgba(201, 168, 76, 0.15);
  border-color: var(--color-gold);
}

.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border-dim);
  padding-bottom: var(--space-xs);
  margin-top: var(--space-sm);
}

.add-member {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

.field-input--small {
  width: 120px;
}

.add-btn {
  padding: 4px 10px;
  font-family: var(--font-body);
  font-size: 10px;
  color: #2d8a4e;
  border: 1px solid rgba(45, 138, 78, 0.4);
  background: rgba(45, 138, 78, 0.06);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-transform: uppercase;
  transition: all var(--transition-fast);
}

.add-btn:hover {
  background: rgba(45, 138, 78, 0.15);
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 3px var(--space-sm);
}

.member-name {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.visibility-btn {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 2px;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: #2d8a4e;
  border: 1px solid rgba(45, 138, 78, 0.4);
  background: rgba(45, 138, 78, 0.06);
}

.visibility-btn--secret {
  color: #c87830;
  border: 1px solid rgba(200, 120, 48, 0.4);
  background: rgba(200, 120, 48, 0.06);
}

.visibility-btn:hover {
  opacity: 0.8;
}

.remove-btn {
  margin-left: auto;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid rgba(139, 26, 26, 0.3);
  border-radius: var(--radius-sm);
  color: #b22222;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background: rgba(139, 26, 26, 0.15);
  border-color: rgba(139, 26, 26, 0.6);
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
