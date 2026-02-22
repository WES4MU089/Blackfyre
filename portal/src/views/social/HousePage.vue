<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import PageHeader from '@/components/layout/PageHeader.vue'

interface House {
  id: number
  name: string
  motto: string | null
  sigil_url: string | null
  seat: string | null
  region_id: number | null
  is_great_house: boolean
  is_royal_house: boolean
  is_extinct: boolean
  head_character_id: number | null
  lore_summary: string | null
  region_name: string | null
}

interface FamilyNPC {
  id: number
  name: string
  title: string | null
  epithet: string | null
  portrait_url: string | null
  public_bio: string | null
  is_deceased: boolean
}

interface FamilyEdge {
  id: number
  relationship: 'parent' | 'spouse' | 'sibling'
  from_character_id: number | null
  from_npc_id: number | null
  to_character_id: number | null
  to_npc_id: number | null
}

interface CharacterSummary {
  id: number
  name: string
  title: string | null
  epithet: string | null
  portrait_url: string | null
  is_active: boolean
  public_bio: string | null
  level: number
}

const route = useRoute()
const router = useRouter()
const { apiFetch } = useApi()

const house = ref<House | null>(null)
const npcs = ref<FamilyNPC[]>([])
const edges = ref<FamilyEdge[]>([])
const characters = ref<CharacterSummary[]>([])
const loading = ref(true)
const error = ref('')

const houseId = computed(() => Number(route.params.id))

const activeMembers = computed(() => characters.value.filter((c) => c.is_active))
const inactiveMembers = computed(() => characters.value.filter((c) => !c.is_active))

const headCharacter = computed(() => {
  if (!house.value?.head_character_id) return null
  return characters.value.find((c) => c.id === house.value!.head_character_id) || null
})

// Build family tree generations from edges
const generations = computed(() => {
  const allNodes: { key: string; name: string; title: string | null; isDeceased: boolean; isCharacter: boolean; id: number }[] = []

  for (const npc of npcs.value) {
    allNodes.push({ key: `n:${npc.id}`, name: npc.name, title: npc.title, isDeceased: npc.is_deceased, isCharacter: false, id: npc.id })
  }
  for (const ch of characters.value) {
    allNodes.push({ key: `c:${ch.id}`, name: ch.name, title: ch.title, isDeceased: false, isCharacter: true, id: ch.id })
  }

  if (allNodes.length === 0) return []

  // Build adjacency: parent → children
  const parentEdges = edges.value.filter((e) => e.relationship === 'parent')
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()

  for (const e of parentEdges) {
    const fromKey = e.from_character_id ? `c:${e.from_character_id}` : `n:${e.from_npc_id}`
    const toKey = e.to_character_id ? `c:${e.to_character_id}` : `n:${e.to_npc_id}`
    if (!childrenOf.has(fromKey)) childrenOf.set(fromKey, [])
    childrenOf.get(fromKey)!.push(toKey)
    hasParent.add(toKey)
  }

  // BFS from roots
  const nodeMap = new Map(allNodes.map((n) => [n.key, n]))
  const roots = allNodes.filter((n) => !hasParent.has(n.key))
  if (roots.length === 0) return [allNodes] // fallback: flat grid

  const genMap = new Map<string, number>()
  const queue = roots.map((r) => ({ key: r.key, gen: 0 }))
  for (const item of queue) {
    if (genMap.has(item.key)) continue
    genMap.set(item.key, item.gen)
    const children = childrenOf.get(item.key) || []
    for (const child of children) {
      queue.push({ key: child, gen: item.gen + 1 })
    }
  }

  // Nodes without edges
  for (const n of allNodes) {
    if (!genMap.has(n.key)) genMap.set(n.key, 0)
  }

  const maxGen = Math.max(...genMap.values())
  const gens: typeof allNodes[] = []
  for (let g = 0; g <= maxGen; g++) {
    gens.push(allNodes.filter((n) => genMap.get(n.key) === g))
  }
  return gens
})

onMounted(async () => {
  try {
    const [houseData, treeData] = await Promise.all([
      apiFetch<{ house: House }>(`/api/houses/${houseId.value}`),
      apiFetch<{ npcs: FamilyNPC[]; edges: FamilyEdge[]; characters: CharacterSummary[] }>(
        `/api/family-tree/houses/${houseId.value}/tree`
      ),
    ])

    house.value = houseData.house
    npcs.value = treeData.npcs
    edges.value = treeData.edges
    characters.value = treeData.characters
  } catch (e: any) {
    error.value = e.message || 'Failed to load house'
  } finally {
    loading.value = false
  }
})

function goToCharacter(id: number) {
  router.push({ name: 'character', params: { id } })
}
</script>

