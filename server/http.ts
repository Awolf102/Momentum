import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import {
  Attempts,
  AuthError,
  checkAccount,
  createAccount,
  createSession,
  deleteAccount,
  deleteSession,
  findSession,
  normalizeUsername,
  type Signup,
} from './auth.ts'
import {
  DEFAULT_LIMITS,
  pull,
  push,
  SyncError,
  usage,
  type Limits,
} from './sync.ts'

/** The protocol's version, so the app can tell an older server. */
export const VERSION = 1

export interface ServerOptions {
  db: DatabaseSync
  signup: Signup
  /** Origins the app may call from; "*" for any. */
  origins: readonly string[]
  limits?: Limits
  /** The largest request body, in bytes. */
  maxBody?: number
  /** One line per request: method, path, status, time. Never bodies or tokens. */
  log?: (line: string) => void
}

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const AUTH_STATUS: Record<string, number> = {
  credentials: 401,
  invite: 403,
  taken: 409,
  username: 400,
  invalid: 400,
}
const SYNC_STATUS: Record<string, number> = {
  record: 400,
  batch: 413,
  size: 413,
  quota: 507,
  account: 404,
}

function send(response: ServerResponse, status: number, body?: unknown) {
  response.statusCode = status
  if (body === undefined) {
    response.end()
    return
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function cors(
  request: IncomingMessage,
  response: ServerResponse,
  origins: readonly string[],
) {
  const origin = request.headers.origin
  if (origins.includes('*'))
    response.setHeader('Access-Control-Allow-Origin', '*')
  else if (origin && origins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type',
  )
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, DELETE, OPTIONS',
  )
  response.setHeader('Access-Control-Max-Age', '600')
}

/** The request's JSON body, up to `max` bytes. */
async function readJson(
  request: IncomingMessage,
  max: number,
): Promise<Record<string, unknown>> {
  const declared = Number(request.headers['content-length'] ?? 0)
  if (declared > max) {
    request.resume()
    throw new HttpError(413, 'body', 'The request is too large.')
  }
  const chunks: Buffer[] = []
  let size = 0
  let tooLarge = false
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > max) tooLarge = true
    else chunks.push(chunk as Buffer)
  }
  if (tooLarge) throw new HttpError(413, 'body', 'The request is too large.')
  try {
    const value: unknown = JSON.parse(
      Buffer.concat(chunks).toString('utf8') || '{}',
    )
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new Error('not an object')
    return value as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'json', 'The request is not JSON.')
  }
}

const bearer = (request: IncomingMessage) => {
  const header = request.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}
const device = (body: Record<string, unknown>) =>
  typeof body.device === 'string' ? body.device : ''

/** The sync server: accounts, sessions, and each account's records. */
export function createSyncServer(options: ServerOptions): Server {
  const { db, signup, origins } = options
  const limits = options.limits ?? DEFAULT_LIMITS
  const maxBody = options.maxBody ?? 16 * 1024 * 1024
  const log = options.log ?? (() => {})
  const byName = new Attempts(10, 15 * 60_000)
  const byAddress = new Attempts(60, 15 * 60_000)

  function limit(request: IncomingMessage, username: unknown) {
    const address = request.socket.remoteAddress ?? ''
    const name = typeof username === 'string' ? normalizeUsername(username) : ''
    if (!byAddress.allow(`address:${address}`) || !byName.allow(`name:${name}`))
      throw new HttpError(
        429,
        'slow-down',
        'Too many tries. Wait a few minutes.',
      )
  }

  function session(request: IncomingMessage): {
    userId: number
    token: string
  } {
    const token = bearer(request)
    const userId = findSession(db, token)
    if (userId === null)
      throw new HttpError(
        401,
        'session',
        'Sign in again: the session has ended.',
      )
    return { userId, token }
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? '/', 'http://momentum.invalid')
    switch (`${request.method} ${url.pathname}`) {
      case 'GET /api/health':
        return send(response, 200, {
          ok: true,
          version: VERSION,
          signup,
          limits: { batch: limits.batch, recordChars: limits.recordChars },
        })
      case 'POST /api/accounts': {
        const body = await readJson(request, 64 * 1024)
        limit(request, body.username)
        const userId = createAccount(db, body, signup)
        return send(response, 201, {
          token: createSession(db, userId, device(body)),
          username: normalizeUsername(String(body.username)),
        })
      }
      case 'POST /api/sessions': {
        const body = await readJson(request, 64 * 1024)
        limit(request, body.username)
        const userId = checkAccount(db, body)
        return send(response, 201, {
          token: createSession(db, userId, device(body)),
          username: normalizeUsername(String(body.username)),
        })
      }
      case 'DELETE /api/sessions': {
        const { token } = session(request)
        deleteSession(db, token)
        return send(response, 204)
      }
      case 'GET /api/account': {
        const { userId } = session(request)
        const row = db
          .prepare('SELECT username, seq FROM users WHERE id = ?')
          .get(userId)
        return send(response, 200, {
          username: String(row?.username ?? ''),
          seq: Number(row?.seq ?? 0),
          ...usage(db, userId),
          quota: limits.quotaChars,
        })
      }
      case 'DELETE /api/account': {
        const { userId } = session(request)
        const body = await readJson(request, 64 * 1024)
        const row = db
          .prepare('SELECT username FROM users WHERE id = ?')
          .get(userId)
        limit(request, row?.username)
        // The password again, so a stolen session can't delete everything.
        checkAccount(db, { username: row?.username, secret: body.secret })
        deleteAccount(db, userId)
        return send(response, 204)
      }
      case 'GET /api/sync': {
        const { userId } = session(request)
        return send(
          response,
          200,
          pull(
            db,
            userId,
            Number(url.searchParams.get('since') ?? 0),
            Number(url.searchParams.get('limit') ?? limits.batch),
            limits,
          ),
        )
      }
      case 'POST /api/sync': {
        const { userId } = session(request)
        const body = await readJson(request, maxBody)
        return send(response, 200, push(db, userId, body.records, limits))
      }
      default:
        throw new HttpError(404, 'not-found', 'There’s nothing here.')
    }
  }

  return createServer(async (request, response) => {
    const started = Date.now()
    cors(request, response, origins)
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    try {
      if (request.method === 'OPTIONS') send(response, 204)
      else await handle(request, response)
    } catch (error) {
      const known =
        error instanceof HttpError
          ? error
          : error instanceof AuthError
            ? new HttpError(
                AUTH_STATUS[error.code] ?? 400,
                error.code,
                error.message,
              )
            : error instanceof SyncError
              ? new HttpError(
                  SYNC_STATUS[error.code] ?? 400,
                  error.code,
                  error.message,
                )
              : null
      if (!known) console.error('[momentum-sync]', error)
      if (!response.headersSent)
        send(
          response,
          known?.status ?? 500,
          known
            ? { error: known.code, message: known.message }
            : {
                error: 'server',
                message: 'Something went wrong on the server.',
              },
        )
    } finally {
      const path = (request.url ?? '/').split('?')[0]
      log(
        `${request.method} ${path} ${response.statusCode} ${Date.now() - started} ms`,
      )
    }
  })
}
