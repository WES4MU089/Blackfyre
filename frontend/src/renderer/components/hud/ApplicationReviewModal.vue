<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerApplicationStore } from '@/stores/playerApplication'

const store = usePlayerApplicationStore()
const commentBody = ref('')

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  head_of_house: 'Head of House',
  lord_paramount: 'Lord Paramount',
  royalty: 'Royalty',
}

async function submitComment(): Promise<void> {
  if (!commentBody.value.trim()) return
  const ok = await store.postComment(commentBody.value.trim())
  if (ok) commentBody.value = ''
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="app-modal-overlay" @click.self="store.close()">
    <div class="app-modal panel-ornate animate-fade-in">
      <!-- Header -->
      <div class="app-modal-header">
        <div class="app-modal-title-row">
          <span class="app-modal-title">Application Review</span>
          <span v-if="store.application" class="app-modal-status" :class="`app-modal-status--${store.application.status}`">
            {{ store.application.status }}
          </span>
        </div>
        <button class="app-modal-close" @click="store.close()" title="Close">&times;</button>
      </div>

      <!-- Loading -->
      <div v-if="store.isLoading" class="app-modal-body app-modal-loading">
        Loading application...
      </div>

      <!-- Error -->
      <div v-else-if="store.error" class="app-modal-body app-modal-error">
        {{ store.error }}
      </div>

      <!-- Content -->
      <div v-else-if="store.application" class="app-modal-body">
        <!-- Character name -->
        <h3 class="app-char-name">{{ store.application.character_name }}</h3>

        <!-- Details -->
        <div class="app-details">
          <div v-if="store.application.house_name" class="app-detail-row">
            <span class="app-detail-label">House</span>
            <span class="app-detail-value">{{ store.application.house_name }}</span>
          </div>
          <div class="app-detail-row">
            <span class="app-detail-label">Role</span>
            <span class="app-detail-value">{{ ROLE_LABELS[store.application.requested_role] ?? store.application.requested_role }}</span>
          </div>
          <div v-if="store.application.father_name" class="app-detail-row">
            <span class="app-detail-label">Father</span>
            <span class="app-detail-value">{{ store.application.father_name }}</span>
          </div>
          <div v-if="store.application.mother_name" class="app-detail-row">
            <span class="app-detail-label">Mother</span>
            <span class="app-detail-value">{{ store.application.mother_name }}</span>
          </div>

          <!-- Flags -->
          <div v-if="store.application.is_bastard || store.application.is_dragon_seed || store.application.is_featured_role" class="app-detail-flags">
            <span v-if="store.application.is_bastard" class="app-flag app-flag--bastard">Bastard</span>
            <span v-if="store.application.is_dragon_seed" class="app-flag app-flag--dragon">Dragon Seed</span>
            <span v-if="store.application.is_featured_role" class="app-flag app-flag--featured">Featured Role</span>
          </div>

          <!-- HoH Contact -->
          <div v-if="store.application.hoh_contact" class="app-detail-section">
            <span class="app-detail-section-label">Head of House Contact</span>
            <p class="app-detail-section-text">{{ store.application.hoh_contact }}</p>
          </div>

          <!-- Application Bio -->
          <div v-if="store.application.application_bio" class="app-detail-section">
            <span class="app-detail-section-label">Application Bio</span>
            <p class="app-detail-section-text">{{ store.application.application_bio }}</p>
          </div>

          <!-- Public Bio -->
          <div v-if="store.application.public_bio" class="app-detail-section">
            <span class="app-detail-section-label">Public Bio</span>
            <p class="app-detail-section-text">{{ store.application.public_bio }}</p>
          </div>
        </div>

        <!-- Comments -->
        <div class="app-comments">
          <span class="app-comments-label">Comments</span>
          <div v-if="store.comments.length === 0" class="app-comments-empty">No comments yet.</div>
          <div v-else class="app-comments-list">
            <div
              v-for="c in store.comments"
              :key="c.id"
              class="app-comment"
            >
              <div class="app-comment-header">
                <span class="app-comment-author">{{ c.author_name }}</span>
                <span v-if="c.edited_at" class="app-comment-edited">(edited)</span>
                <span class="app-comment-time">{{ formatDate(c.created_at) }}</span>
              </div>
              <p class="app-comment-body">{{ c.body }}</p>
            </div>
          </div>

          <!-- Comment input (only for pending/revision) -->
          <div v-if="store.application.status === 'pending' || store.application.status === 'revision'" class="app-comment-input">
            <textarea
              v-model="commentBody"
              class="app-comment-textarea"
              placeholder="Write a comment..."
              rows="2"
            />
            <div class="app-comment-actions">
              <button
                class="app-comment-submit"
                :disabled="!commentBody.trim()"
                @click="submitComment"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
  pointer-events: auto;
}

.app-modal {
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

/* Header */
.app-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
}

.app-modal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-modal-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.app-modal-status {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 2px;
}

.app-modal-status--pending { color: var(--color-gold); background: rgba(201, 168, 76, 0.12); }
.app-modal-status--approved { color: var(--color-success); background: rgba(45, 138, 78, 0.12); }
.app-modal-status--denied { color: var(--color-crimson-light); background: rgba(139, 26, 26, 0.12); }
.app-modal-status--revision { color: #c87830; background: rgba(200, 120, 48, 0.12); }

.app-modal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.app-modal-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Body */
.app-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.app-modal-loading,
.app-modal-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.app-modal-error {
  color: var(--color-crimson-light);
}

/* Character name */
.app-char-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
  text-align: center;
}

/* Details */
.app-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}

.app-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.app-detail-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.app-detail-value {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.app-detail-flags {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.app-flag {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
}

.app-flag--bastard { color: #c87830; background: rgba(200, 120, 48, 0.12); border: 1px solid rgba(200, 120, 48, 0.3); }
.app-flag--dragon { color: var(--color-crimson-light); background: rgba(139, 26, 26, 0.12); border: 1px solid rgba(139, 26, 26, 0.3); }
.app-flag--featured { color: var(--color-gold); background: rgba(201, 168, 76, 0.12); border: 1px solid rgba(201, 168, 76, 0.3); }

.app-detail-section {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border-dim);
}

.app-detail-section-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.app-detail-section-text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 4px 0 0;
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
  white-space: pre-wrap;
}

/* Comments */
.app-comments {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.app-comments-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold-dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.app-comments-empty {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
  padding: 4px 0;
}

.app-comments-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.app-comment {
  padding: 6px 8px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
}

.app-comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.app-comment-author {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.app-comment-edited {
  font-family: var(--font-body);
  font-size: 8px;
  color: var(--color-text-muted);
  font-style: italic;
}

.app-comment-time {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-text-muted);
}

.app-comment-body {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.4;
  margin: 3px 0 0;
  white-space: pre-wrap;
}

/* Comment input */
.app-comment-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-xs);
}

.app-comment-textarea {
  width: 100%;
  padding: 6px 8px;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast);
}

.app-comment-textarea:focus {
  border-color: var(--color-gold-dim);
}

.app-comment-actions {
  display: flex;
  justify-content: flex-end;
}

.app-comment-submit {
  padding: 3px 12px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid var(--color-gold-dim);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.app-comment-submit:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

.app-comment-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
