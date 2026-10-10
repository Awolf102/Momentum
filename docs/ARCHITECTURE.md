# Momentum — Architecture

This document explains how Momentum is structured and why. Version 1 does one
thing — a daily productivity streak — but the codebase is laid out so study
timers, tasks, themes, analytics and achievements can be added later without
rewriting what exists.

## Guiding principles

1. **Store facts, derive everything else.** We persist _which days you checked
   in_, never "the current streak". Current streak, longest streak, totals, the
   week strip and the activity calendar are all computed from that history. A
   counter can drift or be corrupted; a list of days can always be recomputed,
   and future analytics get the raw data for free.
2. **Calendar days, not timestamps.** A streak is about _your_ days. Every day is
   a `DateKey` (`"2026-10-10"`) in the user's local time zone. Only one function
   (`toDateKey`) reads the clock; all date arithmetic is done on pure calendar
   dates in UTC, so daylight-saving changes and midnight edge cases can't break
   a streak.
3. **Pure logic, thin React.** Streak rules, calendar layout and message
   selection are plain TypeScript functions with unit tests. Components only
   render what those functions return.
4. **Features are vertical slices.** Each feature owns its components, hooks,
   storage and logic, and exposes a small public API through `index.ts`.
   Adding a feature means adding a folder, not editing ten.
5. **Persistence behind an interface.** Today it's `localStorage`. Tomorrow it
   might be a backend. Components never touch storage directly.

## Project structure

```
src/
├── main.tsx                  Entry point: fonts, global CSS, mounts <App />
├── app/                      Application shell — the frame every page lives in
│   ├── App.tsx               Providers (motion config, theme) + page
│   ├── AppShell.tsx          Background, header, footer, settings sheet
│   ├── Header.tsx, Footer.tsx, Logo.tsx
├── pages/
│   └── DashboardPage.tsx     Composes features into the dashboard
├── features/
│   ├── streak/               Check-ins, streak rules, hero card, stats
│   │   ├── components/       StreakHero, Flame, WeekStrip, EmberBurst, StreakStats
│   │   ├── lib/              summarizeStreak, streakDepths, copy (pure + tested)
│   │   ├── hooks/useStreak.ts
│   │   ├── store.ts          Persistent store + actions (checkIn, reset, merge)
│   │   ├── types.ts
│   │   └── index.ts          Public API
│   ├── calendar/             Generic GitHub-style activity grid
│   │   ├── components/ActivityCalendar.tsx
│   │   └── lib/buildCalendar.ts
│   ├── motivation/           Daily and milestone messages
│   ├── appearance/           Theme, backgrounds, user photos, overlay
│   │   ├── components/       BackgroundLayer, BackgroundPicker, AlpineDusk scene
│   │   ├── lib/              Photo processing + IndexedDB photo storage
│   │   ├── backgrounds.ts    Preset + bundled-photo catalog
│   │   └── store.ts
│   └── settings/             Settings sheet and backup/restore
├── components/               Shared, feature-agnostic UI
│   ├── GlassCard, IconButton, Sheet, SegmentedControl, AutoHeight
│   └── icons.tsx
├── lib/                      Shared infrastructure
│   ├── date.ts               DateKey helpers (pure, tested)
│   ├── persistentStore.ts    Versioned, validated, cross-tab-synced storage
│   ├── useToday.ts           Current day that updates at midnight
│   └── …
├── assets/backgrounds/       Drop photos here → they become built-in backgrounds
└── styles/index.css          Tailwind, design tokens, glass utility
```

### Dependency rules

- `pages` → `features` → `components` / `lib`. Never the other way around.
- Features import each other only through their `index.ts`. The calendar, for
  example, knows nothing about streaks: it renders a map of `DateKey → level`.
  The dashboard is what turns streak data into calendar levels. That keeps the
  calendar reusable for multiple habits, study sessions or task completion later.

## Data model

```ts
// localStorage key "momentum.streak"
{
  "version": 1,
  "data": {
    "checkIns": {
      "2026-10-08": { "at": "2026-10-08T21:14:03.120Z" },
      "2026-10-09": { "at": "2026-10-09T07:02:44.981Z" }
    }
  }
}
```

- **Keyed by day**, so "only one check-in per calendar day" is guaranteed by the
  data structure itself, not just by the UI.
- **The timestamp is kept** even though V1 doesn't use it. It costs nothing now
  and can't be recovered later — "what time do I usually check in?" is a natural
  analytics question.
- **Every stored value is wrapped in `{ version, data }`.** When multiple streak
  categories arrive (studying, programming, exercise, reading), a `migrate`
  function will move this V1 history into a `habits.default` entry. Nothing in
  V1 needs to anticipate that shape — the versioning is what makes it safe.

