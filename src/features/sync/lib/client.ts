/**
 * Talking to a sync server (see `server/`): accounts, sessions, and pushing
 * and pulling sealed records. Errors come back as `SyncHttpError`, with the
 * server's code, or as offline when there was no answer.
 */

export interface WireRecord {
  store: string
  id: string
  updatedAt: string
  deleted: boolean
  blob: string
}

export class SyncHttpError extends Error {
  readonly status: number
  /** The server's code ("credentials", "invite", "quota"…), or "offline". */
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface Health {
  ok: boolean
  version: number
  signup: 'invite' | 'open'
  /** The most records in one push or pull, and the largest sealed record. */
  limits?: { batch: number; recordChars: number }
}

/** A server address as typed: https assumed, no trailing slash. */
export function normalizeServer(value: string): string {
  let text = value.trim()
  if (!text) return ''
  // Another scheme (ftp://…) isn't a sync server; none means https.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    if (!/^https?:\/\//i.test(text)) return ''
  } else text = `https://${text}`
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return ''
  }
}

const TIMEOUT_MS = 20_000

export function createClient(server: string, fetcher: typeof fetch = fetch) {
  async function call<T>(
    path: string,
    init: { method?: string; body?: unknown; token?: string } = {},
  ): Promise<T> {
    let response: Response
    try {
      response = await fetcher(`${server}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          ...(init.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new SyncHttpError(
        0,
        'offline',
        'Couldn’t reach the sync server. Check the address and your connection.',
      )
    }
    if (response.status === 204) return undefined as T
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // Not JSON: an error page from something in between.
    }
    if (!response.ok) {
      const error = body as { error?: string; message?: string } | null
      throw new SyncHttpError(
        response.status,
        error?.error ?? 'server',
        error?.message ?? `The sync server answered ${response.status}.`,
      )
    }
    return body as T
  }

  return {
    health: () => call<Health>('/api/health'),
    createAccount: (input: {
      username: string
      secret: string
      invite?: string
      device: string
    }) =>
      call<{ token: string; username: string }>('/api/accounts', {
        method: 'POST',
        body: input,
      }),
    signIn: (input: { username: string; secret: string; device: string }) =>
      call<{ token: string; username: string }>('/api/sessions', {
        method: 'POST',
        body: input,
      }),
    signOut: (token: string) =>
      call<void>('/api/sessions', { method: 'DELETE', token }),
    account: (token: string) =>
      call<{
        username: string
        seq: number
        records: number
        chars: number
        quota: number
      }>('/api/account', { token }),
    deleteAccount: (token: string, secret: string) =>
      call<void>('/api/account', {
        method: 'DELETE',
        token,
        body: { secret },
      }),
    pull: (token: string, since: number) =>
      call<{
        records: Array<WireRecord & { seq: number }>
        seq: number
        more: boolean
      }>(`/api/sync?since=${since}`, { token }),
    push: (token: string, records: WireRecord[]) =>
      call<{
        accepted: number
        rejected: Array<{ store: string; id: string; reason: string }>
        seq: number
      }>('/api/sync', { method: 'POST', token, body: { records } }),
  }
}

export type SyncClient = ReturnType<typeof createClient>
