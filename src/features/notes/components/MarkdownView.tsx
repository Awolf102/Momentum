import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { editTask, tasks, type Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { checkboxPositions } from '../lib/checkboxes'
import { normalizeTitle } from '../lib/links'
import { loadRenderer, needs, readyRenderer } from '../markdown/load'
import type { RenderContext } from '../markdown/render'
import { createNote, findByTitle, notes } from '../notes'
import type { Note } from '../types'
import '../markdown/prose.css'

/** Which note or task each [[link]] points to. */
function linkContext(
  allNotes: readonly Note[],
  allTasks: readonly Task[],
): RenderContext {
  const byTitle = <T extends { id: string; title: string }>(
    items: readonly T[],
  ) => {
    // Later items win, so callers list the preferred ones last.
    const ids = new Map<string, string>()
    for (const item of items) {
      const key = normalizeTitle(item.title)
      if (key) ids.set(key, item.id)
    }
    return ids
  }
  const latestLast = <T extends { updatedAt: string }>(items: readonly T[]) =>
    [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))
  const noteIds = byTitle(latestLast(allNotes))
  // An open task before a finished one with the same title.
  const taskIds = byTitle(
    latestLast(allTasks).sort(
      (a, b) => Number(a.status !== 'done') - Number(b.status !== 'done'),
    ),
  )
  return {
    noteFor: (title) => noteIds.get(normalizeTitle(title)) ?? null,
    taskFor: (title) => taskIds.get(normalizeTitle(title)) ?? null,
  }
}

async function openNoteTitled(title: string) {
  const note = findByTitle(title) ?? (await createNote({ title }))
  navigate(paths.note(note.id))
}

interface MarkdownViewProps {
  markdown: string
  /** Ticks the nth checkbox. Without it, checkboxes can't be changed. */
  onToggleCheckbox?: (index: number) => void
  className?: string
}

/**
 * A note as it reads: markdown with maths, highlighted code and working
 * links. Maths and code support load only for notes that use them.
 */
export function MarkdownView({
  markdown,
  onToggleCheckbox,
  className,
}: MarkdownViewProps) {
  const allNotes = useStore(notes)
  const allTasks = useStore(tasks)
  const context = useMemo(
    () => linkContext(allNotes, allTasks),
    [allNotes, allTasks],
  )
  const { math, code } = useMemo(() => needs(markdown), [markdown])
  // Once the renderer has loaded, notes render straight away; until then
  // (the first note shown), it loads and the note appears when it has.
  const renderer = readyRenderer({ math, code })
  const ready = useMemo(
    () => (renderer ? renderer(markdown, context) : null),
    [renderer, markdown, context],
  )
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (renderer) return
    let current = true
    const render = async (need: { math: boolean; code: boolean }) => {
      const loading = await loadRenderer(need)
      if (current) setLoaded(loading(markdown, context))
    }
    // Offline before maths or code support was saved: show the note
    // without it rather than not at all.
    render({ math, code })
      .catch(() => render({ math: false, code: false }))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [renderer, markdown, context, math, code])
  const html = ready ?? loaded

  // Checkboxes can be ticked only when each one on screen matches one in
  // the text; otherwise a tick could land on the wrong line.
  const ref = useRef<HTMLDivElement>(null)
  const boxes = useMemo(() => checkboxPositions(markdown).length, [markdown])
  const canToggle = Boolean(onToggleCheckbox)
  useLayoutEffect(() => {
    const inputs =
      ref.current?.querySelectorAll<HTMLInputElement>('input[data-box]') ?? []
    const enabled = canToggle && inputs.length === boxes
    for (const input of inputs) input.disabled = !enabled
  }, [html, boxes, canToggle])

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element
    const box = target.closest<HTMLInputElement>('input[data-box]')
    if (box) {
      if (!box.disabled) onToggleCheckbox?.(Number(box.dataset.box))
      return
    }
    const link = target.closest<HTMLAnchorElement>('a')
    if (!link) return
    const { note, newNote, task } = link.dataset
    const plainClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    if (note) {
      // ⌘/Ctrl-click opens it in a new tab, as with any link.
      if (!plainClick) return
      event.preventDefault()
      navigate(paths.note(note))
    } else if (newNote !== undefined) {
      event.preventDefault()
      void openNoteTitled(newNote)
    } else if (task) {
      event.preventDefault()
      editTask(task)
    }
  }

  if (failed && html === null) {
    return (
      <div className={cn('text-[15px] whitespace-pre-wrap', className)}>
        {markdown}
      </div>
    )
  }
  return (
    // Clicks are handled for the links and checkboxes inside, which are
    // themselves focusable and keyboard-operable.
    <div
      ref={ref}
      className={cn('note-prose', className)}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  )
}
