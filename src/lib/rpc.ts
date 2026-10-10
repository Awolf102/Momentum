/**
 * A small typed RPC for Web Workers. The worker `expose`s functions, and the
 * page `connect`s to it and calls them as async functions. While it works,
 * the worker can also `emit` events, such as download progress.
 */

/** The functions a worker offers. */
export type Handlers = Record<string, (...args: never[]) => unknown>

/** An error from the worker, with the fields that survive postMessage. */
export class WorkerError extends Error {
  /** A machine-readable reason, if the worker gave one. */
  readonly code?: string

  constructor(message: string, name = 'Error', code?: string) {
    super(message)
    this.name = name
    this.code = code
  }
}

interface CallMessage {
  type: 'call'
  id: number
  method: string
  args: unknown[]
}

type ReplyMessage =
  | { type: 'reply'; id: number; ok: true; value: unknown }
  | {
      type: 'reply'
      id: number
      ok: false
      error: { name: string; message: string; code?: string }
    }

interface EventMessage {
  type: 'event'
  name: string
  data: unknown
}

/** The parts of a worker (or its global scope) that RPC needs. */
export interface Port {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
  ): void
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
  ): void
}

const transfers = new WeakMap<object, Transferable[]>()

/** Marks a result's buffers to be moved to the page, not copied. */
export function withTransfer<T extends object>(
  value: T,
  list: Transferable[],
): T {
  transfers.set(value, list)
  return value
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const { code } = error as { code?: unknown }
    return {
      name: error.name,
      message: error.message,
      code: typeof code === 'string' ? code : undefined,
    }
  }
  return { name: 'Error', message: String(error) }
}

/** In a worker: answers calls to `handlers` until the worker is closed. */
export function expose(handlers: Handlers, port: Port): void {
  port.addEventListener('message', (event) => {
    const message = event.data as CallMessage
    if (message?.type !== 'call') return
    const handler = handlers[message.method] as
      ((...args: unknown[]) => unknown) | undefined
    void (async () => {
      try {
        if (!handler) throw new Error(`No method "${message.method}".`)
        const value = await handler(...message.args)
        const list =
          typeof value === 'object' && value !== null
            ? transfers.get(value)
            : undefined
        port.postMessage(
          { type: 'reply', id: message.id, ok: true, value } as ReplyMessage,
          list ?? [],
        )
      } catch (error) {
        port.postMessage({
          type: 'reply',
          id: message.id,
          ok: false,
          error: serializeError(error),
        } as ReplyMessage)
      }
    })()
  })
}

/** In a worker: tells the page something, e.g. how a download is going. */
export function emit(port: Port, name: string, data: unknown): void {
  port.postMessage({ type: 'event', name, data } as EventMessage)
}

export interface Connection<H extends Handlers> {
  call<K extends keyof H & string>(
    method: K,
    ...args: Parameters<H[K]>
  ): Promise<Awaited<ReturnType<H[K]>>>
  /** Listens for the worker's events of one name. */
  on(name: string, listener: (data: unknown) => void): () => void
  /** Rejects calls still waiting, and stops listening. */
  close(reason?: string): void
}

/** On the page: calls a worker's exposed functions. */
export function connect<H extends Handlers>(port: Port): Connection<H> {
  let next = 0
  const pending = new Map<
    number,
    { resolve: (value: never) => void; reject: (error: Error) => void }
  >()
  const listeners = new Map<string, Set<(data: unknown) => void>>()

  function onMessage(event: MessageEvent) {
    const message = event.data as ReplyMessage | EventMessage
    if (message?.type === 'event') {
      for (const listener of listeners.get(message.name) ?? [])
        listener(message.data)
      return
    }
    if (message?.type !== 'reply') return
    const call = pending.get(message.id)
    if (!call) return
    pending.delete(message.id)
    if (message.ok) call.resolve(message.value as never)
    else {
      const { message: text, name, code } = message.error
      call.reject(new WorkerError(text, name, code))
    }
  }
  port.addEventListener('message', onMessage)

  return {
    call(method, ...args) {
      const id = next++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        port.postMessage({ type: 'call', id, method, args } as CallMessage)
      })
    },
    on(name, listener) {
      const set = listeners.get(name) ?? new Set()
      set.add(listener)
      listeners.set(name, set)
      return () => set.delete(listener)
    },
    close(reason = 'The worker was stopped.') {
      port.removeEventListener('message', onMessage)
      for (const call of pending.values())
        call.reject(new WorkerError(reason, 'AbortError', 'closed'))
      pending.clear()
      listeners.clear()
    },
  }
}
