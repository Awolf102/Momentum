import { describe, expect, it, vi } from 'vitest'
import { fitWithin, imageTokens, PHOTO_LIMITS, turned } from './lib/image'
import {
  noteFromTranscription,
  transcribe,
  transcribeContent,
  TRANSCRIBE_SYSTEM,
} from './transcribe'

const sent = vi.hoisted(() => ({
  requests: [] as unknown[],
  chunks: [] as string[],
  stopReason: 'end',
}))

vi.mock('@/features/ai', () => ({
  ai: {
    async *chat(request: unknown) {
      sent.requests.push(request)
      for (const text of sent.chunks) yield { type: 'text', text }
      yield { type: 'done', stopReason: sent.stopReason }
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
