<script setup lang="ts">
import { computed } from 'vue'

// Three-segment durability display.
//   Green = durability (usable integrity)
//   Red   = softDamage  (repairable damage from combat)
//   Black = hardDamage  (permanent cap loss from repair wear)
// Invariant: durability + softDamage + hardDamage = 100.
const props = withDefaults(defineProps<{
  durability: number
  softDamage?: number
  hardDamage?: number
}>(), {
  softDamage: 0,
  hardDamage: 0,
})

const clamp = (n: number): number => Math.max(0, Math.min(100, n))

const green = computed(() => clamp(props.durability))
const red = computed(() => clamp(props.softDamage))
const black = computed(() => clamp(props.hardDamage))

// Only show the bar when the item has taken any damage at all.
const isVisible = computed(() => green.value < 100 || red.value > 0 || black.value > 0)
</script>

<template>
  <div v-if="isVisible" class="dur-bar" :aria-label="`Durability ${Math.round(green)}%`">
    <div class="dur-bar__seg dur-bar__seg--green" :style="{ width: green + '%' }" />
    <div class="dur-bar__seg dur-bar__seg--red" :style="{ width: red + '%' }" />
    <div class="dur-bar__seg dur-bar__seg--black" :style="{ width: black + '%' }" />
  </div>
</template>

<style scoped>
.dur-bar {
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 3px;
  height: 4px;
  display: flex;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.85);
  border-radius: 2px;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  z-index: 2;
}

.dur-bar__seg {
  height: 100%;
  transition: width 0.2s ease;
}

.dur-bar__seg--green {
  background: linear-gradient(to bottom, #5fd35f, #2f8a2f);
}

.dur-bar__seg--red {
  background: linear-gradient(to bottom, #d94848, #8a1f1f);
}

.dur-bar__seg--black {
  background: linear-gradient(to bottom, #2a2a2a, #0a0a0a);
}
</style>
