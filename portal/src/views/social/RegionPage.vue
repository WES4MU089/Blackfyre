<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

interface House {
  id: number
  name: string
  motto: string | null
  sigil_url: string | null
  seat: string | null
  region_id: number | null
  is_great_house: boolean
  is_royal_house: boolean
  head_character_id: number | null
  region_name: string | null
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const region = ref<Region | null>(null)
const houses = ref<House[]>([])
const loading = ref(true)
const error = ref('')

const regionId = computed(() => Number(route.params.id))

const regionHouses = computed(() =>
  houses.value.filter((h) => h.region_id === regionId.value)
)

onMounted(async () => {
  try {
    const [regionsData, housesData] = await Promise.all([
      apiFetch<{ regions: Region[] }>('/api/houses/regions/list'),
      apiFetch<{ houses: House[] }>('/api/houses'),
    ])

    region.value = regionsData.regions.find((r) => r.id === regionId.value) || null
    houses.value = housesData.houses

    if (!region.value) {
      error.value = 'Region not found'
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load region'
  } finally {
    loading.value = false
  }
})

function goToHouse(id: number) {
  router.push({ name: 'house', params: { id } })
}
</script>

<template>
  <div class="region-page">
    <div v-if="loading" class="dim">Loading region...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="region">
      <PageHeader :title="region.name" subtitle="Houses and lords of this realm">
        <router-link to="/social/regions" class="back-link">&larr; All Regions</router-link>
      </PageHeader>

      <div v-if="region.banner_url" class="region-banner">
        <img :src="region.banner_url" :alt="region.name" />
      </div>

      <p v-if="region.description" class="region-desc dim">{{ region.description }}</p>

      <section class="houses-section">
        <h2>Houses of {{ region.name }}</h2>
        <div v-if="regionHouses.length" class="houses-grid">
          <div
            v-for="house in regionHouses"
            :key="house.id"
            class="card card-clickable house-card"
            @click="goToHouse(house.id)"
          >
            <div class="house-header">
              <img
                v-if="house.sigil_url"
                :src="house.sigil_url"
                :alt="house.name"
                class="house-sigil"
              />
              <div>
                <h3>House {{ house.name }}</h3>
                <div class="house-badges">
                  <span v-if="house.is_royal_house" class="badge badge-crimson">Royal</span>
                  <span v-if="house.is_great_house" class="badge badge-gold">Great House</span>
                </div>
              </div>
            </div>
            <p v-if="house.motto" class="house-motto dim">"{{ house.motto }}"</p>
            <p v-if="house.seat" class="house-seat">
              <span class="muted">Seat:</span> {{ house.seat }}
            </p>
          </div>
        </div>
        <p v-else class="dim">No houses in this region.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.region-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.region-banner {
  width: 100%;
  max-height: 240px;
  overflow: hidden;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-lg);
  border: 1px solid var(--color-border-dim);
}

.region-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.8;
}

.region-desc {
  font-size: var(--font-size-md);
  line-height: 1.7;
  margin-bottom: var(--space-xl);
}

.houses-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.houses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.house-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.house-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.house-sigil {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface);
}

.house-header h3 {
  font-size: var(--font-size-lg);
  margin-bottom: 2px;
}

.house-badges {
  display: flex;
  gap: var(--space-xs);
}

.house-motto {
  font-style: italic;
  font-size: var(--font-size-sm);
}

.house-seat {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}
</style>
