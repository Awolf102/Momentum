import { navigate as navigateBrowser } from 'wouter/use-browser-location'

export const SETTINGS_SECTIONS = [
  'appearance',
  'focus',
  'app',
  'ai',
  'data',
] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

/** Every screen's address, so links don't repeat path strings. */
export const paths = {
  home: '/',
  log: '/log',
  /** The log, scrolled to a day. */
  logDay: (day: string) => `/log?day=${day}`,
  tasks: '/tasks',
  /** The plan: today's, or a day's. */
  plan: '/plan',
  planDay: (day: string) => `/plan?day=${day}`,
  /** The plan with its calendars open, to import one. */
  planCalendars: '/plan?calendars=1',
  /** The plan, with "Plan my day" ready to send. */
  planDraft: '/plan?draft=1',
  /** A week in review: this week's, or the week a day is in. */
  review: (week?: string) => (week ? `/review?week=${week}` : '/review'),
  goals: '/goals',
  goal: (id: string) => `/goals/${encodeURIComponent(id)}`,
  /** The goals, with a new one being written. */
  newGoal: '/goals?new=1',
  inbox: '/inbox',
  notes: '/notes',
  library: '/library',
  /** A document, optionally at a page. */
  document: (id: string, page?: number) =>
    `/library/${encodeURIComponent(id)}${page ? `?page=${page}` : ''}`,
  note: (id: string) => `/notes/${encodeURIComponent(id)}`,
  /** A note from photos of handwritten notes, a whiteboard or slides. */
  photoNote: '/capture/photo',
  /** A note from speech: recorded, or a recording chosen. */
  voiceNote: '/capture/voice',
  assistant: '/assistant',
  conversation: (id: string) => `/assistant/${encodeURIComponent(id)}`,
  /** A new conversation: about one document, or about your plans. */
  ask: (about: { document: string } | 'planner') =>
    about === 'planner'
      ? '/assistant?mode=planner'
      : `/assistant?document=${encodeURIComponent(about.document)}`,
  cards: '/cards',
  /** Studying the cards due: all, one subject's, or those with none (null). */
  study: (subjectId?: string | null) =>
    subjectId === undefined
      ? '/cards/review'
      : `/cards/review?subject=${encodeURIComponent(subjectId ?? 'none')}`,
  /** Making cards, from a note or a document (at a page) when given. */
  makeCards: (from?: { note: string } | { document: string; page?: number }) =>
    !from
      ? '/cards/make'
      : 'note' in from
        ? `/cards/make?note=${encodeURIComponent(from.note)}`
        : `/cards/make?document=${encodeURIComponent(from.document)}${from.page ? `&page=${from.page}` : ''}`,
  quizzes: '/quizzes',
  quiz: (id: string) => `/quizzes/${encodeURIComponent(id)}`,
  /** Making a quiz, from a note or a document when given. */
  newQuiz: (from?: { note: string } | { document: string }) =>
    !from
      ? '/quizzes/new'
      : 'note' in from
        ? `/quizzes/new?note=${encodeURIComponent(from.note)}`
        : `/quizzes/new?document=${encodeURIComponent(from.document)}`,
  settings: (section?: SettingsSection) =>
    section ? `/settings/${section}` : '/settings',
}

/** Navigates from outside React (commands, toasts, hotkeys). */
export function navigate(path: string, options?: { replace?: boolean }): void {
  navigateBrowser(path, options)
}

export function openSettings(section?: SettingsSection): void {
  navigate(paths.settings(section))
}
