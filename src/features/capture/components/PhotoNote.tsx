import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ArrowLeftIcon,
  CameraIcon,
  CloseIcon,
  EyeIcon,
  ImageIcon,
  PencilIcon,
  RotateIcon,
  SparkleIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import {
  describeAiError,
  formatSource,
  isAiError,
  ReplyStatus,
  SendPreview,
  useAiReadiness,
} from '@/features/ai'
import { startNote } from '@/features/notes'
import { MarkdownView } from '@/features/notes/view'
import { SubjectPicker } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { createId } from '@/lib/id'
import { openSettings } from '@/lib/routes'
import { imageTokens } from '../lib/image'
import { preparePhoto, UnreadablePhoto, type PreparedPhoto } from '../photo'
import {
  INSTRUCTION_TOKENS,
  MAX_PHOTOS,
  noteFromTranscription,
  transcribe,
} from '../transcribe'

const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:pointer-events-none disabled:opacity-40'

const isImage = (file: File) =>
  file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)

const megabytes = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} kB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`

interface Photo {
  key: string
  file: File
  /** The original, for the thumbnail. */
  url: string
  /** Quarter turns clockwise. */
  turns: number
  /** As it will be sent; null while it's being prepared. */
  prepared: PreparedPhoto | null
  problem: string | null
}

type Phase = 'choose' | 'writing' | 'review'

/** Why a transcription failed, in words; a model that can't read pictures says so. */
function describeFailure(error: unknown): string {
  if (
    isAiError(error) &&
    error.kind === 'bad-request' &&
    /image|vision|multimodal|picture/i.test(error.message)
  )
    return 'This model can’t read pictures. Choose one that can in Settings → AI.'
  return describeAiError(error)
}

/**
 * A note from photos of handwritten notes, a whiteboard or slides: the
 * photos are chosen (or pasted, or dropped), turned the right way up, sent
 * through the send preview, and the note that comes back can be edited
 * before it's saved. The photos themselves aren't kept.
 */
export function PhotoNote() {
  const readiness = useAiReadiness('chat')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [phase, setPhase] = useState<Phase>('choose')
  const [streamed, setStreamed] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [view, setView] = useState<'read' | 'edit'>('read')
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [cutShort, setCutShort] = useState<
    'length' | 'stopped' | 'broken' | null
  >(null)
  // Who read the photos, and why it broke off, if it did.
  const [madeBy, setMadeBy] = useState<string | null>(null)
  const [brokeOff, setBrokeOff] = useState<string | null>(null)
  const [since, setSince] = useState(0)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  // The text so far, for keeping it when you stop.
  const soFar = useRef('')
  // Every thumbnail made, to let go of when leaving.
  const urls = useRef(new Set<string>())
  useEffect(() => {
    const made = urls.current
    return () => {
      controller.current?.abort()
      for (const url of made) URL.revokeObjectURL(url)
    }
  }, [])

  async function prepare(key: string, file: File, turns: number) {
    try {
      const prepared = await preparePhoto(file, turns)
      setPhotos((list) =>
        list.map((each) =>
          each.key === key && each.turns === turns
            ? { ...each, prepared, problem: null }
            : each,
        ),
      )
    } catch (error) {
      setPhotos((list) =>
        list.map((each) =>
          each.key === key
            ? {
                ...each,
                problem:
                  error instanceof UnreadablePhoto
                    ? error.message
                    : 'This picture couldn’t be opened.',
              }
            : each,
        ),
      )
    }
  }

  function add(files: Iterable<File>) {
    const images = [...files].filter(isImage)
    const room = MAX_PHOTOS - photos.length
    setProblem(
      images.length > room ? `Up to ${MAX_PHOTOS} photos make one note.` : null,
    )
    const added = images.slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      return {
        key: createId(),
        file,
        url,
        turns: 0,
        prepared: null,
        problem: null,
      }
    })
    if (added.length === 0) return
    setPhotos((list) => [...list, ...added])
    for (const photo of added) void prepare(photo.key, photo.file, 0)
  }

  // Pasting a picture (a screenshot, say) adds it.
  const latestAdd = useRef(add)
  useEffect(() => {
    latestAdd.current = add
  })
  useEffect(() => {
    if (phase !== 'choose') return
    function onPaste(event: ClipboardEvent) {
      const files = [...(event.clipboardData?.files ?? [])].filter(isImage)
      if (files.length === 0) return
      event.preventDefault()
      latestAdd.current(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [phase])

  function rotate(key: string) {
    const photo = photos.find((each) => each.key === key)
    if (!photo) return
    const turns = (photo.turns + 1) % 4
    setPhotos((list) =>
      list.map((each) =>
        each.key === key ? { ...each, turns, prepared: null } : each,
      ),
    )
    void prepare(key, photo.file, turns)
  }

  function remove(key: string) {
    const photo = photos.find((each) => each.key === key)
    if (photo) {
      URL.revokeObjectURL(photo.url)
      urls.current.delete(photo.url)
    }
    setPhotos((list) => list.filter((each) => each.key !== key))
  }

  function earlier(key: string) {
    setPhotos((list) => {
      const at = list.findIndex((each) => each.key === key)
      if (at < 1) return list
      const next = [...list]
      ;[next[at - 1], next[at]] = [next[at], next[at - 1]]
      return next
    })
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    add(event.dataTransfer.files)
  }

  const ready =
    photos.length > 0 &&
    photos.every((photo) => photo.prepared && !photo.problem)
  const tokens = readiness.ready
    ? INSTRUCTION_TOKENS +
      photos.reduce(
        (sum, photo) =>
          sum +
          (photo.prepared
            ? imageTokens(
                readiness.provider,
                photo.prepared.width,
                photo.prepared.height,
              )
            : 0),
        0,
      )
    : 0

  function finish(text: string, cut: 'length' | 'stopped' | 'broken' | null) {
    const note = noteFromTranscription(text)
    setTitle(note.title)
    setBody(note.body)
    setCutShort(cut)
    setView('read')
    setPhase('review')
  }

  async function send() {
    setPreviewing(false)
    if (!ready) return
    setPhase('writing')
    setSince(Date.now())
    setStreamed('')
    soFar.current = ''
    setProblem(null)
    setCutShort(null)
    setMadeBy(null)
    setBrokeOff(null)
    const asking = new AbortController()
    controller.current = asking
    try {
      const result = await transcribe(
        photos.map((photo) => photo.prepared!),
        {
          signal: asking.signal,
          onText: (text) => {
            soFar.current = text
            setStreamed(text)
          },
        },
      )
      if (!result.text.trim()) {
        setProblem(
          result.stopReason === 'refusal'
            ? 'The model declined to read these photos.'
            : 'Nothing came back. Try again, or with a clearer photo.',
        )
        setPhase('choose')
        return
      }
      setMadeBy(result.madeBy ?? null)
      finish(result.text, result.stopReason === 'max-tokens' ? 'length' : null)
    } catch (error) {
      if (asking.signal.aborted) {
        // Stopped: keep what came, if anything did.
        if (soFar.current.trim()) finish(soFar.current, 'stopped')
        else setPhase('choose')
        return
      }
      // Broke off part way: what came is kept, with why.
      if (isAiError(error) && error.partial && soFar.current.trim()) {
        if (error.source) setMadeBy(formatSource(error.source))
        setBrokeOff(describeFailure(error))
        finish(soFar.current, 'broken')
        return
      }
      setProblem(describeFailure(error))
      setPhase('choose')
    }
  }

  async function save() {
    await startNote({
      title: title.trim(),
      body: body.trim(),
      subjectId,
    })
  }

  const strip = (
    <ol
      aria-label="Photos"
      className={cn(
        'grid gap-3',
        phase === 'choose'
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-1',
      )}
    >
      {photos.map((photo, index) => (
        <li key={photo.key} className="relative">
          <figure className="overflow-hidden rounded-2xl bg-tint">
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Photo ${index + 1}, full size`}
              className="flex aspect-[4/3] items-center justify-center overflow-hidden"
            >
              <img
                src={photo.url}
                alt=""
                // On white, as it's sent (a transparent screenshot shows).
                className="max-h-full max-w-full bg-white object-contain transition-transform"
                style={{ transform: `rotate(${photo.turns * 90}deg)` }}
              />
            </a>
            {/* On a phone the buttons go on a line of their own. */}
            <figcaption className="flex flex-wrap items-center gap-x-1 px-2.5 py-1.5 text-xs text-fg-subtle">
              <span className="flex min-w-0 basis-full items-baseline gap-1 py-1 sm:flex-1 sm:basis-0">
                <span className="font-semibold text-fg-muted tabular-nums">
                  {index + 1}
                </span>
                <span className={cn('min-w-0', !photo.problem && 'truncate')}>
                  {photo.problem
                    ? photo.problem
                    : photo.prepared
                      ? `${photo.prepared.width} × ${photo.prepared.height}`
                      : 'Getting it ready…'}
                </span>
              </span>
              {phase === 'choose' && (
                <span className="ml-auto flex items-center">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => earlier(photo.key)}
                      aria-label={`Move photo ${index + 1} earlier`}
                      title="Earlier"
                      className="flex size-7 items-center justify-center rounded-full transition hover:bg-line hover:text-fg"
                    >
                      <ArrowLeftIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => rotate(photo.key)}
                    aria-label={`Turn photo ${index + 1}`}
                    title="Turn"
                    className="flex size-7 items-center justify-center rounded-full transition hover:bg-line hover:text-fg"
                  >
                    <RotateIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(photo.key)}
                    aria-label={`Remove photo ${index + 1}`}
                    title="Remove"
                    className="flex size-7 items-center justify-center rounded-full transition hover:bg-line hover:text-fg"
                  >
                    <CloseIcon />
                  </button>
                </span>
              )}
            </figcaption>
          </figure>
        </li>
      ))}
    </ol>
  )

  if (phase !== 'choose')
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-8">{strip}</div>
        {phase === 'writing' ? (
          <section
            aria-label="Writing the note"
            className="rounded-[28px] glass-strong p-5 sm:p-7"
          >
            <div className="flex items-center gap-3">
              <ReplyStatus
                since={since}
                phase={streamed ? 'writing' : 'thinking'}
                writing="Writing your note…"
                className="flex-1 font-medium text-fg-muted"
              />
              <button
                type="button"
                onClick={() => controller.current?.abort()}
                className={secondary}
              >
                Stop
              </button>
            </div>
            <p
              aria-live="polite"
              className="mt-4 max-h-[60dvh] overflow-y-auto text-[15px] whitespace-pre-wrap text-fg-muted"
            >
              {streamed}
            </p>
          </section>
        ) : (
          <section
            aria-label="The note"
            className="rounded-[28px] glass-strong p-5 sm:p-7"
          >
            {cutShort && (
              <p className="mb-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 light:text-amber-800">
                {cutShort === 'length'
                  ? 'The note was cut short: it ran out of room. Try fewer photos at a time.'
                  : cutShort === 'broken'
                    ? (brokeOff ??
                      'It broke off part way: this is what came before.')
                    : 'You stopped it part way: this is what came before.'}
              </p>
            )}
            {madeBy && (
              <p className="mb-3 text-xs text-fg-subtle">Read by {madeBy}.</p>
            )}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              aria-label="Title"
              className="w-full bg-transparent font-serif text-4xl leading-tight tracking-tight outline-none placeholder:text-fg-subtle"
            />
            <div className="mt-4 w-44">
              <SegmentedControl
                label="View"
                value={view}
                options={[
                  { value: 'read', label: 'Read', icon: <EyeIcon /> },
                  { value: 'edit', label: 'Edit', icon: <PencilIcon /> },
                ]}
                onChange={setView}
                compact
              />
            </div>
            <div className="mt-4 border-t border-line pt-4">
              {view === 'read' ? (
                <div className="text-[15px]">
                  <MarkdownView markdown={body} />
                </div>
              ) : (
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  aria-label="Note"
                  rows={16}
                  className="block w-full resize-y rounded-2xl bg-tint p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
                />
              )}
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
                Subject
              </p>
              <SubjectPicker
                value={subjectId}
                onChange={(id) =>
                  setSubjectId((current) => (current === id ? null : id))
                }
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!body.trim() && !title.trim()}
                onClick={() => void save()}
                className={primary}
              >
                Save as a note
              </button>
              <button
                type="button"
                onClick={() => setPhase('choose')}
                className={secondary}
              >
                Back to the photos
              </button>
            </div>
            <p className="mt-3 text-xs text-fg-subtle">
              The photos aren’t kept; only the note is saved.
            </p>
          </section>
        )}
      </div>
    )

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Photos"
        description="Handwritten notes, a whiteboard or slides: one photo a page, in order."
      >
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'space-y-4 rounded-2xl transition',
            dragging && 'ring-2 ring-orange-300/70',
          )}
        >
          {photos.length > 0 && strip}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={photos.length >= MAX_PHOTOS}
              onClick={() => inputRef.current?.click()}
              className={photos.length ? secondary : primary}
            >
              <CameraIcon />
              {photos.length ? 'Add more' : 'Add photos'}
            </button>
            <p className="text-xs text-fg-subtle">
              Or paste or drop pictures here. They stay on this device until you
              send them.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Photos to add"
            onChange={(event) => {
              add(event.target.files ?? [])
              event.target.value = ''
            }}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Make the note"
        description="AI reads the photos and writes them out as markdown, maths in LaTeX; you can edit it before saving."
      >
        {readiness.ready ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!ready}
              onClick={() => setPreviewing(true)}
              className={primary}
            >
              <SparkleIcon /> Make the note…
            </button>
            {photos.length > 0 && !ready && (
              <p className="text-xs text-fg-subtle">
                {photos.some((photo) => photo.problem)
                  ? 'Remove the pictures that couldn’t be opened.'
                  : 'Getting the photos ready…'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Set up a chat model that can read pictures to make notes from
            photos.{' '}
            <button
              type="button"
              onClick={() => openSettings('ai')}
              className="font-semibold text-fg underline-offset-2 hover:underline"
            >
              Settings → AI
            </button>
          </p>
        )}
        {problem && (
          <p className="mt-3 text-sm text-rose-300 light:text-rose-600">
            {problem}
          </p>
        )}
      </SettingsCard>

      {readiness.ready && ready && (
        <SendPreview
          open={previewing}
          onClose={() => setPreviewing(false)}
          title="Make a note from photos"
          purpose={
            <>
              To write the note, the{' '}
              {photos.length === 1 ? 'photo is' : `${photos.length} photos are`}{' '}
              sent with instructions to transcribe them into markdown. Momentum
              doesn’t keep them afterwards.
            </>
          }
          chat
          provider={readiness.provider}
          model={readiness.model}
          items={photos.map((photo, index) => ({
            id: photo.key,
            title: `Photo ${index + 1}`,
            detail: `${photo.prepared!.width} × ${photo.prepared!.height}, ${megabytes(photo.prepared!.bytes)}`,
            icon: <ImageIcon />,
          }))}
          tokens={tokens}
          sendLabel="Send"
          onSend={() => void send()}
        />
      )}
    </div>
  )
}
