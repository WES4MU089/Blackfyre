<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface Character {
  id: number
  name: string
  title: string | null
  epithet: string | null
  portrait_url: string | null
  public_bio: string | null
  level: number
  is_active: boolean
  house_id: number | null
  region_id: number | null
  is_bastard: boolean
  is_dragon_seed: boolean
  father_name: string | null
  mother_name: string | null
}

interface House {
  id: number
  name: string
  motto: string | null
  sigil_url: string | null
  seat: string | null
  region_name: string | null
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const character = ref<Character | null>(null)
const house = ref<House | null>(null)
const loading = ref(true)
const error = ref('')

const charId = computed(() => Number(route.params.id))

onMounted(async () => {
  try {
    const data = await apiFetch<Character>(`/api/characters/${charId.value}`)
    character.value = data

    // Fetch house details if character belongs to one
    if (data.house_id) {
      try {
        const houseData = await apiFetch<{ house: House }>(`/api/houses/${data.house_id}`)
        house.value = houseData.house
      } catch {
        // House fetch is optional — don't block
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load character'
  } finally {
    loading.value = false
  }
})

function goToHouse(id: number) {
  router.push({ name: 'house', params: { id } })
}
</script>

<template>
  <div class="character-page">
    <div v-if="loading" class="dim">Loading character...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="character">
      <PageHeader
        :title="character.name"
        :subtitle="character.title || undefined"
      >
        <router-link
          v-if="house"
          :to="{ name: 'house', params: { id: house.id } }"
          class="back-link"
        >
          &larr; House {{ house.name }}
        </router-link>
        <router-link v-else to="/social/regions" class="back-link">&larr; Regions</router-link>
      </PageHeader>

      <div class="char-layout">
        <!-- Portrait + Quick Info -->
        <aside class="char-sidebar">
          <div class="char-portrait-frame">
            <img
              v-if="character.portrait_url"
              :src="character.portrait_url"
              :alt="character.name"
              class="char-portrait"
            />
            <div v-else class="char-portrait-placeholder">
              <span>?</span>
            </div>
          </div>

          <div class="char-quick-info">
            <div class="char-badges">
              <span class="badge badge-gold">Level {{ character.level }}</span>
              <span v-if="!character.is_active" class="badge badge-crimson">Inactive</span>
              <span v-if="character.is_dragon_seed" class="badge badge-crimson">Dragonseed</span>
              <span v-if="character.is_bastard" class="badge badge-info">Bastard</span>
            </div>

            <div class="char-details">
              <div v-if="character.epithet" class="char-detail">
                <span class="muted">Known as</span>
                <span class="gold" style="font-style: italic">{{ character.epithet }}</span>
              </div>
              <div v-if="house" class="char-detail">
                <span class="muted">House</span>
                <a class="gold" @click.prevent="goToHouse(house.id)">{{ house.name }}</a>
              </div>
              <div v-if="character.father_name" class="char-detail">
                <span class="muted">Father</span>
                <span>{{ character.father_name }}</span>
              </div>
              <div v-if="character.mother_name" class="char-detail">
                <span class="muted">Mother</span>
                <span>{{ character.mother_name }}</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- Bio -->
        <div class="char-main">
          <section v-if="character.public_bio" class="bio-section">
            <h2>Biography</h2>
            <p class="bio-text">{{ character.public_bio }}</p>
          </section>
          <p v-else class="dim">No public biography available.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.character-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

.char-layout {
  display: flex;
  gap: var(--space-xl);
  align-items: flex-start;
}

/* Sidebar */
.char-sidebar {
  flex-shrink: 0;
  width: 240px;
}

.char-portrait-frame {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-ornate);
  background: var(--color-surface);
  margin-bottom: var(--space-md);
}

.char-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.char-portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-3xl);
  color: var(--color-text-muted);
}

.char-quick-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.char-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.char-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.char-detail {
  display: flex;
  flex-direction: column;
  font-size: var(--font-size-sm);
}

.char-detail .muted {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 1px;
}

/* Main Content */
.char-main {
  flex: 1;
  min-width: 0;
}

.bio-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.bio-text {
  font-size: var(--font-size-md);
  line-height: 1.8;
  color: var(--color-text-dim);
  white-space: pre-wrap;
}

/* Responsive */
@media (max-width: 768px) {
  .char-layout {
    flex-direction: column;
  }

  .char-sidebar {
    width: 100%;
    max-width: 300px;
  }
}
</style>
