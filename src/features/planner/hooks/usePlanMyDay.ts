import { useEffect, useMemo, useRef, useState } from 'react'
import {
  describeAiError,
  isAiError,
  startReply,
  useAiReadiness,
  type ReplyProgress,
} from '@/features/ai'
import { estimateTokens } from '@/features/ai/material'
import type { DateKey } from '@/lib/date'
import { createStore, useStore } from '@/lib/store'
import { useClock } from '@/lib/useClock'
import { useToday } from '@/lib/useToday'
import {
  PLAN_SYSTEM,
  planRequest,
  planWindow,
  type PlanContext,
} from '../lib/draft'
import {
  draftPlan,
  gatherPlanContext,
  PLAN_PARTS,
  planDraftStore,
  showDraft,
  type PlanPart,
} from '../planMyDay'

/** Parts left out of "Plan my day", kept while the app is open. */
const leftOutStore = createStore<ReadonlySet<PlanPart>>(new Set())

const ALL: ReadonlySet<PlanPart> = new Set(PLAN_PARTS)

/** Everything "Plan my day" needs: what's sent, sending it, and the draft. */
export function usePlanMyDay(day: DateKey) {
  const today = useToday()
  const clock = useClock()
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes()
  const readiness = useAiReadiness('chat')
  const window = planWindow(day, today, nowMinutes)
  const leftOut = useStore(leftOutStore)
  const current = useStore(planDraftStore)
  const [previewing, setPreviewing] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [progress, setProgress] = useState<ReplyProgress>({ since: 0 })
  const [problem, setProblem] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const now = day === today ? nowMinutes : null
  // Everything that could go, as it was when the preview opened.
  const [everything, setEverything] = useState<PlanContext | null>(null)
  const parts = useMemo(
    () => new Set(PLAN_PARTS.filter((part) => !leftOut.has(part))),
    [leftOut],
  )
  // What's ticked, at the same time of day.
  const chosen = useMemo(
    () =>
      everything
        ? gatherPlanContext(
            everything.day,
            { from: everything.from, until: everything.until },
            everything.now,
            parts,
          )
        : null,
    [everything, parts],
  )

  const items =
    previewing && everything
      ? (
          [
            [
              'events',
              'Calendar events',
              everything.busy.filter((busy) => busy.kind === 'event').length,
              (n: number) =>
                `${n} in the time to plan, with ${n === 1 ? 'its title' : 'their titles'}`,
            ],
            [
              'blocks',
              'Already on the plan',
              everything.busy.filter((busy) => busy.kind === 'block').length,
              (n: number) =>
                `${n} ${n === 1 ? 'block, with its title' : 'blocks, with their titles'}`,
            ],
            [
              'tasks',
              'Tasks',
              everything.tasks.length,
              (n: number) =>
                `${n} open: overdue, due in the next two weeks, or without a date; with ${n === 1 ? 'its subject and priority' : 'their subjects and priorities'}`,
            ],
            [
              'goals',
              'Goals',
              everything.goals.length,
              (n: number) =>
                `${n} on the go, with ${n === 1 ? 'its next milestone' : 'their next milestones'}`,
            ],
            [
              'habits',
              'Habits',
              everything.habits.length,
              (n: number) => `${n} still to do that day`,
            ],
          ] as const
        )
          .filter(([, , count]) => count > 0)
          .map(([id, title, count, detail]) => ({
            id,
            title,
            detail: detail(count),
          }))
      : []

  const tokens = chosen
    ? estimateTokens(PLAN_SYSTEM.length + planRequest(chosen).length)
    : 0

  async function send() {
    setPreviewing(false)
    if (!chosen) return
    setDrafting(true)
    setProgress(startReply())
    setProblem(null)
    setRetrying(null)
    controller.current = new AbortController()
    try {
      const draft = await draftPlan(chosen, {
        signal: controller.current.signal,
        onProgress: (phase) =>
          setProgress((current) => ({ ...current, phase })),
        onRetry: (info) =>
          setRetrying(
            `Busy, trying again in ${Math.max(1, Math.round(info.delayMs / 1000))} s`,
          ),
      })
      if (draft.blocks.length === 0) {
        setProblem(
          draft.cutOff
            ? 'The reply was cut off at the length limit before a whole block came through. Try a longer limit in Settings → AI.'
            : draft.note
              ? `Nothing came back that fits: ${draft.note}`
              : 'Nothing came back that fits. Try again, or free up some time.',
        )
        return
      }
      showDraft(day, draft)
    } catch (error) {
      if (!controller.current?.signal.aborted)
        setProblem(
          isAiError(error)
            ? describeAiError(error)
            : 'Something went wrong. Try again in a moment.',
        )
    } finally {
      setDrafting(false)
      setRetrying(null)
    }
  }

  return {
    readiness,
    window,
    previewing,
    open: () => {
      if (!window) return
      setProblem(null)
      setEverything(gatherPlanContext(day, window, now, ALL))
      setPreviewing(true)
    },
    close: () => setPreviewing(false),
    items,
    leftOut,
    toggle: (id: string, send: boolean) =>
      leftOutStore.set((set) => {
        const next = new Set(set)
        if (send) next.delete(id as PlanPart)
        else next.add(id as PlanPart)
        return next
      }),
    tokens,
    send: () => void send(),
    drafting,
    progress,
    stop: () => controller.current?.abort(),
    problem,
    retrying,
    draft: current?.day === day ? current : null,
  }
}
