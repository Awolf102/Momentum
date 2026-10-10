import { useId } from 'react'

/** Momentum's mark: a mountain ridge that doubles as an "M". */
export function Logo({ className }: { className?: string }) {
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-ridge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#fb923c" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0b0f1f" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.14"
      />
      <path
        d="M6.5 22.5L12.5 11L16 17.5L19.5 11L25.5 22.5"
        fill="none"
        stroke={`url(#${id}-ridge)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
