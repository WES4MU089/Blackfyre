import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// ── Types (match backend workbench-handler.ts) ──────────────────────

export interface WorkbenchIngredient {
  itemKey: string
  itemName: string
  iconUrl: string | null
  needed: number
  have: number
  ok: boolean
}

export interface WorkbenchRecipeOutput {
  itemKey: string
  itemName: string
  iconUrl: string | null
  tier: number | null
  quantity: number
  rarity: string | null
  category: string | null
}

export interface WorkbenchRecipe {
  id: number
  recipeKey: string
  name: string
  description: string | null
  stationMinTier: number
  aptitudeKey: string | null
  aptitudeMin: number
  goldCost: number
  timeSeconds: number
  output: WorkbenchRecipeOutput
  ingredients: WorkbenchIngredient[]
  canCraft: boolean
  blockers: string[]
}

export interface WorkbenchOpenPayload {
  stationType: string
  stationLabel: string
  stationTier: number
  holdingId: number
  holdingName: string
  holdingGold: number
  character: {
    id: number
    name: string
    aptitudes: Record<string, number>
  }
  recipes: WorkbenchRecipe[]
}

export interface CraftResult {
  success: boolean
  message: string
  mode?: 'instant' | 'timed'
  completesAt?: string
  output?: {
    itemKey: string
    quantity: number
    quality: string | null
    tier: number | null
    slot: number | null
    roll: { successes: number; target: number; poolSize: number } | null
  }
  refreshedRecipes?: WorkbenchRecipe[]
  refreshedHoldingGold?: number
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const isOpen = ref(false)
  const stationType = ref('')
  const stationLabel = ref('')
  const stationTier = ref(0)
  const holdingId = ref<number | null>(null)
  const holdingName = ref('')
  const holdingGold = ref(0)
  const characterName = ref('')
  const aptitudes = ref<Record<string, number>>({})
  const recipes = ref<WorkbenchRecipe[]>([])
  const selectedRecipeKey = ref<string | null>(null)
  const craftingRecipeKey = ref<string | null>(null)
  const lastResult = ref<CraftResult | null>(null)
  const filterOnlyCraftable = ref(false)
  const search = ref('')

  const selectedRecipe = computed<WorkbenchRecipe | null>(() =>
    recipes.value.find(r => r.recipeKey === selectedRecipeKey.value) ?? null,
  )

  const visibleRecipes = computed(() => {
    let list = recipes.value
    if (filterOnlyCraftable.value) list = list.filter(r => r.canCraft)
    if (search.value.trim()) {
      const q = search.value.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q)
        || r.output.itemKey.toLowerCase().includes(q)
        || r.output.itemName.toLowerCase().includes(q),
      )
    }
    return list
  })

  function open(payload: WorkbenchOpenPayload): void {
    isOpen.value = true
    stationType.value = payload.stationType
    stationLabel.value = payload.stationLabel
    stationTier.value = payload.stationTier
    holdingId.value = payload.holdingId
    holdingName.value = payload.holdingName
    holdingGold.value = payload.holdingGold
    characterName.value = payload.character.name
    aptitudes.value = payload.character.aptitudes
    recipes.value = payload.recipes
    // Preserve selection if the recipe still exists; otherwise auto-select the first craftable
    if (!selectedRecipeKey.value || !payload.recipes.find(r => r.recipeKey === selectedRecipeKey.value)) {
      const firstCraftable = payload.recipes.find(r => r.canCraft)
      selectedRecipeKey.value = (firstCraftable ?? payload.recipes[0])?.recipeKey ?? null
    }
    craftingRecipeKey.value = null
    lastResult.value = null
  }

  function close(): void {
    isOpen.value = false
    recipes.value = []
    selectedRecipeKey.value = null
    craftingRecipeKey.value = null
    lastResult.value = null
    filterOnlyCraftable.value = false
    search.value = ''
  }

  function select(recipeKey: string): void {
    selectedRecipeKey.value = recipeKey
    lastResult.value = null
  }

  function setCrafting(recipeKey: string | null): void {
    craftingRecipeKey.value = recipeKey
  }

  function applyCraftResult(result: CraftResult): void {
    lastResult.value = result
    craftingRecipeKey.value = null
    if (result.refreshedRecipes) {
      recipes.value = result.refreshedRecipes
    }
    if (result.refreshedHoldingGold != null) {
      holdingGold.value = result.refreshedHoldingGold
    }
  }

  return {
    isOpen,
    stationType,
    stationLabel,
    stationTier,
    holdingId,
    holdingName,
    holdingGold,
    characterName,
    aptitudes,
    recipes,
    selectedRecipeKey,
    craftingRecipeKey,
    lastResult,
    filterOnlyCraftable,
    search,
    selectedRecipe,
    visibleRecipes,
    open,
    close,
    select,
    setCrafting,
    applyCraftResult,
  }
})
