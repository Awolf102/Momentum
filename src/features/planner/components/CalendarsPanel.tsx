import { useRef, useState } from 'react'
import { EyeIcon, RefreshIcon, TrashIcon, UploadIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { formatDateKey, toDateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { CALENDAR_COLORS, calendars } from '../calendars'
import { CALENDAR_COLOR_NAMES, CALENDAR_SWATCHES } from '../lib/colors'
import type { Calendar } from '../types'

const ICS_TYPES = '.ics,.ical,.icalendar,text/calendar'

/**
 * Calendars imported from .ics files: a timetable from uni, an export from
 * Google or Outlook. Each can be renamed, recoloured, hidden, replaced with
 * a newer file or removed. Their events can't be changed here.
 */
export function CalendarsPanel({
  onImport,
  onChange,
  onRemove,
}: {
  onImport: (file: File, replacing?: Calendar) => void
  onChange: (
    calendar: Calendar,
    changes: Partial<Pick<Calendar, 'name' | 'color' | 'hidden'>>,
  ) => void
  onRemove: (calendar: Calendar) => void
}) {
  const list = useStore(calendars)
  const input = useRef<HTMLInputElement>(null)
  const replacing = useRef<Calendar | undefined>(undefined)

  function choose(calendar?: Calendar) {
    replacing.current = calendar
    input.current?.click()
  }

  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Bring in your timetable or another calendar as an .ics file, so
          classes show on the plan. Google Calendar, Outlook and most uni
          timetables can export one. It’s read on this device; nothing is
          uploaded.
        </p>
      ) : (
        <ul aria-label="Calendars" className="space-y-1">
          {list.map((calendar) => (
            <CalendarRow
              // A new name from elsewhere starts the field afresh.
              key={`${calendar.id}:${calendar.name}`}
              calendar={calendar}
              onChange={(changes) => onChange(calendar, changes)}
              onReplace={() => choose(calendar)}
              onRemove={() => onRemove(calendar)}
            />
          ))}
        </ul>
      )}
      <button
        type="button"
        data-import
        onClick={() => choose()}
        className="inline-flex items-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line"
      >
        <UploadIcon /> Import a calendar (.ics)
      </button>
      <input
        ref={input}
        type="file"
        accept={ICS_TYPES}
        hidden
        aria-label="Calendar file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onImport(file, replacing.current)
          replacing.current = undefined
        }}
      />
    </div>
  )
}

function CalendarRow({
  calendar,
  onChange,
  onReplace,
  onRemove,
}: {
  calendar: Calendar
  onChange: (
    changes: Partial<Pick<Calendar, 'name' | 'color' | 'hidden'>>,
  ) => void
  onReplace: () => void
  onRemove: () => void
}) {
  const [name, setName] = useState(calendar.name)
  const repeating = calendar.events.filter((event) => event.rule).length
  const next =
    CALENDAR_COLORS[
      (CALENDAR_COLORS.indexOf(calendar.color) + 1) % CALENDAR_COLORS.length
    ]
  return (
    <li
      className={cn('rounded-xl px-1 py-1.5', calendar.hidden && 'opacity-60')}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ color: next })}
          aria-label={`Colour: ${CALENDAR_COLOR_NAMES[calendar.color]}. Change to ${CALENDAR_COLOR_NAMES[next]}`}
          className="grid size-7 shrink-0 place-items-center rounded-full transition hover:bg-tint"
        >
          <span
            className="size-3 rounded-full"
            style={{ background: CALENDAR_SWATCHES[calendar.color] }}
          />
        </button>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name.trim() && name !== calendar.name) onChange({ name })
            else setName(calendar.name)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          aria-label="Calendar name"
          maxLength={80}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:bg-tint focus-visible:bg-tint"
        />
        <button
          type="button"
          role="switch"
          aria-checked={!calendar.hidden}
          aria-label={`Show ${calendar.name}`}
          onClick={() => onChange({ hidden: !calendar.hidden })}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full transition hover:bg-tint',
            calendar.hidden ? 'text-fg-subtle' : 'text-fg',
          )}
        >
          <EyeIcon />
        </button>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-xs text-fg-subtle">
        <span>
          {calendar.events.length}{' '}
          {calendar.events.length === 1 ? 'event' : 'events'}
          {repeating ? `, ${repeating} repeating` : ''} · imported{' '}
          {formatDateKey(toDateKey(new Date(calendar.importedAt)), {
            day: 'numeric',
            month: 'short',
          })}
        </span>
        <button
          type="button"
          onClick={onReplace}
          aria-label={`Replace ${calendar.name} with a newer file`}
          className="inline-flex items-center gap-1 font-semibold text-fg-muted hover:text-fg"
        >
          <RefreshIcon /> Newer file…
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${calendar.name}`}
          className="inline-flex items-center gap-1 font-semibold text-fg-muted hover:text-rose-300"
        >
          <TrashIcon /> Remove
        </button>
      </div>
    </li>
  )
}
