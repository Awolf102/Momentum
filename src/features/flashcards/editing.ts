import { navigate, paths } from '@/lib/routes'
import { createStore } from '@/lib/store'

/** The card open in the editor: an id, 'new' while writing one, or none. */
export const editCardStore = createStore<string | null>(null)
/** The subject a new card starts with. */
export const newCardSubjectStore = createStore<string | null>(null)

/** Opens the editor for a new card (the Cards page shows it). */
export function newCardWith(subjectId: string | null = null): void {
  newCardSubjectStore.set(subjectId)
  editCardStore.set('new')
}

/** Opens a card in the editor, on the Cards page. */
export function openCard(id: string): void {
  editCardStore.set(id)
  navigate(paths.cards)
}
