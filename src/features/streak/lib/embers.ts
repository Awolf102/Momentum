export interface Ember {
  x: number
  y: number
  size: number
  duration: number
  delay: number
  color: string
}

const COLORS = ['#fde68a', '#fdba74', '#fb923c', '#f97316', '#fda4af']

/** Random sparks for one celebration — created in the click handler, not during render. */
export function createEmbers(count = 26): Ember[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.5
    const distance = 70 + Math.random() * 90
    return {
      x: Math.cos(angle) * distance,
      // Embers drift upward, like heat rising.
      y: Math.sin(angle) * distance * 0.8 - 40 - Math.random() * 30,
      size: 4 + Math.random() * 5,
      duration: 0.9 + Math.random() * 0.7,
      delay: Math.random() * 0.08,
      color: COLORS[index % COLORS.length],
    }
  })
}
