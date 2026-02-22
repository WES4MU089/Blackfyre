<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface ApplicationFull {
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
  father_name: string
  mother_name: string
  public_bio: string | null
  character_name: string
  template_key: string
  player_name: string
  house_name: string | null
  is_great_house: boolean | null
  is_royal_house: boolean | null
  reviewed_by_name: string | null
  reviewed_by: number | null
  reviewed_at: string | null
  staff_notes: string | null
  organization_id: number | null
}

interface Comment {
  id: number
  author_id: number
  body: string
  is_private: boolean
  is_visible: boolean
  created_at: string
  edited_at: string | null
  author_name: string
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const application = ref<ApplicationFull | null>(null)
const comments = ref<Comment[]>([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)
const actionError = ref('')

const newComment = ref('')
const commentPrivate = ref(false)
const staffNotes = ref('')

const appId = computed(() => Number(route.params.id))

const statusColors: Record<string, string> = {
  pending: 'badge-gold',
  approved: 'badge-success',
  denied: 'badge-crimson',
  revision: 'badge-info',
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ application: ApplicationFull; comments: Comment[] }>(
      `/api/staff/applications/${appId.value}`
    )
    application.value = data.application
    comments.value = data.comments
    staffNotes.value = data.application.staff_notes || ''
  } catch (e: any) {
    error.value = e.message || 'Failed to load application'
  } finally {
    loading.value = false
  }
})

