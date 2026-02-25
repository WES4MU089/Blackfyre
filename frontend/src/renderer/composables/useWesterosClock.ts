import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Westeros 24-Hour Clock System
 *
 * 6 canon hours (from ASOIAF): Bat, Eel, Ghosts, Owl, Wolf, Nightingale
 * 7 hours named after the Seven: Maiden, Smith, Warrior, Father, Mother, Crone, Stranger
 * 11 hours named after Westeros creatures/sigils
 */

const WESTEROS_HOURS: readonly string[] = [
  // Midnight block (deep night)
  'Hour of Ghosts',           //  0 — CANON (midnight, spirits walk)
  'Hour of the Owl',          //  1 — CANON (deep night)
  'Hour of the Stranger',     //  2 — The Stranger (death, the unknown)
  'Hour of the Wolf',         //  3 — CANON (darkest before dawn)
  'Hour of the Raven',        //  4 — Ravens herald messages at first light
  'Hour of the Nightingale',  //  5 — CANON (pre-dawn song)

  // Morning block (dawn to noon)
  'Hour of the Maiden',       //  6 — The Maiden (innocence, dawn of new day)
  'Hour of the Lark',         //  7 — Larks sing at morning
  'Hour of the Smith',        //  8 — The Smith (forges lit, labor begins)
  'Hour of the Falcon',       //  9 — Falcons hunt the morning sky
  'Hour of the Warrior',      // 10 — The Warrior (peak strength)
  'Hour of the Eagle',        // 11 — Eagles soar at height of morning

  // Afternoon block (noon to dusk)
  'Hour of the Father',       // 12 — The Father (judgment, high noon)
  'Hour of the Dragon',       // 13 — Dragons rule when the sun burns hottest
  'Hour of the Lion',         // 14 — The lion basks in afternoon sun
  'Hour of the Mother',       // 15 — The Mother (warmth, mercy)
  'Hour of the Stag',         // 16 — The stag grazes in golden light
  'Hour of the Crone',        // 17 — The Crone (wisdom, the day grows old)

  // Evening block (dusk to midnight)
  'Hour of the Boar',         // 18 — Evenfall, boars root at dusk
  'Hour of the Fox',          // 19 — Foxes emerge in twilight
  'Hour of the Hound',        // 20 — The hound keeps the night watch
  'Hour of the Spider',       // 21 — Darkness weaves its web
  'Hour of the Bat',          // 22 — CANON (first named hour of night)
  'Hour of the Eel',          // 23 — CANON (late night)
] as const

/**
 * Westeros 12-Moon Calendar
 *
 * GRRM confirmed 12 moon turns per year. Canon uses numbered moons
 * (e.g. "the fifth moon of the year 130 AC"). We follow that format.
 */
const WESTEROS_MOONS: readonly string[] = [
  'the First Moon',
  'the Second Moon',
  'the Third Moon',
  'the Fourth Moon',
  'the Fifth Moon',
  'the Sixth Moon',
  'the Seventh Moon',
  'the Eighth Moon',
  'the Ninth Moon',
  'the Tenth Moon',
  'the Eleventh Moon',
  'the Twelfth Moon',
] as const

/**
 * Year mapping: 2026 real-world = 120 AC (After the Conquest)
 * Offset: realYear - 1906 = AC year
 */
const AC_OFFSET = 1906

interface WesterosTime {
  hourName: string
  moonName: string
  /** Formatted SLT time string, e.g. "3:42 PM" */
  sltTime: string
  /** Formatted date string, e.g. "the 10th day of the Second Moon, 127 AC" */
  dateLine: string
  /** 0-23 hour in SLT */
  hour: number
  /** 0-11 month index */
  month: number
  /** Day of the month */
  day: number
  /** Game year in AC */
  yearAC: number
}

/**
 * Returns the current time in SLT (Second Life Time = US Pacific)
 * formatted as a Westeros clock with named hours and moons.
 * Updates every 30 seconds.
 */
export function useWesterosClock() {
  const time = ref<WesterosTime>(getWesterosTime())
  let interval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    interval = setInterval(() => {
      time.value = getWesterosTime()
    }, 30_000)
  })

  onUnmounted(() => {
    if (interval) clearInterval(interval)
  })

  return { time }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function getWesterosTime(): WesterosTime {
  // SLT = US Pacific Time
  const now = new Date()
  const slt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))

  const hour = slt.getHours()
  const minute = slt.getMinutes()
  const month = slt.getMonth()
  const day = slt.getDate()
  const year = slt.getFullYear()
  const yearAC = year - AC_OFFSET

  // Format 12-hour SLT string
  const h12 = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  const mm = minute.toString().padStart(2, '0')

  return {
    hourName: WESTEROS_HOURS[hour],
    moonName: WESTEROS_MOONS[month],
    sltTime: `${h12}:${mm} ${ampm}`,
    dateLine: `the ${ordinal(day)} day of ${WESTEROS_MOONS[month]}, ${yearAC} AC`,
    hour,
    month,
    day,
    yearAC,
  }
}

export { WESTEROS_HOURS, WESTEROS_MOONS }
