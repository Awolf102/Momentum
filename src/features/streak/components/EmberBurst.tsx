import { motion } from 'motion/react'
import type { Ember } from '../lib/embers'

/** A ring pulse and a burst of embers radiating from the flame. */
export function EmberBurst({ embers }: { embers: Ember[] }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.span
        className="absolute top-1/2 left-1/2 size-24 -translate-1/2 rounded-full border-2 border-orange-300/70"
        initial={{ scale: 0.4, opacity: 0.9 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      {embers.map((ember, index) => (
        <motion.span
          key={index}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: ember.size,
            height: ember.size,
            marginLeft: -ember.size / 2,
            marginTop: -ember.size / 2,
            backgroundColor: ember.color,
            boxShadow: `0 0 8px ${ember.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: ember.x, y: ember.y, opacity: 0, scale: 0.3 }}
          transition={{
            duration: ember.duration,
            delay: ember.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </span>
  )
}
