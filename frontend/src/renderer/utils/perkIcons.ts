import berserkersFuryIcon from '@res/images/icons/Perks/berserkersFury.png'
import brutalStrikesIcon from '@res/images/icons/Perks/brutalStrikes.png'
import danceOfTheSpearIcon from '@res/images/icons/Perks/danceOfTheSpear.png'
import executionerIcon from '@res/images/icons/Perks/executioner.png'
import fieldMedicIcon from '@res/images/icons/Perks/fieldMedic.png'
import flankerIcon from '@res/images/icons/Perks/flanker.png'
import ironcladIcon from '@res/images/icons/Perks/ironclad.png'
import lastStandIcon from '@res/images/icons/Perks/lastStand.png'
import riposteMasterIcon from '@res/images/icons/Perks/riposteMaster.png'
import secondWindIcon from '@res/images/icons/Perks/secondWind.png'
import shieldWallIcon from '@res/images/icons/Perks/shieldWall.png'
import stalwartIcon from '@res/images/icons/Perks/stalwart.png'
import swordmasterIcon from '@res/images/icons/Perks/swordmaster.png'
import vanguardIcon from '@res/images/icons/Perks/vanguard.png'
import warCryIcon from '@res/images/icons/Perks/warCry.png'

const PERK_ICONS: Record<string, string> = {
  berserkersFury: berserkersFuryIcon,
  brutalStrikes: brutalStrikesIcon,
  danceOfTheSpear: danceOfTheSpearIcon,
  executioner: executionerIcon,
  fieldMedic: fieldMedicIcon,
  flanker: flankerIcon,
  ironclad: ironcladIcon,
  lastStand: lastStandIcon,
  riposteMaster: riposteMasterIcon,
  secondWind: secondWindIcon,
  shieldWall: shieldWallIcon,
  stalwart: stalwartIcon,
  swordmaster: swordmasterIcon,
  vanguard: vanguardIcon,
  warCry: warCryIcon,
}

export function getPerkIcon(key: string): string | null {
  return PERK_ICONS[key] ?? null
}

export const PERK_SLOT_LEVELS: Record<number, number> = { 1: 1, 2: 5, 3: 10, 4: 15, 5: 20 }
export const MAX_PERKS_PER_CATEGORY = 3
