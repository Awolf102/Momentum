import { MoonIcon, RepeatIcon, SunIcon, SunriseIcon } from '@/components/icons'
import type { PartOfDay } from '../types'

export function PartIcon({
  part,
  className,
}: {
  part: PartOfDay
  className?: string
}) {
  const Icon =
    part === 'morning'
      ? SunriseIcon
      : part === 'afternoon'
        ? SunIcon
        : part === 'evening'
          ? MoonIcon
          : RepeatIcon
  return <Icon className={className} />
}
