<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface TableInfo {
  name: string
  rows: number
}

interface ColumnInfo {
  COLUMN_NAME: string
  COLUMN_TYPE: string
  IS_NULLABLE: string
  COLUMN_KEY: string
  COLUMN_DEFAULT: string | null
  EXTRA: string
}

const { apiFetch } = useApi()

const tables = ref<TableInfo[]>([])
const schema = ref<Record<string, ColumnInfo[]>>({})
const loading = ref(true)
const error = ref('')
const expandedTable = ref<string | null>(null)
const filterText = ref('')

const filteredTables = computed(() => {
  if (!filterText.value) return tables.value
  const q = filterText.value.toLowerCase()
  return tables.value.filter((t) => t.name.toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    const data = await apiFetch<{ tables: TableInfo[]; schema: Record<string, ColumnInfo[]> }>(
      '/api/sysadmin/database/schema'
    )
    tables.value = data.tables
    schema.value = data.schema
  } catch (e: any) {
    error.value = e.message || 'Failed to load schema'
  } finally {
    loading.value = false
  }
})

function toggleTable(name: string) {
  expandedTable.value = expandedTable.value === name ? null : name
}
</script>

<template>
  <div class="schema-viewer">
    <PageHeader title="Database Schema" :subtitle="`${tables.length} tables`">
      <div class="header-links">
        <router-link to="/sysadmin/database/migrations" class="btn-secondary" style="padding: 4px 10px; font-size: 11px">Migrations</router-link>
        <router-link to="/sysadmin/database/query" class="btn-secondary" style="padding: 4px 10px; font-size: 11px">Query Console</router-link>
      </div>
    </PageHeader>

    <div class="search-bar">
      <input v-model="filterText" placeholder="Filter tables..." />
    </div>

    <p v-if="loading" class="dim">Loading schema...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else class="tables-list">
      <div
        v-for="table in filteredTables"
        :key="table.name"
        class="table-item"
      >
        <div class="table-header card card-clickable" @click="toggleTable(table.name)">
          <span class="table-name">
            <span class="expand-icon">{{ expandedTable === table.name ? '\u25BC' : '\u25B6' }}</span>
            {{ table.name }}
          </span>
          <span class="muted">~{{ table.rows }} rows</span>
        </div>

        <div v-if="expandedTable === table.name && schema[table.name]" class="columns-table">
          <div class="col-header">
            <span>Column</span>
            <span>Type</span>
            <span>Nullable</span>
            <span>Key</span>
            <span>Default</span>
            <span>Extra</span>
          </div>
          <div
            v-for="col in schema[table.name]"
            :key="col.COLUMN_NAME"
            class="col-row"
            :class="{ 'col-pk': col.COLUMN_KEY === 'PRI' }"
          >
            <span class="col-name">{{ col.COLUMN_NAME }}</span>
            <span class="col-type">{{ col.COLUMN_TYPE }}</span>
            <span>{{ col.IS_NULLABLE }}</span>
            <span>
              <span v-if="col.COLUMN_KEY === 'PRI'" class="badge badge-gold" style="font-size: 9px; padding: 1px 4px">PK</span>
              <span v-else-if="col.COLUMN_KEY === 'UNI'" class="badge badge-info" style="font-size: 9px; padding: 1px 4px">UNI</span>
              <span v-else-if="col.COLUMN_KEY === 'MUL'" class="badge badge-success" style="font-size: 9px; padding: 1px 4px">FK</span>
            </span>
            <span class="muted">{{ col.COLUMN_DEFAULT ?? '' }}</span>
            <span class="muted">{{ col.EXTRA }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schema-viewer {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.header-links {
  display: flex;
  gap: var(--space-sm);
}

.search-bar {
  margin-bottom: var(--space-lg);
}

.search-bar input {
  width: 100%;
  max-width: 400px;
}

.tables-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
}

.table-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.expand-icon {
  font-size: 10px;
  color: var(--color-gold-dim);
  width: 12px;
}

.columns-table {
  margin: 0 0 var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.col-header {
  display: grid;
  grid-template-columns: 2fr 2fr 0.8fr 0.6fr 1.5fr 1.5fr;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  font-family: var(--font-body);
}

.col-row {
  display: grid;
  grid-template-columns: 2fr 2fr 0.8fr 0.6fr 1.5fr 1.5fr;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  align-items: center;
  border-top: 1px solid var(--color-border-dim);
}

.col-row:hover {
  background: var(--color-surface-hover);
}

.col-pk {
  background: rgba(201, 168, 76, 0.04);
}

.col-name {
  color: var(--color-text);
  font-weight: 600;
}

.col-type {
  color: var(--color-gold-dim);
}
</style>
