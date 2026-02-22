<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface CodexCategory {
  id: number
  slug: string
  name: string
  description: string | null
  icon: string | null
  entry_count: number
}

const router = useRouter()
const { apiFetch } = useApi()

const categories = ref<CodexCategory[]>([])
const loading = ref(true)
const error = ref('')

// Map icon slugs to SVG paths
const iconMap: Record<string, string> = {
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  flame: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  sword: 'M14.71 4.29l-2.83 2.83L15.3 10.54l2.83-2.83L14.71 4.29zM4.93 17.66c-.39.39-.39 1.02 0 1.41l.01.01c.39.39 1.02.39 1.41 0L12 13.42l-5.66-5.66L4.93 9.17l5.66 5.66-5.66 5.83z',
  scroll: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  crossed: 'M14.71 4.29l-2.83 2.83L15.3 10.54l2.83-2.83L14.71 4.29zM4.93 17.66c-.39.39-.39 1.02 0 1.41l.01.01c.39.39 1.02.39 1.41 0L12 13.42l-5.66-5.66L4.93 9.17l5.66 5.66-5.66 5.83z',
  anvil: 'M15 17v2H9v-2H3v4h18v-4h-6zm6-4V9c0-.55-.45-1-1-1h-4V4H8v4H4c-.55 0-1 .45-1 1v4l2 2h14l2-2z',
  book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ categories: CodexCategory[] }>('/api/codex/categories')
    categories.value = data.categories
  } catch (e: any) {
    error.value = e.message || 'Failed to load codex'
  } finally {
    loading.value = false
  }
})

function goToCategory(slug: string) {
  router.push({ name: 'codex-category', params: { categorySlug: slug } })
}
</script>

<template>
  <div class="codex-index">
    <PageHeader title="Codex" subtitle="Lore, faiths, orders, and the player guide" />

    <p v-if="loading" class="dim">Loading codex...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else class="codex-grid">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="card card-clickable codex-card"
        @click="goToCategory(cat.slug)"
      >
        <div class="codex-card-icon">
          <svg v-if="iconMap[cat.icon || '']" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path :d="iconMap[cat.icon || '']" />
          </svg>
          <span v-else class="codex-card-icon-fallback">?</span>
        </div>
        <div class="codex-card-body">
          <h3>{{ cat.name }}</h3>
          <p v-if="cat.description" class="dim">{{ cat.description }}</p>
          <span class="codex-card-count muted">{{ cat.entry_count }} {{ cat.entry_count === 1 ? 'entry' : 'entries' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.codex-index {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.codex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.codex-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.codex-card-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold);
  background: var(--color-gold-glow);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-gold-dim);
}

.codex-card-icon-fallback {
  font-size: var(--font-size-lg);
  color: var(--color-gold-dim);
}

.codex-card-body h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-xs);
}

.codex-card-body p {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin-bottom: var(--space-xs);
}

.codex-card-count {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
