<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: string
  stacks: number
  roundsRemaining: number
}>()

const label = computed(() => {
  const labels: Record<string, string> = {
    bleeding: 'Bleeding',
    stunned: 'Stunned',
    sundered: 'Sundered',
    piercing: 'Piercing',
    engaged: 'Engaged',
    protecting: 'Protecting',
    pressured: 'Pressured',
    grappled: 'Grappled',
    grappling: 'Grappling',
    bracing: 'Bracing',
    rallied: 'Rallied',
    rally_cooldown: 'Rally Cooldown',
    wounded: 'Wounded',
  }
  return labels[props.type] ?? props.type
})

const symbol = computed(() => {
  const symbols: Record<string, string> = {
    bleeding: '\u2620',   // skull
    stunned: '\u2738',    // star
    sundered: '\u2694',   // crossed swords
    piercing: '\u27B3',   // arrow
    engaged: '\u2694',    // crossed swords
    protecting: '\u26E8', // shield
    pressured: '\u26A0',  // warning
    grappled: '\u2696',   // chains/scales
    grappling: '\u270B',  // hand
    bracing: '\u26E8',    // shield
    rallied: '\u2691',    // flag
    rally_cooldown: '\u23F3', // hourglass
    wounded: '\u2764',    // heart
  }
  return symbols[props.type] ?? '\u2022'
})

const tooltip = computed(() => {
  const descriptions: Record<string, string> = {
    bleeding: `5 damage per round (${props.stacks} stack${props.stacks > 1 ? 's' : ''})`,
    stunned: 'Skip next turn',
    sundered: `-${props.stacks * 5} mitigation (${props.stacks} stack${props.stacks > 1 ? 's' : ''})`,
    piercing: '+10 penetration',
    engaged: 'In melee combat',
    protecting: 'Guarding an ally',
    pressured: `-${props.stacks} dice to all pools (${props.stacks + 1} attackers)`,
    grappled: '-3 defense dice (1 round)',
    grappling: 'Holding an enemy',
    bracing: '+1 defense die per attacker this round',
    rallied: `+${props.stacks} attack dice from rally`,
    rally_cooldown: 'Cannot rally yet',
    wounded: '-2 dice to all combat pools (24h or until healed)',
  }
  let text = `${label.value}: ${descriptions[props.type] ?? 'Unknown effect'}`
  if (props.roundsRemaining > 0) {
    text += ` — ${props.roundsRemaining} round${props.roundsRemaining > 1 ? 's' : ''} left`
  }
  return text
})

const effectClass = computed(() => `effect-${props.type}`)
</script>

<template>
  <span class="status-effect-icon" :class="effectClass" :title="tooltip">
    <span class="effect-symbol">{{ symbol }}</span>
    <span v-if="stacks > 1" class="effect-stacks">{{ stacks }}</span>
  </span>
</template>

<style scoped>
.status-effect-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-dim);
  background: rgba(0, 0, 0, 0.4);
  font-size: 11px;
  cursor: default;
}

.effect-symbol {
  line-height: 1;
}

.effect-stacks {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-crimson);
  color: var(--color-text-bright);
  font-size: 8px;
  font-weight: bold;
  border-radius: var(--radius-full);
  line-height: 1;
  padding: 0 2px;
}

/* Effect-specific colors */
.effect-bleeding { border-color: rgba(196, 43, 43, 0.5); color: #c42b2b; }
.effect-stunned { border-color: rgba(212, 169, 50, 0.5); color: #d4a932; }
.effect-sundered { border-color: rgba(90, 94, 107, 0.5); color: var(--color-iron-light); }
.effect-piercing { border-color: rgba(58, 123, 213, 0.5); color: #3a7bd5; }
.effect-engaged { border-color: rgba(201, 168, 76, 0.3); color: var(--color-gold-dim); }
.effect-protecting { border-color: rgba(58, 123, 213, 0.5); color: #3a7bd5; }
.effect-pressured { border-color: rgba(212, 143, 50, 0.5); color: #d48f32; }
.effect-grappled { border-color: rgba(155, 50, 212, 0.5); color: #9b32d4; }
.effect-grappling { border-color: rgba(155, 50, 212, 0.5); color: #9b32d4; }
.effect-bracing { border-color: rgba(45, 138, 78, 0.5); color: #2d8a4e; }
.effect-rallied { border-color: rgba(0, 172, 193, 0.5); color: #00acc1; }
.effect-rally_cooldown { border-color: rgba(120, 120, 120, 0.5); color: #787878; }
.effect-wounded { border-color: rgba(196, 43, 43, 0.5); color: #c42b2b; }
</style>
