import { AnimatePresence, motion } from 'motion/react'
import {
  BookIcon,
  ChecklistIcon,
  ExternalIcon,
  NoteIcon,
  TrashIcon,
} from '@/components/icons'
import { GlassCard } from '@/components/GlassCard'
import { navigate, paths } from '@/lib/routes'
import { toast } from '@/lib/toast'
import { addToLog, makeNote, makeTask } from '../actions'
import { dismiss } from '../items'
import { displayUrl } from '../lib/share'
import type { InboxItem } from '../types'

const timeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/** Everything waiting to be sorted, each with what to do with it. */
export function InboxList({ items }: { items: readonly InboxItem[] }) {
  if (items.length === 0) {
    return (
      <GlassCard className="px-5 py-6 text-center text-sm leading-relaxed text-fg-muted sm:px-6">
        Inbox zero. Capture anything with <strong className="text-fg">I</strong>
        , or share to Momentum from another app once it's installed.
      </GlassCard>
    )
  }
  return (
    <GlassCard as="ul" className="divide-y divide-line px-5 py-1 sm:px-6">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="py-4"
          >
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
              {item.text}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
              <time dateTime={item.createdAt}>
                {timeFormat.format(new Date(item.createdAt))}
              </time>
              {item.source === 'shared' && <span>Shared to Momentum</span>}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  {displayUrl(item.url)}
                  <ExternalIcon />
                </a>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const task = await makeTask(item)
                  if (task)
                    toast({
                      id: 'inbox-task',
                      icon: <ChecklistIcon className="text-orange-300" />,
                      title: 'Added to your tasks',
                      description: task.title,
                      duration: 2500,
                    })
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
              >
                <ChecklistIcon /> Make it a task
              </button>
              <button
                type="button"
                onClick={async () => {
                  const note = await makeNote(item)
                  toast({
                    id: 'inbox-note',
                    icon: <NoteIcon className="text-orange-300" />,
                    title: 'Saved as a note',
                    description: note.title || undefined,
                    action: {
                      label: 'Open',
                      run: () => navigate(paths.note(note.id)),
                    },
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
              >
                <NoteIcon /> Make it a note
              </button>
              <button
                type="button"
                onClick={async () => {
                  await addToLog(item)
                  toast({
                    id: 'inbox-log',
                    icon: <BookIcon className="text-orange-300" />,
                    title: "Added to today's log",
                    duration: 2500,
                  })
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
              >
                <BookIcon /> Add to today's log
              </button>
              <button
                type="button"
                onClick={() => void dismiss(item.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-subtle transition hover:bg-tint hover:text-fg"
              >
                <TrashIcon /> Let it go
              </button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </GlassCard>
  )
}
