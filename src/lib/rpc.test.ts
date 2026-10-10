import { describe, expect, it } from 'vitest'
import {
  connect,
  emit,
  expose,
  withTransfer,
  WorkerError,
  type Port,
} from './rpc'

/** Two ends of a MessageChannel, as a page and its worker would have. */
function pair(): [page: Port, worker: Port] {
  const channel = new MessageChannel()
  channel.port1.start()
  channel.port2.start()
  return [channel.port1, channel.port2]
}

describe('rpc', () => {
  it('calls exposed functions and returns their results', async () => {
    const [page, worker] = pair()
    const handlers = {
      add: (a: number, b: number) => a + b,
      greet: async (name: string) => `Hello, ${name}`,
    }
    expose(handlers, worker)
    const remote = connect<typeof handlers>(page)
    expect(await remote.call('add', 2, 3)).toBe(5)
    expect(await remote.call('greet', 'Ada')).toBe('Hello, Ada')
  })

  it('passes errors back with their name and code', async () => {
    const [page, worker] = pair()
    const handlers = {
      fail: () => {
        const error = new Error('Out of space') as Error & { code: string }
        error.name = 'QuotaError'
        error.code = 'quota'
        throw error
      },
    }
    expose(handlers, worker)
    const remote = connect<typeof handlers>(page)
    const error = await remote.call('fail').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WorkerError)
    expect(error).toMatchObject({
      name: 'QuotaError',
      message: 'Out of space',
      code: 'quota',
    })
  })

  it('delivers events while a call runs, and moves marked buffers', async () => {
    const [page, worker] = pair()
    const handlers = {
      work: async () => {
        emit(worker, 'progress', { done: 1, total: 2 })
        const data = new Float32Array([1, 2, 3])
        return withTransfer({ data }, [data.buffer])
      },
    }
    expose(handlers, worker)
    const remote = connect<typeof handlers>(page)
    const events: unknown[] = []
    remote.on('progress', (data) => events.push(data))
    const result = await remote.call('work')
    expect(Array.from(result.data)).toEqual([1, 2, 3])
    expect(events).toEqual([{ done: 1, total: 2 }])
  })

  it('rejects calls still waiting when closed', async () => {
    const [page, worker] = pair()
    const handlers = { slow: () => new Promise<void>(() => {}) }
    expose(handlers, worker)
    const remote = connect<typeof handlers>(page)
    const waiting = remote.call('slow')
    remote.close()
    await expect(waiting).rejects.toMatchObject({ code: 'closed' })
  })
})
