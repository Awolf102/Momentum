import { MotionConfig } from 'motion/react'
import { useApplyTheme } from '@/features/appearance'
import { AppShell } from './AppShell'
import { AppRoutes } from './routes'

export function App() {
  useApplyTheme()
  return (
    // Respect the OS "reduce motion" setting for every animation in the app.
    <MotionConfig reducedMotion="user">
      <AppShell>
        <AppRoutes />
      </AppShell>
    </MotionConfig>
  )
}
