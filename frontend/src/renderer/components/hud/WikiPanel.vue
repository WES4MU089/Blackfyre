<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useHudStore } from '@/stores/hud'
import { useAuthStore } from '@/stores/auth'
import { useDraggable } from '@/composables/useDraggable'
import { useResizable } from '@/composables/useResizable'
import { BACKEND_URL } from '@/config'

const hudStore = useHudStore()
const authStore = useAuthStore()
const panelRef = ref<HTMLElement | null>(null)
const { isDragging, onDragStart } = useDraggable('wiki', panelRef, { alwaysDraggable: true })
const { isResizing, onResizeStart, currentWidth, currentHeight } = useResizable(
  'wiki', panelRef,
  { minWidth: 400, maxWidth: 900, minHeight: 300, maxHeight: 900 },
)

// ─── Types ─────────────────────────────────────────────────────────────────

interface TocEntry {
  slug: string
  title: string
  section: string | null
}

interface TocCategory {
  id: number
  slug: string
  name: string
  icon: string | null
  entries: TocEntry[]
}

interface FullEntry {
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

// ─── State ─────────────────────────────────────────────────────────────────

const categories = ref<TocCategory[]>([])
const expandedCategories = reactive(new Set<string>())
const activeEntrySlug = ref<string | null>(null)
const activeCategorySlug = ref<string | null>(null)

const entry = ref<FullEntry | null>(null)
const tocLoading = ref(true)
const entryLoading = ref(false)
const error = ref('')

// In-memory entry cache
const entryCache = new Map<string, FullEntry>()

// ─── API Helpers ───────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
  return headers
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Markdown Renderer (ported from Portal Codex.vue) ──────────────────────

function renderContent(raw: string): string {
  const lines = raw.split('\n')
  const output: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let inParagraph = false
  let inBlockquote = false
  let bqLines: string[] = []

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function formatInline(s: string): string {
    return escapeHtml(s)
      .replace(/\{\{(\w+):([^}]+)\}\}/g, '<span class="wiki-$1">$2</span>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
  }

  function closeParagraph() {
    if (inParagraph) { output.push('</p>'); inParagraph = false }
  }

  function flushBlockquote() {
    if (!inBlockquote || bqLines.length === 0) return
    inBlockquote = false
    const text = bqLines.map(l => formatInline(l)).join('<br />')
    output.push(`<div class="wiki-tip"><div class="wiki-tip-label">Note</div><p class="wiki-tip-text">${text}</p></div>`)
    bqLines = []
  }

  function flushTable() {
    if (!inTable || tableRows.length === 0) return
    inTable = false
    let html = '<table><thead><tr>'
    const headers = tableRows[0]
    for (const h of headers) html += `<th>${formatInline(h.trim())}</th>`
    html += '</tr></thead><tbody>'
    const startRow = tableRows.length > 1 && /^[\s|:-]+$/.test(tableRows[1].join('|')) ? 2 : 1
    for (let i = startRow; i < tableRows.length; i++) {
      html += '<tr>'
      for (const cell of tableRows[i]) html += `<td>${formatInline(cell.trim())}</td>`
      html += '</tr>'
    }
    html += '</tbody></table>'
    output.push(html)
    tableRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        output.push(`<div class="wiki-formula"><pre>${escapeHtml(codeLines.join('\n'))}</pre></div>`)
        codeLines = []
        inCodeBlock = false
      } else {
        closeParagraph(); flushBlockquote(); flushTable()
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) { codeLines.push(line); continue }

    // Blockquote lines
    const bqMatch = line.match(/^>\s?(.*)$/)
    if (bqMatch) {
      closeParagraph(); flushTable()
      if (!inBlockquote) inBlockquote = true
      bqLines.push(bqMatch[1])
      continue
    } else {
      flushBlockquote()
    }

    // Table rows
    if (/^\|(.+)\|$/.test(line.trim())) {
      if (!inTable) { closeParagraph(); inTable = true }
      const cells = line.trim().slice(1, -1).split('|')
      tableRows.push(cells)
      continue
    } else {
      flushTable()
    }

    // Blank line
    if (line.trim() === '') { closeParagraph(); continue }

    // Horizontal rule → wiki divider
    if (/^---+$/.test(line.trim())) {
      closeParagraph()
      output.push('<div class="wiki-divider"></div>')
      continue
    }

    // Headers
    const h5 = line.match(/^#{5}\s+(.+)$/)
    if (h5) { closeParagraph(); output.push(`<h6 class="wiki-subtitle">${formatInline(h5[1])}</h6>`); continue }
    const h4 = line.match(/^#{4}\s+(.+)$/)
    if (h4) { closeParagraph(); output.push(`<h5 class="wiki-subtitle">${formatInline(h4[1])}</h5>`); continue }
    const h3 = line.match(/^#{3}\s+(.+)$/)
    if (h3) { closeParagraph(); output.push(`<h4 class="wiki-subtitle">${formatInline(h3[1])}</h4>`); continue }
    const h2 = line.match(/^#{2}\s+(.+)$/)
    if (h2) { closeParagraph(); output.push(`<h3 class="wiki-subtitle">${formatInline(h2[1])}</h3>`); continue }
    const h1 = line.match(/^#{1}\s+(.+)$/)
    if (h1) { closeParagraph(); output.push(`<h2 class="wiki-section-title">${formatInline(h1[1])}</h2>`); continue }

    // List items
    const li = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (li) { closeParagraph(); output.push(`<li>${formatInline(li[2])}</li>`); continue }

    // Regular text → paragraph
    if (!inParagraph) {
      output.push('<p class="wiki-text">')
      inParagraph = true
      output.push(formatInline(line))
    } else {
      output.push('<br />' + formatInline(line))
    }
  }

  closeParagraph(); flushBlockquote(); flushTable()

  let html = output.join('\n')
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/gs, '<ul class="wiki-list">$1</ul>')
  return html
}

// ─── TOC Navigation ────────────────────────────────────────────────────────

function toggleCategory(slug: string) {
  if (expandedCategories.has(slug)) {
    expandedCategories.delete(slug)
  } else {
    expandedCategories.add(slug)
  }
}

async function selectEntry(categorySlug: string, entrySlug: string) {
  activeCategorySlug.value = categorySlug
  activeEntrySlug.value = entrySlug
  expandedCategories.add(categorySlug)

  // Check cache first
  const cached = entryCache.get(entrySlug)
  if (cached) {
    entry.value = cached
    await nextTick()
    const contentEl = panelRef.value?.querySelector('.wiki-content')
    if (contentEl) contentEl.scrollTop = 0
    return
  }

  entryLoading.value = true
  error.value = ''
  try {
    const data = await apiFetch<{ entry: FullEntry }>(`/api/codex/entries/${entrySlug}`)
    entry.value = data.entry
    entryCache.set(entrySlug, data.entry)
    await nextTick()
    const contentEl = panelRef.value?.querySelector('.wiki-content')
    if (contentEl) contentEl.scrollTop = 0
  } catch (e: any) {
    error.value = e.message || 'Failed to load entry'
    entry.value = null
  } finally {
    entryLoading.value = false
  }
}

// ─── Position & Size ───────────────────────────────────────────────────────

const positionStyle = computed(() => {
  const pos = hudStore.hudPositions['wiki']
  if (pos && pos.x != null && pos.y != null) {
    return { position: 'fixed' as const, left: `${pos.x}px`, top: `${pos.y}px` }
  }
  return undefined
})

const sizeStyle = computed(() => ({
  width: currentWidth.value + 'px',
  height: currentHeight.value + 'px',
}))

function close() {
  hudStore.toggleSystemPanel('wiki')
}

// ─── Mount ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const data = await apiFetch<{ categories: TocCategory[] }>('/api/codex/toc')
    categories.value = data.categories
    // Auto-expand first category and select first entry
    if (data.categories.length > 0) {
      const firstCat = data.categories[0]
      expandedCategories.add(firstCat.slug)
      if (firstCat.entries.length > 0) {
        await selectEntry(firstCat.slug, firstCat.entries[0].slug)
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load codex'
  } finally {
    tocLoading.value = false
  }
})
</script>

<template>
  <div class="wiki-panel-wrapper" :style="positionStyle">
    <div
      ref="panelRef"
      class="wiki-panel panel-ornate animate-fade-in"
      :class="{ 'is-dragging': isDragging || isResizing }"
      :style="sizeStyle"
    >
      <!-- Header (drag handle) -->
      <div class="wiki-header" @mousedown="onDragStart">
        <span class="wiki-title">Codex</span>
        <button class="wiki-close" @click="close" title="Close">&times;</button>
      </div>

      <!-- Body: sidebar TOC + scrollable content -->
      <div class="wiki-body">
        <!-- Table of Contents -->
        <nav class="wiki-toc">
          <div v-if="tocLoading" class="wiki-toc-loading">Loading...</div>
          <template v-else>
            <div v-for="cat in categories" :key="cat.id" class="wiki-toc-category">
              <button
                class="wiki-toc-cat-header"
                :class="{ 'wiki-toc-cat-header--active': activeCategorySlug === cat.slug }"
                @click="toggleCategory(cat.slug)"
              >
                <span class="wiki-toc-chevron" :class="{ 'wiki-toc-chevron--open': expandedCategories.has(cat.slug) }">&#9656;</span>
                {{ cat.name }}
              </button>
              <div v-if="expandedCategories.has(cat.slug)" class="wiki-toc-sections">
                <button
                  v-for="e in cat.entries"
                  :key="e.slug"
                  class="wiki-toc-item"
                  :class="{ 'wiki-toc-item--active': activeEntrySlug === e.slug }"
                  @click="selectEntry(cat.slug, e.slug)"
                >
                  {{ e.title }}
                </button>
              </div>
            </div>
          </template>
        </nav>

        <!-- Content Area -->
        <div class="wiki-content">
          <!-- Loading -->
          <div v-if="entryLoading" class="wiki-content-status">Loading entry...</div>

          <!-- Error -->
          <div v-else-if="error && activeEntrySlug" class="wiki-content-status wiki-content-error">{{ error }}</div>

          <!-- Entry -->
          <template v-else-if="entry">
            <h3 class="wiki-entry-title">{{ entry.title }}</h3>
            <div class="wiki-entry-body" v-html="renderContent(entry.content)" />
          </template>

          <!-- Welcome State -->
          <div v-else class="wiki-welcome">
            <h3 class="wiki-entry-title">The Codex</h3>
            <p class="wiki-text">Select a topic from the table of contents to begin reading.</p>
          </div>
        </div>
      </div>

      <!-- Resize handle (bottom-right corner) -->
      <div class="wiki-resize-handle" @mousedown="onResizeStart">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="10" cy="10" r="1.2" />
          <circle cx="6" cy="10" r="1.2" />
          <circle cx="10" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" />
          <circle cx="6" cy="6" r="1.2" />
          <circle cx="10" cy="2" r="1.2" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wiki-panel-wrapper {
  pointer-events: none;
}

.wiki-panel {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  position: relative;
  resize: none;
}

/* Header */
.wiki-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  user-select: none;
}

.wiki-header:active {
  cursor: grabbing;
}

.wiki-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wiki-close {
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

.wiki-close:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

/* Body layout */
.wiki-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Table of Contents sidebar */
.wiki-toc {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--space-sm) 0;
  border-right: 1px solid var(--color-border-dim);
  overflow-y: auto;
}

.wiki-toc::-webkit-scrollbar { width: 3px; }
.wiki-toc::-webkit-scrollbar-track { background: transparent; }
.wiki-toc::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.wiki-toc-loading {
  padding: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Category header */
.wiki-toc-category {
  margin-bottom: 2px;
}

.wiki-toc-cat-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px var(--space-sm);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  transition: all var(--transition-fast);
}

.wiki-toc-cat-header:hover {
  color: var(--color-gold);
  background: var(--color-surface-hover);
}

.wiki-toc-cat-header--active {
  color: var(--color-gold);
}

.wiki-toc-chevron {
  font-size: 8px;
  transition: transform var(--transition-fast);
  display: inline-block;
}

.wiki-toc-chevron--open {
  transform: rotate(90deg);
}

.wiki-toc-sections {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wiki-toc-item {
  padding: 4px var(--space-sm) 4px 20px;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--color-text-muted);
  letter-spacing: 0.06em;
  text-align: left;
  transition: all var(--transition-fast);
}

.wiki-toc-item:hover {
  color: var(--color-text-dim);
  background: var(--color-surface-hover);
}

.wiki-toc-item--active {
  color: var(--color-gold);
  border-left-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.06);
}

/* Content area */
.wiki-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  min-height: 0;
}

