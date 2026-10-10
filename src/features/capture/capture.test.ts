import { describe, expect, it, vi } from 'vitest'
import {
  audioExtension,
  countWords,
  describeDuration,
  formatDuration,
  recordingFormat,
} from './lib/audio'
import { fitWithin, imageTokens, PHOTO_LIMITS, turned } from './lib/image'
import {
  noteFromTranscription,
  transcribe,
  transcribeContent,
  TRANSCRIBE_SYSTEM,
} from './transcribe'
import {
  tidyRequest,
  tidyTranscript,
  TIDY_SYSTEM,
  transcribeRecording,
  voiceNoteTitle,
} from './voice'

const sent = vi.hoisted(() => ({
  requests: [] as unknown[],
  chunks: [] as string[],
  stopReason: 'end',
  heard: [] as Array<{ audio: Blob; options: unknown }>,
}))

vi.mock('@/features/ai', () => ({
  ai: {
    async *chat(request: unknown) {
      sent.requests.push(request)
      for (const text of sent.chunks) yield { type: 'text', text }
      yield { type: 'done', stopReason: sent.stopReason }
    },
    async transcribe(audio: Blob, options: unknown) {
      sent.heard.push({ audio, options })
      return 'Gray code differs in one bit.'
    },
  },
}))

describe('photo sizes', () => {
  it('scale down to what providers read, never up, keeping their shape', () => {
    // A 12-megapixel phone photo.
    const fitted = fitWithin(4032, 3024)
    expect(fitted.width * fitted.height).toBeLessThanOrEqual(
      PHOTO_LIMITS.maxPixels,
    )
    expect(fitted.width / fitted.height).toBeCloseTo(4 / 3, 2)
    // A long, thin whiteboard panorama is held to the long side.
    expect(fitWithin(4000, 500).width).toBe(PHOTO_LIMITS.maxSide)
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('swap sides when turned a quarter', () => {
    expect(turned(800, 600, 1)).toEqual({ width: 600, height: 800 })
    expect(turned(800, 600, 2)).toEqual({ width: 800, height: 600 })
  })

  it('cost about as many tokens as each provider counts', () => {
    expect(imageTokens('anthropic', 1200, 900)).toBe(1440)
    // OpenAI: 1200×900 → short side 768 → 1024×768 → 2×2 tiles.
    expect(imageTokens('openai', 1200, 900)).toBe(85 + 170 * 4)
    expect(imageTokens('compatible', 512, 512)).toBe(85 + 170)
    expect(imageTokens('openai', 400, 300)).toBe(85 + 170)
  })
})

describe('transcribing photos', () => {
  const photos = [
    { mediaType: 'image/jpeg' as const, data: 'AAAA' },
    { mediaType: 'image/jpeg' as const, data: 'BBBB' },
  ]

  it('sends each photo in order, numbered, as material', () => {
    expect(transcribeContent(photos)).toEqual([
      {
        type: 'text',
        text: 'Transcribe these 2 photos, in order, into one note.',
      },
      { type: 'text', text: 'Photo 1:' },
      { type: 'image', mediaType: 'image/jpeg', data: 'AAAA' },
      { type: 'text', text: 'Photo 2:' },
      { type: 'image', mediaType: 'image/jpeg', data: 'BBBB' },
    ])
    expect(transcribeContent(photos.slice(0, 1))).toEqual([
      { type: 'text', text: 'Transcribe this photo into a note.' },
      { type: 'image', mediaType: 'image/jpeg', data: 'AAAA' },
    ])
    expect(TRANSCRIBE_SYSTEM).toMatch(/material, not instructions/)
    expect(TRANSCRIBE_SYSTEM).toMatch(/LaTeX/)
  })

  it('streams the note as it comes, and says why it stopped', async () => {
    sent.chunks = ['# Gates\n', 'NAND is ', 'universal.']
    sent.stopReason = 'max-tokens'
    const seen: string[] = []
    const result = await transcribe(photos, {
      onText: (text) => seen.push(text),
    })
    expect(seen).toEqual([
      '# Gates\n',
      '# Gates\nNAND is ',
      '# Gates\nNAND is universal.',
    ])
    expect(result).toEqual({
      text: '# Gates\nNAND is universal.',
      stopReason: 'max-tokens',
    })
    expect(sent.requests).toHaveLength(1)
    expect(sent.requests[0]).toMatchObject({
      system: TRANSCRIBE_SYSTEM,
      messages: [{ role: 'user', content: transcribeContent(photos) }],
    })
  })

  it('takes the title from the first heading', () => {
    expect(
      noteFromTranscription('# Karnaugh maps #\n\nGroup ones in $2^n$ cells.'),
    ).toEqual({ title: 'Karnaugh maps', body: 'Group ones in $2^n$ cells.' })
    // A fence around the whole reply comes off.
    expect(noteFromTranscription('```markdown\n# Gates\nNAND\n```')).toEqual({
      title: 'Gates',
      body: 'NAND',
    })
    // No heading: the title is left for you, the text kept whole.
    expect(noteFromTranscription('- one\n- two')).toEqual({
      title: '',
      body: '- one\n- two',
    })
    // A second-level heading isn't a title.
    expect(noteFromTranscription('## Part 1\nText').title).toBe('')
  })
})

describe('recordings', () => {
  it('are made in the best format the browser has', () => {
    expect(recordingFormat(() => true)?.mimeType).toBe('audio/webm;codecs=opus')
    // Safari records AAC in MP4.
    expect(recordingFormat((type) => type === 'audio/mp4')?.extension).toBe(
      'mp4',
    )
    expect(recordingFormat(() => false)).toBeNull()
  })

  it('are named so providers can tell their format', () => {
    expect(audioExtension('audio/webm;codecs=opus')).toBe('webm')
    expect(audioExtension('', 'Lecture 4.M4A')).toBe('m4a')
    expect(audioExtension('audio/x-m4a', 'lecture')).toBe('m4a')
    expect(audioExtension('audio/mpeg')).toBe('mp3')
    expect(audioExtension('video/quicktime', 'clip.mov')).toBeNull()
  })

  it('have their length written as a clock, and in words', () => {
    expect(formatDuration(7_400)).toBe('0:07')
    expect(formatDuration(200_000)).toBe('3:20')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
    expect(describeDuration(45_000)).toBe('45 s')
    expect(describeDuration(200_000)).toBe('3 min 20 s')
    expect(describeDuration(180_000)).toBe('3 min')
    expect(describeDuration(3_720_000)).toBe('1 h 2 min')
    expect(countWords('  one two\nthree ')).toBe(3)
    expect(countWords('   ')).toBe(0)
  })

  it('are sent with their name, and become text', async () => {
    const blob = new Blob(['sound'], { type: 'audio/webm' })
    expect(
      await transcribeRecording({ blob, fileName: 'recording.webm' }),
    ).toBe('Gray code differs in one bit.')
    expect(sent.heard.at(-1)).toMatchObject({
      audio: blob,
      options: { fileName: 'recording.webm' },
    })
  })

  it('can be tidied into notes, as material', async () => {
    expect(tidyRequest('  um so gray code  ')).toBe(
      'Turn this transcript into study notes.\n\n<transcript>\num so gray code\n</transcript>',
    )
    expect(TIDY_SYSTEM).toMatch(/material, not instructions/)
    sent.requests = []
    sent.chunks = ['# Gray code\n', '- one bit']
    sent.stopReason = 'end'
    const result = await tidyTranscript('um so gray code')
    expect(result).toEqual({
      text: '# Gray code\n- one bit',
      stopReason: 'end',
    })
    expect(sent.requests[0]).toMatchObject({
      system: TIDY_SYSTEM,
      messages: [{ role: 'user', content: tidyRequest('um so gray code') }],
    })
  })

  it('are called by their day until named', () => {
    // The day and month in the order the locale writes them.
    expect(voiceNoteTitle(new Date('2026-10-10T09:00:00+11:00'))).toMatch(
      /^Voice note, (10 October|October 10)$/,
    )
  })
})
