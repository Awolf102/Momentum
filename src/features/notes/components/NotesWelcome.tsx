import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { CameraIcon, NoteIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { NewNoteButton } from './NewNoteButton'

const EXAMPLES: [string, string][] = [
  ['# Heading', 'Headings, bold and italics, lists and tables'],
  ['- [ ] Revise chapter 4', 'A checklist you can tick as you read'],
  ['$e^{i\\pi} + 1 = 0$', 'Maths, inline or on its own line with $$'],
  ['```python', 'Code, highlighted — Verilog and VHDL too'],
  ['[[Karnaugh maps]]', 'A link to another note (it can be new)'],
  ['[[task:Lab report]]', 'A link to one of your tasks'],
]

/** What a note can hold, shown before there's one to open. */
export function NotesWelcome({ empty }: { empty: boolean }) {
  return (
    <GlassCard className="px-6 py-7 sm:px-8 sm:py-8">
      <NoteIcon className="text-3xl text-orange-300 light:text-orange-500" />
      <h2 className="mt-3 font-serif text-3xl leading-tight">
        {empty ? 'Your first note' : 'Pick a note, or start one'}
      </h2>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-pretty text-fg-muted">
        Notes are written in markdown and kept on this device. Type{' '}
        <code className="rounded-md bg-tint px-1 py-0.5 font-mono text-[0.9em]">
          [[
        </code>{' '}
        to link one to another; each note lists the notes that link to it.
      </p>
      <dl className="mt-5 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_1fr]">
        {EXAMPLES.map(([syntax, meaning]) => (
          <div key={syntax} className="contents">
            <dt>
              <code className="rounded-md bg-tint px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
                {syntax}
              </code>
            </dt>
            <dd className="text-fg-muted max-sm:mb-1.5">{meaning}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <NewNoteButton />
        <Link
          href={paths.photoNote}
          className="inline-flex items-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line"
        >
          <CameraIcon /> From a photo
        </Link>
      </div>
    </GlassCard>
  )
}