.wiki-content::-webkit-scrollbar { width: 4px; }
.wiki-content::-webkit-scrollbar-track { background: transparent; }
.wiki-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.wiki-content-status {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding: var(--space-md);
}

.wiki-content-error {
  color: var(--color-crimson);
}

/* Entry title */
.wiki-entry-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 var(--space-sm) 0;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border-dim);
}

/* Welcome */
.wiki-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

/* ─── Rendered Content Typography ────────────────────────────────────────── */

.wiki-entry-body :deep(.wiki-section-title) {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: var(--space-lg) 0 var(--space-sm) 0;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border-dim);
}

.wiki-entry-body :deep(.wiki-section-title:first-child) {
  margin-top: 0;
}

.wiki-entry-body :deep(.wiki-subtitle) {
  font-family: var(--font-display);
  color: var(--color-gold-dark);
  letter-spacing: 0.08em;
  margin: var(--space-sm) 0 var(--space-xs) 0;
}

.wiki-entry-body :deep(h3.wiki-subtitle) { font-size: var(--font-size-sm); }
.wiki-entry-body :deep(h4.wiki-subtitle) { font-size: var(--font-size-sm); }
.wiki-entry-body :deep(h5.wiki-subtitle) { font-size: var(--font-size-xs); }
.wiki-entry-body :deep(h6.wiki-subtitle) { font-size: var(--font-size-xs); }

