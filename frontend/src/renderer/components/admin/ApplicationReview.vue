<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useHudStore } from '@/stores/hud'

const adminStore = useAdminStore()
const hudStore = useHudStore()

const reviewNotes = ref('')
const commentBody = ref('')
const commentIsPrivate = ref(false)
const isActioning = ref(false)

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  head_of_house: 'Head of House',
  lord_paramount: 'Lord Paramount',
  royalty: 'Royalty',
}

async function approve(): Promise<void> {
  if (!adminStore.selectedApplication || isActioning.value) return
  isActioning.value = true
  const ok = await adminStore.updateApplicationStatus(adminStore.selectedApplication.id, 'approved', reviewNotes.value || undefined)
  if (ok) hudStore.addNotification('success', 'Application', 'Application approved')
  isActioning.value = false
}

async function deny(): Promise<void> {
  if (!adminStore.selectedApplication || isActioning.value) return
  isActioning.value = true
  const ok = await adminStore.updateApplicationStatus(adminStore.selectedApplication.id, 'denied', reviewNotes.value || undefined)
  if (ok) hudStore.addNotification('info', 'Application', 'Application denied')
  isActioning.value = false
}

async function requestRevision(): Promise<void> {
  if (!adminStore.selectedApplication || isActioning.value) return
  isActioning.value = true
  const ok = await adminStore.updateApplicationStatus(adminStore.selectedApplication.id, 'revision', reviewNotes.value || undefined)
  if (ok) hudStore.addNotification('info', 'Application', 'Revision requested')
  isActioning.value = false
}

