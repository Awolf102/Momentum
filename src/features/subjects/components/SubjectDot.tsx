import { cn } from '@/lib/cn'
import { SUBJECT_COLORS, type SubjectColor } from '../types'

export function SubjectDot({
  color,
  className,
}: {
  color: SubjectColor
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ background: SUBJECT_COLORS[color] }}
    />
  )
}
