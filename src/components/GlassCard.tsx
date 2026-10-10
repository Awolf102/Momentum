import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/cn'

type GlassCardProps<T extends ElementType> = {
  as?: T
} & ComponentPropsWithoutRef<T>

/** The frosted-glass surface used for every card on top of the background. */
export function GlassCard<T extends ElementType = 'section'>({
  as,
  className,
  ...props
}: GlassCardProps<T>) {
  const Component = as ?? 'section'
  return (
    <Component className={cn('rounded-[28px] glass', className)} {...props} />
  )
}