async function submitComment(): Promise<void> {
  if (!adminStore.selectedApplication || !commentBody.value.trim()) return
  await adminStore.postComment(adminStore.selectedApplication.id, commentBody.value.trim(), commentIsPrivate.value)
  commentBody.value = ''
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div v-if="adminStore.selectedApplication" class="app-review">
    <!-- Back button -->
    <button class="review-back" @click="adminStore.backToQueue">&larr; Back to Queue</button>

    <!-- Header -->
    <div class="review-header">
      <h3 class="review-char-name">{{ adminStore.selectedApplication.character_name }}</h3>
      <div class="review-meta">
        <span class="review-tier" :class="`review-tier--${adminStore.selectedApplication.tier}`">
          Tier {{ adminStore.selectedApplication.tier }}
        </span>
        <span class="review-status" :class="`review-status--${adminStore.selectedApplication.status}`">
          {{ adminStore.selectedApplication.status }}
        </span>
      </div>
    </div>

    <!-- Details -->
    <div class="review-details">
      <div class="detail-row">
        <span class="detail-label">Player</span>
        <span class="detail-value">{{ adminStore.selectedApplication.discord_username }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Template</span>
        <span class="detail-value">{{ adminStore.selectedApplication.template_key }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Father</span>
        <span class="detail-value">{{ adminStore.selectedApplication.father_name }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Mother</span>
        <span class="detail-value">{{ adminStore.selectedApplication.mother_name }}</span>
      </div>
      <div v-if="adminStore.selectedApplication.house_name" class="detail-row">
        <span class="detail-label">House</span>
        <span class="detail-value">{{ adminStore.selectedApplication.house_name }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Role</span>
        <span class="detail-value">{{ ROLE_LABELS[adminStore.selectedApplication.requested_role] ?? adminStore.selectedApplication.requested_role }}</span>
      </div>

      <!-- Flags -->
      <div v-if="adminStore.selectedApplication.is_bastard || adminStore.selectedApplication.is_dragon_seed || adminStore.selectedApplication.is_featured_role" class="detail-flags">
        <span v-if="adminStore.selectedApplication.is_bastard" class="detail-flag detail-flag--bastard">Bastard</span>
        <span v-if="adminStore.selectedApplication.is_dragon_seed" class="detail-flag detail-flag--dragon">Dragon Seed</span>
        <span v-if="adminStore.selectedApplication.is_featured_role" class="detail-flag detail-flag--featured">Featured Role</span>
      </div>

      <!-- HoH Contact -->
      <div v-if="adminStore.selectedApplication.hoh_contact" class="detail-section">
        <span class="detail-section-label">Head of House Contact</span>
        <p class="detail-section-text">{{ adminStore.selectedApplication.hoh_contact }}</p>
      </div>

      <!-- Application Bio -->
      <div v-if="adminStore.selectedApplication.application_bio" class="detail-section">
        <span class="detail-section-label">Application Bio</span>
        <p class="detail-section-text">{{ adminStore.selectedApplication.application_bio }}</p>
      </div>

      <!-- Public Bio -->
      <div v-if="adminStore.selectedApplication.public_bio" class="detail-section">
        <span class="detail-section-label">Public Bio</span>
        <p class="detail-section-text">{{ adminStore.selectedApplication.public_bio }}</p>
      </div>

      <!-- Backstory -->
      <div v-if="adminStore.selectedApplication.backstory" class="detail-section">
        <span class="detail-section-label">Private Backstory</span>
        <p class="detail-section-text">{{ adminStore.selectedApplication.backstory }}</p>
      </div>
    </div>

    <!-- Comments -->
    <div class="review-comments">
      <span class="comments-label">Comments</span>
      <div v-if="adminStore.comments.length === 0" class="comments-empty">No comments yet.</div>
      <div v-else class="comments-list">
        <div
          v-for="c in adminStore.comments"
          :key="c.id"
          class="comment-item"
          :class="{ 'comment-item--private': c.is_private }"
        >
          <div class="comment-header">
            <span class="comment-author">{{ c.author_name }}</span>
            <span v-if="c.is_private" class="comment-private-tag">Staff Only</span>
            <span class="comment-time">{{ formatDate(c.created_at) }}</span>
          </div>
          <p class="comment-body">{{ c.body }}</p>
        </div>
      </div>

      <!-- Comment input -->
      <div class="comment-input">
        <textarea
          v-model="commentBody"
          class="comment-textarea"
          placeholder="Write a comment..."
          rows="2"
        />
        <div class="comment-input-actions">
          <label class="comment-private-toggle">
            <input type="checkbox" v-model="commentIsPrivate" />
            <span>Staff only</span>
          </label>
          <button class="comment-submit" :disabled="!commentBody.trim()" @click="submitComment">Post</button>
        </div>
      </div>
    </div>

    <!-- Action buttons (only for pending/revision) -->
    <div v-if="adminStore.selectedApplication.status === 'pending' || adminStore.selectedApplication.status === 'revision'" class="review-actions">
      <textarea
        v-model="reviewNotes"
        class="review-notes-input"
        placeholder="Review notes (optional)..."
        rows="2"
      />
      <div class="review-action-btns">
        <button class="action-btn action-btn--approve" :disabled="isActioning" @click="approve">Approve</button>
        <button class="action-btn action-btn--revision" :disabled="isActioning" @click="requestRevision">Request Revision</button>
        <button class="action-btn action-btn--deny" :disabled="isActioning" @click="deny">Deny</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-review {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: 0 var(--space-sm);
}

.review-back {
  align-self: flex-start;
  background: none;
  border: none;
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dark);
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 2px 4px;
  transition: color var(--transition-fast);
}

.review-back:hover {
  color: var(--color-gold);
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.review-char-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.review-meta {
  display: flex;
  gap: 6px;
}

.review-tier,
.review-status {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 2px;
}

.review-tier--2 { color: var(--color-gold); background: rgba(201, 168, 76, 0.12); }
.review-tier--3 { color: var(--color-crimson-light); background: rgba(139, 26, 26, 0.12); }

.review-status--pending { color: var(--color-gold); background: rgba(201, 168, 76, 0.12); }
.review-status--approved { color: var(--color-success); background: rgba(45, 138, 78, 0.12); }
.review-status--denied { color: var(--color-crimson-light); background: rgba(139, 26, 26, 0.12); }
.review-status--revision { color: #c87830; background: rgba(200, 120, 48, 0.12); }

/* Details */
.review-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.detail-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.detail-value {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.detail-flags {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.detail-flag {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 2px;
}

.detail-flag--bastard { color: #c87830; background: rgba(200, 120, 48, 0.12); border: 1px solid rgba(200, 120, 48, 0.3); }
.detail-flag--dragon { color: var(--color-crimson-light); background: rgba(139, 26, 26, 0.12); border: 1px solid rgba(139, 26, 26, 0.3); }
.detail-flag--featured { color: var(--color-gold); background: rgba(201, 168, 76, 0.12); border: 1px solid rgba(201, 168, 76, 0.3); }

.detail-section {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border-dim);
}

.detail-section-label {
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.detail-section-text {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 4px 0 0;
  max-height: 100px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

/* Comments */
.review-comments {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.comments-label {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold-dim);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.comments-empty {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
  padding: 4px 0;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-gold-dim) transparent;
}

.comment-item {
  padding: 6px 8px;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-dark);
}

.comment-item--private {
  border-color: rgba(139, 26, 26, 0.3);
  background: rgba(139, 26, 26, 0.04);
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.comment-author {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.comment-private-tag {
  font-family: var(--font-mono);
  font-size: 7px;
  color: var(--color-crimson-light);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 4px;
  border: 1px solid rgba(139, 26, 26, 0.3);
  border-radius: 2px;
}

.comment-time {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--color-text-muted);
}

.comment-body {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.4;
  margin: 3px 0 0;
}

/* Comment input */
.comment-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-textarea,
.review-notes-input {
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

.comment-textarea:focus,
.review-notes-input:focus {
  border-color: var(--color-gold-dim);
}

.comment-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-private-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-body);
  font-size: 9px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.comment-private-toggle input {
  accent-color: var(--color-gold);
}

.comment-submit {
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

.comment-submit:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.2);
  border-color: var(--color-gold);
}

.comment-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Action buttons */
.review-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border-top: 1px solid var(--color-border-dim);
  padding-top: var(--space-sm);
}

.review-action-btns {
  display: flex;
  gap: 6px;
}

.action-btn {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn--approve {
  color: var(--color-success);
  border-color: rgba(45, 138, 78, 0.4);
  background: rgba(45, 138, 78, 0.06);
}

.action-btn--approve:hover:not(:disabled) {
  background: rgba(45, 138, 78, 0.15);
  border-color: var(--color-success);
}

.action-btn--revision {
  color: #c87830;
  border-color: rgba(200, 120, 48, 0.4);
  background: rgba(200, 120, 48, 0.06);
}

.action-btn--revision:hover:not(:disabled) {
  background: rgba(200, 120, 48, 0.15);
  border-color: #c87830;
}

.action-btn--deny {
  color: var(--color-crimson-light);
  border-color: rgba(139, 26, 26, 0.4);
  background: rgba(139, 26, 26, 0.06);
}

.action-btn--deny:hover:not(:disabled) {
  background: rgba(139, 26, 26, 0.15);
  border-color: var(--color-crimson-light);
}
</style>
