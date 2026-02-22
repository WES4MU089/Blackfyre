<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="page-header">
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
    <slot />
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border-dim);
}

.page-title {
  font-size: var(--font-size-xl);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.page-subtitle {
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}
</style>
