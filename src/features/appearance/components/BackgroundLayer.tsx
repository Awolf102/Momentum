import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/lib/store'
import { useCurrentBackground, useLight } from '../hooks/useBackground'
import { backgroundPanStore } from '../pan'
import { appearanceStore } from '../store'
import { BackgroundVisual } from './BackgroundVisual'

/** The full-screen background, cross-fading when it changes, with a readability overlay. */
export function BackgroundLayer({ dimmed = true }: { dimmed?: boolean }) {
  const { overlay: chosen, theme } = useStore(appearanceStore)
  const background = useCurrentBackground()
  const pan = useStore(backgroundPanStore)
  const light = useLight()
  // Light mode washes the background with white, so it needs a stronger veil.
  const strength =
    theme === 'light' ? Math.min(0.85, 0.2 + chosen * 1.4) : chosen
  // With the cards hidden (the climb view) the photo can be seen almost bare.
  const overlay = dimmed ? strength : strength * 0.25

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-[#05070f]"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={background.id}
          data-background-id={background.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        >
          <BackgroundVisual background={background} light={light} pan={pan} />
        </motion.div>
      </AnimatePresence>

      {/* Scrim: darker toward the bottom where the calendar sits. */}
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background: `linear-gradient(180deg, rgb(var(--scrim) / ${overlay * 0.75}) 0%, rgb(var(--scrim) / ${overlay * 0.55}) 45%, rgb(var(--scrim) / ${Math.min(1, overlay * 1.25)}) 100%)`,
        }}
      />
      {/* Vignette keeps the eye on the centre of the screen. */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: dimmed ? 1 : 0.4,
          background: `radial-gradient(130% 95% at 50% 35%, transparent 55%, rgb(var(--scrim) / ${0.25 + strength * 0.35}) 100%)`,
        }}
      />
    </div>
  )
}
