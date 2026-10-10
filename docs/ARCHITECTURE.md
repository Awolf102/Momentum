# Momentum — Architecture

This document explains how Momentum is structured and why. Version 1 did one
thing — a daily productivity streak — and version 2 leans into the mountain
identity and adds polish (light, rewards, the climb, sound, sharing, offline,
shortcuts), but the codebase is laid out so study
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
├── main.tsx                  Entry point: fonts, CSS, install prompt, service worker
├── sw.ts                     Service worker: offline precache + reminder notifications
├── app/                      Application shell — the frame every page lives in
│   ├── App.tsx               Providers (motion config, theme) + page
│   ├── AppShell.tsx          Progress context, background, climb overlay, dialogs, hotkeys
│   ├── commands.tsx          Every app action, for the ⌘K palette and shortcuts
│   ├── Header.tsx, Footer.tsx, Logo.tsx, ShortcutsSheet.tsx, overlays.ts
├── pages/
│   └── DashboardPage.tsx     Composes features into the dashboard
├── features/
│   ├── streak/               Check-ins, streak rules, hero card, stats, flame
│   ├── calendar/             Generic GitHub-style activity grid
│   ├── motivation/           Daily and milestone messages
│   ├── appearance/           Theme, light, backgrounds, rewards, user photos
│   │   ├── components/       BackgroundLayer, BackgroundPicker, MountainScene…
│   │   ├── lib/light.ts      Time-of-day / streak-warmth palettes (pure, tested)
│   │   ├── lib/gradients.ts  Gradient backgrounds as data (CSS + canvas)
│   │   ├── backgrounds.ts    Catalog: bundled photos, scenes, gradients, rewards
│   │   └── scenes.ts         Ridge geometry, the scene trail, scene definitions
│   ├── climb/                The climber on the mountain
│   │   ├── lib/              Summits, trail geometry, skyline detection (tested)
│   │   └── components/       ClimbCard, ClimbOverlay, TrailTracer
│   ├── share/                Canvas-rendered share card
│   ├── ambience/             Procedural wind / rain / fire (Web Audio)
│   ├── reminder/             Evening reminder (shared with the service worker)
│   ├── pwa/                  Install prompt, service worker registration
│   └── settings/             Settings sheet and backup/restore
├── components/               Shared UI: GlassCard, Sheet, CommandPalette, Toaster…
├── lib/                      Shared infrastructure
│   ├── date.ts               DateKey helpers (pure, tested)
│   ├── store.ts              Tiny observable store + useStore
│   ├── persistentStore.ts    Versioned, validated, cross-tab-synced storage
│   ├── progress.ts           Streak progress context (see dependency rules)
│   ├── hotkeys.ts, commands.ts, toast.ts, color.ts, cover.ts, brand.ts
│   └── useToday.ts, useClock.ts, useViewport.ts, useMediaQuery.ts
├── assets/backgrounds/       Drop photos here → built-in backgrounds
│   └── unlocks/<days>/       …or here → rewards unlocked at that streak
└── styles/index.css          Tailwind, design tokens, glass utility
```

### Dependency rules

- `pages` → `features` → `components` / `lib`. Never the other way around.
- Features import each other only through their `index.ts`. The calendar, for
  example, knows nothing about streaks: it renders a map of `DateKey → level`.
  The dashboard is what turns streak data into calendar levels. That keeps the
  calendar reusable for multiple habits, study sessions or task completion later.
- **No cycles between features.** Lower-level features that need streak numbers
  (appearance for rewards and streak warmth, climb for the marker) read them
  from `ProgressContext` in `lib/progress.ts`, which `AppShell` provides from
  `useStreak()`. Where a feature needs to put a control inside another's
  component (the share button on the streak card), the page passes it in through
  a slot (`<StreakHero corner={…} />`).
- **UI state lives with its feature.** Each feature owns small in-memory stores
  for its dialogs (`settingsOpenStore`, `shareOpenStore`, `climbViewStore`), so
  commands and shortcuts can open them without prop drilling.

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

Everything persisted, and where:

| Key / database                  | Holds                                                                  |
| ------------------------------- | ---------------------------------------------------------------------- |
| `momentum.streak`               | Check-ins (above)                                                      |
| `momentum.appearance`           | Theme, background, overlay, light mode, photo list, celebrated rewards |
| `momentum.climb`                | Trails you traced, per background                                      |
| `momentum.ambience`             | Sound mix and volume (playback never auto-starts)                      |
| `momentum.reminder`             | Reminder on/off and time                                               |
| IndexedDB `momentum` / `photos` | Uploaded photos as Blobs (2560 px + 360 px thumbnail)                  |
| IndexedDB `momentum-reminder`   | What the service worker needs for reminders (a mirror)                 |

Fields added after the first release are optional in each store's `parse` and
filled with defaults, so older saved data loads without a version bump. A bump
is reserved for changes `parse` can't absorb.

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

Four sources, one `Background` type:

1. **Scenes** — the default, _Alpine Ridge_, is an SVG mountain range painted
   from a palette, so the app has its identity before you add a photo.
2. **Gradients** — stored as data (`GradientLayer[]`), rendered as CSS on screen
   and drawn onto a canvas for the share card.
3. **Bundled photos** — any image in `src/assets/backgrounds/` is picked up at
   build time by `import.meta.glob` and named from its file name. The first one
   becomes the default background. This is where the Australian photograph goes.
4. **Uploaded photos** — downscaled in the browser, stored in IndexedDB, never
   uploaded anywhere.

Readability comes from a tunable overlay (scrim + vignette) and the glass cards:
translucent fill, `backdrop-filter: blur(24px) saturate(160%)`, a hairline
border and an inner top highlight.

### Light

`lib/light.ts` defines five phases — night, dawn, daylight, golden hour, dusk —
each with a **scene palette** (sky stops, ridge colours, glow, stars, mist, snow)
and a **photo grade** (a soft-light tint plus brightness and saturation). Light
is a blend between two neighbouring phases, so it changes continuously:

- **Time of day** (default) follows the local clock (`useClock`, once a minute).
- **Streak** maps the current streak onto night → dawn → golden hour, eased so
  the first days change the most; full warmth at 60 days.
- **Off** keeps the scene at dusk and photos as taken.

Reward scenes have fixed palettes; light only affects the main scene and photos.

### Rewards

A background with `unlockAt` is a reward, unlocked by the **longest** streak (so a
broken streak never takes one away). Built in: _Aurora Ridge_ (30 days),
_Moonrise_ (60) and _First Light_ (100). Photos in
`src/assets/backgrounds/unlocks/<days>/` and uploaded "reward photos" join them.
`useUnlockCelebrations` toasts each new unlock once (`celebrated` in appearance).

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

## The climb

Each streak is a series of climbs between summits at 7, 14, 30, 60, 100, 200 and
365 days (then every 100). `climbFor(streak)` gives the current climb's base,
summit and progress; on a summit day the marker stands on the peak.

The marker walks a **trail**: a polyline in normalised image coordinates.

- **Scenes** have a built-in trail along the far ridge.
- **Photos** get a trail found automatically: `detectSkyline` scores every pixel
  for a sky-above / land-below edge on a 128 px copy and uses dynamic
  programming to find the strongest smooth left-to-right path. The trail runs
  from the lower end of the skyline to its highest point.
- **Traced trails** — tap along the ridge in the climb view — override both.

`coverFit` mirrors `object-fit: cover` so the overlay lands exactly on the
photo. On the dashboard the marker sits behind the glass cards; the climb view
(press M) hides the cards, lightens the overlay and pans the background
(`backgroundPanStore`) so a route cropped on a narrow screen comes into view.

## Share card

`share/lib/renderCard.ts` draws the card on a canvas (1080 × 1350, 1080 × 1080 or
1080 × 1920): the current background (photos with the light's grade; the scene
by serialising the on-screen SVG; gradients from their data), a scrim, a glass
panel (the background redrawn with `ctx.filter = blur()`), the flame from the
same path data as the UI, the number and a first-person line. It's shared with
the Web Share API where files are supported, otherwise downloaded or copied.

## Ambient sound

No audio files: `ambience/lib/sounds.ts` builds each soundscape from looped
noise buffers. Wind is band-passed pink noise swept by slow, unrelated LFOs;
rain is a filtered hiss plus scheduled droplet bursts; fire is a low brown-noise
roar plus crackles and pops. A compressor guards the mix. The AudioContext is
created on the first play, which always follows a click or key press.

## Commands and shortcuts

`app/commands.tsx` lists every action once (title, section, keywords, optional
hotkey). The ⌘K / Ctrl K palette searches it; the same list drives the keyboard
shortcuts and the shortcuts sheet. Single-key shortcuts (C, M, S, A, T, `,`, `?`)
are ignored while typing or while a dialog (`aria-modal`) is open.

## Offline, install and reminders

- `vite-plugin-pwa` (injectManifest) builds `src/sw.ts`, which precaches the app
  shell, fonts and icons (Latin subsets only) and serves `index.html` for every
  navigation, so the app — including check-ins — works offline.
- Updates are offered with a toast rather than applied silently.
- The **evening reminder** fires at a chosen time, once a day, only if you haven't
  checked in. While Momentum is open (even in a background tab) a timer handles
  it: a toast if you're looking at the app, a notification otherwise. The
  service worker can't read `localStorage`, so the bits it needs are mirrored to
  IndexedDB; installed Chromium apps also get periodic background sync, which
  wakes the worker at the browser's discretion.
- Notifications offer a **Check in** action that opens `/?checkin=1`, as does the
  home-screen shortcut.
- Limits: without a push server, reminders can't be guaranteed while the app is
  fully closed. iOS only allows notifications for apps added to the Home Screen.

## Where future features plug in

| Feature           | Where it goes                                                           |
| ----------------- | ----------------------------------------------------------------------- |
| Streak categories | `streak` store v2 migration + a `habitId` argument to `useStreak`       |
| Study timer       | `features/timer/`, a new page, router added in `app/`; reuse `ambience` |
| Tasks             | `features/tasks/` with its own persistent store + commands              |
| Custom themes     | More token sets in `styles/` + options in `appearance`                  |
| Analytics         | Pure functions over the existing check-in history (timestamps too)      |
| Achievements      | `features/achievements/`, reacting to `climbFor` summits                |
| Sync / accounts   | A remote storage driver behind `createPersistentStore`                  |

## Testing

Vitest covers the parts where bugs hide: date arithmetic (month, year, leap-day
and DST boundaries — tests run in `Australia/Sydney`), streak rules, calendar
layout, message selection, the persistent store (versioning, corruption,
migration), light blending, climb progress, trail geometry and skyline
detection (on synthetic images), command search and hotkey matching, noise
generation and reminder scheduling. UI flows are checked in a headless browser.
