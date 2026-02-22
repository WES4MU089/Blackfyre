<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface ApplicationFull {
  id: number
  character_id: number
  player_id: number
  house_id: number | null
  organization_id: number | null
  is_bastard: boolean
  is_dragon_seed: boolean
  father_name: string
  mother_name: string
  requested_role: string
  is_featured_role: boolean
  hoh_contact: string | null
  application_bio: string
  public_bio: string | null
  status: string
  reviewed_by: number | null
  reviewed_at: string | null
  submitted_at: string
  updated_at: string
  character_name: string
  house_name: string | null
}

interface Comment {
  id: number
  author_id: number
  body: string
  is_private: boolean
  created_at: string
  edited_at: string | null
  author_name: string
}

const route = useRoute()
const { apiFetch } = useApi()

const application = ref<ApplicationFull | null>(null)
const comments = ref<Comment[]>([])
const loading = ref(true)
const error = ref('')

const appId = computed(() => Number(route.params.id))

const statusColors: Record<string, string> = {
  pending: 'badge-gold',
  approved: 'badge-success',
  denied: 'badge-crimson',
  revision: 'badge-info',
}

// Players can only see non-private comments
const visibleComments = computed(() => comments.value.filter((c) => !c.is_private))

onMounted(async () => {
  try {
    const data = await apiFetch<{ application: ApplicationFull; comments: Comment[] }>(
      `/api/applications/${appId.value}`
    )
    application.value = data.application
    comments.value = data.comments
  } catch (e: any) {
    error.value = e.message || 'Failed to load application'
  } finally {
    loading.value = false
  }
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="app-detail">
    <div v-if="loading" class="dim">Loading application...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="application">
      <PageHeader :title="application.character_name" subtitle="Application Details">
        <router-link to="/my/applications" class="back-link">&larr; My Applications</router-link>
      </PageHeader>

      <!-- Status Bar -->
      <div class="status-bar card">
        <div class="status-item">
          <span class="muted label">Status</span>
          <span class="badge" :class="statusColors[application.status] || 'badge-gold'">
            {{ application.status }}
          </span>
        </div>
        <div class="status-item">
          <span class="muted label">Submitted</span>
          <span>{{ formatDate(application.submitted_at) }}</span>
        </div>
        <div v-if="application.reviewed_at" class="status-item">
          <span class="muted label">Reviewed</span>
          <span>{{ formatDate(application.reviewed_at) }}</span>
        </div>
      </div>

      <!-- Character Info -->
      <section class="detail-section">
        <h2>Character Information</h2>
        <div class="detail-grid">
          <div class="detail-field">
            <span class="muted label">Name</span>
            <span>{{ application.character_name }}</span>
          </div>
          <div v-if="application.house_name" class="detail-field">
            <span class="muted label">House</span>
            <span>{{ application.house_name }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Role</span>
            <span>{{ application.requested_role }}</span>
            <span v-if="application.is_featured_role" class="badge badge-crimson" style="margin-left: 6px">Featured</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Father</span>
            <span>{{ application.father_name || 'Unknown' }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Mother</span>
            <span>{{ application.mother_name || 'Unknown' }}</span>
          </div>
          <div v-if="application.is_bastard" class="detail-field">
            <span class="badge badge-info">Bastard</span>
          </div>
          <div v-if="application.is_dragon_seed" class="detail-field">
            <span class="badge badge-crimson">Dragonseed</span>
          </div>
          <div v-if="application.hoh_contact" class="detail-field">
            <span class="muted label">Head of House Contact</span>
            <span>{{ application.hoh_contact }}</span>
          </div>
        </div>
      </section>

      <!-- Bio -->
      <section class="detail-section">
        <h2>Application Biography</h2>
        <div class="bio-text">{{ application.application_bio }}</div>
      </section>

      <section v-if="application.public_bio" class="detail-section">
        <h2>Public Biography</h2>
        <div class="bio-text dim">{{ application.public_bio }}</div>
      </section>

      <!-- Comments -->
      <section v-if="visibleComments.length" class="detail-section">
        <h2>Comments</h2>
        <div class="comments-list">
          <div v-for="comment in visibleComments" :key="comment.id" class="comment card">
            <div class="comment-header">
              <span class="gold">{{ comment.author_name }}</span>
              <span class="muted">{{ formatDate(comment.created_at) }}</span>
            </div>
            <p class="comment-body">{{ comment.body }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.app-detail {
  max-width: 800px;
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.status-bar {
  display: flex;
  gap: var(--space-xl);
  flex-wrap: wrap;
  margin-bottom: var(--space-xl);
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.detail-section {
  margin-bottom: var(--space-xl);
}

.detail-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-sm);
}

.bio-text {
  font-size: var(--font-size-md);
  line-height: 1.8;
  white-space: pre-wrap;
  color: var(--color-text-dim);
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-sm);
}

.comment-body {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--color-text-dim);
}
</style>
