import { updateDocument } from '../documents'
import { loadFile, saveDocumentText, saveThumb } from '../files'
import { pageText, type TextRun } from '../lib/text'
import { openPdf, type PDFDocumentProxy } from './pdfjs'

const THUMB_WIDTH = 360

/** The first page as a small picture, for the library. */
async function renderThumb(pdf: PDFDocumentProxy): Promise<Blob | null> {
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
}

/** Every page's text, one string each, for search. */
async function extractText(pdf: PDFDocumentProxy): Promise<string[]> {
  const pages: string[] = []
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number)
    const content = await page.getTextContent()
    const runs = content.items.filter(
      (item): item is TextRun & (typeof content.items)[number] => 'str' in item,
    )
    pages.push(pageText(runs))
  }
  return pages
}

/**
 * What the library knows about a document from its PDF: the page count, a
 * picture of the first page, and the text for search.
 */
export async function readPdf(id: string, pdf: PDFDocumentProxy) {
  // The picture first: the page count arriving is the library's cue to
  // show it.
  const thumb = await renderThumb(pdf)
  if (thumb) await saveThumb(id, thumb)
  await updateDocument(id, { pages: pdf.numPages })
  await saveDocumentText(id, await extractText(pdf))
}

/**
 * Reads a newly added (or restored) document, in the background. A PDF that
 * can't be read keeps its record and file, and says so when opened; one
 * with a password is read once it's opened with it.
 */
export async function processDocument(id: string): Promise<void> {
  const file = await loadFile(id)
  if (!file) return
  const { pdf, close } = await openPdf(await file.arrayBuffer())
  try {
    await readPdf(id, pdf)
  } finally {
    await close()
  }
}
