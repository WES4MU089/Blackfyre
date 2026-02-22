<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Application {
  id: number
  character_id: number
  house_id: number | null
  status: string
  requested_role: string
  is_featured_role: boolean
  submitted_at: string
  updated_at: string
  character_name: string
  house_name: string | null
}

const router = useRouter()
const { apiFetch } = useApi()

const applications = ref<Application[]>([])
const loading = ref(true)
const error = ref('')

const statusColors: Record<string, string> = {
  pending: 'badge-gold',
  approved: 'badge-success',
  denied: 'badge-crimson',
  revision: 'badge-info',
  none: 'badge-gold',
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ applications: Application[] }>('/api/applications')
    applications.value = data.applications
  } catch (e: any) {
    error.value = e.message || 'Failed to load applications'
  } finally {
    loading.value = false
  }
})

function goToDetail(id: number) {
  router.push({ name: 'my-application-detail', params: { id } })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="my-apps">
    <PageHeader title="My Applications" subtitle="Track your character applications">
      <router-link to="/my/applications/new" class="btn-primary" style="padding: 6px 14px; font-size: 12px">+ New Character</router-link>
    </PageHeader>

    <p v-if="loading" class="dim">Loading applications...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else-if="applications.length" class="apps-list">
      <div
        v-for="app in applications"
        :key="app.id"
        class="card card-clickable app-card"
        @click="goToDetail(app.id)"
      >
        <div class="app-card-header">
          <h3>{{ app.character_name }}</h3>
          <span class="badge" :class="statusColors[app.status] || 'badge-gold'">
            {{ app.status }}
          </span>
        </div>
        <div class="app-card-meta dim">
          <span v-if="app.house_name">House {{ app.house_name }}</span>
          <span v-if="app.requested_role">{{ app.requested_role }}</span>
          <span v-if="app.is_featured_role" class="badge badge-crimson" style="margin-left: 4px">Featured</span>
        </div>
        <div class="app-card-footer muted">
          Submitted {{ formatDate(app.submitted_at) }}
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p class="dim">You have no character applications.</p>
      <router-link to="/my/applications/new" class="btn-primary" style="margin-top: var(--space-md); display: inline-block">Create Your First Character</router-link>
    </div>
  </div>
</template>

<style scoped>
.my-apps {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.apps-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.app-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.app-card-header h3 {
  font-size: var(--font-size-lg);
}

.app-card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  margin-top: var(--space-xs);
}

.app-card-footer {
  font-size: var(--font-size-xs);
  margin-top: var(--space-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.empty-state {
  text-align: center;
  margin-top: var(--space-2xl);
}

.empty-state p:first-child {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-sm);
}
</style>
