import { motion } from 'motion/react'

/** The climber: a glowing ember with a slow pulse. */
export function Marker({
  x,
  y,
  size = 1,
}: {
  x: number
  y: number
  size?: number
}) {
  return (
    <motion.g
      initial={false}
      animate={{ x, y }}
      transition={{ type: 'spring', stiffness: 60, damping: 18 }}
    >
      <motion.circle
        r={10 * size}
        fill="none"
        stroke="#fdba74"
        strokeWidth={1.5}
        initial={{ scale: 0.6, opacity: 0.8 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <circle r={12 * size} fill="#fb923c" opacity={0.25} />
      <circle
        r={5.5 * size}
        fill="#fed7aa"
        stroke="#fff"
        strokeWidth={2 * size}
      />
    </motion.g>
  )
}

/** The summit flag, planted at the end of the trail. */
export function SummitFlag({
  x,
  y,
  reached,
  size = 1,
}: {
  x: number
  y: number
  reached: boolean
  size?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="-26"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <motion.path
        d="M0 -26 L16 -21 L0 -16 Z"
        fill={reached ? '#fb923c' : 'rgba(255,255,255,0.85)'}
        animate={reached ? { skewY: [0, -6, 0, 4, 0] } : { skewY: 0 }}
        transition={reached ? { duration: 2.4, repeat: Infinity } : undefined}
        style={{ transformOrigin: '0px -21px' }}
      />
      <circle r="2.5" fill="#fff" />
    </g>
  )
}
