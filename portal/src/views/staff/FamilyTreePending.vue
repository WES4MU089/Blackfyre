<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface PendingEdge {
  id: number
  house_id: number
  relationship: string
  status: string
  from_character_id: number | null
  from_npc_id: number | null
  to_character_id: number | null
  to_npc_id: number | null
  created_at: string
  house_name: string
  submitted_by: string
  from_character_name: string | null
  from_npc_name: string | null
  to_character_name: string | null
  to_npc_name: string | null
}

const { apiFetch } = useApi()

const edges = ref<PendingEdge[]>([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref<number | null>(null)

function fromName(e: PendingEdge): string {
  return e.from_character_name || e.from_npc_name || 'Unknown'
}

function toName(e: PendingEdge): string {
  return e.to_character_name || e.to_npc_name || 'Unknown'
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ edges: PendingEdge[] }>('/api/staff/family-tree/pending')
    edges.value = data.edges
  } catch (e: any) {
    error.value = e.message || 'Failed to load pending suggestions'
  } finally {
    loading.value = false
  }
})

async function updateEdge(id: number, status: 'approved' | 'denied') {
  if (actionLoading.value !== null) return
  actionLoading.value = id
  try {
    await apiFetch(`/api/staff/family-tree/edges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    edges.value = edges.value.filter((e) => e.id !== id)
  } catch (e: any) {
    error.value = e.message || 'Failed to update edge'
  } finally {
    actionLoading.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="family-tree-pending">
    <PageHeader title="Family Tree Suggestions" subtitle="Review player-submitted relationship suggestions" />

    <p v-if="loading" class="dim">Loading suggestions...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else-if="edges.length" class="edges-list">
      <div v-for="edge in edges" :key="edge.id" class="card edge-card">
        <div class="edge-info">
          <div class="edge-house">
            <span class="muted label">House</span>
            <span class="gold">{{ edge.house_name }}</span>
          </div>
          <div class="edge-relationship">
            <span class="edge-from">{{ fromName(edge) }}</span>
            <span class="edge-arrow badge badge-gold">{{ edge.relationship }}</span>
            <span class="edge-to">{{ toName(edge) }}</span>
          </div>
          <div class="edge-meta muted">
            Submitted by {{ edge.submitted_by }} on {{ formatDate(edge.created_at) }}
          </div>
        </div>
        <div class="edge-actions">
          <button
            class="btn-primary"
            :disabled="actionLoading === edge.id"
            @click="updateEdge(edge.id, 'approved')"
          >
            Approve
          </button>
          <button
            class="btn-danger"
            :disabled="actionLoading === edge.id"
            @click="updateEdge(edge.id, 'denied')"
          >
            Deny
          </button>
        </div>
      </div>
    </div>

    <p v-else class="dim" style="margin-top: var(--space-xl); text-align: center">
      No pending suggestions.
    </p>
  </div>
</template>

<style scoped>
.family-tree-pending {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.edges-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.edge-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-lg);
}

.edge-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.edge-house {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.edge-relationship {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-md);
}

.edge-from, .edge-to {
  font-weight: 600;
  color: var(--color-text);
}

.edge-arrow {
  font-size: var(--font-size-xs);
}

.edge-meta {
  font-size: var(--font-size-xs);
}

.edge-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}
</style>
