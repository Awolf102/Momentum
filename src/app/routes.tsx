import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Redirect, Route, Switch, useLocation } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { collectionRegistry } from '@/lib/collection'
import { storeRegistry } from '@/lib/persistentStore'
import { paths } from '@/lib/routes'
import { DashboardPage } from '@/pages/DashboardPage'

/**
 * A page whose code loads on first visit. Any stores it brings load their
 * saved values before it renders, so it never flashes defaults.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    const page = await load()
    await Promise.all([storeRegistry.settled(), collectionRegistry.settled()])
    return page
  })
}

const LogPage = lazyPage(() => import('@/pages/LogPage'))
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage'))

export function AppRoutes() {
  const [location] = useLocation()
  return (
    <PageErrorBoundary resetKey={location}>
      <Suspense fallback={null}>
        <Switch>
          <Route path={paths.home} component={DashboardPage} />
          <Route path={paths.log} component={LogPage} />
          <Route path="/settings/:section?" component={SettingsPage} />
          <Route>
            <Redirect to={paths.home} replace />
          </Route>
        </Switch>
      </Suspense>
    </PageErrorBoundary>
  )
}

interface BoundaryProps {
  resetKey: string
  children: ReactNode
}

interface BoundaryState {
  failed: boolean
  resetKey: string
}

/** If a page's code can't load (e.g. offline before it was cached), say so. */
class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true }
  }

  // Moving to another page clears the error.
  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <GlassCard className="mx-auto mt-10 max-w-md p-6 text-center">
        <h2 className="text-lg font-semibold">This page didn't load</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          Check your connection, then try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line"
        >
          Try again
        </button>
      </GlassCard>
    )
  }
}
