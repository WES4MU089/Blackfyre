<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from '@/components/layout/NavBar.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  authStore.loadFromStorage()
})
</script>

<template>
  <NavBar />
  <div class="app-body">
    <Sidebar v-if="authStore.isStaff || authStore.isSuperAdmin" />
    <main class="app-content" :class="{ 'with-sidebar': authStore.isStaff || authStore.isSuperAdmin }">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}

.app-content.with-sidebar {
  margin-left: var(--sidebar-width);
}
</style>
