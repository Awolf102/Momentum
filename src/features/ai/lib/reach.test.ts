import { describe, expect, it } from 'vitest'
import {
  blockedBeforeSending,
  isLoopback,
  noteRefusal,
  refusedByContentPolicy,
} from './reach'

const safari = (origin: string) => ({ origin, webkit: true })
const chrome = (origin: string) => ({ origin, webkit: false })

describe('reaching a server', () => {
  it('knows this device’s own addresses', () => {
    for (const host of [
      'localhost',
      'LOCALHOST',
      'app.localhost',
      '127.0.0.1',
      '127.1.2.3',
      '[::1]',
    ])
      expect(isLoopback(host)).toBe(true)
    for (const host of [
      'localhost.example.com',
      '192.168.1.5',
      '128.0.0.1',
      'pc.tail1234.ts.net',
    ])
      expect(isLoopback(host)).toBe(false)
  })

  it('lets a page on http reach anything', () => {
    for (const page of [
      safari('http://localhost:4173'),
      chrome('http://localhost:4173'),
    ]) {
      expect(blockedBeforeSending(page, 'http://localhost:11434/v1')).toBeNull()
      expect(blockedBeforeSending(page, 'http://127.0.0.1:8080/v1')).toBeNull()
      expect(
        blockedBeforeSending(page, 'http://192.168.1.5:11434/v1'),
      ).toBeNull()
      expect(
        blockedBeforeSending(page, 'https://pc.tail1234.ts.net/v1'),
      ).toBeNull()
    }
  })

  it('in Safari, blocks plain http from an https page, even to this computer', () => {
    const page = safari('https://momentum.example.com')
    expect(blockedBeforeSending(page, 'http://localhost:11434/v1')).toBe(
      'mixed-content',
    )
    expect(blockedBeforeSending(page, 'http://127.0.0.1:11434/v1')).toBe(
      'mixed-content',
    )
    expect(
      blockedBeforeSending(page, 'https://pc.tail1234.ts.net/v1'),
    ).toBeNull()
  })

  it('in Chrome, lets an https page reach this computer over http, but nothing else', () => {
    const page = chrome('https://momentum.example.com')
    expect(blockedBeforeSending(page, 'http://localhost:11434/v1')).toBeNull()
    expect(blockedBeforeSending(page, 'http://[::1]:11434/v1')).toBeNull()
    expect(blockedBeforeSending(page, 'http://192.168.1.5:11434/v1')).toBe(
      'mixed-content',
    )
    expect(
      blockedBeforeSending(page, 'https://openrouter.ai/api/v1'),
    ).toBeNull()
  })

  it('leaves addresses it can’t read to the request itself', () => {
    expect(
      blockedBeforeSending(safari('https://a.test'), 'localhost:11434'),
    ).toBeNull()
    expect(blockedBeforeSending(safari('null'), 'http://localhost')).toBeNull()
  })

  it('remembers, briefly, what a page policy refused', () => {
    noteRefusal('http://localhost:11434/v1/models', 1000)
    expect(refusedByContentPolicy('http://localhost:11434/v1', 2000)).toBe(true)
    expect(refusedByContentPolicy('http://localhost:11434/v1', 9000)).toBe(
      false,
    )
    expect(refusedByContentPolicy('http://localhost:8080/v1', 2000)).toBe(false)
  })
})
