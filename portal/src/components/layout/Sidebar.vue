<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <aside class="sidebar">
    <!-- Staff Section -->
    <div v-if="auth.isStaff" class="sidebar-section">
      <div class="sidebar-heading">Staff</div>
      <router-link
        v-if="auth.hasPermission('applications.view_queue')"
        to="/staff/applications"
        class="sidebar-link"
      >Applications</router-link>
      <router-link
        v-if="auth.hasPermission('family_tree.approve_suggestions')"
        to="/staff/family-trees"
        class="sidebar-link"
      >Family Trees</router-link>
    </div>

    <!-- Sysadmin Section -->
    <div v-if="auth.isSuperAdmin" class="sidebar-section">
      <div class="sidebar-heading">System Admin</div>
      <router-link to="/sysadmin/roles" class="sidebar-link">Roles</router-link>
      <router-link to="/sysadmin/players" class="sidebar-link">Players</router-link>
      <router-link to="/sysadmin/audit-log" class="sidebar-link">Audit Log</router-link>
      <router-link to="/sysadmin/database" class="sidebar-link">Schema</router-link>
      <router-link to="/sysadmin/database/migrations" class="sidebar-link">Migrations</router-link>
      <router-link to="/sysadmin/database/query" class="sidebar-link">Query Console</router-link>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: var(--nav-height);
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border-dim);
  overflow-y: auto;
  padding: var(--space-md) 0;
  z-index: 50;
}

.sidebar-section {
  padding: var(--space-sm) var(--space-md);
}

.sidebar-section + .sidebar-section {
  margin-top: var(--space-sm);
  border-top: 1px solid var(--color-border-dim);
  padding-top: var(--space-md);
}

.sidebar-heading {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  color: var(--color-gold-dark);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0 var(--space-sm);
  margin-bottom: var(--space-sm);
}

.sidebar-link {
  display: block;
  padding: 6px var(--space-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-dim);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  text-decoration: none;
}
.sidebar-link:hover {
  color: var(--color-text);
  background: rgba(201, 168, 76, 0.06);
}
.sidebar-link.router-link-active {
  color: var(--color-gold);
  background: rgba(201, 168, 76, 0.1);
}
</style>
