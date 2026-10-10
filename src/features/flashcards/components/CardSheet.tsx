import {
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ActionRow } from '@/components/ActionRow'
import { RefreshIcon, TrashIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import { MarkdownView } from '@/features/notes/view'
import { SubjectPicker } from '@/features/subjects'
import { useStore } from '@/lib/store'
import { useClock } from '@/lib/useClock'
import { toast } from '@/lib/toast'
import {
  addCards,
  cards,
  deleteCards,
  editCard,
  resetCard,
  restoreCards,
} from '../cards'
import { editCardStore, newCardSubjectStore } from '../editing'
import { describeWhen } from '../lib/format'
import { MAX_SIDE } from '../lib/text'
import type { FlashCard } from '../types'

const close = () => editCardStore.set(null)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

const textarea =
  'block min-h-24 w-full resize-y rounded-2xl bg-tint px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60'

/** Writing a card, or changing one: its two sides, in markdown, and its subject. */
export function CardSheet() {
  const editing = useStore(editCardStore)
  const card = useStore(cards).find((each) => each.id === editing)
  const open = editing === 'new' || Boolean(card)
  return (
    <Sheet open={open} onClose={close} title={card ? 'Card' : 'New card'}>
      {editing === 'new' ? (
        <CardForm key="new" />
      ) : (
        card && <CardForm key={card.id} card={card} />
      )}
    </Sheet>
  )
}

function CardForm({ card }: { card?: FlashCard }) {
  const now = useClock()
  const startSubject = useStore(newCardSubjectStore)
  const [front, setFront] = useState(card?.front ?? '')
  const [back, setBack] = useState(card?.back ?? '')
  const [subjectId, setSubjectId] = useState<string | null>(
    card ? card.subjectId : startSubject,
  )
  const [preview, setPreview] = useState(false)
  const [added, setAdded] = useState(0)
  const ready = front.trim() !== '' && back.trim() !== ''

  async function save(another = false) {
    if (!ready) return
    if (card) {
      await editCard(card.id, { front, back, subjectId })
      close()
      return
    }
    await addCards([{ front, back }], { subjectId })
    newCardSubjectStore.set(subjectId)
    if (!another) {
      close()
      toast({ title: 'Card added' })
      return
    }
    setFront('')
    setBack('')
    setAdded((count) => count + 1)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void save()
  }

  // ⌘/Ctrl+Enter saves from either side.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void save(!card && event.shiftKey)
    }
  }

  async function remove() {
    if (!card) return
    await deleteCards([card.id])
    close()
    toast({
      title: 'Card deleted',
      action: { label: 'Undo', run: () => void restoreCards([card]) },
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Front">
        <textarea
          value={front}
          onChange={(event) => setFront(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_SIDE}
          autoFocus={!card}
          placeholder="A question, a term, a formula to recall…"
          className={textarea}
        />
      </Field>
      <Field label="Back">
        <textarea
          value={back}
          onChange={(event) => setBack(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_SIDE}
          placeholder="The answer"
          className={textarea}
        />
      </Field>
      <p className="text-xs text-fg-subtle">
        Markdown works: **bold**, `code`, and maths between $ signs.{' '}
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview((shown) => !shown)}
          className="font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          {preview ? 'Hide preview' : 'Preview'}
        </button>
      </p>
      {preview && (
        <div className="space-y-3 rounded-2xl bg-tint p-4">
          <MarkdownView markdown={front || '*Front*'} />
          <div className="border-t border-line pt-3">
            <MarkdownView markdown={back || '*Back*'} />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Subject
        </p>
        <SubjectPicker value={subjectId} onChange={setSubjectId} />
        {subjectId && (
          <button
            type="button"
            onClick={() => setSubjectId(null)}
            className="text-xs font-medium text-fg-subtle hover:text-fg"
          >
            No subject
          </button>
        )}
      </div>

      {card && (
        <p className="text-xs text-fg-subtle">
          {card.schedule.state === 'new'
            ? 'Not studied yet.'
            : `Due ${describeWhen(new Date(card.schedule.due), now)} · studied ${card.schedule.reps} ${card.schedule.reps === 1 ? 'time' : 'times'}${card.schedule.lapses ? ` · forgotten ${card.schedule.lapses} ${card.schedule.lapses === 1 ? 'time' : 'times'}` : ''}`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-950 disabled:opacity-40"
        >
          {card ? 'Save' : 'Add card'}
        </button>
        {!card && (
          <button
            type="button"
            disabled={!ready}
            onClick={() => void save(true)}
            className="rounded-full bg-tint px-4 py-2.5 text-sm font-semibold transition hover:bg-line disabled:opacity-40"
          >
            Add and write another
          </button>
        )}
        {added > 0 && (
          <span className="text-xs text-fg-subtle" role="status">
            {added} added
          </span>
        )}
      </div>

      {card && (
        <div className="space-y-2 pt-2">
          {card.schedule.state !== 'new' && (
            <ActionRow
              icon={<RefreshIcon />}
              label="Start this card again"
              hint="Forgets how it went"
              onClick={() => void resetCard(card.id)}
            />
          )}
          <ActionRow
            icon={<TrashIcon />}
            label="Delete card"
            danger
            onClick={() => void remove()}
          />
        </div>
      )}
    </form>
  )
}
