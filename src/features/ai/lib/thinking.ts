/**
 * Some servers send a model's thinking in the reply itself, as a
 * `<think>…</think>` block before the answer (rather than apart, as Ollama
 * does). This takes it out as the text streams in, piece by piece, so only
 * the answer is shown and kept, and says while the model is thinking.
 */
const OPEN = '<think>'
const CLOSE = '</think>'

export interface ThinkSplit {
  /** Whether this piece was (or ended) the model's thinking. */
  thinking: boolean
  /** The answer's text in this piece, if any. */
  text: string
}

export interface ThinkSplitter {
  push(piece: string): ThinkSplit
  /** What's held back at the end, when it turned out not to be thinking. */
  flush(): string
}

export function createThinkSplitter(): ThinkSplitter {
  let state: 'start' | 'thinking' | 'answer' = 'start'
  let held = ''
  // The answer's leading blank lines (after a think block) are dropped.
  let trimming = false

  function answer(text: string): ThinkSplit {
    if (trimming) {
      text = text.replace(/^\s+/, '')
      if (text) trimming = false
    }
    return { thinking: false, text }
  }

  return {
    push(piece) {
      if (state === 'answer') return answer(piece)
      held += piece
      if (state === 'start') {
        const start = held.trimStart()
        // Not enough yet to tell whether a think block is starting.
        if (start.length < OPEN.length && OPEN.startsWith(start))
          return { thinking: false, text: '' }
        if (!start.startsWith(OPEN)) {
          state = 'answer'
          const text = held
          held = ''
          return { thinking: false, text }
        }
        state = 'thinking'
        held = start.slice(OPEN.length)
      }
      const end = held.indexOf(CLOSE)
      if (end === -1) {
        // Keep enough to find a closing tag split across pieces.
        held = held.slice(-(CLOSE.length - 1))
        return { thinking: true, text: '' }
      }
      const rest = held.slice(end + CLOSE.length)
      held = ''
      state = 'answer'
      trimming = true
      return { thinking: true, text: answer(rest).text }
    },
    flush() {
      // A reply that was only ever thinking (cut off part way) has no answer.
      const text = state === 'start' ? held : ''
      held = ''
      return text
    },
  }
}
