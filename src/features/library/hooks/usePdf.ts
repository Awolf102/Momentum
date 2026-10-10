import { useEffect, useState } from 'react'
import { loadFile } from '../files'
import type { PDFDocumentProxy } from '../pdf/pdfjs'

export type Pdfjs = typeof import('../pdf/pdfjs')

export type PdfState =
  | { status: 'loading' }
  /** The record is here but the file isn't (e.g. a backup without files). */
  | { status: 'missing' }
  | { status: 'password'; wrong: boolean }
  | { status: 'error' }
  | { status: 'ready'; pdf: PDFDocumentProxy; pdfjs: Pdfjs }

const isPasswordError = (error: unknown) =>
  (error as { name?: string } | null)?.name === 'PasswordException'

/**
 * Opens a document's PDF (loading pdf.js on first use), and closes it again
 * when the viewer goes. Changing `password` or `attempt` tries again.
 */
export function usePdf(
  id: string,
  { password, attempt }: { password?: string; attempt: number },
): PdfState {
  const [state, setState] = useState<{ key: string; value: PdfState }>({
    key: '',
    value: { status: 'loading' },
  })
  const key = `${id}|${password ?? ''}|${attempt}`

  useEffect(() => {
    let cancelled = false
    let close: (() => Promise<void>) | undefined
    const settle = (value: PdfState) => !cancelled && setState({ key, value })
    void (async () => {
      const file = await loadFile(id)
      if (!file) return settle({ status: 'missing' })
      try {
        const pdfjs = await import('../pdf/pdfjs')
        const opened = await pdfjs.openPdf(await file.arrayBuffer(), password)
        if (cancelled) return void opened.close()
        close = opened.close
        settle({ status: 'ready', pdf: opened.pdf, pdfjs })
      } catch (error) {
        if (isPasswordError(error))
          return settle({ status: 'password', wrong: Boolean(password) })
        console.warn('[momentum] Could not open a document.', error)
        settle({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
      void close?.()
    }
  }, [id, password, key])

  // Until this attempt settles, it's loading.
  return state.key === key ? state.value : { status: 'loading' }
}
