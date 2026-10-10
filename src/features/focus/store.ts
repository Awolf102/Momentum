import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import { IDLE } from './lib/timer'
import type { ActivePhase, FocusSettings, PhaseKind, TimerState } from './types'

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  autoAmbience: false,
  subjectId: 'calculus',
}

/** Allowed lengths, in minutes. */
export const LENGTH_LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 90 },
} as const

export type LengthSetting = keyof typeof LENGTH_LIMITS

function clampMinutes(value: unknown, setting: LengthSetting): number {
  const { min, max } = LENGTH_LIMITS[setting]
  const number =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : DEFAULT_FOCUS_SETTINGS[setting]
  return Math.min(max, Math.max(min, number))
}

export function parseFocusSettings(data: unknown): FocusSettings | null {
  if (!isRecord(data)) return null
  return {
    focusMinutes: clampMinutes(data.focusMinutes, 'focusMinutes'),
    shortBreakMinutes: clampMinutes(
      data.shortBreakMinutes,
      'shortBreakMinutes',
    ),
    longBreakMinutes: clampMinutes(data.longBreakMinutes, 'longBreakMinutes'),
    autoAmbience: data.autoAmbience === true,
    subjectId: typeof data.subjectId === 'string' ? data.subjectId : null,
  }
}

export const focusSettingsStore = createPersistentStore<FocusSettings>({
  key: 'momentum.focus',
  version: 1,
  defaultValue: DEFAULT_FOCUS_SETTINGS,
  parse: parseFocusSettings,
})

const KINDS: readonly PhaseKind[] = ['focus', 'short-break', 'long-break']
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function parsePhase(value: unknown): ActivePhase | null {
  if (!isRecord(value)) return null
  const { id, kind, subjectId, startedAt, durationMs, pausedAt, pausedMs } =
    value
  if (typeof id !== 'string' || !KINDS.includes(kind as PhaseKind)) return null
  if (!isTime(startedAt) || !isTime(durationMs) || !isTime(pausedMs))
    return null
  if (pausedAt !== null && !isTime(pausedAt)) return null
  return {
    id,
    kind: kind as PhaseKind,
    subjectId: typeof subjectId === 'string' ? subjectId : null,
    startedAt,
    durationMs,
    pausedAt: pausedAt as number | null,
    pausedMs,
  }
}

export function parseTimer(data: unknown): TimerState | null {
  if (!isRecord(data)) return null
  const cycle = data.completedInCycle
  return {
    phase: data.phase === null ? null : parsePhase(data.phase),
    completedInCycle:
      typeof cycle === 'number' && cycle >= 0 && cycle <= 4
        ? Math.floor(cycle)
        : 0,
    lastAutoCheckIn: isDateKey(data.lastAutoCheckIn)
      ? data.lastAutoCheckIn
      : null,
  }
}

/**
 * The phase on the clock, saved as it changes, so a reload or a closed tab
 * picks up exactly where it left off.
 */
export const focusTimerStore = createPersistentStore<TimerState>({
  key: 'momentum.focus.timer',
  version: 1,
  defaultValue: IDLE,
  parse: parseTimer,
  // A backup's timer is a moment that has passed: restoring it could finish
  // (and record) a session that was later cancelled. This device's stays.
  merge: (current) => current,
})

export function setLength(setting: LengthSetting, minutes: number): void {
  focusSettingsStore.set((settings) => ({
    ...settings,
    [setting]: clampMinutes(minutes, setting),
  }))
}

export function setAutoAmbience(on: boolean): void {
  focusSettingsStore.set((settings) => ({ ...settings, autoAmbience: on }))
}

export function setFocusSubject(subjectId: string | null): void {
  focusSettingsStore.set((settings) => ({ ...settings, subjectId }))
}

/** Clears the timer (for "start over"). Settings and subjects are kept. */
export function resetTimer(): void {
  focusTimerStore.reset()
}