<template>
  <div class="house-page">
    <div v-if="loading" class="dim">Loading house...</div>
    <div v-else-if="error" class="crimson">{{ error }}</div>

    <template v-else-if="house">
      <PageHeader :title="'House ' + house.name" :subtitle="house.motto ? '\u0022' + house.motto + '\u0022' : undefined">
        <router-link
          v-if="house.region_id"
          :to="{ name: 'region', params: { id: house.region_id } }"
          class="back-link"
        >
          &larr; {{ house.region_name || 'Region' }}
        </router-link>
        <router-link v-else to="/social/regions" class="back-link">&larr; Regions</router-link>
      </PageHeader>

      <!-- House Info -->
      <div class="house-info card">
        <div class="house-info-header">
          <img
            v-if="house.sigil_url"
            :src="house.sigil_url"
            :alt="house.name"
            class="house-sigil-large"
          />
          <div class="house-meta">
            <div class="house-badges">
              <span v-if="house.is_royal_house" class="badge badge-crimson">Royal House</span>
              <span v-if="house.is_great_house" class="badge badge-gold">Great House</span>
              <span v-if="house.is_extinct" class="badge badge-crimson">Extinct</span>
            </div>
            <p v-if="house.seat" class="house-detail">
              <span class="muted">Seat:</span> {{ house.seat }}
            </p>
            <p v-if="house.region_name" class="house-detail">
              <span class="muted">Region:</span> {{ house.region_name }}
            </p>
            <p v-if="headCharacter" class="house-detail">
              <span class="muted">Head:</span>
              <a class="gold" @click.prevent="goToCharacter(headCharacter.id)">{{ headCharacter.name }}</a>
            </p>
          </div>
        </div>
        <p v-if="house.lore_summary" class="house-lore dim">{{ house.lore_summary }}</p>
      </div>

      <!-- Family Tree -->
      <section v-if="generations.length > 0" class="tree-section">
        <h2>Family Tree</h2>
        <div class="tree-container">
          <div
            v-for="(gen, gi) in generations"
            :key="gi"
            class="tree-generation"
          >
            <div class="tree-gen-label muted">Gen {{ gi + 1 }}</div>
            <div class="tree-gen-row">
              <div
                v-for="node in gen"
                :key="node.key"
                class="tree-node"
                :class="{
                  'tree-node-character': node.isCharacter,
                  'tree-node-deceased': node.isDeceased,
                }"
                @click="node.isCharacter ? goToCharacter(node.id) : undefined"
              >
                <span class="tree-node-name">{{ node.name }}</span>
                <span v-if="node.title" class="tree-node-title dim">{{ node.title }}</span>
                <span v-if="node.isDeceased" class="tree-node-dead muted">(deceased)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Character Roster -->
      <section v-if="activeMembers.length > 0" class="roster-section">
        <h2>Active Members</h2>
        <div class="roster-grid">
          <div
            v-for="ch in activeMembers"
            :key="ch.id"
            class="card card-clickable roster-card"
            @click="goToCharacter(ch.id)"
          >
            <img
              v-if="ch.portrait_url"
              :src="ch.portrait_url"
              :alt="ch.name"
              class="roster-portrait"
            />
            <div v-else class="roster-portrait-placeholder">?</div>
            <div class="roster-info">
              <h4>{{ ch.name }}</h4>
              <p v-if="ch.title" class="dim">{{ ch.title }}</p>
              <p v-if="ch.epithet" class="muted" style="font-style: italic">{{ ch.epithet }}</p>
              <span class="badge badge-gold">Lv {{ ch.level }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="inactiveMembers.length > 0" class="roster-section">
        <h2 class="dim">Inactive Members</h2>
        <div class="roster-grid faded">
          <div
            v-for="ch in inactiveMembers"
            :key="ch.id"
            class="card roster-card"
          >
            <div class="roster-portrait-placeholder muted">?</div>
            <div class="roster-info">
              <h4 class="dim">{{ ch.name }}</h4>
              <p v-if="ch.title" class="muted">{{ ch.title }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.house-page {
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.back-link {
  font-size: var(--font-size-sm);
}

/* House Info */
.house-info {
  margin-bottom: var(--space-xl);
}

.house-info-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
}

.house-sigil-large {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface);
  flex-shrink: 0;
}

.house-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.house-badges {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.house-detail {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}

.house-lore {
  margin-top: var(--space-md);
  font-size: var(--font-size-sm);
  line-height: 1.7;
  border-top: 1px solid var(--color-border-dim);
  padding-top: var(--space-md);
}

/* Family Tree */
.tree-section {
  margin-bottom: var(--space-xl);
}

.tree-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.tree-container {
  overflow-x: auto;
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-md);
}

.tree-generation {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.tree-generation:last-child {
  margin-bottom: 0;
}

.tree-gen-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  width: 40px;
  flex-shrink: 0;
  text-align: right;
}

.tree-gen-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tree-node {
  display: flex;
  flex-direction: column;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border-dim);
  border-radius: var(--radius-sm);
  background: var(--color-surface-card);
  min-width: 100px;
  font-size: var(--font-size-sm);
}

.tree-node-character {
  border-color: var(--color-gold-dim);
  cursor: pointer;
}

.tree-node-character:hover {
  border-color: var(--color-gold);
  box-shadow: var(--shadow-gold);
}

.tree-node-deceased {
  opacity: 0.6;
}

.tree-node-name {
  color: var(--color-text);
  font-weight: 600;
}

.tree-node-character .tree-node-name {
  color: var(--color-gold);
}

.tree-node-title {
  font-size: var(--font-size-xs);
}

.tree-node-dead {
  font-size: var(--font-size-xs);
}

/* Roster */
.roster-section {
  margin-bottom: var(--space-xl);
}

.roster-section h2 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-md);
}

.roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-md);
}

.roster-grid.faded {
  opacity: 0.5;
}

.roster-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.roster-portrait {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--color-border-dim);
  flex-shrink: 0;
}

.roster-portrait-placeholder {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.roster-info h4 {
  font-size: var(--font-size-md);
  margin-bottom: 2px;
}

.roster-info p {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.roster-info .badge {
  margin-top: var(--space-xs);
}
</style>
