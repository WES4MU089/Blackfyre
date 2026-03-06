/** Returns an HSL color string that smoothly transitions from green (100%) to red (0%). */
export function hpBarColor(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct))
  const hue = Math.round((clamped / 100) * 120) // 0 = red, 120 = green
  return `hsl(${hue}, 65%, 38%)`
}
