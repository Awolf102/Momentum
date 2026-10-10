import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'

/** Which view the activity calendar shows (an id chosen by the page). */
export const calendarViewStore = createPersistentStore<{ view: string }>({
  key: 'momentum.calendar',
  version: 1,
  defaultValue: { view: 'check-ins' },
  parse: (data) =>
    isRecord(data) && typeof data.view === 'string'
      ? { view: data.view }
      : null,
})

export const setCalendarView = (view: string) => calendarViewStore.set({ view })