Appearance settings live separately under `momentum.appearance`. Uploaded photos
are **not** in `localStorage` (it's capped around 5 MB and stores strings); they
are resized in the browser and stored as `Blob`s in IndexedDB.

## Streak rules

| Situation                                          | Status    | Current streak            |
| -------------------------------------------------- | --------- | ------------------------- |
| No check-ins ever                                  | `new`     | 0                         |
| Checked in today                                   | `done`    | run ending today          |
| Not yet today, but checked in yesterday            | `pending` | run ending yesterday      |
| Last check-in before yesterday (a full day missed) | `broken`  | 0 (previous run is shown) |

`pending` is important: the streak isn't lost the moment the clock passes
midnight — it's lost only after a full calendar day goes by without a check-in.
The flame stays unlit until you check in, which gives a gentle nudge.

The **longest streak** is computed from history in a single pass, so it can never
disagree with the calendar.

## State management

No Redux or Zustand. A ~100-line `createPersistentStore` provides:

- `get / set / subscribe`, consumed in React via `useSyncExternalStore`
- schema versioning with `parse` (validation) and `migrate` (upgrades)
- protection against corrupted data (unreadable values are kept under a
  `.unreadable` key instead of being silently overwritten)
- an in-memory fallback when `localStorage` is unavailable (some private modes)
- cross-tab sync through the `storage` event — check in on one tab and every
  open tab updates

Swapping to a server later means replacing the storage driver or the store's
internals; `useStreak()` and every component stay the same.

## Day rollover

`useToday()` returns today's `DateKey` and re-renders at local midnight, and
again whenever the tab regains focus or visibility (browsers throttle timers in
background tabs). The check-in action reads the clock at the moment of the
click, so even a stale screen can't record the wrong day.

## Backgrounds

Three sources, one `Background` type:

1. **Scenes and gradients** — built in. The default, _Alpine Dusk_, is an SVG
   mountain range so the app has its identity even before you add a photo.
2. **Bundled photos** — any image in `src/assets/backgrounds/` is picked up at
   build time by `import.meta.glob`, given a name from its file name, and offered
   as a preset. The first one becomes the default background. This is where the
   Australian mountain photograph goes.
3. **Uploaded photos** — chosen from the settings sheet, downscaled to 2560 px
   (plus a 360 px thumbnail), stored in IndexedDB, and never leave the device.

Readability over photos comes from a tunable overlay (scrim + vignette) and the
glass cards: translucent fill, `backdrop-filter: blur(24px) saturate(160%)`, a
hairline border and an inner top highlight.

## Design system

- **Tokens as CSS variables** (`--fg`, `--glass-bg`, `--cell-1`…) mapped into
  Tailwind v4's `@theme`. Dark is the default; light mode only swaps variable
  values. Custom themes later are just more variable sets.
- **Typography:** Inter (variable) for interface text; Instrument Serif for the
  large streak number and motivational lines, which gives the dashboard an
  editorial, calm feel over photographs.
- **Motion** via the `motion` library, wrapped in `MotionConfig
reducedMotion="user"`; decorative effects (embers, flicker) are skipped when the
  user prefers reduced motion.

## The dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ (◆ Momentum)                    (Saturday, October 10)  (⚙)  │
│                                                              │
│                ╭──────────────────────────────╮              │
│                │           (flame)            │              │
│                │              12              │              │
│                │          DAY STREAK          │              │
│                │ You've shown up for yourself │              │
│                │      12 days in a row.       │              │
│                │                              │              │
│                │    M  T  W  T  F  S  S       │ ← this week  │
│                │    ●  ●  ●  ●  ●  ◌  ·       │              │
│                │                              │              │
│                │   [  Check in for today  ]   │              │
│                ╰──────────────────────────────╯              │
│      ╭───────────────────────╮  ╭───────────────────────╮    │
│      │ LONGEST STREAK        │  │ TOTAL DAYS            │    │
│      │ 21 days               │  │ 48 days               │    │
│      ╰───────────────────────╯  ╰───────────────────────╯    │
│      ╭──────────────────────────────────────────────────╮    │
│      │ Activity                48 check-ins in the past │    │
│      │      Jun     Jul     Aug     Sep     Oct          │    │
│      │ Mon  ▪▪▫▪▪▪▪▫▫▪▪▪▪▪▪▪▪▫▪▪▪▪▪▪▪▪▪▪▫▪▪▪▪▪▪         │    │
│      │      (GitHub-style grid, 7 rows × N weeks)       │    │
│      ╰──────────────────────────────────────────────────╯    │
│ Your progress is saved on this device.  Background · Alpine  │
└──────────────────────────────────────────────────────────────┘
```

- **One column, centered.** The photo is part of the experience; a single column
  leaves it room to breathe on desktop and collapses naturally on mobile.
- **The streak is the hero.** A large serif number, a flame that is lit only once
  you've checked in today, and the sentence _"You've shown up for yourself 12 days
  in a row."_
- **Week strip** (Duolingo-style) shows the current week at a glance.
- **Check-in moment:** the flame ignites with an ember burst and a ring pulse, the
  number rolls up, the button folds into a "Checked in" confirmation, today's dot
  and calendar cell pop, and the day's motivational line fades in. Screen readers
  get the same news through a live region.
- **Activity calendar:** cells get brighter the deeper a day sits in a streak, so
  long runs visibly glow. The grid measures its container and shows as many weeks
  as fit — a year on desktop, a few months on a phone — without horizontal
  scrolling.

## Where future features plug in

| Feature           | Where it goes                                                      |
| ----------------- | ------------------------------------------------------------------ |
| Streak categories | `streak` store v2 migration + a `habitId` argument to `useStreak`  |
| Study timer       | `features/timer/`, a new page, router added in `app/`              |
| Tasks             | `features/tasks/` with its own persistent store                    |
| Custom themes     | More token sets in `styles/` + options in `appearance`             |
| Analytics         | Pure functions over the existing check-in history (timestamps too) |
| Achievements      | `features/achievements/`, reacting to streak milestones            |
| Sync / accounts   | A remote storage driver behind `createPersistentStore`             |

## Testing

Vitest covers the parts where bugs hide: date arithmetic (month, year, leap-day
and DST boundaries — tests run in `Australia/Sydney`), streak rules, calendar
layout, message selection and the persistent store (versioning, corruption,
migration).
