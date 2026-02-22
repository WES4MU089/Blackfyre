<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface CodexEntry {
  id: number
  slug: string
  title: string
  content: string
  summary: string | null
  image_url: string | null
  created_at: string
  updated_at: string
  category_slug: string
  category_name: string
}

const route = useRoute()
const { apiFetch } = useApi()

const entry = ref<CodexEntry | null>(null)
const loading = ref(true)
const error = ref('')

const entrySlug = computed(() => route.params.entrySlug as string)

// Simple markdown-like rendering: paragraphs, bold, italic, headers, lists
function renderContent(raw: string): string {
  return raw
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines to <br>
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
}

onMounted(async () => {
  try {
    const data = await apiFetch<{ entry: CodexEntry }>(`/api/codex/entries/${entrySlug.value}`)
    entry.value = data.entry
  } catch (e: any) {
    error.value = e.message || 'Failed to load entry'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="codex-entry">
    <div v-if="loading" class="dim">Loading...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="entry">
      <PageHeader :title="entry.title">
        <router-link
          :to="{ name: 'codex-category', params: { categorySlug: entry.category_slug } }"
          class="back-link"
        >
          &larr; {{ entry.category_name }}
        </router-link>
      </PageHeader>

      <article class="entry-article">
        <img
          v-if="entry.image_url"
          :src="entry.image_url"
          :alt="entry.title"
          class="entry-hero-image"
        />

        <div class="entry-content" v-html="renderContent(entry.content)" />

        <div class="entry-meta muted">
          Last updated {{ new Date(entry.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.codex-entry {
  max-width: 800px;
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.entry-article {
  margin-top: var(--space-md);
}

.entry-hero-image {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-dim);
  margin-bottom: var(--space-xl);
}

.entry-content {
  font-size: var(--font-size-md);
  line-height: 1.8;
  color: var(--color-text-dim);
}

.entry-content :deep(h2) {
  font-family: var(--font-display);
  color: var(--color-gold);
  font-size: var(--font-size-xl);
  margin: var(--space-xl) 0 var(--space-sm);
}

.entry-content :deep(h3) {
  font-family: var(--font-display);
  color: var(--color-gold);
  font-size: var(--font-size-lg);
  margin: var(--space-lg) 0 var(--space-sm);
}

.entry-content :deep(h4) {
  font-family: var(--font-display);
  color: var(--color-gold);
  font-size: var(--font-size-md);
  margin: var(--space-md) 0 var(--space-xs);
}

.entry-content :deep(p) {
  margin-bottom: var(--space-md);
}

.entry-content :deep(strong) {
  color: var(--color-text);
  font-weight: 600;
}

.entry-content :deep(em) {
  font-style: italic;
}

.entry-content :deep(ul) {
  padding-left: var(--space-lg);
  margin-bottom: var(--space-md);
}

.entry-content :deep(li) {
  margin-bottom: var(--space-xs);
}

.entry-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border-dim);
  margin: var(--space-lg) 0;
}

.entry-meta {
  margin-top: var(--space-xl);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-dim);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
