export { addFiles, choosePdfs, readInBackground } from './actions'
export { ContinueReading } from './components/ContinueReading'
export { documents, purgeDeletedFiles } from './documents'
export {
  clearFiles,
  documentTexts,
  listAllFiles,
  loadDocumentTexts,
  putFile,
} from './files'
export { highlights } from './highlights'
export { formatSize } from './lib/file'
export { useDocuments } from './hooks/useLibrary'
export type { Highlight, LibraryDocument } from './types'
