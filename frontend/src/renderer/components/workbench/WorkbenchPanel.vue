<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkbenchStore, type WorkbenchRecipe, type WorkbenchIngredient } from '@/stores/workbench'
import { useHudStore } from '@/stores/hud'
import { useDraggable } from '@/composables/useDraggable'
import { getSocket } from '@/composables/useSocket'
import { getTierColor } from '@/utils/tierColors'
import { getItemIcon } from '@/utils/itemIcons'

const workbenchStore = useWorkbenchStore()
const hudStore = useHudStore()
const panelRef = ref<HTMLElement | null>(null)
const { onDragStart } = useDraggable('workbench', panelRef, { alwaysDraggable: true })

const panelStyle = computed(() => {
  const pos = hudStore.hudPositions['workbench']
  if (!pos || pos.x == null || pos.y == null) return undefined
  return {
    position: 'fixed' as const,
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function iconFor(
  itemKey: string,
  iconUrl: string | null,
  opts: { tier?: number | null; category?: string | null } = {},
): string {
  if (iconUrl) return iconUrl
  return getItemIcon(itemKey, {
    tier: opts.tier ?? undefined,
    category: opts.category ?? undefined,
  })
}

function tierLabel(tier: number | null): string {
  if (tier == null) return ''
  const labels: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' }
  return labels[tier] ?? String(tier)
}

function timeLabel(seconds: number): string {
  if (seconds === 0) return 'Instant'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function aptValue(aptKey: string | null): number {
  if (!aptKey) return 0
  return workbenchStore.aptitudes[aptKey] ?? 0
}

function aptOk(recipe: WorkbenchRecipe): boolean {
  if (!recipe.aptitudeKey) return true
  return aptValue(recipe.aptitudeKey) >= recipe.aptitudeMin
}

function craftRecipe(recipeKey: string): void {
  if (workbenchStore.craftingRecipeKey) return
  workbenchStore.setCrafting(recipeKey)
  getSocket()?.emit('workbench:craft', { recipeKey })
}

function closePanel(): void {
  getSocket()?.emit('workbench:close')
  workbenchStore.close()
}

function selectRecipe(recipe: WorkbenchRecipe): void {
  workbenchStore.select(recipe.recipeKey)
}

function rarityColor(rarity: string | null): string {
  switch (rarity) {
    case 'uncommon':  return '#1eff00'
    case 'rare':      return '#0070dd'
    case 'epic':      return '#a335ee'
    case 'legendary': return '#ff8000'
    default:          return '#888888'
  }
}

function qualityColor(quality: string | null | undefined): string {
  switch (quality) {
    case 'superior': return '#ffd166'
    case 'inferior': return '#d64545'
    default:         return '#bcbcbc'
  }
}

function qualityLabel(quality: string | null | undefined): string {
  if (!quality) return 'Standard'
  return quality.charAt(0).toUpperCase() + quality.slice(1)
}

function ingredientIcon(ing: WorkbenchIngredient): string {
  return iconFor(ing.itemKey, ing.iconUrl, { category: 'material' })
}
</script>

<template>
  <div class="workbench-wrapper">
    <div
      ref="panelRef"
      class="workbench-panel panel-ornate animate-fade-in"
      :style="panelStyle"
    >
      <!-- ── Header ────────────────────────────── -->
      <header class="wb-header" @mousedown="onDragStart">
        <div class="wb-identity">
          <div class="wb-station-icon" :class="`wb-station-icon--${workbenchStore.stationType}`">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 14h16l-2 4H6l-2-4zM6 14V9a2 2 0 012-2h8a2 2 0 012 2v5M10 3v4M14 3v4" />
            </svg>
          </div>
          <div class="wb-identity-text">
            <div class="wb-station-label">{{ workbenchStore.workbenchName || workbenchStore.stationLabel }}</div>
            <div class="wb-station-sub">
              <span>{{ workbenchStore.stationLabel }}</span>
              <span class="wb-dot">·</span>
              <span>{{ workbenchStore.characterName }}</span>
            </div>
          </div>
        </div>
        <button class="wb-close" aria-label="Close" @click.stop="closePanel">✕</button>
      </header>

      <!-- ── Toolbar (filters) ────────────────────── -->
      <div class="wb-toolbar">
        <input
          v-model="workbenchStore.search"
          placeholder="Search recipes..."
          class="wb-search"
        />
        <label class="wb-filter-toggle">
          <input type="checkbox" v-model="workbenchStore.filterOnlyCraftable" />
          <span>Craftable only</span>
        </label>
        <span class="wb-count dim mono">{{ workbenchStore.visibleRecipes.length }} / {{ workbenchStore.recipes.length }}</span>
      </div>

      <!-- ── Body ─────────────────────────────── -->
      <div class="wb-body">
        <!-- Left: recipe grid -->
        <div class="wb-recipe-list">
          <p v-if="workbenchStore.visibleRecipes.length === 0" class="dim empty">
            No recipes match.
          </p>

          <div
            v-for="r in workbenchStore.visibleRecipes"
            :key="r.recipeKey"
            class="wb-recipe-tile"
            :class="{
              'wb-recipe-tile--selected': workbenchStore.selectedRecipeKey === r.recipeKey,
              'wb-recipe-tile--locked': !r.canCraft,
            }"
            @click="selectRecipe(r)"
          >
            <div
              class="wb-recipe-icon"
              :style="{ borderColor: rarityColor(r.output.rarity) }"
            >
              <img :src="iconFor(r.output.itemKey, r.output.iconUrl, { tier: r.output.tier, category: r.output.category })" :alt="r.output.itemName" />
              <span v-if="r.output.tier" class="wb-tier-badge" :style="{ color: getTierColor(r.output.tier) }">
                {{ tierLabel(r.output.tier) }}
              </span>
            </div>
            <div class="wb-recipe-info">
              <div class="wb-recipe-name">{{ r.name }}</div>
              <div class="wb-recipe-meta">
                <span v-if="r.aptitudeKey" class="wb-meta-apt" :class="{ 'wb-meta-apt--low': !aptOk(r) }">
                  {{ r.aptitudeKey }} {{ r.aptitudeMin }}+
                </span>
                <span v-if="r.timeSeconds > 0" class="wb-meta-time mono">
                  {{ timeLabel(r.timeSeconds) }}
                </span>
              </div>
            </div>
            <div v-if="r.canCraft" class="wb-recipe-status wb-recipe-status--ok" title="Ready to craft">●</div>
            <div v-else class="wb-recipe-status wb-recipe-status--blocked" title="Requirements not met">●</div>
          </div>
        </div>

        <!-- Right: recipe detail -->
        <div class="wb-recipe-detail">
          <template v-if="workbenchStore.selectedRecipe">
            <div class="wb-detail-header">
              <div
                class="wb-detail-icon"
                :style="{ borderColor: rarityColor(workbenchStore.selectedRecipe.output.rarity) }"
              >
                <img
                  :src="iconFor(
                    workbenchStore.selectedRecipe.output.itemKey,
                    workbenchStore.selectedRecipe.output.iconUrl,
                    { tier: workbenchStore.selectedRecipe.output.tier, category: workbenchStore.selectedRecipe.output.category },
                  )"
                  :alt="workbenchStore.selectedRecipe.output.itemName"
                />
              </div>
              <div class="wb-detail-title">
                <h2 :style="{ color: getTierColor(workbenchStore.selectedRecipe.output.tier ?? 0) }">
                  {{ workbenchStore.selectedRecipe.output.itemName }}
                </h2>
                <div class="wb-detail-sub mono dim">
                  <span>{{ workbenchStore.selectedRecipe.output.quantity }}×</span>
                  <span v-if="workbenchStore.selectedRecipe.output.tier">Tier {{ tierLabel(workbenchStore.selectedRecipe.output.tier) }}</span>
                  <span v-if="workbenchStore.selectedRecipe.output.rarity" class="wb-rarity" :style="{ color: rarityColor(workbenchStore.selectedRecipe.output.rarity) }">
                    {{ workbenchStore.selectedRecipe.output.rarity }}
                  </span>
                </div>
              </div>
            </div>

            <p v-if="workbenchStore.selectedRecipe.description" class="wb-detail-description">
              {{ workbenchStore.selectedRecipe.description }}
            </p>

            <div class="wb-section">
              <div class="wb-section-head">Materials</div>
              <div class="wb-ingredients-grid">
                <div
                  v-for="ing in workbenchStore.selectedRecipe.ingredients"
                  :key="ing.itemKey"
                  class="wb-ingredient"
                  :class="{ 'wb-ingredient--missing': !ing.ok }"
                >
                  <div class="wb-ingredient-icon">
                    <img :src="ingredientIcon(ing)" :alt="ing.itemName" />
                  </div>
                  <div class="wb-ingredient-info">
                    <div class="wb-ingredient-name">{{ ing.itemName }}</div>
                    <div class="wb-ingredient-count mono" :class="{ crimson: !ing.ok, gold: ing.ok }">
                      {{ ing.have }} / {{ ing.needed }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="wb-section wb-requirements">
              <div v-if="workbenchStore.selectedRecipe.aptitudeKey" class="wb-req" :class="{ 'wb-req--low': !aptOk(workbenchStore.selectedRecipe) }">
                <span class="wb-req-label">{{ workbenchStore.selectedRecipe.aptitudeKey }}</span>
                <span class="wb-req-value mono">
                  {{ aptValue(workbenchStore.selectedRecipe.aptitudeKey) }} / {{ workbenchStore.selectedRecipe.aptitudeMin }}
                </span>
              </div>
              <div v-if="workbenchStore.selectedRecipe.timeSeconds > 0" class="wb-req">
                <span class="wb-req-label">Craft time</span>
                <span class="wb-req-value mono">{{ timeLabel(workbenchStore.selectedRecipe.timeSeconds) }}</span>
              </div>
            </div>

            <div v-if="!workbenchStore.selectedRecipe.canCraft" class="wb-blockers">
              <span class="crimson mono">Missing: {{ workbenchStore.selectedRecipe.blockers.join(', ') }}</span>
            </div>

            <button
              class="wb-craft-btn"
              :disabled="!workbenchStore.selectedRecipe.canCraft || !!workbenchStore.craftingRecipeKey"
              @click="craftRecipe(workbenchStore.selectedRecipe.recipeKey)"
            >
              <span v-if="workbenchStore.craftingRecipeKey === workbenchStore.selectedRecipe.recipeKey">Crafting…</span>
              <span v-else-if="!workbenchStore.selectedRecipe.canCraft">Requirements not met</span>
              <span v-else-if="workbenchStore.selectedRecipe.timeSeconds > 0">Begin work ({{ timeLabel(workbenchStore.selectedRecipe.timeSeconds) }})</span>
              <span v-else>Craft</span>
            </button>

            <div v-if="workbenchStore.lastResult" class="wb-result" :class="{ 'wb-result--fail': !workbenchStore.lastResult.success }">
              <div class="wb-result-head">
                <span v-if="workbenchStore.lastResult.success" class="wb-result-badge wb-result-badge--ok">Crafted</span>
                <span v-else class="wb-result-badge wb-result-badge--fail">Failed</span>
                <span
                  v-if="workbenchStore.lastResult.output?.quality"
                  class="wb-quality-badge"
                  :style="{ color: qualityColor(workbenchStore.lastResult.output.quality) }"
                >
                  {{ qualityLabel(workbenchStore.lastResult.output.quality) }}
                </span>
              </div>
              <div class="wb-result-message">{{ workbenchStore.lastResult.message }}</div>
              <div v-if="workbenchStore.lastResult.output?.roll" class="wb-result-roll mono dim">
                Rolled {{ workbenchStore.lastResult.output.roll.successes }} successes
                (target {{ workbenchStore.lastResult.output.roll.target }},
                pool {{ workbenchStore.lastResult.output.roll.poolSize }}d6)
              </div>
              <div v-if="workbenchStore.lastResult.output?.slot != null" class="wb-result-slot mono dim">
                Placed in inventory slot {{ workbenchStore.lastResult.output.slot }}
              </div>
              <div v-if="workbenchStore.lastResult.completesAt" class="wb-result-slot mono dim">
                Ready {{ new Date(workbenchStore.lastResult.completesAt).toLocaleString() }}
              </div>
            </div>
          </template>

          <div v-else class="wb-empty-detail dim">
            Select a recipe from the list.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workbench-wrapper { pointer-events: none; }
.workbench-panel {
  pointer-events: auto;
  width: 860px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface, #0c0a10);
  color: var(--color-text, #e8dcc8);
  overflow: hidden;
}
.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border-ornate, rgba(201, 168, 76, 0.35));
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}
.wb-header:active { cursor: grabbing; }
.wb-identity { display: flex; gap: 14px; align-items: center; }
.wb-station-icon {
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-gold, #c9a84c);
  border: 1px solid var(--color-border-ornate, rgba(201, 168, 76, 0.35));
  border-radius: 3px;
  background: rgba(201, 168, 76, 0.08);
}
.wb-station-icon svg { width: 28px; height: 28px; }
.wb-identity-text { display: flex; flex-direction: column; gap: 3px; }
.wb-station-label {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.25rem;
  color: var(--color-gold, #c9a84c);
  letter-spacing: 0.02em;
}
.wb-station-sub { display: flex; gap: 8px; font-size: 0.8rem; color: var(--color-text-dim, #a89b85); }
.wb-dot { opacity: 0.6; }
.wb-close {
  background: transparent;
  border: 1px solid var(--color-border-ornate, rgba(201, 168, 76, 0.35));
  color: var(--color-text-dim, #a89b85);
  width: 32px; height: 32px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 120ms ease;
}
.wb-close:hover { color: var(--color-gold, #c9a84c); border-color: var(--color-gold, #c9a84c); }
.wb-toolbar {
  display: flex; gap: 12px; align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid var(--color-border-dim, #333);
  flex-shrink: 0;
}
.wb-search {
  flex: 1; max-width: 320px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border-dim, #333);
  color: var(--color-text, #e8dcc8);
  border-radius: 2px;
  font-family: var(--font-body, sans-serif);
  font-size: 0.85rem;
}
.wb-filter-toggle {
  display: flex; gap: 6px; align-items: center;
  font-size: 0.85rem;
  color: var(--color-text-dim, #a89b85);
  cursor: pointer;
}
.wb-count { margin-left: auto; font-size: 0.8rem; }
.wb-body {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 1.4fr;
  overflow: hidden;
  flex: 1; min-height: 0;
}
.wb-recipe-list {
  overflow-y: auto;
  padding: 10px;
  border-right: 1px solid var(--color-border-dim, #333);
  display: flex; flex-direction: column; gap: 4px;
}
.wb-recipe-tile {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: all 120ms ease;
}
.wb-recipe-tile:hover {
  background: var(--color-surface-hover, #1a1820);
  border-color: var(--color-border-dim, #333);
}
.wb-recipe-tile--selected {
  background: rgba(201, 168, 76, 0.08);
  border-color: var(--color-gold, #c9a84c);
}
.wb-recipe-tile--locked .wb-recipe-icon { opacity: 0.45; filter: grayscale(0.6); }
.wb-recipe-tile--locked .wb-recipe-name { color: var(--color-text-dim, #a89b85); }
.wb-recipe-icon {
  position: relative;
  width: 44px; height: 44px;
  border: 2px solid #555;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.wb-recipe-icon img { width: 100%; height: 100%; object-fit: contain; }
.wb-tier-badge {
  position: absolute; bottom: -1px; right: 2px;
  font-family: var(--font-display, serif);
  font-size: 0.7rem; font-weight: 700;
  text-shadow: 0 0 3px #000, 0 0 3px #000;
  line-height: 1;
}
.wb-recipe-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wb-recipe-name {
  font-size: 0.92rem; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wb-recipe-meta {
  display: flex; gap: 8px;
  font-size: 0.72rem;
  color: var(--color-text-dim, #a89b85);
}
.wb-meta-apt--low { color: #d64545; }
.wb-recipe-status { font-size: 0.7rem; line-height: 1; }
.wb-recipe-status--ok { color: #4caf50; }
.wb-recipe-status--blocked { color: #d64545; }
.empty { padding: 20px; text-align: center; font-size: 0.85rem; }
.wb-recipe-detail {
  overflow-y: auto;
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 14px;
}
.wb-empty-detail { padding: 40px 20px; text-align: center; font-style: italic; }
.wb-detail-header { display: flex; gap: 14px; align-items: center; }
.wb-detail-icon {
  width: 64px; height: 64px;
  border: 2px solid #555; border-radius: 3px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
}
.wb-detail-icon img { width: 100%; height: 100%; object-fit: contain; }
.wb-detail-title h2 {
  margin: 0;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.2rem; letter-spacing: 0.02em;
}
.wb-detail-sub { display: flex; gap: 10px; margin-top: 3px; font-size: 0.78rem; }
.wb-rarity { text-transform: capitalize; }
.wb-detail-description {
  margin: 0;
  font-style: italic;
  color: var(--color-text-dim, #a89b85);
  font-size: 0.88rem; line-height: 1.4;
}
.wb-section { display: flex; flex-direction: column; gap: 6px; }
.wb-section-head {
  font-size: 0.7rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--color-gold-dark, #9a7b2e);
  border-bottom: 1px solid var(--color-border-dim, #333);
  padding-bottom: 4px;
}
.wb-ingredients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.wb-ingredient {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px; align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border-dim, #333);
  border-radius: 2px;
}
.wb-ingredient--missing {
  background: rgba(214, 69, 69, 0.08);
  border-color: rgba(214, 69, 69, 0.4);
}
.wb-ingredient-icon {
  width: 36px; height: 36px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 2px; overflow: hidden;
}
.wb-ingredient-icon img { width: 100%; height: 100%; object-fit: contain; }
.wb-ingredient-info { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.wb-ingredient-name {
  font-size: 0.78rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wb-ingredient-count { font-size: 0.8rem; font-weight: 600; }
.gold { color: var(--color-gold, #c9a84c); }
.crimson { color: #d64545; }
.wb-requirements { display: flex; flex-wrap: wrap; gap: 8px; }
.wb-req {
  display: flex; flex-direction: column; gap: 1px;
  padding: 5px 10px;
  border: 1px solid var(--color-border-dim, #333);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.02);
  min-width: 120px;
}
.wb-req--low {
  background: rgba(214, 69, 69, 0.08);
  border-color: rgba(214, 69, 69, 0.4);
}
.wb-req-label {
  font-size: 0.68rem;
  color: var(--color-text-dim, #a89b85);
  text-transform: capitalize;
  letter-spacing: 0.03em;
}
.wb-req-value { font-size: 0.88rem; font-weight: 600; }
.wb-blockers {
  font-size: 0.8rem;
  padding: 6px 8px;
  background: rgba(214, 69, 69, 0.08);
  border-left: 2px solid #d64545;
}
.wb-craft-btn {
  margin-top: 6px;
  padding: 12px 20px;
  font-size: 1rem; font-weight: 600;
  font-family: var(--font-display, 'Cinzel', serif);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: linear-gradient(180deg, var(--color-gold, #c9a84c), var(--color-gold-dark, #9a7b2e));
  color: #0c0a10;
  border: 1px solid var(--color-gold-dark, #9a7b2e);
  border-radius: 3px;
  cursor: pointer;
  transition: all 120ms ease;
  box-shadow: 0 2px 8px rgba(201, 168, 76, 0.2);
}
.wb-craft-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, var(--color-gold-light, #e0c878), var(--color-gold, #c9a84c));
  box-shadow: 0 2px 12px rgba(201, 168, 76, 0.4);
}
.wb-craft-btn:active:not(:disabled) { transform: scale(0.98); }
.wb-craft-btn:disabled {
  background: #2a2a2a;
  color: #777;
  border-color: #3a3a3a;
  cursor: not-allowed;
  box-shadow: none;
}
.wb-result {
  margin-top: 6px;
  padding: 10px 12px;
  border-left: 3px solid var(--color-gold, #c9a84c);
  background: rgba(201, 168, 76, 0.06);
  display: flex; flex-direction: column; gap: 4px;
}
.wb-result--fail { border-left-color: #d64545; background: rgba(214, 69, 69, 0.06); }
.wb-result-head { display: flex; gap: 8px; align-items: center; }
.wb-result-badge {
  font-family: var(--font-display, serif);
  font-size: 0.78rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 2px;
}
.wb-result-badge--ok { color: #4caf50; border: 1px solid #4caf50; }
.wb-result-badge--fail { color: #d64545; border: 1px solid #d64545; }
.wb-quality-badge {
  font-family: var(--font-display, serif);
  font-size: 0.82rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.wb-result-message { font-size: 0.9rem; }
.wb-result-roll, .wb-result-slot { font-size: 0.75rem; }
.dim { color: var(--color-text-dim, #a89b85); }
.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
</style>
