import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { LockIcon, RefreshIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import {
  connect,
  deleteServerAccount,
  describeProblem,
  disconnect,
  startSync,
  syncNow,
  syncStatusStore,
  type SyncStatus,
} from '../manager'

const MIN_PASSWORD = 8

const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:pointer-events-none disabled:opacity-40'
const field =
  'w-full rounded-2xl bg-tint px-4 py-2.5 text-sm outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  )
}

const hostOf = (server: string) => {
  try {
    return new URL(server).host
  } catch {
    return server
  }
}

/** Settings → Sync: signing in to a sync server, and how syncing is going. */
export function SyncSettings() {
  const status = useStore(syncStatusStore)
  // Shows how syncing is going when this device is signed in.
  useEffect(() => {
    startSync()
  }, [])
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-fg-muted">
        Sync keeps your tasks, notes, habits and the rest the same on your
        devices, through a sync server you (or someone you trust) run: see
        “Sync” in the README. Your password never leaves this device. It makes
        the key that encrypts everything before it’s sent, so the server can’t
        read any of it.
      </p>
      {status.state === 'on' ? <Connected status={status} /> : <SignIn />}
      <WhatSyncs />
    </div>
  )
}

function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in')
  const [server, setServer] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const creating = mode === 'create'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    if (creating && password.length < MIN_PASSWORD)
      return setProblem(
        `Use a password of at least ${MIN_PASSWORD} characters.`,
      )
    if (creating && password !== confirm)
      return setProblem('The two passwords are different.')
    setBusy(true)
    try {
      await connect({ server, username, password, mode, invite })
    } catch (error) {
      setProblem(describeProblem(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <SegmentedControl
        label="Account"
        value={mode}
        options={[
          { value: 'sign-in', label: 'Sign in' },
          { value: 'create', label: 'Create an account' },
        ]}
        onChange={(value) => {
          setMode(value)
          setProblem(null)
        }}
      />
      <Field label="Server" hint="Its address, like https://sync.example.com.">
        {(id) => (
          <input
            id={id}
            value={server}
            onChange={(event) => setServer(event.target.value)}
            placeholder="https://sync.example.com"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            required
            className={field}
          />
        )}
      </Field>
      <Field label="Username">
        {(id) => (
          <input
            id={id}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={field}
          />
        )}
      </Field>
      <Field
        label="Password"
        hint={
          creating
            ? 'If it’s forgotten, what’s on the server can’t be opened (each device keeps its own copy). A long phrase is best.'
            : undefined
        }
      >
        {(id) => (
          <input
            id={id}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={creating ? 'new-password' : 'current-password'}
            required
            className={field}
          />
        )}
      </Field>
      {creating && (
        <>
          <Field label="The password again">
            {(id) => (
              <input
                id={id}
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
                className={field}
              />
            )}
          </Field>
          <Field
            label="Invite code"
            hint="If the server asks for one: whoever runs it can make one."
          >
            {(id) => (
              <input
                id={id}
                value={invite}
                onChange={(event) => setInvite(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={field}
              />
            )}
          </Field>
        </>
      )}
      {problem && (
        <p role="alert" className="text-sm text-rose-300 light:text-rose-600">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={primary}>
          <LockIcon />
          {busy
            ? creating
              ? 'Making the account…'
              : 'Signing in…'
            : creating
              ? 'Create the account'
              : 'Sign in'}
        </button>
        {busy && (
          <span role="status" className="text-xs text-fg-subtle">
            Making your keys on this device takes a moment.
          </span>
        )}
      </div>
    </form>
  )
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function Connected({
  status,
}: {
  status: Extract<SyncStatus, { state: 'on' }>
}) {
  const { account, syncing, lastSyncedAt, report, problem } = status
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null)
  const passwordId = useId()

  async function remove(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setDeleteProblem(null)
    try {
      await deleteServerAccount(password)
    } catch (error) {
      setDeleteProblem(describeProblem(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-tint px-4 py-3">
        <p className="text-sm">
          Signed in as <strong>{account.username}</strong> on{' '}
          <strong>{hostOf(account.server)}</strong>
        </p>
        <p
          role="status"
          className={cn(
            'mt-1 text-xs',
            problem ? 'text-rose-300 light:text-rose-600' : 'text-fg-muted',
          )}
        >
          {syncing ? (
            'Syncing…'
          ) : problem ? (
            problem.message
          ) : lastSyncedAt ? (
            <>
              Up to date: synced at{' '}
              <time dateTime={lastSyncedAt}>
                {timeFormat.format(new Date(lastSyncedAt))}
              </time>
              .
            </>
          ) : (
            'Not synced yet.'
          )}
        </p>
        {report && report.tooLarge.length > 0 && (
          <p className="mt-1 text-xs text-fg-muted">
            {report.tooLarge.length === 1
              ? '1 record is'
              : `${report.tooLarge.length} records are`}{' '}
            too large to sync (a very long note or calendar), so{' '}
            {report.tooLarge.length === 1 ? 'it stays' : 'they stay'} on this
            device.
          </p>
        )}
        {report && report.rejected > 0 && (
          <p className="mt-1 text-xs text-amber-200 light:text-amber-700">
            This device’s clock is ahead of the server’s, so{' '}
            {report.rejected === 1 ? 'a change' : `${report.rejected} changes`}{' '}
            from it {report.rejected === 1 ? 'is' : 'are'} held back. Set the
            clock right and it will go.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className={primary}
        >
          <RefreshIcon />
          Sync now
        </button>
        <button
          type="button"
          onClick={() => void disconnect()}
          className={secondary}
        >
          Sign out
        </button>
      </div>
      <p className="text-xs text-fg-subtle">
        Signing out keeps everything on this device; the server keeps its copy
        for your other devices.
      </p>
      {deleting ? (
        <form
          onSubmit={(event) => void remove(event)}
          className="space-y-2 rounded-2xl border border-rose-400/30 p-4"
        >
          <label htmlFor={passwordId} className="text-sm font-medium">
            Your password, to delete the account and everything synced to it
            from the server
          </label>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className={field}
          />
          {deleteProblem && (
            <p
              role="alert"
              className="text-sm text-rose-300 light:text-rose-600"
            >
              {deleteProblem}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
            >
              Delete from the server
            </button>
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className={secondary}
            >
              Keep it
            </button>
          </div>
          <p className="text-xs text-fg-subtle">
            Your devices keep what’s on them.
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="text-xs font-semibold text-rose-300 underline-offset-2 hover:underline light:text-rose-600"
        >
          Delete the account from the server…
        </button>
      )}
    </div>
  )
}

function WhatSyncs() {
  return (
    <details className="group rounded-2xl bg-tint px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">
        What syncs, and what stays on each device
      </summary>
      <div className="mt-2 space-y-2 text-fg-muted">
        <p>
          <strong className="text-fg">Synced:</strong> tasks, notes, habits and
          check-ins, routines, focus sessions and subjects, the log, goals, the
          plan and imported calendars, cards and their reviews, quizzes, the
          inbox, conversations with the assistant, the library’s documents and
          highlights, your weekly write-ups, and the settings for focus, cards
          and the weekly review.
        </p>
        <p>
          <strong className="text-fg">On each device:</strong> API keys, PDF
          files and photos (add a PDF again on another device to read it there),
          appearance, sound, reminders, AI setup, and the search-by-meaning
          index, which each device builds.
        </p>
        <p>
          Deleting things one by one syncs; clearing everything in Settings →
          Data clears this device only.
        </p>
      </div>
    </details>
  )
}
