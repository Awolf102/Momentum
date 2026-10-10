import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Link } from 'wouter'
import {
  ArrowLeftIcon,
  ChatIcon,
  FitWidthIcon,
  HighlighterIcon,
  MinusIcon,
  MoreIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons'
import { GlassCard } from '@/components/GlassCard'
import { Sheet } from '@/components/Sheet'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { navigate, paths } from '@/lib/routes'
import { createStore, useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { noteFromHighlights, readInBackground, readUnlocked } from '../actions'
import { deleteDocument, restoreDocument, updateDocument } from '../documents'
import { putFile } from '../files'
import {
  addHighlight,
  deleteHighlight,
  restoreHighlight,
  updateHighlight,
} from '../highlights'
import { useHighlights } from '../hooks/useLibrary'
import { usePdf, type Pdfjs } from '../hooks/usePdf'
import { isPdf } from '../lib/file'
import { hits, toPageRects } from '../lib/rects'
import type { PDFDocumentProxy } from '../pdf/pdfjs'
import type {
  Highlight,
  HighlightColor,
  LibraryDocument,
  PageRect,
} from '../types'
import { DocumentSheet } from './DocumentSheet'
import { HighlightMenu, SelectionMenu, type Anchor } from './HighlightMenus'
import { HighlightsPanel } from './HighlightsPanel'
import { PdfPage } from './PdfPage'
import './viewer.css'

/**
 * Whether the highlights panel is open on wide screens, kept while you move
 * between documents. On phones it's a sheet, opened only when asked for.
 */
const panelStore = createStore(false)

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3]
/** A4, until the first page says otherwise. */
const DEFAULT_ASPECT = 297 / 210

const iconButton =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-fg-muted transition hover:bg-tint hover:text-fg disabled:opacity-40'

/** A document open to read: its pages, highlights and notes. */
export function DocumentViewer({
  document,
  startPage,
}: {
  document: LibraryDocument
  startPage: number | null
}) {
  const [attempt, setAttempt] = useState(0)
  const [password, setPassword] = useState<string>()
  const state = usePdf(document.id, { password, attempt })

  if (state.status === 'ready')
    return (
      <PdfView
        document={document}
        pdf={state.pdf}
        pdfjs={state.pdfjs}
        startPage={startPage ?? document.lastPage}
      />
    )
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <Toolbar document={document} />
      <GlassCard className="mt-4 px-6 py-8 text-center text-[15px] leading-relaxed text-fg-muted sm:px-10">
        {state.status === 'loading' && <p>Opening…</p>}
        {state.status === 'error' && (
          <>
            <p>This PDF couldn't be opened. It may be damaged.</p>
            <button
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
              className="mt-4 rounded-full bg-tint px-4 py-2 text-sm font-semibold text-fg transition hover:bg-line"
            >
              Try again
            </button>
          </>
        )}
        {state.status === 'password' && (
          <PasswordForm wrong={state.wrong} onSubmit={setPassword} />
        )}
        {state.status === 'missing' && (
          <MissingFile
            document={document}
            onFound={() => setAttempt((count) => count + 1)}
          />
        )}
      </GlassCard>
    </div>
  )
}

function PasswordForm({
  wrong,
  onSubmit,
}: {
  wrong: boolean
  onSubmit: (password: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        if (value) onSubmit(value)
      }}
      className="mx-auto flex max-w-sm flex-col items-center gap-3"
    >
      <p>This PDF is protected with a password.</p>
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="PDF password"
        placeholder="Password"
        className="h-11 w-full rounded-xl bg-tint px-3 text-fg outline-none focus-visible:outline-2"
      />
      {wrong && (
        <p className="text-sm text-rose-300 light:text-rose-600">
          That password didn't open it.
        </p>
      )}
      <button
        type="submit"
        className="rounded-full bg-tint px-4 py-2 text-sm font-semibold text-fg transition hover:bg-line"
      >
        Open
      </button>
    </form>
  )
}

