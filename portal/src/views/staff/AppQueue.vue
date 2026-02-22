<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface QueueApp {
  id: number
  character_id: number
  player_id: number
  house_id: number | null
  status: string
  requested_role: string
  is_featured_role: boolean
  is_bastard: boolean
  is_dragon_seed: boolean
  submitted_at: string
  updated_at: string
  character_name: string
  template_key: string
  player_name: string
  house_name: string | null
  is_great_house: boolean | null
  is_royal_house: boolean | null
}

const router = useRouter()
const { apiFetch } = useApi()

const applications = ref<QueueApp[]>([])
const loading = ref(true)
const error = ref('')
const statusFilter = ref('pending')

const statusColors: Record<string, string> = {
  pending: 'badge-gold',
  approved: 'badge-success',
  denied: 'badge-crimson',
  revision: 'badge-info',
}

const filteredApps = computed(() => {
  if (statusFilter.value === 'all') return applications.value
  return applications.value.filter((a) => a.status === statusFilter.value)
})

onMounted(async () => {
  try {
    const data = await apiFetch<{ applications: QueueApp[] }>('/api/staff/applications')
    applications.value = data.applications
  } catch (e: any) {
    error.value = e.message || 'Failed to load applications'
  } finally {
    loading.value = false
  }
})

function goToReview(id: number) {
  router.push({ name: 'staff-application-review', params: { id } })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="app-queue">
    <PageHeader title="Application Queue" subtitle="Review pending character applications">
      <div class="filter-bar">
        <button
          v-for="s in ['pending', 'revision', 'approved', 'denied', 'all']"
          :key="s"
          class="filter-btn"
          :class="{ active: statusFilter === s }"
          @click="statusFilter = s"
        >
          {{ s }}
        </button>
      </div>
    </PageHeader>

    <p v-if="loading" class="dim">Loading queue...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else-if="filteredApps.length" class="queue-list">
      <div
        v-for="app in filteredApps"
        :key="app.id"
        class="card card-clickable queue-card"
        @click="goToReview(app.id)"
      >
        <div class="queue-card-main">
          <div class="queue-card-left">
            <h3>{{ app.character_name }}</h3>
            <div class="queue-meta dim">
              <span v-if="app.house_name">House {{ app.house_name }}</span>
              <span>{{ app.requested_role }}</span>
              <span>by {{ app.player_name }}</span>
            </div>
          </div>
          <div class="queue-card-right">
            <span class="badge" :class="statusColors[app.status] || 'badge-gold'">{{ app.status }}</span>
            <div class="queue-badges">
              <span v-if="app.is_featured_role" class="badge badge-crimson">Featured</span>
              <span v-if="app.is_bastard" class="badge badge-info">Bastard</span>
              <span v-if="app.is_dragon_seed" class="badge badge-crimson">Dragonseed</span>
            </div>
          </div>
        </div>
        <div class="queue-card-footer muted">
          Submitted {{ formatDate(app.submitted_at) }}
        </div>
      </div>
    </div>

    <p v-else class="dim" style="margin-top: var(--space-xl); text-align: center">
      No {{ statusFilter === 'all' ? '' : statusFilter }} applications.
    </p>
  </div>
</template>

<style scoped>
.app-queue {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.filter-bar {
  display: flex;
  gap: var(--space-xs);
}

.filter-btn {
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-dim);
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
}

.filter-btn.active {
  background: var(--color-gold-glow);
  border-color: var(--color-gold-dim);
  color: var(--color-gold);
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.queue-card-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
}

.queue-card-left h3 {
  font-size: var(--font-size-md);
  margin-bottom: 2px;
}

.queue-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
}

.queue-meta span:not(:last-child)::after {
  content: '\b7';
  margin-left: var(--space-sm);
  color: var(--color-text-muted);
}

.queue-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.queue-badges {
  display: flex;
  gap: var(--space-xs);
}

.queue-card-footer {
  font-size: var(--font-size-xs);
  margin-top: var(--space-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
