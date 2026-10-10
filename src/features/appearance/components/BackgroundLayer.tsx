import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/lib/persistentStore'
import { resolveBackground } from '../backgrounds'
import { appearanceStore } from '../store'
import { BackgroundVisual } from './BackgroundVisual'

/** The full-screen background, cross-fading when it changes, with a readability overlay. */
export function BackgroundLayer() {
  const {
    backgroundId,
    overlay: chosen,
    photos,
    theme,
  } = useStore(appearanceStore)
  const background = resolveBackground(backgroundId, photos)
  // Light mode washes the background with white, so it needs a stronger veil.
  const overlay =
    theme === 'light' ? Math.min(0.85, 0.2 + chosen * 1.4) : chosen

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-[#05070f]"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={background.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        >
          <BackgroundVisual background={background} />
        </motion.div>
      </AnimatePresence>

      {/* Scrim: darker toward the bottom where the calendar sits. */}
      <div
        className="absolute inset-0 transition-[background] duration-500"
        style={{
          background: `linear-gradient(180deg, rgb(var(--scrim) / ${overlay * 0.75}) 0%, rgb(var(--scrim) / ${overlay * 0.55}) 45%, rgb(var(--scrim) / ${Math.min(1, overlay * 1.25)}) 100%)`,
        }}
      />
      {/* Vignette keeps the eye on the centre of the screen. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(130% 95% at 50% 35%, transparent 55%, rgb(var(--scrim) / ${0.25 + overlay * 0.35}) 100%)`,
        }}
      />
    </div>
  )
}
