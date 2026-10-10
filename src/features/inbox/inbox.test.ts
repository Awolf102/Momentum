import { afterEach, describe, expect, it } from 'vitest'
import { capture, dismiss, inboxItems } from './items'
import { displayUrl, findUrl, fromShare, safeUrl } from './lib/share'

afterEach(() => inboxItems.clear())

const share = (params: Record<string, string>) =>
  fromShare(new URLSearchParams(params))

describe('sharing to Momentum', () => {
  it('combines what apps send, without repeats', () => {
    expect(
      share({ title: 'Lecture 5 slides', url: 'https://uni.example/l5.pdf' }),
    ).toEqual({ text: 'Lecture 5 slides', url: 'https://uni.example/l5.pdf' })
    // Some apps put the link in the text.
    expect(
      share({ title: 'Great article', text: 'https://blog.example/post' }),
    ).toEqual({ text: 'Great article', url: 'https://blog.example/post' })
    expect(share({ text: 'Buy more index cards' })).toEqual({
      text: 'Buy more index cards',
      url: null,
    })
    expect(share({ title: 'Same', text: 'Same' })?.text).toBe('Same')
    // Only a link: the link is the text too.
    expect(share({ url: 'https://example.com/' })).toEqual({
      text: 'https://example.com/',
      url: 'https://example.com/',
    })
    expect(share({})).toBeNull()
  })

  it('only keeps ordinary web links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,hi')).toBeNull()
    expect(safeUrl('https://example.com')).toBe('https://example.com/')
    expect(
      share({ text: 'see this', url: 'javascript:alert(1)' })?.url,
    ).toBeNull()
  })

  it('finds a link in text, leaving the sentence its full stop', () => {
    expect(findUrl('Read https://example.com/a.')).toBe('https://example.com/a')
    expect(findUrl('nothing here')).toBeNull()
    expect(displayUrl('https://www.example.com/docs/page?x=1')).toBe(
      'example.com/docs/page',
    )
  })
})

describe('the inbox', () => {
  it('captures text, picking out a link, and dismisses', async () => {
    const item = await capture('  Check https://example.com/x for the lab  ')
    expect(item).toMatchObject({
      text: 'Check https://example.com/x for the lab',
      url: 'https://example.com/x',
      source: 'typed',
    })
    expect(await capture('   ')).toBeNull()
    await dismiss(item!.id)
    expect(inboxItems.get()).toHaveLength(0)
  })
})
