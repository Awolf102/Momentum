import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { FlameIcon, RainIcon, VolumeIcon, WindIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { SOUNDS, type SoundId } from '../lib/sounds'
import {
  ambienceStore,
  playingStore,
  setVolume,
  togglePlaying,
  toggleSound,
} from '../store'

const ICONS: Record<SoundId, ReactNode> = {
  wind: <WindIcon />,
  rain: <RainIcon />,
  fire: <FlameIcon />,
}

/** Three bouncing bars: shown on the button while sound is playing. */
function Equalizer() {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
      {[0, 0.25, 0.5].map((delay) => (
        <motion.span
          key={delay}
          className="w-[3px] rounded-full bg-orange-300 light:bg-orange-500"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  )
}

/**
 * Header button + small mixer for the ambient soundscape. The mixer opens
 * below the button, or above it when the button sits at the bottom of the
 * sidebar.
 */
export function AmbienceControl({
  placement = 'below',
}: {
  placement?: 'below' | 'above'
}) {
  const playing = useStore(playingStore)
  const { sounds, volume } = useStore(ambienceStore)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-label={playing ? 'Ambient sound (playing)' : 'Ambient sound'}
        title="Ambient sound"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-10 items-center justify-center rounded-full glass text-lg text-fg transition hover:scale-105 active:scale-95"
      >
        {playing ? <Equalizer /> : <VolumeIcon />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Ambient sound"
            initial={{
              opacity: 0,
              y: placement === 'below' ? -6 : 6,
              scale: 0.97,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: placement === 'below' ? -4 : 4,
              scale: 0.97,
              transition: { duration: 0.12 },
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={cn(
              'absolute z-40 w-72 rounded-3xl glass-strong p-4',
              placement === 'below'
                ? 'top-12 right-0 origin-top-right'
                : 'bottom-12 left-0 origin-bottom-left',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Ambient sound</p>
              <button
                type="button"
                onClick={togglePlaying}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  playing
                    ? 'bg-tint text-fg hover:bg-line'
                    : 'bg-linear-to-br from-amber-300 to-orange-500 text-orange-950',
                )}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(Object.keys(SOUNDS) as SoundId[]).map((id) => {
                const active = sounds.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSound(id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium ring-1 transition',
                      active
                        ? 'bg-orange-400/15 text-fg ring-orange-300/60'
                        : 'bg-tint text-fg-muted ring-transparent hover:text-fg',
                    )}
                  >
                    <span className="text-lg">{ICONS[id]}</span>
                    {SOUNDS[id].label}
                  </button>
                )
              })}
            </div>
            <label className="mt-4 block">
              <span className="flex justify-between text-xs text-fg-subtle">
                <span>Volume</span>
                <span className="tabular-nums">
                  {Math.round(volume * 100)}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
              Generated live in your browser. Mix them for rain by the fire.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