.wiki-entry-body :deep(.wiki-text) {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.6;
  margin: 0 0 var(--space-sm) 0;
}

.wiki-entry-body :deep(.wiki-text:last-child) {
  margin-bottom: 0;
}

.wiki-entry-body :deep(strong) {
  color: var(--color-text-bright);
  font-weight: 600;
}

.wiki-entry-body :deep(em) {
  font-style: italic;
}

.wiki-entry-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 3px;
  padding: 1px 4px;
  color: var(--color-gold);
}

.wiki-entry-body :deep(del) {
  text-decoration: line-through;
  opacity: 0.6;
}

/* Lists */
.wiki-entry-body :deep(.wiki-list) {
  list-style: none;
  padding: 0;
  margin: var(--space-xs) 0 var(--space-sm) 0;
}

.wiki-entry-body :deep(.wiki-list li) {
  position: relative;
  padding-left: 14px;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.5;
  margin-bottom: 4px;
}

.wiki-entry-body :deep(.wiki-list li::before) {
  content: '\2756';
  position: absolute;
  left: 0;
  color: var(--color-gold-dim);
  font-size: 8px;
  top: 3px;
}

/* Ornamental divider */
.wiki-entry-body :deep(.wiki-divider) {
  width: 60%;
  height: 1px;
  margin: var(--space-md) auto;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
}

