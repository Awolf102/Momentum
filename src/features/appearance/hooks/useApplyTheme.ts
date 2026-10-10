import { useEffect } from 'react'
import { useStore } from '@/lib/persistentStore'
import { appearanceStore } from '../store'

const THEME_COLORS = { dark: '#05070f', light: '#f6f7fb' } as const

/** Mirrors the chosen theme onto <html> so CSS tokens and native controls follow it. */
export function useApplyTheme(): void {
  const { theme } = useStore(appearanceStore)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme])
  }, [theme])
}
