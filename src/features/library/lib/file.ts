/** The largest PDF the library takes, in bytes. */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

/** A title from a file name: "Lecture_05-karnaugh maps.pdf" → "Lecture 05 karnaugh maps". */
export function titleFromFileName(name: string): string {
  const title = name
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/(?<=\S)-(?=\S)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return title || 'Untitled document'
}

/** Whether the bytes are a PDF: "%PDF-" near the start. */
export function isPdf(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

/** "2.4 MB", "830 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024)
    return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
