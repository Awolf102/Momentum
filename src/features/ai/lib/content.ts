import type { ChatMessage } from '../types'

/** A message's text, with any pictures left out. */
export function textOf(content: ChatMessage['content']): string {
  return typeof content === 'string'
    ? content
    : content.map((part) => (part.type === 'text' ? part.text : '')).join('')
}
