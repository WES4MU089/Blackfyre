<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Category {
  id: number
  slug: string
  name: string
  description: string | null
  icon: string | null
}

interface EntryPreview {
  id: number
  slug: string
  title: string
  summary: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const category = ref<Category | null>(null)
const entries = ref<EntryPreview[]>([])
const loading = ref(true)
const error = ref('')

const categorySlug = computed(() => route.params.categorySlug as string)

onMounted(async () => {
  try {
    const data = await apiFetch<{ category: Category; entries: EntryPreview[] }>(
      `/api/codex/categories/${categorySlug.value}`
    )
    category.value = data.category
    entries.value = data.entries
  } catch (e: any) {
    error.value = e.message || 'Failed to load category'
  } finally {
    loading.value = false
  }
})

function goToEntry(slug: string) {
  router.push({ name: 'codex-entry', params: { categorySlug: categorySlug.value, entrySlug: slug } })
}
</script>

<template>
  <div class="codex-category">
    <div v-if="loading" class="dim">Loading...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="category">
      <PageHeader :title="category.name" :subtitle="category.description || undefined">
        <router-link to="/codex" class="back-link">&larr; All Categories</router-link>
      </PageHeader>

      <div v-if="entries.length" class="entries-list">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="card card-clickable entry-card"
          @click="goToEntry(entry.slug)"
        >
          <img
            v-if="entry.image_url"
            :src="entry.image_url"
            :alt="entry.title"
            class="entry-thumb"
          />
          <div class="entry-body">
            <h3>{{ entry.title }}</h3>
            <p v-if="entry.summary" class="dim">{{ entry.summary }}</p>
          </div>
        </div>
      </div>

      <p v-else class="dim empty-msg">No entries in this category yet.</p>
    </template>
  </div>
</template>

<style scoped>
.codex-category {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.entry-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.entry-thumb {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.entry-body h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-xs);
}

.entry-body p {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-dim);
}

.empty-msg {
  margin-top: var(--space-xl);
  text-align: center;
}
</style>
