import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

/**
 * pdf.js, set up: parsing runs in its own worker, and the files some PDFs
 * need (fonts, character maps, decoders) come from /pdfjs/. This module is
 * only ever loaded with `import()`, so pdf.js stays out of every page that
 * doesn't show a PDF.
 *
 * Its "legacy" build: the modern one relies on JavaScript features only the
 * newest browsers have (Map.prototype.getOrInsertComputed, for one), and
 * would fail on many phones; this one brings standard polyfills.
 */
GlobalWorkerOptions.workerSrc = workerUrl

const resources = `${import.meta.env.BASE_URL}pdfjs/`

export interface OpenPdf {
  pdf: PDFDocumentProxy
  /** Frees the document (and its worker's memory) when done. */
  close: () => Promise<void>
}

export async function openPdf(
  data: ArrayBuffer,
  password?: string,
): Promise<OpenPdf> {
  const task = getDocument({
    data,
    password,
    cMapUrl: `${resources}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${resources}standard_fonts/`,
    wasmUrl: `${resources}wasm/`,
    iccUrl: `${resources}iccs/`,
  })
  try {
    return { pdf: await task.promise, close: () => task.destroy() }
  } catch (error) {
    await task.destroy()
    throw error
  }
}

export {
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs'

export { enableSelection } from './selection'
