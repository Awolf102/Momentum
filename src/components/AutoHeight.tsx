import { motion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Smoothly animates its height when its content changes size, so swapping
 * content doesn't make the layout jump. Padding inside the clipped area keeps
 * focus rings and shadows visible mid-animation; at rest nothing is clipped.
 */
export function AutoHeight({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const [animating, setAnimating] = useState(false)

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      onAnimationStart={() => setAnimating(true)}
      onAnimationComplete={() => setAnimating(false)}
      className={cn('-m-4', animating && 'overflow-hidden', className)}
    >
      <div ref={contentRef} className="p-4">
        {children}
      </div>
    </motion.div>
  )
}
