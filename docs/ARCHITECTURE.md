# Momentum — Architecture

This document explains how Momentum is structured and why. Version 1 did one
thing — a daily productivity streak — and version 2 leans into the mountain
identity and adds polish (light, rewards, the climb, sound, sharing, offline,
shortcuts). Version 3 grows it into a personal productivity platform, one
phase at a time ([ROADMAP.md](ROADMAP.md)). Phase 1 laid the foundations: a
routed app shell, IndexedDB storage with migrations, full backups, and an
optional bring-your-own-key AI layer.

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
5. **Persistence behind an interface.** Stores write through a
   `StorageBackend` (IndexedDB today; a sync server could be another one).
   Components never touch storage directly.
6. **Local-first, AI optional.** Everything works offline and without keys.
   AI is reached only through `features/ai`, only when the user acts, with the
   user's own keys, which never leave the device except to their provider.

## Project structure

```
src/
├── main.tsx                  Entry point: loads every store, then renders
├── sw.ts                     Service worker: offline precache + reminder notifications
├── app/                      Application shell — the frame every page lives in
│   ├── App.tsx               Providers (motion config, theme) + routes
│   ├── routes.tsx            The routes; lazy pages; page error boundary
│   ├── AppShell.tsx          Background, navigation, page transitions, dialogs, hotkeys
│   ├── Sidebar.tsx, TabBar.tsx, nav.tsx   Navigation (wide screens / phones)
│   ├── commands.tsx          Every app action, for the ⌘K palette and shortcuts
│   ├── Header.tsx, Footer.tsx, Logo.tsx, ShortcutsSheet.tsx
├── pages/
│   ├── DashboardPage.tsx     Home: composes features into the dashboard
│   └── SettingsPage.tsx      Settings sections (lazy-loaded)
├── features/
│   ├── ai/                   Optional AI: providers, client, Settings → AI, AiGate
│   │   ├── client.ts         The one entry point features use (chat, embed…)
│   │   ├── providers/        Anthropic, OpenAI(-compatible) adapters; mock
│   │   └── lib/              Retries, rate-limit gate, error mapping, usage (tested)
│   ├── backup/               Backup v2 (all data, opt-in keys) and Settings → Data
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
│   └── pwa/                  Install prompt, service worker registration
├── components/               Shared UI: GlassCard, Sheet, SettingsCard, Switch…
├── lib/                      Shared infrastructure
│   ├── date.ts               DateKey helpers (pure, tested)
│   ├── store.ts              Tiny observable store + useStore
│   ├── persistentStore.ts    Versioned stores + the registry that persists them
│   ├── db/                   The IndexedDB database: schema, upgrades, connection
│   ├── storage.ts            IndexedDB backend, localStorage migration, fallback
│   ├── secrets.ts            API keys, in their own object store
│   ├── routes.ts             Paths and navigation (usable outside React)
│   ├── progress.ts           Streak progress context (see dependency rules)
│   ├── overlays.ts           Palette and shortcuts dialogs' open state
│   ├── hotkeys.ts, commands.ts, toast.ts, color.ts, cover.ts, brand.ts
│   └── useToday.ts, useClock.ts, useViewport.ts, useMediaQuery.ts
├── assets/backgrounds/       Drop photos here → built-in backgrounds
│   └── unlocks/<days>/       …or here → rewards unlocked at that streak
└── styles/index.css          Tailwind, design tokens, glass utility
```

### Dependency rules

- `app` → `pages` → `features` → `components` / `lib`. Never the other way
  around.
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
  for its dialogs (`shareOpenStore`, `climbViewStore`), so commands and
  shortcuts can open them without prop drilling. Screens are routes instead:
  `openSettings('ai')` in `lib/routes.ts` navigates from anywhere.

## Data model

