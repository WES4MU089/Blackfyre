// Static icon imports — Vite requires these at build time
import placeholder from '@res/images/icons/Inventory/Placeholder.png'

// 1H Swords (rarity 1–5: common, uncommon, rare, epic, legendary)
import sword1 from '@res/images/icons/Inventory/Weapons/1HSwords/sword-1.png'
import sword2 from '@res/images/icons/Inventory/Weapons/1HSwords/sword-2.png'
import sword3 from '@res/images/icons/Inventory/Weapons/1HSwords/sword-3.png'
import sword4 from '@res/images/icons/Inventory/Weapons/1HSwords/sword-4.png'
import sword5 from '@res/images/icons/Inventory/Weapons/1HSwords/sword-5.png'

// 2H Swords
import twoHSword1 from '@res/images/icons/Inventory/Weapons/2HSwords/2hSword-1.png'
import twoHSword2 from '@res/images/icons/Inventory/Weapons/2HSwords/2hSword-2.png'
import twoHSword3 from '@res/images/icons/Inventory/Weapons/2HSwords/2hSword-3.png'
import twoHSword4 from '@res/images/icons/Inventory/Weapons/2HSwords/2hSword-4.png'
import twoHSword5 from '@res/images/icons/Inventory/Weapons/2HSwords/2hSword-5.png'

// Daggers
import dagger1 from '@res/images/icons/Inventory/Weapons/Daggers/dagger-1.png'
import dagger2 from '@res/images/icons/Inventory/Weapons/Daggers/dagger-2.png'
import dagger3 from '@res/images/icons/Inventory/Weapons/Daggers/dagger-3.png'
import dagger4 from '@res/images/icons/Inventory/Weapons/Daggers/dagger-4.png'
import dagger5 from '@res/images/icons/Inventory/Weapons/Daggers/dagger-5.png'

// Map item_key → icon asset
const itemIconMap: Record<string, string> = {
  // 1H Swords
  iron_sword: sword1,
  steel_sword: sword2,

  // 2H Swords
  war_scythe: twoHSword1,
  steel_greatsword: twoHSword2,

  // Daggers
  iron_dagger: dagger1,
  valyrian_dagger: dagger5,
}

// Rarity-indexed icon sets for future items
const iconSets = {
  sword: [sword1, sword2, sword3, sword4, sword5],
  greatsword: [twoHSword1, twoHSword2, twoHSword3, twoHSword4, twoHSword5],
  dagger: [dagger1, dagger2, dagger3, dagger4, dagger5],
} as const

const rarityIndex: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

/**
 * Get the icon for an item by its item_key.
 * Falls back to placeholder if no specific icon exists.
 */
export function getItemIcon(itemKey: string): string {
  return itemIconMap[itemKey] ?? placeholder
}

/**
 * Get a weapon icon by weapon category and rarity.
 * Useful for dynamically generated or future items.
 */
export function getWeaponIcon(
  weaponType: 'sword' | 'greatsword' | 'dagger',
  rarity: string,
): string {
  const idx = rarityIndex[rarity] ?? 0
  return iconSets[weaponType][idx]
}

export { placeholder }
