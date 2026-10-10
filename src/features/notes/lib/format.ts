import { daysBetween, toDateKey } from '@/lib/date'

const time = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})
const full = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** When a note was last changed: "3:04 pm", "Mon", "12 Oct", "12 Oct 2025". */
export function formatEdited(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const days = daysBetween(toDateKey(date), toDateKey(now))
  if (days <= 0) return time.format(date)
  if (days < 7) return weekday.format(date)
  if (date.getFullYear() === now.getFullYear()) return dayMonth.format(date)
  return full.format(date)
}

/** A link as a short title: "example.com/notes/gray-code". */
function linkTitle(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const path = pathname === '/' ? '' : pathname.replace(/\/$/, '')
    return `${hostname.replace(/^www\./, '')}${path}`.slice(0, 80)
  } catch {
    return ''
  }
}

/**
 * A note made from a captured thought: a short first line becomes the title,
 * the rest the body, and any link goes on its own line at the end.
 */
export function noteFromText(
  text: string,
  url: string | null = null,
): { title: string; body: string } {
  let source = text.trim()
  if (url && source.includes(url)) {
    source = source
      .replace(url, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[\s:\-–—|·]+$/, '')
      .trim()
  }
  const [first = '', ...rest] = source.split('\n')
  const line = first.trim()
  let title: string
  let body: string
  if (line.length <= 80) {
    title = line
    body = rest.join('\n').trim()
  } else {
    // Too long for a title: name it after its opening words, keep it all.
    const cut = line.slice(0, 60)
    const space = cut.lastIndexOf(' ')
    title = (space > 20 ? cut.slice(0, space) : cut).trim()
    body = source
  }
  if (url) {
    if (!title) title = linkTitle(url)
    body = body ? `${body}\n\n${url}` : url
  }
  return { title, body }
}
