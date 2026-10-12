import { useEffect, useRef, useState } from 'react'
import {
  EyeIcon,
  MicIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SparkleIcon,
  StopIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import {
  describeAiError,
  PROVIDERS,
  ReplyStatus,
  SendPreview,
  useAiReadiness,
} from '@/features/ai'
import { estimateTokens } from '@/features/ai/material'
import { startNote } from '@/features/notes'
import { MarkdownView } from '@/features/notes/view'
import { SubjectPicker } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { openSettings } from '@/lib/routes'
import {
  audioExtension,
  countWords,
  describeDuration,
  formatDuration,
  MAX_AUDIO_BYTES,
} from '../lib/audio'
import { canRecord, useRecorder, type Recording } from '../recorder'
import { noteFromTranscription } from '../transcribe'
import {
  tidyTranscript,
  TIDY_SYSTEM,
  transcribeRecording,
  voiceNoteTitle,
} from '../voice'

const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:pointer-events-none disabled:opacity-40'

const megabytes = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} kB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`

type Phase = 'record' | 'recorded' | 'transcribing' | 'review'

/** A recording with its length known (or not, for some chosen files). */
interface Held extends Recording {
  url: string
  source: 'recorded' | 'chosen'
}

/**
 * A note from speech: recorded here or a recording chosen, played back,
 * sent through the send preview to the transcription model, and the text
 * that comes back edited (and, if you like, tidied into notes by the chat
 * model) before it's saved. The recording isn't kept.
 */
export function VoiceNote() {
  const transcription = useAiReadiness('transcription')
  const chat = useAiReadiness('chat')
  const [phase, setPhase] = useState<Phase>('record')
  const [held, setHeld] = useState<Held | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<'transcribe' | 'tidy' | null>(
    null,
  )
  const [title, setTitle] = useState('')
  // The title it was given, kept for tidying: a title you chose stays.
  const [givenTitle, setGivenTitle] = useState('')
  const [body, setBody] = useState('')
  const [view, setView] = useState<'read' | 'edit'>('read')
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [tidying, setTidying] = useState(false)
  const [since, setSince] = useState(0)
  // The note as it was before tidying, to go back to.
  const [untidied, setUntidied] = useState<{
    title: string
    body: string
  } | null>(null)
  const [streamed, setStreamed] = useState('')
  const [cutShort, setCutShort] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // The playback address, let go of when it changes or the page closes.
  const url = held?.url
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])
  useEffect(() => () => controller.current?.abort(), [])

  const recorder = useRecorder((recording) => {
    if (recording.blob.size > MAX_AUDIO_BYTES) {
      setProblem(
        `That recording is ${megabytes(recording.blob.size)}; providers take up to 25 MB at a time.`,
      )
      return
    }
    setHeld({
      ...recording,
      url: URL.createObjectURL(recording.blob),
      source: 'recorded',
    })
    setPhase('recorded')
  })

  function choose(file: File) {
    setProblem(null)
    const extension = audioExtension(file.type, file.name)
    if (!extension) {
      setProblem(
        'That isn’t a recording providers can read. Choose an MP3, M4A, WAV, WebM or OGG file.',
      )
      return
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setProblem(
        `That recording is ${megabytes(file.size)}; providers take up to 25 MB at a time.`,
      )
      return
    }
    const fileName = file.name.toLowerCase().endsWith(`.${extension}`)
      ? file.name
      : `recording.${extension}`
    const address = URL.createObjectURL(file)
    // Its length, from the file (a few formats don't say).
    const audio = new Audio()
    audio.preload = 'metadata'
    const hold = (durationMs: number) => {
      setHeld({
        blob: file,
        durationMs,
        fileName,
        url: address,
        source: 'chosen',
      })
      setPhase('recorded')
    }
    audio.onloadedmetadata = () =>
      hold(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0)
    audio.onerror = () => hold(0)
    audio.src = address
  }

  function again() {
    setHeld(null)
    setProblem(null)
    setPhase('record')
  }

  async function transcribe() {
    setPreviewing(null)
    if (!held) return
    setPhase('transcribing')
    setProblem(null)
    const asking = new AbortController()
    controller.current = asking
    try {
      const text = (
        await transcribeRecording(held, { signal: asking.signal })
      ).trim()
      if (!text) {
        setProblem('No words were heard in the recording.')
        setPhase('recorded')
        return
      }
      const named = voiceNoteTitle(new Date())
      setBody(text)
      setTitle(named)
      setGivenTitle(named)
      setUntidied(null)
      setCutShort(false)
      setView('read')
      setPhase('review')
    } catch (error) {
      if (!asking.signal.aborted) setProblem(describeAiError(error))
      setPhase('recorded')
    }
  }

  async function tidy() {
    setPreviewing(null)
    setTidying(true)
    setSince(Date.now())
    setStreamed('')
    setProblem(null)
    const asking = new AbortController()
    controller.current = asking
    const before = { title, body }
    try {
      const result = await tidyTranscript(body, {
        signal: asking.signal,
        onText: setStreamed,
      })
      const note = noteFromTranscription(result.text)
      if (note.body) {
        setBody(note.body)
        // The notes' title replaces only the one it was given.
        const tidiedTitle = note.title
        if (tidiedTitle)
          setTitle((current) =>
            !current.trim() || current === givenTitle ? tidiedTitle : current,
          )
        setUntidied(before)
        setView('read')
      }
      setCutShort(result.stopReason === 'max-tokens')
    } catch (error) {
      if (!asking.signal.aborted) setProblem(describeAiError(error))
    } finally {
      setTidying(false)
    }
  }

  function untidy() {
    if (!untidied) return
    setBody(untidied.body)
    setTitle(untidied.title)
    setUntidied(null)
    setCutShort(false)
  }

  async function save() {
    await startNote({ title: title.trim(), body: body.trim(), subjectId })
  }

  const recordingLine = held
    ? [
        held.durationMs ? formatDuration(held.durationMs) : null,
        megabytes(held.blob.size),
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  if (phase === 'review')
    return (
      <section
        aria-label="The note"
        className="rounded-[28px] glass-strong p-5 sm:p-7"
      >
        {held && (
          <audio
            controls
            src={held.url}
            aria-label="The recording"
            className="mb-5 w-full"
          />
        )}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled"
          aria-label="Title"
          className="w-full bg-transparent font-serif text-4xl leading-tight tracking-tight outline-none placeholder:text-fg-subtle"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="w-44">
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
          <p className="text-xs text-fg-subtle">
            {countWords(body).toLocaleString()} words
            {untidied ? ', tidied into notes' : ', as said'}
          </p>
        </div>
        {cutShort && (
          <p className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 light:text-amber-800">
            The tidied notes were cut short: they ran out of room. The
            transcript as it was is still a click away.
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          {tidying ? (
            <div aria-label="Tidying" className="space-y-3">
              <div className="flex items-center gap-3">
                <ReplyStatus
                  since={since}
                  phase={streamed ? 'writing' : 'thinking'}
                  writing="Tidying it into notes…"
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
              <p className="max-h-[50dvh] overflow-y-auto text-[15px] whitespace-pre-wrap text-fg-muted">
                {streamed}
              </p>
            </div>
          ) : view === 'read' ? (
            <div className="text-[15px]">
              <MarkdownView markdown={body} />
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Note"
              rows={14}
              className="block w-full resize-y rounded-2xl bg-tint p-4 text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
            />
          )}
        </div>
        {!tidying && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            {untidied ? (
              <button type="button" onClick={untidy} className={secondary}>
                Back to the transcript as it was
              </button>
            ) : chat.ready ? (
              <>
                <button
                  type="button"
                  disabled={!body.trim()}
                  onClick={() => setPreviewing('tidy')}
                  className={secondary}
                >
                  <SparkleIcon /> Tidy it into notes…
                </button>
                <p className="text-xs text-fg-subtle">
                  Organises it into headings and points, with{' '}
                  {PROVIDERS[chat.provider].label}.
                </p>
              </>
            ) : null}
          </div>
        )}
        {problem && (
          <p className="mt-3 text-sm text-rose-300 light:text-rose-600">
            {problem}
          </p>
        )}
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
            disabled={tidying || (!body.trim() && !title.trim())}
            onClick={() => void save()}
            className={primary}
          >
            Save as a note
          </button>
          <button
            type="button"
            disabled={tidying}
            onClick={again}
            className={secondary}
          >
            Start again
          </button>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          The recording isn’t kept; only the note is saved.
        </p>
        {chat.ready && (
          <SendPreview
            open={previewing === 'tidy'}
            onClose={() => setPreviewing(null)}
            title="Tidy into notes"
            purpose={
              <>
                To tidy the transcript into notes, its text is sent with
                instructions to organise it into headings and points, keeping
                what was said.
              </>
            }
            provider={chat.provider}
            model={chat.model}
            items={[
              {
                id: 'transcript',
                title: 'The transcript',
                detail: `${countWords(body).toLocaleString()} words`,
                icon: <MicIcon />,
              },
            ]}
            tokens={estimateTokens(body.length + TIDY_SYSTEM.length)}
            sendLabel="Send"
            onSend={() => void tidy()}
          />
        )}
      </section>
    )

  return (
    <div className="space-y-5">
      {phase === 'record' ? (
        <>
          <SettingsCard
            title="Record"
            description="A thought, a summary in your own words, or a lecture: up to an hour."
          >
            {recorder.status === 'recording' || recorder.status === 'paused' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      recorder.status === 'recording'
                        ? 'animate-pulse bg-rose-400'
                        : 'bg-fg-subtle',
                    )}
                  />
                  <p
                    role="timer"
                    className="font-serif text-5xl tracking-tight tabular-nums"
                    aria-label="Recorded so far"
                  >
                    {formatDuration(recorder.elapsed)}
                  </p>
                  <p className="text-sm text-fg-muted" aria-live="polite">
                    {recorder.status === 'recording' ? 'Recording' : 'Paused'}
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-tint"
                  role="meter"
                  aria-label="Loudness"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(recorder.level * 100)}
                >
                  <div
                    className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500 transition-[width] duration-75"
                    style={{ width: `${Math.round(recorder.level * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {recorder.status === 'recording' ? (
                    <button
                      type="button"
                      onClick={recorder.pause}
                      className={secondary}
                    >
                      <PauseIcon /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={recorder.resume}
                      className={secondary}
                    >
                      <PlayIcon /> Resume
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={recorder.stop}
                    className={primary}
                  >
                    <StopIcon /> Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={recorder.status === 'starting'}
                  onClick={() => void recorder.start()}
                  aria-label="Start recording"
                  className="flex size-20 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-300 to-orange-500 text-3xl text-orange-950 shadow-[0_14px_30px_-12px_rgb(249_115_22/0.9)] transition active:scale-95 disabled:opacity-50"
                >
                  <MicIcon />
                </button>
                <p className="max-w-sm text-sm text-fg-muted">
                  {recorder.status === 'starting'
                    ? 'Starting the microphone…'
                    : canRecord()
                      ? 'Start recording. It stays on this device until you send it.'
                      : 'This browser can’t record audio; choose a recording below.'}
                </p>
              </div>
            )}
            {recorder.problem && (
              <p className="mt-3 text-sm text-rose-300 light:text-rose-600">
                {recorder.problem}
              </p>
            )}
          </SettingsCard>
          <SettingsCard
            title="Or a recording you have"
            description="An MP3, M4A, WAV, WebM or OGG file, up to 25 MB: a lecture you recorded, say."
          >
            <button
              type="button"
              disabled={recorder.status !== 'idle'}
              onClick={() => fileRef.current?.click()}
              className={secondary}
            >
              Choose a recording
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.flac"
              hidden
              aria-label="Recording to use"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) choose(file)
              }}
            />
          </SettingsCard>
        </>
      ) : (
        held && (
          <SettingsCard
            title={
              held.source === 'recorded' ? 'Your recording' : 'The recording'
            }
            description={recordingLine}
          >
            <audio
              controls
              src={held.url}
              aria-label="The recording"
              className="w-full"
            />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {phase === 'transcribing' ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-orange-400" />
                  <p className="text-sm font-medium text-fg-muted">
                    Turning speech into text…
                  </p>
                  <button
                    type="button"
                    onClick={() => controller.current?.abort()}
                    className={secondary}
                  >
                    Stop
                  </button>
                </>
              ) : transcription.ready ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewing('transcribe')}
                    className={primary}
                  >
                    <SparkleIcon /> Make the note…
                  </button>
                  <button type="button" onClick={again} className={secondary}>
                    {held.source === 'recorded'
                      ? 'Record again'
                      : 'Choose another'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-fg-muted">
                  Set up transcription (OpenAI or a compatible server) to turn
                  recordings into notes.{' '}
                  <button
                    type="button"
                    onClick={() => openSettings('ai')}
                    className="font-semibold text-fg underline-offset-2 hover:underline"
                  >
                    Settings → AI
                  </button>
                </p>
              )}
            </div>
          </SettingsCard>
        )
      )}
      {problem && (
        <p className="text-sm text-rose-300 light:text-rose-600">{problem}</p>
      )}
      {transcription.ready && held && (
        <SendPreview
          open={previewing === 'transcribe'}
          onClose={() => setPreviewing(null)}
          title="Make a note from a recording"
          purpose={
            <>
              To write the note, the recording is sent to be turned into text.
              Momentum doesn’t keep it afterwards.
            </>
          }
          provider={transcription.provider}
          model={transcription.model}
          items={[
            {
              id: 'recording',
              title:
                held.source === 'recorded' ? 'Your recording' : held.fileName,
              detail: recordingLine,
              icon: <MicIcon />,
            },
          ]}
          tokens={0}
          size={
            held.durationMs
              ? `${describeDuration(held.durationMs)} of audio`
              : megabytes(held.blob.size)
          }
          sendLabel="Send"
          onSend={() => void transcribe()}
        />
      )}
    </div>
  )
}
