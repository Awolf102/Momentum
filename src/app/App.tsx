import { MotionConfig } from 'motion/react'
import { useApplyTheme } from '@/features/appearance'
import { DashboardPage } from '@/pages/DashboardPage'
import { AppShell } from './AppShell'

export function App() {
  useApplyTheme()
  return (
    // Respect the OS "reduce motion" setting for every animation in the app.
    <MotionConfig reducedMotion="user">
      <AppShell>
        <DashboardPage />
      </AppShell>
    </MotionConfig>
  )
}