/** The record came back (from a backup) without its file: ask for it. */
function MissingFile({
  document,
  onFound,
}: {
  document: LibraryDocument
  onFound: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState('')
  return (
    <>
      <p>
        The file for this document isn't on this device — perhaps it came from a
        backup made without documents. Choose{' '}
        {document.fileName ? <strong>{document.fileName}</strong> : 'the PDF'}{' '}
        to read it here again.
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-4 rounded-full bg-tint px-4 py-2 text-sm font-semibold text-fg transition hover:bg-line"
      >
        Choose the file
      </button>
      {problem && (
        <p className="mt-3 text-sm text-rose-300 light:text-rose-600">
          {problem}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!isPdf(new Uint8Array(await file.slice(0, 1024).arrayBuffer())))
            return setProblem(`${file.name} isn't a PDF.`)
          await putFile(document.id, file)
          readInBackground(document.id)
          onFound()
        }}
      />
    </>
  )
}

/** Back to the library, the title, and whatever controls apply. */
function Toolbar({
  document,
  children,
}: {
  document: LibraryDocument
  children?: ReactNode
}) {
  return (
    <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 lg:top-4">
      <div className="flex items-center gap-1 rounded-full glass-strong p-1.5">
        <Link href={paths.library} aria-label="Library" className={iconButton}>
          <ArrowLeftIcon />
        </Link>
        <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
          {document.title}
        </h1>
        {children}
      </div>
    </div>
  )
}

/** "12 / 240", where the number can be typed over to jump. */
function PageField({
  current,
  count,
  onGo,
}: {
  current: number
  count: number
  onGo: (page: number) => void
}) {
  const [typed, setTyped] = useState<string | null>(null)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const page = Number(typed)
        if (Number.isInteger(page) && page >= 1 && page <= count) onGo(page)
        setTyped(null)
        ;(document.activeElement as HTMLElement | null)?.blur()
      }}
      className="flex shrink-0 items-center gap-1 text-sm text-fg-muted tabular-nums"
    >
      <input
        value={typed ?? String(current)}
        onFocus={(event) => {
          setTyped(String(current))
          requestAnimationFrame(() => event.target.select())
        }}
        onBlur={() => setTyped(null)}
        onChange={(event) => setTyped(event.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        aria-label={`Page, of ${count}`}
        className="h-9 w-12 rounded-full bg-tint text-center text-fg outline-none focus-visible:outline-2"
      />
      <span aria-hidden="true">/ {count}</span>
    </form>
  )
}

/** The width of an element, kept up to date. */
function useWidth(element: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const target = element.current
    if (!target) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [element])
  return width
}

interface Selected {
  page: number
  rects: PageRect[]
  quote: string
  anchor: Anchor
}

