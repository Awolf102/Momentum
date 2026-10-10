/** Where an item sits across the day's width: its column of so many. */
export interface Placed<T> {
  item: T
  column: number
  columns: number
}

/**
 * Puts overlapping items side by side, as calendars do: each group of items
 * that overlap shares the width, and an item takes the first column that's
 * free when it starts. Items shorter than `minLength` are treated as that
 * long, since that's how much room they take on screen.
 */
export function layoutDay<T extends { start: number; end: number }>(
  items: readonly T[],
  minLength = 15,
): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const placed: Placed<T>[] = []
  let group: Placed<T>[] = []
  let columnEnds: number[] = []
  let groupEnd = -Infinity
  const close = () => {
    for (const each of group) each.columns = columnEnds.length
    group = []
    columnEnds = []
  }
  for (const item of sorted) {
    const end = Math.max(item.end, item.start + minLength)
    if (item.start >= groupEnd) {
      close()
      groupEnd = -Infinity
    }
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= item.start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(end)
    } else columnEnds[column] = end
    const entry = { item, column, columns: 1 }
    group.push(entry)
    placed.push(entry)
    groupEnd = Math.max(groupEnd, end)
  }
  close()
  return placed
}
