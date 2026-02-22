<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminSocialStore } from '@/stores/adminSocial'

const store = useAdminSocialStore()

onMounted(() => {
  store.fetchPendingEdges()
})

function fromName(edge: typeof store.pendingEdges.value[0]): string {
  return edge.from_character_name || edge.from_npc_name || 'Unknown'
}

function toName(edge: typeof store.pendingEdges.value[0]): string {
  return edge.to_character_name || edge.to_npc_name || 'Unknown'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

async function approve(id: number): Promise<void> {
  await store.approveEdge(id)
}

async function deny(id: number): Promise<void> {
  await store.denyEdge(id)
}
</script>

<template>
  <div class="ft-admin">
    <div v-if="store.isLoading" class="loading">Loading...</div>

    <div v-else-if="store.pendingEdges.length === 0" class="empty-state">
      No pending suggestions
    </div>

    <div v-else class="suggestion-list">
      <div v-for="edge in store.pendingEdges" :key="edge.id" class="suggestion-item">
        <div class="suggestion-top">
          <span class="suggestion-house">{{ edge.house_name }}</span>
          <span class="suggestion-type">{{ edge.relationship }}</span>
          <span class="suggestion-time">{{ timeAgo(edge.created_at) }}</span>
        </div>
        <div class="suggestion-detail">
          <span class="node-name">{{ fromName(edge) }}</span>
          <span class="arrow">&rarr;</span>
          <span class="node-name">{{ toName(edge) }}</span>
        </div>
        <div class="suggestion-meta">
          Submitted by {{ edge.submitted_by }}
        </div>
        <div class="suggestion-actions">
          <button class="action-btn action-btn--approve" @click="approve(edge.id)">Approve</button>
          <button class="action-btn action-btn--deny" @click="deny(edge.id)">Deny</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ft-admin {
  padding: 0 var(--space-sm);
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
}

.suggestion-top {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.suggestion-house {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold);
  letter-spacing: 0.08em;
}

.suggestion-type {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  padding: 1px 5px;
  border: 1px solid var(--color-border-dim);
  border-radius: 2px;
}

.suggestion-time {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--color-text-muted);
}

.suggestion-detail {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
}

.node-name {
  color: var(--color-text);
  font-weight: 600;
}

.arrow {
  color: var(--color-text-muted);
}

.suggestion-meta {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
}

.suggestion-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: 4px;
}

.action-btn {
  padding: 3px 10px;
  font-family: var(--font-display);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn--approve {
  color: #2d8a4e;
  border: 1px solid rgba(45, 138, 78, 0.4);
  background: rgba(45, 138, 78, 0.06);
}

.action-btn--approve:hover {
  background: rgba(45, 138, 78, 0.15);
  border-color: rgba(45, 138, 78, 0.6);
}

.action-btn--deny {
  color: #b22222;
  border: 1px solid rgba(139, 26, 26, 0.4);
  background: rgba(139, 26, 26, 0.06);
}

.action-btn--deny:hover {
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
