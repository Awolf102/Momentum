/** A passage, with where it sits among its source's passages (-1: unknown). */
export interface Placed<T> {
  item: T
  position: number
}

/**
 * Two passages that follow each other, as one: the next passage can start
 * with the sentence the first one ends with, which is kept once.
 */
export function joinPassages(first: string, next: string): string {
  let shared = 0
  for (
    let end = next.indexOf(' ');
    end !== -1 && end <= first.length;
    end = next.indexOf(' ', end + 1)
  ) {
    const start = first.length - end
    if (
      (start === 0 || /\s/.test(first[start - 1])) &&
      first.endsWith(next.slice(0, end))
    )
      shared = end
  }
  return shared ? first + next.slice(shared) : `${first} ${next}`
}

/**
 * One passage per page (or note): passages from the same one are put in
 * reading order, neighbours joined and gaps marked "…". Pages keep the
 * order of their best passage.
 */
export function mergeByPage<
  T extends { key: string; page: number | null; text: string },
>(passages: readonly Placed<T>[]): T[] {
  const pages = new Map<string, Placed<T>[]>()
  for (const passage of passages) {
    const page = `${passage.item.key}\u0001${passage.item.page ?? ''}`
    pages.set(page, [...(pages.get(page) ?? []), passage])
  }
  return [...pages.values()].map((page) => {
    const [first, ...rest] = [...page].sort((a, b) => a.position - b.position)
    let text = first.item.text
    let previous = first.position
    for (const { item, position } of rest) {
      text =
        previous >= 0 && position === previous + 1
          ? joinPassages(text, item.text)
          : `${text} … ${item.text}`
      previous = position
    }
    return { ...first.item, text }
  })
}
