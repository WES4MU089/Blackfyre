<script setup lang="ts">
import PageHeader from '@/components/layout/PageHeader.vue'
</script>

<template>
  <div class="migration-runner">
    <PageHeader title="Migrations" subtitle="Database migration management">
      <router-link to="/sysadmin/database" class="back-link">&larr; Schema</router-link>
    </PageHeader>

    <div class="card info-card">
      <h3>Migration Management</h3>
      <p class="dim">
        Migrations are applied manually via SSH on the production server. This page will show
        migration status and allow applying pending migrations in a future update.
      </p>
      <div class="code-block">
        <code>ssh root@187.77.211.96 "mariadb -u blackfyre -p'***' blackfyre_hud &lt; /path/to/migration.sql"</code>
      </div>
    </div>
  </div>
</template>

<style scoped>
.migration-runner {
  max-width: 800px;
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.info-card {
  margin-top: var(--space-lg);
}

.info-card h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-sm);
}

.info-card p {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  margin-bottom: var(--space-md);
}

.code-block {
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-dim);
  overflow-x: auto;
}
</style>
