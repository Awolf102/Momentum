export { MeaningIndexCard } from './components/MeaningIndexCard'
export { RelatedList } from './components/RelatedList'
export {
  cancelIndexing,
  currentTarget,
  dropQueued,
  indexOverview,
  indexStatusStore,
  retryQueued,
  startAutoIndex,
  unreachable,
  updateIndex,
  type IndexOverview,
  type IndexStatus,
} from './indexer'
export type { Chunk } from './lib/chunk'
export { meaningSearch } from './palette'
export {
  indexedCount,
  relatedTo,
  searchByMeaning,
  type MeaningOptions,
} from './search'
export { excludedKeys, setExcluded } from './settings'
export { chunkSource, currentSources, onSourcesChange } from './sources'
export { clearIndex } from './storage'
export type { MeaningHit, Source } from './types'
