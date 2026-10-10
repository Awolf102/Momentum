// What the quiz screens share besides components (kept apart from them,
// so fast refresh keeps working).
import type { ReactNode } from 'react'
import { CheckIcon, CloseIcon, MinusIcon } from '@/components/icons'
import type { Mark } from '../types'

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

export const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
export const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:pointer-events-none disabled:opacity-40'

/** The three marks, as shown. */
export const MARKS: ReadonlyArray<{
  mark: Mark
  label: string
  icon: ReactNode
  tone: string
}> = [
  {
    mark: 'right',
    label: 'Right',
    icon: <CheckIcon />,
    tone: 'text-emerald-300 light:text-emerald-700',
  },
  {
    mark: 'partly',
    label: 'Partly',
    icon: <MinusIcon />,
    tone: 'text-amber-200 light:text-amber-700',
  },
  {
    mark: 'wrong',
    label: 'Wrong',
    icon: <CloseIcon />,
    tone: 'text-rose-300 light:text-rose-600',
  },
]
