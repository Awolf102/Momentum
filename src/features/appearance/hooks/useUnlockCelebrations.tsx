import { useEffect } from 'react'
import { SparkleIcon } from '@/components/icons'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { isUnlocked, listBackgrounds } from '../backgrounds'
import { appearanceStore, markCelebrated, setBackground } from '../store'

/** Announces each reward background the first time it's unlocked. */
export function useUnlockCelebrations(): void {
  const { longest } = useProgress()
  const { photos, celebrated } = useStore(appearanceStore)

  useEffect(() => {
    const unlocked = listBackgrounds(photos).filter(
      (background) =>
        background.unlockAt &&
        isUnlocked(background, longest) &&
        !celebrated.includes(background.id),
    )
    if (unlocked.length === 0) return
    const newest = unlocked[unlocked.length - 1]
    toast({
      id: 'reward-unlocked',
      icon: <SparkleIcon className="text-amber-300" />,
      title:
        unlocked.length === 1
          ? `New background unlocked: ${newest.name}`
          : `${unlocked.length} new backgrounds unlocked`,
      description: `Earned with a ${newest.unlockAt}-day streak.`,
      action: { label: 'Use it', run: () => setBackground(newest.id) },
      duration: 12_000,
    })
    markCelebrated(unlocked.map((background) => background.id))
  }, [longest, photos, celebrated])
}
