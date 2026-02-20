/**
 * Item quality colors based on tier.
 * Tier 1: Grey (common/rusty)
 * Tier 2: Green (iron)
 * Tier 3: Blue (steel)
 * Tier 4: Purple (castle-forged)
 * Tier 5: Amber (valyrian)
 */

const TIER_COLORS: Record<number, string> = {
  1: '#9d9d9d',
  2: '#4a9e4a',
  3: '#3a7bd5',
  4: '#9b32d4',
  5: '#ffc22f',
}

const TIER_GLOW: Record<number, string> = {
  1: 'rgba(157, 157, 157, 0.4)',
  2: 'rgba(74, 158, 74, 0.4)',
  3: 'rgba(58, 123, 213, 0.4)',
  4: 'rgba(155, 50, 212, 0.4)',
  5: 'rgba(255, 194, 47, 0.6)',
}

const DEFAULT_COLOR = '#9d9d9d'
const DEFAULT_GLOW = 'rgba(157, 157, 157, 0.4)'

export function getTierColor(tier: number): string {
  return TIER_COLORS[tier] ?? DEFAULT_COLOR
}

export function getTierGlow(tier: number): string {
  return TIER_GLOW[tier] ?? DEFAULT_GLOW
}

export function getTierClass(tier: number): string {
  switch (tier) {
    case 1: return 'tier-1'
    case 2: return 'tier-2'
    case 3: return 'tier-3'
    case 4: return 'tier-4'
    case 5: return 'tier-5'
    default: return 'tier-1'
  }
}
