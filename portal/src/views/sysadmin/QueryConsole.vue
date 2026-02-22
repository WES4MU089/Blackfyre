<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

const { apiFetch } = useApi()

const sql = ref('SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME')
const rows = ref<Record<string, unknown>[]>([])
const columns = ref<string[]>([])
const rowCount = ref(0)
const loading = ref(false)
const error = ref('')
const execTime = ref(0)

async function executeQuery() {
  if (!sql.value.trim() || loading.value) return
  loading.value = true
  error.value = ''
  rows.value = []
  columns.value = []

  const start = performance.now()
  try {
    const data = await apiFetch<{ rows: Record<string, unknown>[]; rowCount: number }>(
      '/api/sysadmin/database/query',
      { method: 'POST', body: JSON.stringify({ sql: sql.value }) }
    )
    execTime.value = Math.round(performance.now() - start)
    rows.value = data.rows
    rowCount.value = data.rowCount

    // Extract columns from first row
    if (data.rows.length > 0) {
      columns.value = Object.keys(data.rows[0])
    }
  } catch (e: any) {
    execTime.value = Math.round(performance.now() - start)
    error.value = e.message || 'Query failed'
  } finally {
    loading.value = false
  }
}

function formatCell(value: unknown): string {
  if (value === null) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <div class="query-console">
    <PageHeader title="Query Console" subtitle="Execute read-only SQL queries">
      <router-link to="/sysadmin/database" class="back-link">&larr; Schema</router-link>
    </PageHeader>

    <!-- Query Input -->
    <div class="query-input-area">
      <textarea
        v-model="sql"
        class="sql-input"
        rows="4"
        placeholder="SELECT * FROM players LIMIT 10"
        spellcheck="false"
        @keydown.ctrl.enter="executeQuery"
      />
      <div class="query-actions">
        <button class="btn-primary" :disabled="loading || !sql.trim()" @click="executeQuery">
          {{ loading ? 'Running...' : 'Execute (Ctrl+Enter)' }}
        </button>
        <span v-if="execTime && !loading" class="muted">{{ execTime }}ms</span>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-box card">
      <span class="crimson">{{ error }}</span>
    </div>

    <!-- Results -->
    <div v-if="rows.length" class="results">
      <div class="results-header muted">
        {{ rowCount }} row{{ rowCount === 1 ? '' : 's' }} returned
      </div>
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="i">
              <td v-for="col in columns" :key="col" :class="{ 'cell-null': row[col] === null }">
                {{ formatCell(row[col]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-console {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.query-input-area {
  margin-bottom: var(--space-md);
}

.sql-input {
  width: 100%;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  resize: vertical;
  min-height: 80px;
}

.query-actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}

.error-box {
  margin-bottom: var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.results-header {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-sm);
}

.results-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}

.results-table th {
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  color: var(--color-gold);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.results-table td {
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border-dim);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.results-table tr:hover td {
  background: var(--color-surface-hover);
}

.cell-null {
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
