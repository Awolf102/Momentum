import { GlassCard } from '@/components/GlassCard'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ColumnsIcon, ListIcon } from '@/components/icons'
import {
  QuickAdd,
  setTasksView,
  tasksViewStore,
  useTasks,
  type TasksView,
} from '@/features/tasks'
import { TaskBoard, TaskList } from '@/features/tasks/page'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'

export default function TasksPage() {
  const tasks = useTasks()
  const today = useToday()
  const { view } = useStore(tasksViewStore)
  const open = tasks.filter((task) => task.status !== 'done').length
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col pt-2 pb-8 sm:pt-6 lg:pt-2',
        view === 'board' ? 'max-w-5xl' : 'max-w-2xl',
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
            Tasks
          </h1>
          <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
            {open === 0
              ? 'All clear.'
              : `${open} to do. Type a date, #subject, !priority or “every…” as you add.`}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <SegmentedControl<TasksView>
            label="View"
            value={view}
            options={[
              { value: 'list', label: 'List', icon: <ListIcon /> },
              { value: 'board', label: 'Board', icon: <ColumnsIcon /> },
            ]}
            onChange={setTasksView}
          />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        <GlassCard className="p-2">
          <QuickAdd />
        </GlassCard>
        {view === 'list' ? (
          <TaskList tasks={tasks} today={today} />
        ) : (
          <TaskBoard tasks={tasks} today={today} />
        )}
      </div>
    </div>
  )
}