/* Formula / code blocks */
.wiki-entry-body :deep(.wiki-formula) {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-gold-light);
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  margin: var(--space-xs) 0 var(--space-sm) 0;
  overflow-x: auto;
}

.wiki-entry-body :deep(.wiki-formula pre) {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  white-space: pre-wrap;
}

/* Tip callout */
.wiki-entry-body :deep(.wiki-tip) {
  padding: var(--space-sm) var(--space-md);
  background: rgba(201, 168, 76, 0.04);
  border-left: 2px solid var(--color-gold-dim);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: var(--space-sm) 0;
}

.wiki-entry-body :deep(.wiki-tip-label) {
  font-family: var(--font-display);
  font-size: 9px;
  color: var(--color-gold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.wiki-entry-body :deep(.wiki-tip-text) {
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 0;
}

/* Tables */
.wiki-entry-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-xs);
}

.wiki-entry-body :deep(th) {
  background: var(--color-gold-glow);
  color: var(--color-gold);
  font-family: var(--font-display);
  font-weight: 600;
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border-dim);
}

.wiki-entry-body :deep(td) {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border-dim);
  color: var(--color-text-dim);
}

.wiki-entry-body :deep(tr:nth-child(even) td) {
  background: rgba(255, 255, 255, 0.02);
}

/* Custom span classes for inline keywords and effects */
.wiki-entry-body :deep(.wiki-kw) { color: var(--color-gold); font-weight: 600; }
.wiki-entry-body :deep(.wiki-bleed) { color: #c42b2b; font-weight: 600; }
.wiki-entry-body :deep(.wiki-stun) { color: #d4a932; font-weight: 600; }
.wiki-entry-body :deep(.wiki-sunder) { color: #3a7bd5; font-weight: 600; }
.wiki-entry-body :deep(.wiki-pierce) { color: #9b32d4; font-weight: 600; }
.wiki-entry-body :deep(.wiki-deflect) { color: #6b6051; font-weight: 600; }
.wiki-entry-body :deep(.wiki-glance) { color: #7a7e8b; font-weight: 600; }
.wiki-entry-body :deep(.wiki-partial) { color: #a89b85; font-weight: 600; }
.wiki-entry-body :deep(.wiki-reduced) { color: #e8dcc8; font-weight: 600; }
.wiki-entry-body :deep(.wiki-solid) { color: #c9a84c; font-weight: 600; }
.wiki-entry-body :deep(.wiki-clean) { color: #e0c878; font-weight: 600; }
.wiki-entry-body :deep(.wiki-devas) { color: #c42b2b; font-weight: 600; }
.wiki-entry-body :deep(.wiki-rusty) { color: #6b6051; }
.wiki-entry-body :deep(.wiki-iron) { color: #7a7e8b; }
.wiki-entry-body :deep(.wiki-steel) { color: #a89b85; }
.wiki-entry-body :deep(.wiki-cf) { color: #c9a84c; }
.wiki-entry-body :deep(.wiki-vs) { color: #e0c878; text-shadow: 0 0 6px rgba(224, 200, 120, 0.3); }

/* Welcome text */
.wiki-text {
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.6;
}

/* Resize handle */
.wiki-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--color-gold-dark);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.wiki-resize-handle:hover {
  opacity: 1;
  color: var(--color-gold);
}
</style>
