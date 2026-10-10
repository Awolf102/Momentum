import { memo, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import type { Pdfjs } from '../hooks/usePdf'
import type { PDFDocumentProxy, RenderTask } from '../pdf/pdfjs'
import type { Highlight } from '../types'

const percent = (fraction: number) => `${fraction * 100}%`

const isCancelled = (error: unknown) =>
  (error as { name?: string } | null)?.name === 'RenderingCancelledException'

interface PdfPageProps {
  pdfjs: Pdfjs
  pdf: PDFDocumentProxy
  number: number
  /** On screen, in CSS pixels. */
  width: number
  /** Height ÷ width: a guess until the page has been read. */
  aspect: number
  /** Near the screen: drawn. Pages far away are cleared to save memory. */
  near: boolean
  highlights: readonly Highlight[]
  flashing: string | null
  onAspect: (number: number, aspect: number) => void
}

/** One page: drawn on a canvas, with its text selectable on top. */
export const PdfPage = memo(function PdfPage({
  pdfjs,
  pdf,
  number,
  width,
  aspect,
  near,
  highlights,
  flashing,
  onAspect,
}: PdfPageProps) {
  const page = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const textHost = useRef<HTMLDivElement>(null)
  /** Undoes the selection set-up of the text layer on show. */
  const release = useRef<(() => void) | null>(null)

  // The text layer's selection set-up goes with the page.
  useEffect(
    () => () => {
      release.current?.()
      release.current = null
    },
    [],
  )

  useEffect(() => {
    if (!near) {
      canvasHost.current?.replaceChildren()
      textHost.current?.replaceChildren()
      release.current?.()
      release.current = null
      return
    }
    let cancelled = false
    let task: RenderTask | undefined
    let textLayer: InstanceType<Pdfjs['TextLayer']> | undefined
    void (async () => {
      const proxy = await pdf.getPage(number)
      if (cancelled) return
      const base = proxy.getViewport({ scale: 1 })
      onAspect(number, base.height / base.width)
      const scale = width / base.width
      const viewport = proxy.getViewport({ scale })
      // Drawn off to the side, then swapped in, so zooming never blanks it.
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      task = proxy.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      })
      await task.promise
      if (cancelled) return
      canvasHost.current?.replaceChildren(canvas)
      const layer = document.createElement('div')
      layer.className = 'textLayer'
      textLayer = new pdfjs.TextLayer({
        textContentSource: proxy.streamTextContent(),
        container: layer,
        viewport,
      })
      await textLayer.render()
      if (cancelled) return
      page.current?.style.setProperty('--total-scale-factor', String(scale))
      release.current?.()
      textHost.current?.replaceChildren(layer)
      release.current = pdfjs.enableSelection(layer)
    })().catch((error: unknown) => {
      if (!cancelled && !isCancelled(error))
        console.warn(`[momentum] Could not draw page ${number}.`, error)
    })
    return () => {
      cancelled = true
      task?.cancel()
      textLayer?.cancel()
    }
  }, [pdfjs, pdf, number, width, near, onAspect])

  return (
    <div
      ref={page}
      data-page={number}
      role="region"
      aria-label={`Page ${number}`}
      className="pdf-page"
      style={{ width, height: Math.round(width * aspect) }}
    >
      <div ref={canvasHost} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {highlights.map((highlight) =>
          highlight.rects.map((rect, index) => (
            <span
              key={`${highlight.id}-${index}`}
              data-highlight={highlight.id}
              className={cn(
                'pdf-highlight',
                `pdf-highlight-${highlight.color}`,
                flashing === highlight.id && 'pdf-highlight-flash',
              )}
              style={{
                left: percent(rect.x),
                top: percent(rect.y),
                width: percent(rect.w),
                height: percent(rect.h),
              }}
            />
          )),
        )}
      </div>
      <div ref={textHost} className="absolute inset-0 z-[2]" />
    </div>
  )
})
