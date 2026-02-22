<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { CombatantView } from '@/stores/combat'

const props = defineProps<{
  combatant: CombatantView
  myRating: number
  x: number
  y: number
}>()

const el = ref<HTMLElement | null>(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

// --- In-character name maps ---

const WEAPON_NAMES: Record<string, string> = {
  dagger: 'dagger',
  bastardSword: 'bastard sword',
  greatsword: 'greatsword',
  battleAxe1H: 'battle axe',
  battleAxe2H: 'greataxe',
  warhammer1H: 'warhammer',
  warhammer2H: 'great warhammer',
  mace1H: 'mace',
  spear: 'spear',
  polearm: 'polearm',
  bow: 'bow',
}

const MATERIAL_NAMES: Record<string, string> = {
  rusty: 'rusted',
  iron: 'iron',
  steel: 'steel',
  castle_forged: 'castle-forged',
  valyrian_steel: 'Valyrian steel',
}

const ARMOR_CLASS_NAMES: Record<string, string> = {
  light: 'light leather',
  medium: 'mail',
  heavy: 'heavy plate',
}

const SHIELD_CLASS_NAMES: Record<string, string> = {
  light: 'buckler',
  medium: 'heater shield',
  heavy: 'tower shield',
}

// --- Equipment description ---

const weaponLine = computed(() => {
  const c = props.combatant
  const mat = MATERIAL_NAMES[c.weaponMaterial] ?? c.weaponMaterial
  const name = WEAPON_NAMES[c.weaponType] ?? c.weaponType
  const grip = c.isTwoHanded ? ' in both hands' : ''
  return `Wields a ${mat} ${name}${grip}.`
})

const armorLine = computed(() => {
  const c = props.combatant
  if (c.armorClass === 'none' || c.armorTier === 0) return 'Wears no armor.'
  const mat = MATERIAL_NAMES[c.weaponMaterial] ?? c.weaponMaterial
  const armorName = ARMOR_CLASS_NAMES[c.armorClass] ?? c.armorClass
  // Use armor material if available; weapon material as fallback for tier naming
  const tierMat = MATERIAL_NAMES[c.weaponMaterial] ?? c.weaponMaterial
  return `Clad in ${tierMat} ${armorName}.`
})

const shieldLine = computed(() => {
  const c = props.combatant
  if (!c.hasShield || c.shieldClass === 'none') return null
  const name = SHIELD_CLASS_NAMES[c.shieldClass] ?? c.shieldClass
  return `Carries a ${name}.`
})

// --- Formidability assessment ---

const formidability = computed(() => {
  const myR = props.myRating
  const theirR = props.combatant.combatRating
  if (myR <= 0) return { text: 'You cannot gauge their strength.', cssClass: 'assess-neutral' }

  const ratio = theirR / myR
  if (ratio <= 0.6) return { text: 'You sense no particular danger here.', cssClass: 'assess-weak' }
  if (ratio <= 0.8) return { text: 'They carry themselves with some confidence.', cssClass: 'assess-slight' }
  if (ratio <= 1.2) return { text: 'Something about them gives you pause.', cssClass: 'assess-neutral' }
  if (ratio <= 1.5) return { text: 'They move like someone who has seen battle before.', cssClass: 'assess-strong' }
  return { text: 'Every instinct tells you to be wary of this one.', cssClass: 'assess-danger' }
})

// --- Positioning (mirrors ItemTooltip) ---

function positionTooltip(): void {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 12

  let x = props.x + margin
  let y = props.y + margin

  if (x + rect.width > vw) x = props.x - rect.width - margin
  if (y + rect.height > vh) y = props.y - rect.height - margin

  x = Math.max(4, Math.min(x, vw - rect.width - 4))
  y = Math.max(4, Math.min(y, vh - rect.height - 4))

  adjustedX.value = x
  adjustedY.value = y
}

watch(() => [props.x, props.y], () => {
  positionTooltip()
})

onMounted(() => {
  requestAnimationFrame(positionTooltip)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="el"
      class="combatant-tooltip"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
    >
      <!-- Name -->
      <div class="ct-name">{{ combatant.characterName }}</div>

      <!-- Equipment description -->
      <div class="ct-divider" />
      <div class="ct-equipment">
        <div class="ct-line">{{ weaponLine }}</div>
        <div class="ct-line">{{ armorLine }}</div>
        <div v-if="shieldLine" class="ct-line">{{ shieldLine }}</div>
      </div>

      <!-- Secondary weapons (future) -->
      <div class="ct-secondary">No secondary weapon visible.</div>

      <!-- Formidability -->
      <div class="ct-divider" />
      <div class="ct-assess" :class="formidability.cssClass">
        {{ formidability.text }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.combatant-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  max-width: 280px;
  padding: 8px 10px;
  background: rgba(18, 14, 10, 0.96);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
  pointer-events: none;
  font-family: var(--font-body);
}

.ct-name {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-gold);
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}

.ct-divider {
  height: 1px;
  background: var(--color-border-dim);
  margin: 5px 0;
}

.ct-equipment {
  margin-bottom: 2px;
}

.ct-line {
  font-size: 11px;
  color: var(--color-text);
  line-height: 1.5;
}

.ct-secondary {
  font-size: 10px;
  color: var(--color-text-dim);
  font-style: italic;
  margin-top: 3px;
}

.ct-assess {
  font-size: 11px;
  font-style: italic;
  line-height: 1.4;
}

.ct-assess.assess-weak {
  color: #4a9e4a;
}

.ct-assess.assess-slight {
  color: #8ab86c;
}

.ct-assess.assess-neutral {
  color: var(--color-gold);
}

.ct-assess.assess-strong {
  color: #d48f32;
}

.ct-assess.assess-danger {
  color: var(--color-crimson-light);
}
</style>