```ts
// IndexedDB "momentum" › object store "kv" › key "momentum.streak"
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

| Where                         | Holds                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `kv` › `momentum.streak`      | Check-ins (above)                                                      |
| `kv` › `momentum.appearance`  | Theme, background, overlay, light mode, photo list, celebrated rewards |
| `kv` › `momentum.climb`       | Trails you traced, per background                                      |
| `kv` › `momentum.ambience`    | Sound mix and volume (playback never auto-starts)                      |
| `kv` › `momentum.reminder`    | Reminder on/off and time                                               |
| `kv` › `momentum.ai`          | AI providers, model per task, compatible server address, prices        |
| `kv` › `momentum.ai.usage`    | Tokens and requests per model per month (13 months kept)               |
| `photos`                      | Uploaded photos as Blobs (2560 px + 360 px thumbnail)                  |
| `secrets`                     | API keys: `anthropic`, `openai`, `compatible`                          |
| `meta`                        | Housekeeping, e.g. when localStorage data was migrated                 |
| IndexedDB `momentum-reminder` | What the service worker needs for reminders (a mirror)                 |
| localStorage `momentum.theme` | A copy of the theme, read before the first paint to avoid a flash      |

`kv`, `photos`, `secrets` and `meta` are object stores in the `momentum`
database (version 2). Its schema lives in `lib/db/schema.ts` as one `upgrade`
function with a step per version, so a browser on any older version upgrades
in order: version 1 (photos only, from v2 of the app) gains the other stores
without losing photos. This is tested against `fake-indexeddb`.

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

No Redux or Zustand. `createPersistentStore` gives each feature a small store
with `get / set / subscribe` (read in React via `useSyncExternalStore`), schema
versioning with `parse` (validation) and `migrate` (upgrades), and an optional
`merge` for restoring backups. Every store registers with one `StoreRegistry`,
which owns persistence:

- **Load before the first render.** `main.tsx` awaits `hydrateStores()`, which
  reads every store from IndexedDB in one transaction. Nothing flashes from
  defaults to saved values.
- **Migration from localStorage.** A store with nothing in IndexedDB but data
  under its key in localStorage (where v1 and v2 saved) is migrated, and the
  migration is recorded in `meta`. The old copy is left in place as a safety
  net; IndexedDB wins from then on.
- **Write-through, batched.** `set` updates memory synchronously and schedules
  a write; writes in the same tick are batched.
- **Corruption-safe.** Data that can't be read is kept under a `.unreadable` key
  instead of being overwritten by defaults.
- **Cross-tab sync** over `BroadcastChannel`: after saving, a tab announces
  which keys changed and other tabs reload just those.
- **Lazy pages.** A store first created by a lazily loaded page loads its saved
  value on registration; `lazyPage()` in `app/routes.tsx` waits for that
  (`registry.settled()`) before rendering the page.
- **Fallbacks.** If IndexedDB can't open (some private modes), the same stores
  run on localStorage; if that fails too, in memory for the session.
- **Upgrades across tabs.** If an older Momentum tab is holding the database
  open, an upgrade waits for it, and the new tab says "close other Momentum
  tabs" instead of a blank screen. A tab whose database is upgraded by a newer
  version elsewhere closes its connection and offers a reload.

`navigator.storage.persist()` is requested after the first render, and Settings
→ Data shows whether the browser granted it.

## Routing and the shell

`wouter` (about 2 KB) maps paths to pages: `/` is the dashboard, and
`/settings/:section` the settings (appearance, app, AI, data). Pages other than
the dashboard load on first visit, behind an error boundary that explains a
failed load instead of showing a blank screen. Real paths, not `#` routes: the
service worker answers every navigation with the app shell, so deep links work
offline; a static host needs the usual single-page-app fallback to `index.html`.

The shell keeps the existing look:

- **Wide screens (≥ 1024 px):** a glass sidebar with the logo, search (⌘K), the
  pages, today's date and the sound control.
- **Phones and tablets:** the header stays, and a floating glass tab bar (Home,
  Search, Settings) sits within thumb reach. Toasts move above it.
- The climb view still clears everything away. The fade is applied to each
  layer separately, because a `filter` on a shared wrapper would re-anchor the
  fixed sidebar and tab bar mid-transition.
- Pages fade in when you move between them, and start at the top.

## AI

AI is optional and bring-your-own-key. Features never talk to a provider
directly; they call the `ai` client from `features/ai`:

```
feature ─► ai.chat / ai.complete / ai.embed
             │  reads provider, model and key from settings at call time
             ├─ RequestGate     3 requests at a time per provider, and a shared
             │                  pause after a rate limit
             ├─ withRetry /     backoff with jitter; honours Retry-After (≤ 60 s);
             │  streamWithRetry streams retry only before the first text arrives
             ├─ provider        adapter over the official SDK, loaded on first use
             └─ usage           tokens counted per model per month
```

