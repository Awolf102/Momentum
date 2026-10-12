import { describe, expect, it } from 'vitest'
import { createThinkSplitter } from './thinking'

/** Pushes pieces through a splitter: the answer, and how many were thinking. */
function run(pieces: string[]) {
  const splitter = createThinkSplitter()
  let text = ''
  let thinking = 0
  for (const piece of pieces) {
    const split = splitter.push(piece)
    text += split.text
    if (split.thinking) thinking++
  }
  return { text: text + splitter.flush(), thinking }
}

describe('a <think> block in the reply', () => {
  it('is taken out, even split across pieces', () => {
    expect(run(['<think>Hmm.</think>\n\nThe answer.'])).toEqual({
      text: 'The answer.',
      thinking: 1,
    })
    expect(
      run(['  <th', 'ink>a', 'b</thi', 'nk>', '\n', '\nAn', 'swer']),
    ).toEqual({ text: 'Answer', thinking: 3 })
  })

  it('leaves a reply without one alone, including one that starts with <', () => {
    expect(run(['Hello ', 'there'])).toEqual({
      text: 'Hello there',
      thinking: 0,
    })
    expect(run(['<b>', 'bold</b>'])).toEqual({
      text: '<b>bold</b>',
      thinking: 0,
    })
    expect(run(['<th', 'ese are tags>'])).toEqual({
      text: '<these are tags>',
      thinking: 0,
    })
    // Only a block at the start is thinking; one later on is the answer's.
    expect(run(['A <think> tag'])).toEqual({
      text: 'A <think> tag',
      thinking: 0,
    })
  })

  it('gives no answer for a reply that never stopped thinking', () => {
    expect(run(['<think>On and on', ' and on'])).toEqual({
      text: '',
      thinking: 2,
    })
  })

  it('hands back a reply too short to tell', () => {
    expect(run(['<th'])).toEqual({ text: '<th', thinking: 0 })
    expect(run(['\n'])).toEqual({ text: '\n', thinking: 0 })
  })

  it('takes out an empty block, as a model told not to think may send', () => {
    expect(run(['<think>\n\n</think>\n\n', 'Straight to it.'])).toEqual({
      text: 'Straight to it.',
      thinking: 1,
    })
  })
})
