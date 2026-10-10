import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import { createStore } from '@/lib/store'

export type TasksView = 'list' | 'board'

/** List or board, remembered. */
export const tasksViewStore = createPersistentStore<{ view: TasksView }>({
  key: 'momentum.tasks',
  version: 1,
  defaultValue: { view: 'list' },
  parse: (data) =>
    isRecord(data) && (data.view === 'list' || data.view === 'board')
      ? { view: data.view }
      : null,
})

export const setTasksView = (view: TasksView) => tasksViewStore.set({ view })

/** The quick-add dialog (N, ⌘K or a + button). */
export const quickAddOpenStore = createStore(false)
export const openQuickAdd = () => quickAddOpenStore.set(true)
export const closeQuickAdd = () => quickAddOpenStore.set(false)

/** The task open in the editor sheet. */
export const editingTaskStore = createStore<string | null>(null)
export const editTask = (id: string) => editingTaskStore.set(id)
export const closeTaskEditor = () => editingTaskStore.set(null)
