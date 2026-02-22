<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Role {
  id: number
  name: string
  description: string | null
  color: string | null
  is_default: boolean
  sort_order: number
  permission_count: number
  player_count: number
}

const router = useRouter()
const { apiFetch } = useApi()

const roles = ref<Role[]>([])
const loading = ref(true)
const error = ref('')

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const newColor = ref('#c9a84c')
const createLoading = ref(false)

onMounted(async () => {
  await loadRoles()
})

async function loadRoles() {
  loading.value = true
  try {
    const data = await apiFetch<{ roles: Role[] }>('/api/sysadmin/roles')
    roles.value = data.roles
  } catch (e: any) {
    error.value = e.message || 'Failed to load roles'
  } finally {
    loading.value = false
  }
}

function editRole(id: number) {
  router.push({ name: 'sysadmin-role-editor', params: { id } })
}

async function createRole() {
  if (!newName.value.trim() || createLoading.value) return
  createLoading.value = true
  try {
    const result = await apiFetch<{ id: number }>('/api/sysadmin/roles', {
      method: 'POST',
      body: JSON.stringify({ name: newName.value, description: newDesc.value, color: newColor.value }),
    })
    newName.value = ''
    newDesc.value = ''
    showCreate.value = false
    await loadRoles()
    router.push({ name: 'sysadmin-role-editor', params: { id: result.id } })
  } catch (e: any) {
    error.value = e.message || 'Failed to create role'
  } finally {
    createLoading.value = false
  }
}
</script>

<template>
  <div class="role-list">
    <PageHeader title="Roles" subtitle="Manage staff roles and permissions">
      <button class="btn-primary" @click="showCreate = !showCreate">
        {{ showCreate ? 'Cancel' : 'Create Role' }}
      </button>
    </PageHeader>

    <!-- Create Form -->
    <div v-if="showCreate" class="card create-form">
      <h3>New Role</h3>
      <div class="form-row">
        <input v-model="newName" placeholder="Role name" />
        <input v-model="newColor" type="color" class="color-input" />
      </div>
      <input v-model="newDesc" placeholder="Description (optional)" style="width: 100%" />
      <button class="btn-primary" :disabled="!newName.trim() || createLoading" @click="createRole">
        Create
      </button>
    </div>

    <p v-if="loading" class="dim">Loading roles...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else class="roles-table">
      <div class="roles-header">
        <span>Name</span>
        <span>Permissions</span>
        <span>Players</span>
        <span>Order</span>
      </div>
      <div
        v-for="role in roles"
        :key="role.id"
        class="card card-clickable role-row"
        @click="editRole(role.id)"
      >
        <span class="role-name">
          <span v-if="role.color" class="role-dot" :style="{ background: role.color }" />
          {{ role.name }}
          <span v-if="role.is_default" class="badge badge-info">Default</span>
        </span>
        <span class="dim">{{ role.permission_count }}</span>
        <span class="dim">{{ role.player_count }}</span>
        <span class="muted">{{ role.sort_order }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-list {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.create-form h3 {
  font-size: var(--font-size-md);
}

.form-row {
  display: flex;
  gap: var(--space-sm);
}

.form-row input:first-child {
  flex: 1;
}

.color-input {
  width: 40px;
  height: 36px;
  padding: 2px;
  cursor: pointer;
}

.roles-table {
  margin-top: var(--space-lg);
}

.roles-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.5fr;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.role-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.5fr;
  gap: var(--space-md);
  align-items: center;
  margin-bottom: var(--space-xs);
}

.role-name {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 600;
}

.role-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
</style>
