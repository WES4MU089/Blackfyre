<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Role {
  id: number
  name: string
  description: string | null
  color: string | null
  is_default: boolean
  sort_order: number
}

interface Permission {
  id: number
  key: string
  label: string
  category: string
  description?: string | null
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const role = ref<Role | null>(null)
const allPermissions = ref<Permission[]>([])
const assignedIds = ref<Set<number>>(new Set())
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveMsg = ref('')

const roleId = computed(() => Number(route.params.id))

// Group permissions by category
const permissionsByCategory = computed(() => {
  const map = new Map<string, Permission[]>()
  for (const p of allPermissions.value) {
    if (!map.has(p.category)) map.set(p.category, [])
    map.get(p.category)!.push(p)
  }
  return map
})

onMounted(async () => {
  try {
    const data = await apiFetch<{ role: Role; assignedPermissions: Permission[]; allPermissions: Permission[] }>(
      `/api/sysadmin/roles/${roleId.value}`
    )
    role.value = data.role
    allPermissions.value = data.allPermissions
    assignedIds.value = new Set(data.assignedPermissions.map((p) => p.id))
  } catch (e: any) {
    error.value = e.message || 'Failed to load role'
  } finally {
    loading.value = false
  }
})

function togglePermission(id: number) {
  if (assignedIds.value.has(id)) {
    assignedIds.value.delete(id)
  } else {
    assignedIds.value.add(id)
  }
  // Force reactivity
  assignedIds.value = new Set(assignedIds.value)
}

async function saveRole() {
  if (!role.value || saving.value) return
  saving.value = true
  saveMsg.value = ''
  try {
    // Save role fields
    await apiFetch(`/api/sysadmin/roles/${roleId.value}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: role.value.name,
        description: role.value.description,
        color: role.value.color,
        sort_order: role.value.sort_order,
        is_default: role.value.is_default,
      }),
    })

    // Save permissions
    await apiFetch(`/api/sysadmin/roles/${roleId.value}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds: [...assignedIds.value] }),
    })

    saveMsg.value = 'Saved successfully'
    setTimeout(() => (saveMsg.value = ''), 3000)
  } catch (e: any) {
    error.value = e.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="role-editor">
    <div v-if="loading" class="dim">Loading role...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="role">
      <PageHeader :title="role.name" subtitle="Edit role and permissions">
        <router-link to="/sysadmin/roles" class="back-link">&larr; All Roles</router-link>
      </PageHeader>

      <!-- Role Fields -->
      <section class="editor-section card">
        <h2>Role Settings</h2>
        <div class="form-grid">
          <div class="form-field">
            <label class="muted label">Name</label>
            <input v-model="role.name" />
          </div>
          <div class="form-field">
            <label class="muted label">Color</label>
            <div class="color-row">
              <input v-model="role.color" type="color" class="color-input" />
              <input v-model="role.color" placeholder="#c9a84c" style="width: 100px" />
            </div>
          </div>
          <div class="form-field">
            <label class="muted label">Sort Order</label>
            <input v-model.number="role.sort_order" type="number" style="width: 80px" />
          </div>
          <div class="form-field">
            <label class="muted label">Description</label>
            <input v-model="role.description" placeholder="Optional description" />
          </div>
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" v-model="role.is_default" />
              <span class="dim">Default role (auto-assigned)</span>
            </label>
          </div>
        </div>
      </section>

      <!-- Permissions -->
      <section class="editor-section">
        <h2>Permissions</h2>
        <div class="perms-grid">
          <div
            v-for="[category, perms] of permissionsByCategory"
            :key="category"
            class="perm-category card"
          >
            <h3>{{ category }}</h3>
            <label
              v-for="p in perms"
              :key="p.id"
              class="perm-item"
              :class="{ active: assignedIds.has(p.id) }"
            >
              <input
                type="checkbox"
                :checked="assignedIds.has(p.id)"
                @change="togglePermission(p.id)"
              />
              <div>
                <span class="perm-key">{{ p.key }}</span>
                <span v-if="p.description" class="perm-desc muted">{{ p.description }}</span>
              </div>
            </label>
          </div>
        </div>
      </section>

      <!-- Save -->
      <div class="save-bar">
        <button class="btn-primary" :disabled="saving" @click="saveRole">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
        <span v-if="saveMsg" class="gold">{{ saveMsg }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.role-editor {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.editor-section {
  margin-bottom: var(--space-xl);
}

.editor-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-md);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.color-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.color-input {
  width: 36px;
  height: 36px;
  padding: 2px;
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.checkbox-label input {
  width: auto;
  padding: 0;
}

.perms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.perm-category h3 {
  font-size: var(--font-size-md);
  margin-bottom: var(--space-sm);
  text-transform: capitalize;
}

.perm-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.perm-item input {
  width: auto;
  padding: 0;
  margin-top: 2px;
}

.perm-item.active .perm-key {
  color: var(--color-gold);
}

.perm-key {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  display: block;
}

.perm-desc {
  font-size: var(--font-size-xs);
  display: block;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border-dim);
}
</style>