async function setStatus(status: 'approved' | 'denied' | 'revision') {
  if (actionLoading.value) return
  actionLoading.value = true
  actionError.value = ''
  try {
    await apiFetch(`/api/staff/applications/${appId.value}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, staffNotes: staffNotes.value || undefined }),
    })
    application.value!.status = status
  } catch (e: any) {
    actionError.value = e.message || 'Failed to update status'
  } finally {
    actionLoading.value = false
  }
}

async function addComment() {
  if (!newComment.value.trim() || actionLoading.value) return
  actionLoading.value = true
  actionError.value = ''
  try {
    await apiFetch(`/api/staff/applications/${appId.value}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: newComment.value, isPrivate: commentPrivate.value }),
    })
    // Reload comments
    const data = await apiFetch<{ application: ApplicationFull; comments: Comment[] }>(
      `/api/staff/applications/${appId.value}`
    )
    comments.value = data.comments
    newComment.value = ''
    commentPrivate.value = false
  } catch (e: any) {
    actionError.value = e.message || 'Failed to add comment'
  } finally {
    actionLoading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="app-review">
    <div v-if="loading" class="dim">Loading application...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="application">
      <PageHeader :title="application.character_name" subtitle="Staff Review">
        <router-link to="/staff/applications" class="back-link">&larr; Queue</router-link>
      </PageHeader>

      <!-- Status + Actions -->
      <div class="review-actions card">
        <div class="review-status">
          <span class="muted label">Current Status</span>
          <span class="badge" :class="statusColors[application.status] || 'badge-gold'">
            {{ application.status }}
          </span>
        </div>
        <div v-if="application.reviewed_by_name" class="review-status">
          <span class="muted label">Reviewed By</span>
          <span>{{ application.reviewed_by_name }}</span>
        </div>
        <div class="review-buttons">
          <button class="btn-primary" :disabled="actionLoading" @click="setStatus('approved')">Approve</button>
          <button class="btn-secondary" :disabled="actionLoading" @click="setStatus('revision')">Request Revision</button>
          <button class="btn-danger" :disabled="actionLoading" @click="setStatus('denied')">Deny</button>
        </div>
        <p v-if="actionError" class="crimson" style="font-size: var(--font-size-sm)">{{ actionError }}</p>
      </div>

      <!-- Character Details -->
      <section class="review-section">
        <h2>Character Details</h2>
        <div class="detail-grid">
          <div class="detail-field">
            <span class="muted label">Character</span>
            <span>{{ application.character_name }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Template</span>
            <span>{{ application.template_key }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Player</span>
            <span>{{ application.player_name }}</span>
          </div>
          <div v-if="application.house_name" class="detail-field">
            <span class="muted label">House</span>
            <span>{{ application.house_name }}</span>
            <span v-if="application.is_royal_house" class="badge badge-crimson">Royal</span>
            <span v-else-if="application.is_great_house" class="badge badge-gold">Great</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Role</span>
            <span>{{ application.requested_role }}</span>
            <span v-if="application.is_featured_role" class="badge badge-crimson">Featured</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Father</span>
            <span>{{ application.father_name || 'Unknown' }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Mother</span>
            <span>{{ application.mother_name || 'Unknown' }}</span>
          </div>
          <div class="detail-field">
            <span class="muted label">Flags</span>
            <div class="detail-badges">
              <span v-if="application.is_bastard" class="badge badge-info">Bastard</span>
              <span v-if="application.is_dragon_seed" class="badge badge-crimson">Dragonseed</span>
              <span v-if="!application.is_bastard && !application.is_dragon_seed" class="dim">None</span>
            </div>
          </div>
          <div class="detail-field">
            <span class="muted label">Submitted</span>
            <span>{{ formatDate(application.submitted_at) }}</span>
          </div>
        </div>
      </section>

      <!-- Bio -->
      <section v-if="application.public_bio" class="review-section">
        <h2>Public Biography</h2>
        <div class="bio-text">{{ application.public_bio }}</div>
      </section>

      <!-- Staff Notes -->
      <section class="review-section">
        <h2>Staff Notes</h2>
        <textarea
          v-model="staffNotes"
          class="staff-notes-input"
          placeholder="Internal notes (visible only to staff)..."
          rows="3"
        />
      </section>

      <!-- Comments -->
      <section class="review-section">
        <h2>Comments</h2>
        <div v-if="comments.length" class="comments-list">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment card"
            :class="{ 'comment-private': comment.is_private }"
          >
            <div class="comment-header">
              <span class="gold">{{ comment.author_name }}</span>
              <div class="comment-header-right">
                <span v-if="comment.is_private" class="badge badge-crimson">Private</span>
                <span class="muted">{{ formatDate(comment.created_at) }}</span>
              </div>
            </div>
            <p class="comment-body">{{ comment.body }}</p>
          </div>
        </div>
        <p v-else class="dim">No comments yet.</p>

        <!-- Add Comment -->
        <div class="add-comment">
          <textarea
            v-model="newComment"
            placeholder="Add a comment..."
            rows="2"
            class="comment-input"
          />
          <div class="comment-actions">
            <label class="private-toggle">
              <input type="checkbox" v-model="commentPrivate" />
              <span class="dim">Private (staff only)</span>
            </label>
            <button class="btn-primary" :disabled="!newComment.trim() || actionLoading" @click="addComment">
              Post Comment
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.app-review {
  max-width: 900px;
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.review-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  flex-wrap: wrap;
  margin-bottom: var(--space-xl);
}

.review-status {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.review-buttons {
  display: flex;
  gap: var(--space-sm);
  margin-left: auto;
}

.review-section {
  margin-bottom: var(--space-xl);
}

.review-section h2 {
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

.detail-badges {
  display: flex;
  gap: var(--space-xs);
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

.staff-notes-input {
  width: 100%;
  resize: vertical;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.comment-private {
  border-color: rgba(139, 26, 26, 0.2);
  background: rgba(139, 26, 26, 0.04);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-sm);
}

.comment-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.comment-body {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--color-text-dim);
}

.add-comment {
  margin-top: var(--space-md);
}

.comment-input {
  width: 100%;
  resize: vertical;
  margin-bottom: var(--space-sm);
}

.comment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.private-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.private-toggle input {
  width: auto;
  padding: 0;
}
</style>
