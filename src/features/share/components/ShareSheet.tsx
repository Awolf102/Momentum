import { useEffect, useRef, useState } from 'react'
import { CopyIcon, DownloadIcon, ShareIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Sheet } from '@/components/Sheet'
import { useCurrentBackground, useLight } from '@/features/appearance'
import { useStreak } from '@/features/streak'
import { formatDateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { loadCardBackground } from '../lib/loadBackground'
import { shareMessage, shareText } from '../lib/message'
import {
  CARD_SIZES,
  loadCardFonts,
  renderCard,
  type CardBackground,
  type CardFormat,
} from '../lib/renderCard'
import { closeShare, shareOpenStore } from '../store'

const FORMATS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
  { value: 'story', label: 'Story' },
] as const satisfies readonly { value: CardFormat; label: string }[]

export function ShareSheet() {
  const open = useStore(shareOpenStore)
  return (
    <Sheet open={open} onClose={closeShare} title="Share your streak">
      {open && <ShareCard />}
    </Sheet>
  )
}

function ShareCard() {
  const background = useCurrentBackground()
  const light = useLight()
  const { current, today } = useStreak()
  const [format, setFormat] = useState<CardFormat>('portrait')
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef<{ id: string; background: CardBackground } | null>(null)
  // Read the light when a background loads, without re-rendering the card every minute.
  const lightRef = useRef(light)
  useEffect(() => {
    lightRef.current = light
  })

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    async function render() {
      await loadCardFonts()
      if (loaded.current?.id !== background.id) {
        loaded.current = {
          id: background.id,
          background: await loadCardBackground(background, lightRef.current),
        }
      }
      const canvas = document.createElement('canvas')
      renderCard(canvas, format, loaded.current.background, {
        streak: current,
        message: shareMessage(current),
        footnote: formatDateKey(today, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      })
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ blob, url })
    }
    render().catch((caught: unknown) => {
      console.error('[momentum] Could not create the share card.', caught)
      if (!cancelled)
        setError('Could not create the image. Try another background.')
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [format, background, current, today])

  const fileName = `momentum-${current}-day-streak.png`
  const file = image
    ? new File([image.blob], fileName, { type: 'image/png' })
    : null
  const canShareFile =
    file !== null &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  const canCopy =
    typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: shareText(current) })
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      toast({
        title: 'Sharing failed',
        description: 'Try downloading the image instead.',
      })
    }
  }

  function download() {
    if (!image) return
    const link = document.createElement('a')
    link.href = image.url
    link.download = fileName
    link.click()
  }

  async function copy() {
    if (!image) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': image.blob }),
      ])
      toast({ id: 'copied', title: 'Image copied', duration: 2500 })
    } catch {
      toast({
        title: 'Could not copy the image',
        description: 'Try downloading it instead.',
      })
    }
  }

  const { width, height } = CARD_SIZES[format]

  return (
    <div className="space-y-5 pt-1">
      <SegmentedControl
        label="Format"
        value={format}
        options={FORMATS}
        onChange={setFormat}
      />
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl bg-tint"
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: format === 'story' ? 260 : 360,
        }}
      >
        {image ? (
          <img
            src={image.url}
            alt={`Share card: ${current}-day streak`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="size-6 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" />
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-300 light:text-rose-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canShareFile && (
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-3 text-sm font-semibold text-orange-950"
          >
            <ShareIcon /> Share
          </button>
        )}
        <button
          type="button"
          disabled={!image}
          onClick={download}
          className={
            canShareFile
              ? 'inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-tint px-4 py-3 text-sm font-medium transition hover:bg-line disabled:opacity-50'
              : 'inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-3 text-sm font-semibold text-orange-950 disabled:opacity-50'
          }
        >
          <DownloadIcon /> Download
        </button>
        {canCopy && (
          <button
            type="button"
            disabled={!image}
            onClick={() => void copy()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-tint px-4 py-3 text-sm font-medium transition hover:bg-line disabled:opacity-50"
          >
            <CopyIcon /> Copy
          </button>
        )}
      </div>
    </div>
  )
}
