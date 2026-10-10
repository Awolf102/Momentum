import { useParams, useSearch } from 'wouter'
import { GoalDetail, GoalSheet, GoalsHome } from '@/features/goals/page'
import { navigate, paths } from '@/lib/routes'

export default function GoalsPage() {
  const { id } = useParams<{ id?: string }>()
  // A new goal is written at /goals?new=1, so ⌘K and links can open it.
  const creating = new URLSearchParams(useSearch()).get('new') === '1'

  if (id) return <GoalDetail key={id} id={id} />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Goals
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        Long-term aims, the milestones on the way, and the tasks and habits that
        get you there.
      </p>
      <div className="mt-6">
        <GoalsHome onNew={() => navigate(paths.newGoal)} />
      </div>
      <GoalSheet
        open={creating}
        onClose={() => navigate(paths.goals, { replace: true })}
        onAdded={(goal) => navigate(paths.goal(goal.id), { replace: true })}
      />
    </div>
  )
}