- **Providers.** Anthropic (`@anthropic-ai/sdk`), OpenAI (`openai`), and any
  OpenAI-compatible server (Ollama, LM Studio, vLLM, OpenRouter…) through the
  `openai` SDK with a base URL. Chat and embeddings each have their own
  provider and model; Anthropic offers no embeddings, so it isn't offered there.
- **Models are never hardcoded.** The model is text the user chooses, with
  suggestions from the provider's own model list. Anthropic's Models API also
  reports each model's largest `max_tokens`; the adapter caps requests to it
  (default 64 000: replies stream, so a high cap can't time out, and Anthropic
  counts only generated tokens against rate limits).
- **Straight from the browser.** There's no Momentum server, so the SDKs run in
  the page (`dangerouslyAllowBrowser`). That flag guards against shipping a
  developer's key to users; here each user brings their own key, kept on their
  device. SDK-level retries are off (`maxRetries: 0`) so retries are uniform,
  visible to the UI (`onRetry`) and testable.
- **Errors** become an `AiError` with a `kind` (auth, quota, rate-limit,
  overloaded, network, not-found…). Spending-cap 429s count as `quota` and aren't
  retried. Messages are scrubbed of anything key-shaped.
- **Streams** yield `text`, running `usage`, then `done` with a stop reason
  (`end`, `max-tokens`, `refusal`). Stopping reading cancels the request; usage
  is still recorded for what was generated.
- **Cost.** Usage is counted in tokens; prices aren't built in (they change),
  so an estimate appears once the user enters a price per million tokens.
- **Size.** The SDKs load only when an AI request is made. Their chunks live in
  `assets/ai/` and are left out of the precache, so installing Momentum doesn't
  download them; the service worker caches them on first use.
- **`AiGate`** wraps every AI feature: until a provider is set up it shows a
  friendly "add a key in Settings" card instead.
- **Tests** use `createMockProvider` for the client, fake SDK clients for the
  adapters, and both real SDKs against a local stand-in server for the end-to-end
  request and stream shapes.

### Privacy

- Keys live in the `secrets` object store: never in a persistent store, so never
  broadcast between tabs, logged, or exported unless the user opts in. Once
  saved, the UI shows only a masked hint (`sk-ant…a1b2`).
- Nothing is sent to a provider except on a user's action. Test connection says
  exactly what it sends (one line of text).
- Usage is counted locally from what providers report.

## Backups

Backup v2 is one JSON file: every store's envelope (including stores whose page
hasn't been opened this session, read straight from IndexedDB), every photo as
base64, and API keys only when "Include API keys" is on — for export and for
import. Restoring uses each store's `merge` when it has one: the streak combines
check-ins, so a restore never erases progress. Data for stores this version
doesn't know is saved for when it does; data from a newer version of a store is
left alone. v1 backups (streak only) still import.

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

On a phone (wide screens put the navigation in the sidebar):

```
┌──────────────────────────────────────────────────────────────┐
│ (◆ Momentum)                    (Saturday, October 10)  (♪)  │
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
│           ( ⌂ Home )  ( ⌕ Search )  ( ⚙ Settings )           │
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
  shell, pages, fonts and icons (Latin subsets only) and serves `index.html` for
  every navigation, so the app — including check-ins — works offline. The AI
  SDKs are the exception (see AI).
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

[ROADMAP.md](ROADMAP.md) maps every planned feature to a folder and a phase.
In short: each is a new `features/<name>/` with its own stores or IndexedDB
collections, a lazily loaded page under `pages/`, commands in the palette, and
`AiGate` + the `ai` client if it uses AI.

## Testing

Vitest covers the parts where bugs hide: date arithmetic (month, year, leap-day
and DST boundaries — tests run in `Australia/Sydney`), streak rules, calendar
layout, message selection, the store registry (hydration, localStorage
migration, corruption, write-through, lazy stores, restore and merge), the
database upgrade path, backups (round trip, opt-in keys, v1 files), the AI
layer (retries, Retry-After, the gate, error mapping, both adapters, usage and
cost, settings parsing), light blending, climb progress, trail geometry and
skyline detection (on synthetic images), command search and hotkey matching,
noise generation and reminder scheduling. UI flows — including migrating real
v2 data and a connection test through the real SDK — are checked in a headless
browser at desktop and phone sizes.
