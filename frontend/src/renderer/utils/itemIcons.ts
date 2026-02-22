// Static icon imports — Vite requires these at build time
import placeholder from '@res/images/icons/Inventory/Placeholder.png'

// 1H Swords (tier 1–4)
import sword1 from '@res/images/icons/Inventory/Weapons/64x64/1hsword_tier1.png'
import sword2 from '@res/images/icons/Inventory/Weapons/64x64/1hsword_tier2.png'
import sword3 from '@res/images/icons/Inventory/Weapons/64x64/1hsword_tier3.png'
import sword4 from '@res/images/icons/Inventory/Weapons/64x64/1hsword_tier4.png'

// 2H Swords
import twoHSword1 from '@res/images/icons/Inventory/Weapons/64x64/2hsword_tier1.png'
import twoHSword2 from '@res/images/icons/Inventory/Weapons/64x64/2hsword_tier2.png'
import twoHSword3 from '@res/images/icons/Inventory/Weapons/64x64/2hsword_tier3.png'
import twoHSword4 from '@res/images/icons/Inventory/Weapons/64x64/2hsword_tier4.png'

// Daggers
import dagger1 from '@res/images/icons/Inventory/Weapons/64x64/dagger_tier1.png'
import dagger2 from '@res/images/icons/Inventory/Weapons/64x64/dagger_tier2.png'
import dagger3 from '@res/images/icons/Inventory/Weapons/64x64/dagger_tier3.png'
import dagger4 from '@res/images/icons/Inventory/Weapons/64x64/dagger_tier4.png'

// 1H Hammers
import hammer1 from '@res/images/icons/Inventory/Weapons/64x64/1hHammer_tier1.png'
import hammer2 from '@res/images/icons/Inventory/Weapons/64x64/1hHammer_tier2.png'
import hammer3 from '@res/images/icons/Inventory/Weapons/64x64/1hHammer_tier3.png'
import hammer4 from '@res/images/icons/Inventory/Weapons/64x64/1hHammer_tier4.png'

// 2H Hammers
import twoHHammer1 from '@res/images/icons/Inventory/Weapons/64x64/2hHammer_tier1.png'
import twoHHammer2 from '@res/images/icons/Inventory/Weapons/64x64/2hHammer_tier2.png'
import twoHHammer3 from '@res/images/icons/Inventory/Weapons/64x64/2hHammer_tier3.png'
import twoHHammer4 from '@res/images/icons/Inventory/Weapons/64x64/2hHammer_tier4.png'

// Maces
import mace1 from '@res/images/icons/Inventory/Weapons/64x64/mace_tier1.png'
import mace2 from '@res/images/icons/Inventory/Weapons/64x64/mace_tier2.png'
import mace3 from '@res/images/icons/Inventory/Weapons/64x64/mace_tier3.png'
import mace4 from '@res/images/icons/Inventory/Weapons/64x64/mace_tier4.png'

// Spears
import spear1 from '@res/images/icons/Inventory/Weapons/64x64/Spear_tier1.png'
import spear2 from '@res/images/icons/Inventory/Weapons/64x64/Spear_tier2.png'
import spear3 from '@res/images/icons/Inventory/Weapons/64x64/Spear_tier3.png'
import spear4 from '@res/images/icons/Inventory/Weapons/64x64/Spear_tier4.png'

// Shields
import shield1 from '@res/images/icons/Inventory/Weapons/64x64/Shield_tier1.png'
import shield2 from '@res/images/icons/Inventory/Weapons/64x64/Shield_tier2.png'
import shield3 from '@res/images/icons/Inventory/Weapons/64x64/Shield_tier3.png'
import shield4 from '@res/images/icons/Inventory/Weapons/64x64/Shield_tier4.png'

// Legendary / Named weapons (tier 5)
import blackfyre from '@res/images/icons/Inventory/Weapons/64x64/Blackfyre_tier5.png'
import darkSister from '@res/images/icons/Inventory/Weapons/64x64/DarkSister_tier5.png'
import dawn from '@res/images/icons/Inventory/Weapons/64x64/Dawn_tier5.png'
import ice from '@res/images/icons/Inventory/Weapons/64x64/Ice_tier5.png'

// Explicit item_key → icon overrides (named/unique items)
const itemIconMap: Record<string, string> = {
  blackfyre: blackfyre,
  dark_sister: darkSister,
  dawn: dawn,
  ice: ice,
}

// weaponType (from model_data) → tier-indexed icon arrays [tier1, tier2, tier3, tier4]
const weaponTypeIcons: Record<string, readonly string[]> = {
  dagger: [dagger1, dagger2, dagger3, dagger4],
  bastardSword: [sword1, sword2, sword3, sword4],
  greatsword: [twoHSword1, twoHSword2, twoHSword3, twoHSword4],
  mace1H: [mace1, mace2, mace3, mace4],
  warhammer1H: [hammer1, hammer2, hammer3, hammer4],
  warhammer2H: [twoHHammer1, twoHHammer2, twoHHammer3, twoHHammer4],
  spear: [spear1, spear2, spear3, spear4],
  polearm: [spear1, spear2, spear3, spear4],
  battleAxe1H: [hammer1, hammer2, hammer3, hammer4],
  battleAxe2H: [twoHHammer1, twoHHammer2, twoHHammer3, twoHHammer4],
}

// Shield icons indexed by tier [tier1, tier2, tier3, tier4]
const shieldIcons: readonly string[] = [shield1, shield2, shield3, shield4]

interface ItemIconContext {
  weaponType?: string
  tier?: number
  category?: string
}

/**
 * Get the icon for an item. Checks in order:
 * 1. Explicit item_key override (named legendaries)
 * 2. weaponType + tier lookup (weapons)
 * 3. Shield tier lookup (shields)
 * 4. Placeholder fallback
 */
export function getItemIcon(itemKey: string, ctx?: ItemIconContext): string {
  // Named item override
  const override = itemIconMap[itemKey]
  if (override) return override

  if (ctx) {
    // Weapon lookup by weaponType + tier
    if (ctx.weaponType && ctx.tier) {
      const icons = weaponTypeIcons[ctx.weaponType]
      if (icons) {
        const idx = Math.max(0, Math.min(ctx.tier - 1, icons.length - 1))
        return icons[idx]
      }
    }

    // Shield lookup by tier
    if (ctx.category === 'shield' && ctx.tier) {
      const idx = Math.max(0, Math.min(ctx.tier - 1, shieldIcons.length - 1))
      return shieldIcons[idx]
    }
  }

  return placeholder
}

/**
 * Get a weapon icon directly by weaponType and tier (1-based).
 */
export function getWeaponIcon(
  weaponType: string,
  tier: number,
): string {
  const icons = weaponTypeIcons[weaponType]
  if (!icons) return placeholder
  const idx = Math.max(0, Math.min(tier - 1, icons.length - 1))
  return icons[idx]
}

export { placeholder }
