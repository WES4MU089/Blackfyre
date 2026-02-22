<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Region {
  id: number
  name: string
  description: string | null
  banner_url: string | null
  ruling_house_id: number | null
  ruling_house_name: string | null
}

const router = useRouter()
const { apiFetch } = useApi()

const regions = ref<Region[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await apiFetch<{ regions: Region[] }>('/api/houses/regions/list')
    regions.value = data.regions
  } catch (e: any) {
    error.value = e.message || 'Failed to load regions'
  } finally {
    loading.value = false
  }
})

function goToRegion(id: number) {
  router.push({ name: 'region', params: { id } })
}
</script>

<template>
  <div class="region-list">
    <PageHeader title="Regions" subtitle="Explore the kingdoms of Westeros and the great houses that rule them" />

    <p v-if="loading" class="dim">Loading regions...</p>
    <p v-else-if="error" class="crimson">{{ error }}</p>

    <div v-else class="regions-grid">
      <div
        v-for="region in regions"
        :key="region.id"
        class="card card-clickable region-card"
        @click="goToRegion(region.id)"
      >
        <div v-if="region.banner_url" class="region-banner">
          <img :src="region.banner_url" :alt="region.name" />
        </div>
        <div class="region-info">
          <h3>{{ region.name }}</h3>
          <p v-if="region.ruling_house_name" class="region-ruler">
            Ruled by <span class="gold">House {{ region.ruling_house_name }}</span>
          </p>
          <p v-if="region.description" class="dim region-desc">{{ region.description }}</p>
        </div>
      </div>
    </div>

    <p v-if="!loading && !error && regions.length === 0" class="dim">No regions found.</p>
  </div>
</template>

<style scoped>
.region-list {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.regions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.region-card {
  overflow: hidden;
  padding: 0;
}

.region-banner {
  width: 100%;
  height: 140px;
  overflow: hidden;
  background: var(--color-surface);
}

.region-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.region-card:hover .region-banner img {
  opacity: 0.9;
}

.region-info {
  padding: var(--space-md);
}

.region-info h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-xs);
}

.region-ruler {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
  margin-bottom: var(--space-sm);
}

.region-desc {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