function PdfView({
  document,
  pdf,
  pdfjs,
  startPage,
}: {
  document: LibraryDocument
  pdf: PDFDocumentProxy
  pdfjs: Pdfjs
  startPage: number
}) {
  const count = pdf.numPages
  const wide = useMediaQuery('(min-width: 1024px)')
  const sidePanel = useStore(panelStore)
  const [sheetOpen, setSheetOpen] = useState(false)
  const panelOpen = wide ? sidePanel : sheetOpen
  const togglePanel = () =>
    wide ? panelStore.set(!panelStore.get()) : setSheetOpen((open) => !open)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const column = useRef<HTMLDivElement>(null)
  const columnWidth = useWidth(column)
  const [zoom, setZoom] = useState(1)
  const width = Math.max(240, Math.round((columnWidth || 640) * zoom))
  const [aspects, setAspects] = useState<Record<number, number>>({})
  const baseAspect = aspects[1] ?? DEFAULT_ASPECT
  const onAspect = useCallback(
    (page: number, aspect: number) =>
      setAspects((known) =>
        Math.abs((known[page] ?? 0) - aspect) < 0.002
          ? known
          : { ...known, [page]: aspect },
      ),
    [],
  )
  const highlights = useHighlights(document.id)
  const byPage = useMemo(() => {
    const map = new Map<number, Highlight[]>()
    for (const highlight of highlights)
      map.set(highlight.page, [...(map.get(highlight.page) ?? []), highlight])
    return map
  }, [highlights])
  const first = Math.min(Math.max(1, startPage), count)
  const [current, setCurrent] = useState(first)
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set([first]))
  const [selected, setSelected] = useState<Selected | null>(null)
  const [editing, setEditing] = useState<{
    id: string
    anchor: Anchor
    focusNote: boolean
  } | null>(null)
  const [flashing, setFlashing] = useState<string | null>(null)

  // Opened now; the page count, if it wasn't known yet. Page 1's shape is
  // the guess for every other page until each is read.
  const [needsCount] = useState(document.pages === null)
  useEffect(() => {
    void updateDocument(document.id, {
      lastOpenedAt: new Date().toISOString(),
      ...(needsCount ? { pages: count } : {}),
    })
  }, [document.id, count, needsCount])
  // A protected PDF is read (picture, text) once it's open.
  useEffect(() => readUnlocked(document.id, pdf), [document.id, pdf])
  useEffect(() => {
    void pdf.getPage(1).then((page) => {
      const { width: w, height: h } = page.getViewport({ scale: 1 })
      onAspect(1, h / w)
    })
  }, [pdf, onAspect])

  // Back where you were: once the pages have their sizes (the column's
  // width, the first page's shape), and after the shell's own scroll to the
  // top of a new page.
  const laidOut = columnWidth > 0 && aspects[1] !== undefined
  const restored = useRef(false)
  useEffect(() => {
    if (!laidOut || restored.current || first <= 1) return
    const frame = requestAnimationFrame(() => {
      restored.current = true
      column.current
        ?.querySelector(`[data-page="${first}"]`)
        ?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [laidOut, first])

  // Remember the page, a moment after you settle on it.
  useEffect(() => {
    const timer = setTimeout(
      () => void updateDocument(document.id, { lastPage: current }),
      800,
    )
    return () => clearTimeout(timer)
  }, [current, document.id])

  // Pages near the screen are drawn; the rest wait (or are cleared).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((previous) => {
          const next = new Set(previous)
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page)
            if (entry.isIntersecting) next.add(page)
            else next.delete(page)
          }
          return next
        }),
      { rootMargin: '150% 0px' },
    )
    for (const page of column.current?.querySelectorAll('[data-page]') ?? [])
      observer.observe(page)
    return () => observer.disconnect()
  }, [count])

  // The page under the reading line, and what's selected, as you scroll.
  const checkSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return setSelected(null)
    const range = selection.getRangeAt(0)
    const start =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement
    const page = start?.closest<HTMLElement>('[data-page]')
    if (!page || !column.current?.contains(page)) return setSelected(null)
    const rects = toPageRects(
      [...range.getClientRects()],
      page.getBoundingClientRect(),
    )
    const quote = selection.toString().replace(/\s+/g, ' ').trim()
    if (rects.length === 0 || !quote) return setSelected(null)
    const box = range.getBoundingClientRect()
    setSelected({
      page: Number(page.dataset.page),
      rects,
      quote,
      anchor: {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      },
    })
  }, [])
  useEffect(() => {
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      frame = 0
      const box = column.current?.getBoundingClientRect()
      if (!box) return
      const x = Math.min(
        Math.max(box.left + box.width / 2, 0),
        window.innerWidth - 1,
      )
      const page = window.document
        .elementFromPoint(x, window.innerHeight * 0.4)
        ?.closest<HTMLElement>('[data-page]')
      if (page) setCurrent(Number(page.dataset.page))
      checkSelection()
    }
    const onScroll = () => {
      frame ||= requestAnimationFrame(update)
    }
    const onUp = () => requestAnimationFrame(checkSelection)
    // Touch selections are adjusted with handles: wait for them to settle.
    const onSelectionChange = () => {
      clearTimeout(timer)
      timer = setTimeout(checkSelection, 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.document.addEventListener('pointerup', onUp)
    window.document.addEventListener('keyup', onUp)
    window.document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.document.removeEventListener('pointerup', onUp)
      window.document.removeEventListener('keyup', onUp)
      window.document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [checkSelection])

  useEffect(() => {
    if (!flashing) return
    const timer = setTimeout(() => setFlashing(null), 1500)
    return () => clearTimeout(timer)
  }, [flashing])

  const goTo = useCallback((page: number, at = 0) => {
    const element = column.current?.querySelector<HTMLElement>(
      `[data-page="${page}"]`,
    )
    if (!element) return
    const box = element.getBoundingClientRect()
    window.scrollTo({
      top:
        window.scrollY +
        box.top +
        box.height * at -
        (at ? window.innerHeight * 0.3 : 88),
      behavior: 'smooth',
    })
  }, [])

  function changeZoom(next: number) {
    setZoom(next)
    // Stay on the same page.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        column.current
          ?.querySelector(`[data-page="${current}"]`)
          ?.scrollIntoView({ block: 'start' }),
      ),
    )
  }
  const zoomIn = () => changeZoom(ZOOMS.find((step) => step > zoom) ?? zoom)
  const zoomOut = () =>
    changeZoom([...ZOOMS].reverse().find((step) => step < zoom) ?? zoom)

  useHotkeys([
    { key: 'ArrowRight', run: () => goTo(Math.min(count, current + 1)) },
    { key: 'ArrowLeft', run: () => goTo(Math.max(1, current - 1)) },
    { key: '=', run: zoomIn },
    { key: '+', run: zoomIn },
    { key: '-', run: zoomOut },
    { key: '0', run: () => changeZoom(1) },
    { key: 'h', run: togglePanel },
  ])

  async function highlightSelection(color: HighlightColor, withNote: boolean) {
    if (!selected) return
    const created = await addHighlight({
      documentId: document.id,
      page: selected.page,
      rects: selected.rects,
      quote: selected.quote,
      color,
    })
    window.getSelection()?.removeAllRanges()
    setSelected(null)
    if (withNote)
      setEditing({ id: created.id, anchor: selected.anchor, focusNote: true })
  }

  // A tap on a highlight opens it (unless text is being selected).
  function onPagesClick(event: MouseEvent) {
    if (window.getSelection()?.isCollapsed === false) return
    const page = (event.target as Element).closest<HTMLElement>('[data-page]')
    if (!page) return
    const box = page.getBoundingClientRect()
    const point = {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    }
    const hit = [...(byPage.get(Number(page.dataset.page)) ?? [])]
      .reverse()
      .find((highlight) => hits(highlight.rects, point))
    if (hit)
      setEditing({
        id: hit.id,
        anchor: {
          left: event.clientX,
          right: event.clientX,
          top: event.clientY,
          bottom: event.clientY,
        },
        focusNote: false,
      })
  }

  function openHighlight(highlight: Highlight) {
    setSheetOpen(false)
    goTo(highlight.page, highlight.rects[0]?.y ?? 0)
    setFlashing(highlight.id)
  }

  async function remove() {
    setDetailsOpen(false)
    await deleteDocument(document.id)
    navigate(paths.library)
    toast({
      id: 'document-deleted',
      icon: <TrashIcon className="text-orange-300" />,
      title: 'Document deleted',
      description: document.title,
      action: {
        label: 'Undo',
        run: () =>
          void restoreDocument(document.id).then(() =>
            navigate(paths.document(document.id)),
          ),
      },
    })
  }

  const editingHighlight = editing
    ? highlights.find((highlight) => highlight.id === editing.id)
    : undefined
  const panel = (
    <HighlightsPanel
      highlights={highlights}
      onOpen={openHighlight}
      onMakeNote={() => void noteFromHighlights(document)}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col pt-2 pb-8 sm:pt-4 lg:pt-0">
      <Toolbar document={document}>
        <PageField
          current={current}
          count={count}
          onGo={(page) => goTo(page)}
        />
        <div className="hidden items-center sm:flex">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= ZOOMS[0]}
            aria-label="Zoom out"
            title="Zoom out (−)"
            className={iconButton}
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            aria-label="Fit to width"
            title="Fit to width (0)"
            className={cn(iconButton, zoom === 1 && 'text-fg')}
          >
            <FitWidthIcon />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= ZOOMS.at(-1)!}
            aria-label="Zoom in"
            title="Zoom in (+)"
            className={iconButton}
          >
            <PlusIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate(paths.ask({ document: document.id }))}
          aria-label="Ask about this document"
          title="Ask about this document"
          className={iconButton}
        >
          <ChatIcon />
        </button>
        <button
          type="button"
          onClick={togglePanel}
          aria-pressed={panelOpen}
          aria-label={`Highlights (${highlights.length})`}
          title="Highlights (H)"
          className={cn(iconButton, 'relative', panelOpen && 'bg-tint text-fg')}
        >
          <HighlighterIcon />
          {highlights.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-orange-400 px-1 text-[10px] leading-4 font-bold text-orange-950 tabular-nums">
              {highlights.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label="Document details"
          title="Document details"
          className={iconButton}
        >
          <MoreIcon />
        </button>
      </Toolbar>

      <div
        className={cn(
          'mt-4 grid items-start gap-5',
          wide && panelOpen && 'grid-cols-[minmax(0,1fr)_17rem]',
        )}
      >
        <div ref={column} className="min-w-0 overflow-x-auto">
          <div
            onClick={onPagesClick}
            className="flex flex-col items-center gap-3"
            style={{ width: width > columnWidth ? width : undefined }}
          >
            {Array.from({ length: count }, (_, index) => {
              const page = index + 1
              return (
                <PdfPage
                  key={page}
                  pdfjs={pdfjs}
                  pdf={pdf}
                  number={page}
                  width={width}
                  aspect={aspects[page] ?? baseAspect}
                  near={near.has(page)}
                  highlights={byPage.get(page) ?? NONE}
                  flashing={flashing}
                  onAspect={onAspect}
                />
              )
            })}
          </div>
        </div>
        {wide && panelOpen && (
          <aside
            aria-label="Highlights"
            className="sticky top-24 max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain rounded-[28px] glass p-3"
          >
            <h2 className="px-1 pb-2 text-xs font-semibold tracking-[0.2em] text-fg-subtle uppercase">
              Highlights
            </h2>
            {panel}
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Highlights"
        >
          {panel}
        </Sheet>
      )}
      {selected && !editing && (
        <SelectionMenu
          anchor={selected.anchor}
          onPick={(color) => void highlightSelection(color, false)}
          onNote={() => void highlightSelection('yellow', true)}
          onClose={() => setSelected(null)}
        />
      )}
      {editing && editingHighlight && (
        <HighlightMenu
          key={editingHighlight.id}
          highlight={editingHighlight}
          anchor={editing.anchor}
          focusNote={editing.focusNote}
          onChange={(changes) =>
            void updateHighlight(editingHighlight.id, changes)
          }
          onDelete={() => {
            const { id } = editingHighlight
            setEditing(null)
            void deleteHighlight(id)
            toast({
              id: 'highlight-deleted',
              icon: <TrashIcon className="text-orange-300" />,
              title: 'Highlight deleted',
              action: { label: 'Undo', run: () => void restoreHighlight(id) },
            })
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <DocumentSheet
        document={document}
        open={detailsOpen}
        highlightCount={highlights.length}
        onClose={() => setDetailsOpen(false)}
        onMakeNote={() => {
          setDetailsOpen(false)
          void noteFromHighlights(document)
        }}
        onMakeCards={() => {
          setDetailsOpen(false)
          navigate(paths.makeCards({ document: document.id, page: current }))
        }}
        onDelete={() => void remove()}
      />
    </div>
  )
}

const NONE: readonly Highlight[] = []
