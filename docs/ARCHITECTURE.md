# Momentum — Architecture

This document explains how Momentum is structured and why. Version 1 did one
thing — a daily productivity streak — and version 2 leans into the mountain
identity and adds polish (light, rewards, the climb, sound, sharing, offline,
shortcuts). Version 3 grows it into a personal productivity platform, one
phase at a time ([ROADMAP.md](ROADMAP.md)). Phase 1 laid the foundations: a
routed app shell, IndexedDB storage with migrations, full backups, and an
optional bring-your-own-key AI layer. Phase 2 starts with a focus timer:
Pomodoro sessions with subjects, which check you in when the day's first one
finishes, a daily log (one line a day about what you did), and tasks with
quick add, repeats and a kanban board, more habits beside the daily check-in,
routines, a quick-capture inbox, and password-protected backups.

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
3. **Clocks, not counters.** Anything that runs over time stores when it
   started and paused, and works out the rest from the clock. The focus timer
   never counts `setInterval` ticks, so a sleeping phone or a throttled
   background tab can't put it wrong.
4. **Pure logic, thin React.** Streak rules, timer transitions, calendar layout
   and message selection are plain TypeScript functions with unit tests.
   Components only render what those functions return.
5. **Features are vertical slices.** Each feature owns its components, hooks,
   storage and logic, and exposes a small public API through `index.ts`.
   Adding a feature means adding a folder, not editing ten.
6. **Persistence behind an interface.** Stores write through a
   `StorageBackend`, and collections through a `CollectionBackend` (IndexedDB
   today; a sync server could be another one). Components never touch storage
   directly.
7. **Local-first, AI optional.** Everything works offline and without keys.
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
│   ├── TasksPage.tsx         Tasks as a list or a board (lazy)
│   ├── InboxPage.tsx         Captured things to sort; receives shares (lazy)
│   ├── NotesPage.tsx         Notes: the list and the open note (lazy)
│   ├── LibraryPage.tsx       The library's shelf, or a document open (lazy)
│   ├── AssistantPage.tsx     Ask: conversations about your notes or plans (lazy)
│   ├── CardsPage.tsx         Cards: what's due, studying, making cards (lazy)
│   ├── LogPage.tsx           The log: each day's line, check-in and focus (lazy)
│   └── SettingsPage.tsx      Settings sections (lazy-loaded)
├── features/
│   ├── ai/                   Optional AI: providers, client, Settings → AI, AiGate
│   │   ├── client.ts         The one entry point features use (chat, embed…)
│   │   ├── providers/        Anthropic, OpenAI(-compatible), this device; mock
│   │   ├── local/            The embeddings model on this device: a worker (tested)
│   │   ├── components/       Settings → AI, AiGate, SendPreview (what will be sent)
│   │   └── lib/              Retries, rate-limit gate, error mapping, usage (tested)
│   ├── backup/               Backup v3 (all data, opt-in keys) and Settings → Data
│   ├── streak/               Check-ins, streak rules, hero card, stats, flame
│   ├── focus/                Focus timer: Pomodoro sessions, auto check-in
│   │   ├── lib/timer.ts      Phases, pause/resume, catching up (pure, tested)
│   │   ├── lib/stats.ts      Minutes per day and subject, calendar levels (tested)
│   │   ├── engine.ts         Ends due phases, saves sessions, checks in (tested)
│   │   ├── actions.ts        Start, pause, resume, cancel, skip break
│   │   ├── sessions.ts       The focusSessions collection
│   │   ├── components/       FocusCard, TimerDial, FocusTodayTile, FocusPill
│   │   └── settings.ts       Settings → Focus (its own entry point, lazy-loaded)
│   ├── subjects/             Labels for sessions: Calculus, Reading… (editable)
│   ├── inbox/                Capture now, sort later; the PWA share target
│   │   └── lib/share.ts      What other apps share, safe links (tested)
│   ├── library/              PDFs: reading, highlights, margin notes
│   │   ├── documents.ts, highlights.ts   The collections (tested)
│   │   ├── files.ts          Files, first-page pictures and text, kept apart (tested)
│   │   ├── lib/              Selection rectangles, page text, highlights → note (tested)
│   │   ├── pdf/              pdf.js, set up, and reading a new document (lazy)
│   │   └── page.ts           The shelf and the viewer (only the lazy page loads them)
│   ├── search/               Search everything from ⌘K (loaded when it opens)
│   │   ├── lib/engine.ts     Folding, word-start matching, ranking, snippets (tested)
│   │   └── sources.tsx       Every kind of record as something to find (tested)
│   ├── embeddings/           Search by meaning: the index, ⌘K "By meaning", Related
│   │   ├── lib/              Passages, 8-bit vectors, the update plan, prompts (tested)
│   │   ├── indexer.ts        What's indexed and waiting; updating it (tested)
│   │   ├── search.ts         Passages nearest a search; related notes (tested)
│   │   └── palette.tsx       The palette's "By meaning" section (tested)
│   ├── flashcards/           Cards: spaced repetition with FSRS
│   │   ├── lib/              The schedule, what's due, intervals, cards in notes (tested)
│   │   ├── cards.ts          The cards collection (tested)
│   │   ├── reviews.ts        The review log, read by day (tested)
│   │   ├── review.ts         Rating, Undo, the habit (tested)
│   │   ├── scheduler.ts      FSRS (ts-fsrs), with the page (tested)
│   │   ├── generate.ts       Cards suggested by AI, as drafts
│   │   └── page.ts           Studying, the editor, making cards (lazy)
│   ├── assistant/            Ask: answers from your notes and documents, or your plans
│   │   ├── lib/              Keyword ranking, prompts, citations, plans snapshot (tested)
│   │   ├── retrieval.ts      A question's passages: by words, and by meaning (tested)
│   │   ├── chat.ts           Asking, the streamed answer, Stop, Ask again (tested)
│   │   ├── conversations.ts  The conversations collection (tested)
│   │   └── page.ts           The thread and list (only the lazy page loads them)
│   ├── notes/                Markdown notes with maths, code and [[links]]
│   │   ├── notes.ts          The notes collection; save, rename-aware links (tested)
│   │   ├── lib/links.ts      [[links]], backlinks, renaming (pure, tested)
│   │   ├── lib/suggest.ts, lib/checkboxes.ts   [[ suggestions, ticking boxes (tested)
│   │   ├── markdown/         Renderer, sanitiser, KaTeX, highlight.js (lazy, tested)
│   │   ├── view.ts           Rendered markdown, for the lazy pages that show it
│   │   └── page.ts           The editor and list (only the lazy page loads them)
│   ├── routines/             Checklists for a part of the day, fresh each day
│   │   ├── lib/day.ts        Part of the day, today's order, progress (tested)
│   │   └── runs.ts           The routineRuns collection; ticking steps (tested)
│   ├── habits/               More habits, each with its own days and streak
│   │   ├── lib/summary.ts    Streaks over chosen weekdays, the week, rates (tested)
│   │   └── checkIns.ts       The habitCheckIns collection; tick on and off (tested)
│   ├── tasks/                Tasks: quick add, repeats, list and board
│   │   ├── lib/quickAdd.ts   "Lab report fri 5pm #calculus !high" → a task (tested)
│   │   ├── lib/recurrence.ts Repeating schedules and the next date (tested)
│   │   ├── lib/groups.ts, lib/board.ts   List groups, board order (tested)
│   │   ├── tasks.ts          The tasks collection; add, edit, finish, move (tested)
│   │   └── page.ts           The board and list (only the lazy page loads them)
│   ├── log/                  The daily log: one line per day, editable in place
│   │   ├── entries.ts        The logEntries collection; setLine (tested)
│   │   ├── lib/timeline.ts   Days with a line, check-in or focus (pure, tested)
│   │   └── page.ts           The Log page's pieces (only the lazy page loads them)
│   ├── calendar/             Generic GitHub-style activity grid, with views
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
├── components/               Shared UI: GlassCard, StatTile, Sheet, SettingsCard…
├── lib/                      Shared infrastructure
│   ├── date.ts               DateKey helpers (pure, tested)
│   ├── store.ts              Tiny observable store + useStore
│   ├── persistentStore.ts    Versioned stores + the registry that persists them
│   ├── collection.ts         Record collections (sessions, later tasks…) (tested)
│   ├── rpc.ts                Typed calls to a Web Worker, with progress (tested)
│   ├── db/                   The IndexedDB database: schema, upgrades, connection
│   ├── storage.ts            IndexedDB backends, localStorage migration, fallback
│   ├── secrets.ts            API keys, in their own object store
│   ├── notify.ts             System notifications (reminder, focus timer)
│   ├── duration.ts           "1 h 15 min"
│   ├── routes.ts             Paths and navigation (usable outside React)
│   ├── progress.ts           Streak progress context (see dependency rules)
│   ├── overlays.ts           Palette and shortcuts dialogs' open state
│   ├── hotkeys.ts, commands.ts, toast.ts, color.ts, cover.ts, brand.ts, id.ts
│   └── useToday.ts, useClock.ts, useViewport.ts, useMediaQuery.ts
├── assets/backgrounds/       Drop photos here → built-in backgrounds
│   └── unlocks/<days>/       …or here → rewards unlocked at that streak
└── styles/index.css          Tailwind, design tokens, glass utility
```

### Dependency rules

- `app` → `pages` → `features` → `components` / `lib`. Never the other way
  around.
- Features import each other only through their `index.ts`. The calendar, for
  example, knows nothing about streaks or timers: it renders a map of
  `DateKey → level`. Each feature with something to show supplies a
  `CalendarView` (levels, labels, a summary line) — `useStreakCalendarView()`
  and `useFocusCalendarView()` — and the dashboard hands the calendar both.
  Multiple habits or task completion later are just more views.
- Settings UI that only the Settings page needs has its own entry point
  (`features/focus/settings.ts`, `features/subjects/settings.ts`), so the
  dashboard's bundle doesn't carry it. So does code that only lazy pages
  share: the notes' rendered markdown (`features/notes/view.ts`), which the
  assistant shows too, would otherwise be in the first load.
- **No cycles between features.** Focus uses the streak (to check in), subjects
  and ambience through their `index.ts`; none of them knows focus exists. The
  hero hears about check-ins through `onCheckIn`, whoever made them. Lower-level
  features that need streak numbers
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

A finished focus session is a record of its own (in the `focusSessions` object
store, keyed by `id`):

```ts
{
  "id": "m1x2…",
  "subjectId": "calculus",            // null when no subject was chosen
  "startedAt": "2026-10-10T08:00:00.000Z",
  "endedAt": "2026-10-10T08:31:00.000Z",
  "durationMs": 1500000,               // time focused: the planned 25 min
  "pausedMs": 360000,                  // paused for 6 min in between
  "day": "2026-10-10",                 // the local day it started
  "createdAt": "…", "updatedAt": "…"   // deletedAt when removed
}
```

The subject, start, length and day are everything per-subject streaks need
later, and the store is indexed `by-day` and `by-subject`, so they can be built
without a migration. Cancelled sessions are never stored.

A task is a record too. A repeating task is a series of them: finishing one
creates the next, with the same `seriesId`, so each occurrence keeps its own
history:

```ts
// object store "tasks", indexed by-due, by-status and by-subject
{ "id": "…", "title": "Gym", "subjectId": null,
  "status": "todo",                    // "todo" | "doing" | "done"
  "priority": 0,                       // 0 none … 3 high
  "due": "2026-10-15", "time": "07:00",
  "recurrence": { "unit": "week", "interval": 1, "weekdays": [1, 4],
                  "anchor": "2026-10-12" },
  "seriesId": "…", "completedAt": null,
  "order": 3,                          // place in its board column
  "createdAt": "…", "updatedAt": "…" }
```

A habit is a small definition — name, colour, the weekdays it's due (none
means every day) — in the `momentum.habits` store, and each day it was done is
a record in `habitCheckIns` with the id `<habit>:<day>`, so a day counts once
and unticking it is a soft delete that merges correctly between devices.

A routine is a definition too — name, part of the day, steps, weekdays — in
`momentum.routines`, and each day's run through it is a record in
`routineRuns` (id `<routine>:<day>`) listing the steps ticked, with
`completedAt` set once they all are.

A note is a record with its markdown text; links to other notes are written
in the text as `[[Title]]`, so there's no link table to keep in step:

```ts
// object store "notes", indexed by-subject
{ "id": "…", "title": "Karnaugh maps",
  "body": "## Grouping\nSee [[Boolean algebra]] and [[task:Lab report]].",
  "subjectId": "digital-logic", "pinned": false,
  "createdAt": "…", "updatedAt": "…" }   // deletedAt when deleted
```

A document in the library is a small record; its file, a picture of its
first page and its text (one string per page) are kept in their own stores,
keyed by the document's id, so the records stay small enough to hold in
memory. A highlight is a record of its own, with its place on the page as
fractions of the page's size, so it fits the page at any zoom:

```ts
// object store "documents", indexed by-subject
{ "id": "…", "title": "Lecture 5", "fileName": "lecture5.pdf",
  "size": 44182, "pages": 6, "subjectId": "digital-logic",
  "lastPage": 3, "lastOpenedAt": "…", "createdAt": "…", "updatedAt": "…" }

// object store "highlights", indexed by-document
{ "id": "…", "documentId": "…", "page": 1,
  "rects": [{ "x": 0.1, "y": 0.42, "w": 0.43, "h": 0.03 }],
  "quote": "Group ones in rectangles…", "color": "yellow",
  "note": "Powers of two only.", "createdAt": "…", "updatedAt": "…" }
```

The search-by-meaning index keeps one entry per note or document, in two
stores keyed the same way: what the entry was made from (small, read to see
what's changed) and its passages with their vectors (read only to search):

```ts
// object store "embeddingSources"
{ "key": "document:…", "kind": "document", "id": "…",
  "hash": "1xt1brm3y19",              // of the title and text, as indexed
  "space": "openai:text-embedding-3-small",  // vectors from different models don't mix
  "dims": 1536, "chunks": 7, "indexedAt": "…" }

// object store "embeddingVectors"
{ "key": "document:…", "pages": [1, 1, 2, 3, 3, 5, 6],
  "texts": ["Group ones in rectangles…", …],
  "dims": 1536, "values": Int8Array(7 × 1536), "scales": Float32Array(7) }
```

A conversation with the assistant is a record holding its messages, each
question with exactly what was sent with it (its passages, or the snapshot of
your plans), and each answer with where it came from and how it ended:

```ts
// object store "conversations"
{ "id": "…", "title": "How do Karnaugh maps group cells?",
  "mode": "library",                   // or "planner"
  "documentId": null,                  // set when asking about one document
  "messages": [
    { "id": "…", "role": "user", "text": "How do Karnaugh maps group cells?",
      "sources": [{ "key": "document:…", "kind": "document", "id": "…",
                    "title": "Lecture 5", "page": 2, "text": "Group ones in…" }],
      "createdAt": "…" },
    { "id": "…", "role": "assistant", "text": "In rectangles of 1, 2, 4 or 8 [1].",
      "provider": "anthropic", "model": "…", "stopReason": "end",
      "usage": { "inputTokens": 812, "outputTokens": 64 }, "createdAt": "…" }
  ],                                   // "stopped", "error" or "pending" when cut short
  "createdAt": "…", "updatedAt": "…" }   // deletedAt when deleted
```

A flashcard is a record with its two sides and its schedule, as FSRS keeps
it; every rating goes in a log of its own:

```ts
// object store "cards", indexed by-subject
{ "id": "…", "front": "What does a Karnaugh map group?",
  "back": "Adjacent ones, in rectangles of $2^n$ cells",
  "subjectId": "digital-logic",
  "source": { "kind": "document", "id": "…", "page": 1 },  // or a note, or null
  "schedule": { "state": "review",   // new | learning | review | relearning
                "due": "2026-10-19T09:52:00.000Z",
                "stability": 9.2, "difficulty": 4.9, "scheduledDays": 9,
                "learningSteps": 0, "reps": 3, "lapses": 0,
                "lastReview": "2026-10-10T09:52:00.000Z" },
  "introducedOn": "2026-10-10",      // first studied: new cards a day are limited
  "createdAt": "…", "updatedAt": "…" }   // deletedAt when deleted

// object store "cardReviews", indexed by-card and by-day
{ "id": "…", "cardId": "…", "rating": 3, "day": "2026-10-10",
  "reviewedAt": "…", "state": "learning", "elapsedDays": 0.007,
  "due": "…", "stability": 9.2, "difficulty": 4.9, "durationMs": 4200 }
```

A log line is a record whose id is its day, so "one line per day" holds in the
store itself, and two devices writing the same day merge to the later edit:

```ts
// object store "logEntries"
{ "id": "2026-10-10", "day": "2026-10-10", "text": "Finished the DFA lab",
  "createdAt": "…", "updatedAt": "…" }   // deletedAt once emptied
```

Everything persisted, and where:

| Where                                  | Holds                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `kv` › `momentum.streak`               | Check-ins (above)                                                      |
| `kv` › `momentum.appearance`           | Theme, background, overlay, light mode, photo list, celebrated rewards |
| `kv` › `momentum.climb`                | Trails you traced, per background                                      |
| `kv` › `momentum.ambience`             | Sound mix and volume (playback never auto-starts)                      |
| `kv` › `momentum.reminder`             | Reminder on/off and time                                               |
| `kv` › `momentum.focus`                | Session and break lengths, ambient sound on/off, last subject          |
| `kv` › `momentum.focus.timer`          | The phase on the clock (timestamps), place in the cycle                |
| `kv` › `momentum.subjects`             | Subjects: name, colour, deleted (kept for old sessions)                |
| `kv` › `momentum.calendar`             | Which calendar view is showing                                         |
| `kv` › `momentum.ai`                   | AI providers, model per task, compatible server address, prices        |
| `kv` › `momentum.ai.usage`             | Tokens and requests per model per month (13 months kept)               |
| `focusSessions`                        | Finished focus sessions (above)                                        |
| `logEntries`                           | The daily log, one line per day (above)                                |
| `tasks`                                | Tasks (above)                                                          |
| `kv` › `momentum.habits`               | Habits: name, colour, weekdays                                         |
| `habitCheckIns`                        | The days each habit was done                                           |
| `kv` › `momentum.routines`             | Routines: name, part of the day, steps, weekdays                       |
| `routineRuns`                          | Each day's ticked steps per routine                                    |
| `inboxItems`                           | Captured things not yet sorted (text, an optional link)                |
| `notes`                                | Notes: title, markdown, subject, pinned (above)                        |
| `documents`, `highlights`              | The library's documents, and highlights with margin notes (above)      |
| `documentFiles`                        | Each document's PDF (`<id>`) and first-page picture (`<id>:thumb`)     |
| `documentTexts`                        | Each document's text, one string per page, for search                  |
| `embeddingSources`, `embeddingVectors` | The search-by-meaning index (above); rebuilt, never backed up          |
| `kv` › `momentum.embeddings`           | Notes and documents kept out of that index                             |
| Cache Storage `momentum-models`        | The model on this device and its engine, once downloaded               |
| `conversations`                        | Conversations with the assistant (above)                               |
| `kv` › `momentum.assistant`            | Which parts of your plans the planning assistant may see               |
| `cards`                                | Flashcards and their schedules (above)                                 |
| `cardReviews`                          | Every rating given to a card (above); read by day                      |
| `kv` › `momentum.cards`                | New cards a day, recall to aim for, the habit cards count towards      |
| `kv` › `momentum.tasks`                | List or board                                                          |
| `photos`                               | Uploaded photos as Blobs (2560 px + 360 px thumbnail)                  |
| `secrets`                              | API keys: `anthropic`, `openai`, `compatible`                          |
| `meta`                                 | Housekeeping, e.g. when localStorage data was migrated                 |
| IndexedDB `momentum-reminder`          | What the service worker needs for reminders (a mirror)                 |
| localStorage `momentum.theme`          | A copy of the theme, read before the first paint to avoid a flash      |

These are object stores in the `momentum` database (version 13). Its schema
lives in `lib/db/schema.ts` as one `upgrade` function with a step per version,
so a browser on any older version upgrades in order: version 1 (photos only,
from v2 of the app) gains `kv`, `secrets` and `meta`; version 2 (Phase 1) gains
`focusSessions` and its indexes; version 3 (the timer) gains `logEntries`;
version 4 (the log) gains `tasks` and its indexes; version 5 (tasks) gains
`habitCheckIns`; version 6 (habits) gains `routineRuns` — both indexed by
their habit or routine and by day; version 7 (routines) gains `inboxItems`;
version 8 (the inbox) gains `notes`, indexed by subject; version 9 (notes)
gains the library's `documents`, `highlights`, `documentFiles` and
`documentTexts`; version 10 (the library) gains the search-by-meaning index,
`embeddingSources` and `embeddingVectors`; version 11 (search by meaning)
gains `conversations`; version 12 (the assistant) gains `cards` and
`cardReviews`.
Existing streaks, sessions, settings, keys and photos are untouched — each path
is tested against `fake-indexeddb`.

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

There is one way to check in — `checkIn()` in `features/streak` — whether it's
the button, the C shortcut, a notification's action or a finished focus
session. It records a day at most once and tells `onCheckIn` listeners which
day; the hero plays its animation when that day is today. A focus session that
started before midnight checks in the day it started (`checkIn(at, { day })`).

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
  a write for straight after the code that made the change (a microtask), so
  changes made together are saved together. Each IndexedDB transaction is
  committed at once (`commit()`) rather than when the page next hears back, so
  starting a timer and immediately closing or leaving the page doesn't lose it.
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

### Collections

Stores suit settings and small documents. Things that grow — focus sessions
now; tasks, notes and routines later — are **collections** (`lib/collection.ts`):
one IndexedDB object store each, records keyed by `id`, so saving one session
writes one record rather than rewriting a list.

- Every record carries `createdAt`, `updatedAt` and an optional `deletedAt`.
  Deleting is a soft delete, so history and a future sync can see it.
- The whole collection is loaded before the first render (with the stores) and
  kept in memory as a sorted list, read in React through `useStore`.
- `add` writes only if no record has that id, in one IndexedDB request, so two
  tabs finishing the same session record it once — the tab that wrote it is the
  one that announces it.
- Changes are announced over a `BroadcastChannel`; other tabs reload just those
  records.
- Backups export every record, deleted ones included. Importing merges: new
  records are added, and where both sides have a record the later `updatedAt`
  wins.
- If IndexedDB is unavailable, collections live in memory for the session.

A collection is declared with a name and a `parse` (records that can't be read
are skipped, not fatal); adding one means adding its object store in a new
database version.

## Routing and the shell

`wouter` (about 2 KB) maps paths to pages: `/` is the dashboard, and
`/tasks` the tasks, `/notes` and `/notes/:id` the notes, `/inbox` the inbox,
`/log` the daily log (`/log?day=…` scrolls to a day), and
`/settings/:section` the settings (appearance,
focus, app, AI, data). Pages other than
the dashboard load on first visit, behind an error boundary that explains a
failed load instead of showing a blank screen. Real paths, not `#` routes: the
service worker answers every navigation with the app shell, so deep links work
offline; a static host needs the usual single-page-app fallback to `index.html`.

The shell keeps the existing look:

- **Wide screens (≥ 1024 px):** a glass sidebar with the logo, search (⌘K), the
  pages (Home, Tasks, Notes, Inbox with a count, Log, Settings), today's date
  and the sound control.
- **Phones and tablets:** the header stays, and a floating glass tab bar (Home,
  Tasks, Notes, Search, Settings) sits within thumb reach; the inbox is reached
  from the dashboard notice, ⌘K or a home-screen shortcut, and the Log from
  Search (⌘K). Toasts move above it.
- The climb view still clears everything away. The fade is applied to each
  layer separately, because a `filter` on a shared wrapper would re-anchor the
  fixed sidebar and tab bar mid-transition.
- Pages fade in when you move between them, and start at the top.
- While a focus phase runs and you're on another page, a small countdown pill
  (`FocusPill`) sits under the sidebar's pages, or in the phone header; it
  links back home.

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
  Embeddings can also come from **this device** (`browser`): a small model run
  in a worker (see Search by meaning), behind the same `ai.embed`, so retries,
  the gate and errors work the same. Nothing it does is counted as usage: it
  costs nothing and sends nothing.
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
  is still recorded for what was generated. A stream cancelled through its
  signal ends with an `aborted` error, never `done`: both SDKs end a
  cancelled stream quietly, as if the reply were complete, so the adapters
  check for it.
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
  broadcast between tabs, logged, or exported unless the user opts in — and a
  backup with keys is always password-protected. Once saved, the UI shows only
  a masked hint (`sk-ant…a1b2`).
- Nothing is sent to a provider except on a user's action. Test connection says
  exactly what it sends (one line of text).
- **`SendPreview`** is shown before an AI feature sends your text: the provider
  and model, exactly which notes or documents (each can be unticked), about
  how many tokens, and what that costs once a price is set. Nothing goes until
  **Send**. Search by meaning uses it to build its index, and flashcards
  before AI suggests cards from a note or a PDF.
- **The assistant** says the same for every question, in its composer: the
  provider and model, each passage as a chip you can take out (or, about
  your plans, which parts, with the exact text a click away), and how many
  earlier messages go along. Finding passages as you type happens on this
  device; with a provider's index, finding them by meaning sends the question
  to it, so it's a button that says so.
- The model on this device sends nothing at all. Its files come once from
  Hugging Face (or a server of your own: build with `VITE_MODEL_HOST`), after
  you choose to download them; Settings says how big they are first.
- Usage is counted locally from what providers report.

## Backups

Backup v3 is one JSON file: every store's envelope (including stores whose page
hasn't been opened this session, read straight from IndexedDB), every
collection's records (focus sessions), every photo as base64, and API keys only
when "Include API keys" is on — for export and for import. Restoring uses each
store's `merge` when it has one: the streak combines check-ins and subjects
combine by id, so a restore never erases progress; the timer keeps whatever is
on this device's clock. Collections merge record by record. Data for stores
this version doesn't know is saved for when it does; data from a newer version
of a store is left alone. v1 (streak only) and v2 (no collections) backups
still import. The library's files come along too (base64, like photos)
unless **Include documents** is off; their text isn't included, since it's
read again from the files. Nor is the search-by-meaning index: it's made from
the notes and documents, so it's built again after a restore (on this device
by itself, or with a provider through the send preview). Which notes are kept
out of it is a setting, and is backed up. Conversations with the assistant,
cards and the review log are records like any other, backed up and merged.

**Password protection** (`lib/crypto.ts`) encrypts the whole backup on the
device with the WebCrypto API: AES-GCM (256-bit, random 12-byte IV) under a
key derived from the password with PBKDF2-SHA-256 (600 000 iterations, random
16-byte salt). The file is a small JSON wrapper — format, version, the KDF and
cipher parameters, when it was made, and the encrypted data — with nothing
else readable. Passwords are Unicode-normalised, so the same password typed on
another device opens it. A wrong password and an altered file are
indistinguishable to AES-GCM, and both are refused. Files asking for fewer
than 100 000 or more than 10 000 000 iterations are rejected as damaged. A
backup that includes API keys can't be made without a password; the password
is never stored, so a forgotten one can't be recovered.

Settings → Data can reset the streak history, habits, routines, tasks,
documents, notes, cards (with their reviews), conversations, the inbox, the
log and the focus history separately;
resetting focus clears the sessions and the timer but keeps settings and
subjects.

## Day rollover

`useToday()` returns today's `DateKey` and re-renders at local midnight, and
again whenever the tab regains focus or visibility (browsers throttle timers in
background tabs). The check-in action reads the clock at the moment of the
click, so even a stale screen can't record the wrong day.

## Focus timer

`features/focus` is a Pomodoro timer: 25-minute focus sessions with 5-minute
breaks, and a 15-minute break after every fourth session. All three lengths are
set in Settings → Focus; a change applies from the next phase.

**Timestamps, not ticks.** The saved timer (`momentum.focus.timer`) is the
phase on the clock — its kind, `startedAt`, a `durationMs` fixed when it
started, `pausedAt` and the total `pausedMs` — plus how far into the cycle you
are. The time left is always `durationMs − (now − startedAt − pausedMs)`, worked
out from the clock when it's needed. It stays right while a tab sleeps or a
phone locks, and a reload resumes it exactly, running or paused. The
transitions (`start`, `pause`, `resume`, `cancel`, `skipBreak`, `advance`) are
pure functions in `lib/timer.ts`.

```
 idle ──start──► focus ──time up──► short break ──time up──► idle
                 │  ▲                (long break after the 4th)
           pause │  │ resume         skip break ──► next focus
                 ▼  │
                paused ──cancel──► idle (nothing recorded)
```

**Catching up.** `advance(state, durations, now)` ends every phase whose time
is up at its _scheduled_ end, even if Momentum was closed then, and starts what
follows from that moment. Open the app an hour after a session should have
ended and the session is recorded at its proper end time, its break has run
its course too, and a toast says it finished while you were away.

**The engine.** `useFocusEngine()`, mounted once in `AppShell`, calls
`settle()` on load, at the moment the current phase is due (one `setTimeout`,
not a ticking interval), and whenever the tab becomes visible again. `settle`
saves the advanced state first — so two wake-ups at once can't double-count —
then saves each finished session and handles the check-in. The countdown on
screen comes from `useNow`, a shared ticker lined up with the countdown's
seconds; it only redraws, the timer never depends on it.

**Sessions** go into the `focusSessions` collection (see Data model) with their
subject, start and end, and the day they count toward: the local day they
_started_, so a session that runs past midnight counts for the evening you sat
down. Cancelled sessions are never stored.

**Auto check-in.** Finishing the day's first full session calls the streak's own
`checkIn()`, so its rules hold (one check-in per calendar day, the hero's
animation, the toast says so). `lastAutoCheckIn` remembers the last day that
was considered, so later sessions that day leave the streak alone — even if you
reset your history in between. Manual check-in works as before.

**When a phase ends:** a soft two-note chime (Web Audio, unlocked by the click
that started the session), a toast if you're looking at Momentum or a system
notification if you're not and have allowed them (`lib/notify.ts`, shared with
the evening reminder). While a phase runs, the countdown is in the tab title.

**Subjects** (`features/subjects`) are labels you pick before starting:
Calculus, Digital Logic, Programming and Reading to begin with. Add one from
the picker on the dashboard; rename, recolour and delete them in Settings →
Focus. Deleting hides a subject but keeps it, so past sessions keep their name
and colour.

**Ambient sound.** With "Ambient sound" on in Settings → Focus (off by
default), starting or resuming a session plays your ambient mix, and a pause or
break stops it. It follows your actions rather than the clock, because browsers
only start audio after a click or key press: a session resumed by a reload
starts silent.

**More than one tab.** Every tab runs the engine. The timer store syncs between
tabs, break ids derive from their session's id (`<id>:break`) so every tab
arrives at the same state, and `add` is atomic, so only the tab that saved a
session announces it.

**On screen:** `FocusCard` (dial, subject, controls) and `FocusTodayTile`
(today's minutes and sessions) on the dashboard, `FocusPill` elsewhere, and a
Focus view for the activity calendar, shaded at 1, 50, 100 and 150 minutes —
roughly one, two, four and six sessions.

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
│      ╭──────────────────────────────────────────────────╮    │
│      │ ⏱ FOCUS                                  ● ● ○ ○ │    │
│      │   ╭───────╮   What are you working on?           │    │
│      │   │ 25:00 │   (● Calculus) (● Reading) (+ Add)   │    │
│      │   ╰───────╯   [ ▷ Start focus  F ]               │    │
│      ╰──────────────────────────────────────────────────╯    │
│      ╭────────────────╮ ╭─────────────╮ ╭───────────────╮    │
│      │ LONGEST STREAK │ │ TOTAL DAYS  │ │ FOCUS TODAY   │    │
│      │ 21 days        │ │ 48 days     │ │ 50 min        │    │
│      ╰────────────────╯ ╰─────────────╯ ╰───────────────╯    │
│      ╭──────────────────────────────────────────────────╮    │
│      │ (the climb)                                      │    │
│      ╰──────────────────────────────────────────────────╯    │
│      ╭──────────────────────────────────────────────────╮    │
│      │ Activity             ( Check-ins | Focus )       │    │
│      │      Jun     Jul     Aug     Sep     Oct         │    │
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
- **The focus card** sits under the hero: a large serif countdown in the
  streak number's typeface inside a thin progress ring (amber while you focus,
  teal on breaks), the subject, and the controls — one primary action (start,
  resume, skip break), pause, and a cancel that asks for a second tap ("it
  won't count"). Dots in the corner show where you are in the four-session
  cycle.
- **Tiles:** longest streak, total days and focus today share one `StatTile`
  (two columns on a phone, with focus today across both; three on wider
  screens).
- **Activity calendar:** in the check-ins view, cells get brighter the deeper a
  day sits in a streak, so long runs visibly glow; in the focus view, the more
  minutes you focused. The choice is remembered. The grid measures its
  container and shows as many weeks as fit — a year on desktop, a few months on
  a phone — without horizontal scrolling.

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

## Tasks

`features/tasks` is a to-do list with a board view. Tasks are records in the
`tasks` collection (see Data model).

- **Quick add.** One line becomes a task: `parseQuickAdd` (pure, tested) reads
  dates (today, tomorrow, fri, next week, in 3 days, 12 Oct, 12/10 — day or
  month first as the locale writes it), times (5pm, 17:30), `#subject` (by name,
  ignoring case and spaces, or a prefix), priority (`!`, `!!`, `!!!`) and
  repeats (every monday and thursday, daily, every 2 weeks, fortnightly), and
  the rest is the title. It's careful with words: "sat", "sun" and "wed" only
  count after on / by / next / every, "Call mum!" keeps its "!", unknown tags
  stay in the title, and "quoted text" is never read. What it understood shows
  under the field before you press Enter. It's on the dashboard, the Tasks page
  and, from anywhere, in a dialog (N).
- **Repeats** (`lib/recurrence.ts`) are a unit (day, week, month, year), an
  interval, weekdays for weekly ones, and an anchor that schedules count from:
  "every 2 weeks" alternates from the first week, and a monthly date that
  started on the 31st falls on the last day of shorter months and comes back to
  the 31st. Finishing an occurrence creates the next one, after today —
  missed occurrences are skipped, so a chore done late is next due on its next
  date, not yesterday. The next one's id comes from the series and its date,
  so two tabs finishing it at once add it once.
- **The list** groups open tasks by when they're due — Overdue, Today,
  Tomorrow, Later, No date — soonest, then by time, then by priority; done
  tasks fold away at the end. The checkbox's ring colour shows priority.
- **The board** has To do, Doing and Done. Cards drag between and within
  columns (HTML drag and drop, with the drop point shown); each card has an
  `order` with room between values, so a move rewrites one card. Done is
  newest first, whatever the order. Moving to Done finishes a task (and makes
  its next occurrence); moving out reopens it. On phones the columns scroll
  sideways, and a card's column is changed from its sheet.
- **The sheet** edits everything: title, column, date and time, repeat (common
  choices, or the custom rule quick add made), subject, priority, delete.
  Without a date there's no time or repeat; moving a repeating task's date
  moves its schedule.
- **On the dashboard,** "Today's tasks" shows what's due and overdue, with
  what you've finished today struck through, and its own quick add. The
  activity calendar gains a Tasks view, brighter on days you finished more.
- The board and list are only used by the Tasks page, so they have their own
  entry point (`features/tasks/page.ts`); everything the dashboard uses comes
  from `index.ts`.

## Habits

The daily check-in stays the headline streak. `features/habits` adds others —
reading, exercise, practice — each with its own streak, on the days you
choose.

- **Streaks count due days.** `summarizeHabit` (pure, tested) walks a habit's
  days: a due day done extends the run, a due day missed ends it, days off
  neither break nor extend it, and today stays open until it's done. Days
  before the habit existed don't count against it. Doing a habit on a day off
  still counts toward its total.
- **On the dashboard,** the Habits card lists each with a round check in its
  colour (dashed on a day off — it can still be ticked), its streak and
  schedule, and dots for the last seven days: done, missed, still to do, or a
  day off. A habit is added there by name, or with its days from the sheet.
- **The sheet** shows the streak, longest run, days done and the share of due
  days done over four weeks, a day picker, a colour, the habit's own activity
  calendar, and delete.
- The activity calendar gains a **Habits** view: brighter the larger the share
  of each day's due habits you did.
- ⌘K lists "Done: <habit>" for each habit due today and not yet done, and New
  habit.

Why not move the daily check-in into the same store: rewards, the climb, the
share card, reminders and the focus timer's auto check-in all read the main
streak. Moving it would touch all of them for no visible gain; the habit
streak logic is separate because it understands weekdays, which the main
streak doesn't need.

## Inbox

`features/inbox` is for catching things in the moment and deciding later.

- **Capture** with I from anywhere (a dialog), on the Inbox page, or from the
  home-screen shortcut (`/inbox?capture=1`). Enter saves; Shift+Enter starts a
  new line. A web link in the text is picked out and shown as a link.
- **Sharing to Momentum.** The manifest declares a share target
  (`GET /inbox?title=…&text=…&url=…`), so once installed on Android, Momentum
  is in other apps' share menus. `fromShare` (pure, tested) combines the three
  fields, which apps fill in differently, without repeats; the page saves the
  item and tidies the address, and a reload can't save it twice. The service
  worker answers every navigation with the app, so this works offline.
- **Only web links are links:** anything that isn't `http:` or `https:` (such
  as `javascript:`) stays text.
- **Sorting.** Each item can become a task — read like quick add, so "Email
  tutor fri #calculus" gets its date and subject, and a link is kept in the
  title — become a note (a short first line is its title; a link moves to the
  body), be added to today's log line, or be let go.
- A notice on the dashboard says how many things are waiting, and the sidebar
  shows the count.

## Notes

`features/notes` keeps notes in markdown, for study: maths, code and links
between notes.

- **Rendering** (`markdown/`) is a pipeline loaded on first use: `marked`
  (GitHub-flavoured markdown) with extensions for `[[links]]`, `$maths$` and
  `$$display maths$$`, then **DOMPurify**. KaTeX loads only for a note with
  maths and highlight.js (core plus the languages a student is likely to write,
  Verilog and VHDL included) only for a note with code; `needs()` decides, by
  the same rules the renderer uses, so "$5 and $10" isn't maths. If either
  can't load (offline before it was cached), the note shows without it. None of
  this is in the dashboard's bundle; the maths fonts aren't precached but kept
  by the service worker once fetched.
- **Nothing in a note runs.** Raw HTML in a note is shown as text, not markup.
  The sanitiser then has the last word on the result: scripts, event handlers
  and unsafe links (`javascript:`, `data:`) are removed. KaTeX
  runs with `trust: false`, so `\href` and friends render as mistakes, not
  links. Web links open in a new tab with `noopener`.
- **Links.** `[[Title]]` links a note by title (case and spacing don't
  matter; if two notes share one, the latest wins, and the editor says so),
  `[[Title|text]]` shows other text, and `[[task:Title]]` links a task, opening
  it in the task sheet. A link to a note that doesn't exist yet offers to
  create it, so notes can be written top-down. Under each note, **Linked from**
  lists the notes that link to it with the line that does (`backlinks`, pure).
  Renaming a note rewrites links to it in other notes (`renameLinks`, which
  keeps the shown text and leaves code alone), so a rename never breaks one.
  Nothing inside code counts as a link anywhere.
- **Writing.** A note opens to read if it has text, to write if it's new
  (title first; Enter moves to the text). The body saves 400 ms after typing
  stops and whenever you leave — another page, another note, or the tab
  (`visibilitychange`/`pagehide`); the title saves when you finish it, so a
  rename rewrites links once, not on every keystroke. A change made elsewhere
  (another tab, a rename) is taken in unless you've changed that part since.
  Typing `[[` suggests note titles (or open tasks after `task:`), placed at the
  caret by measuring a hidden copy of the text; choosing one types it in, so
  ⌘Z undoes it. Escape switches to Read, E back to Write.
- **Checklists tick while reading.** Each rendered checkbox is numbered, and
  `checkboxPositions` finds the same boxes in the text (outside code); they're
  only clickable when the two counts agree, so a tick can't land on the wrong
  line.
- **Tidiness.** Notes left empty are deleted once you move on (only ones this
  tab started, or untouched for a day — another tab may still be writing one)
  and aren't listed meanwhile. Deleting a note offers Undo.
- On wide screens the list stays beside the open note; on phones the list and
  the note are separate screens with a way back. The list filters by words in
  titles and text, and by subject once notes have more than one.

## Library

`features/library` keeps PDFs to read, highlight and write in the margin.

- **Adding** (the button, a drop anywhere on the page, or the palette) checks
  that a file is a PDF (by its first bytes) and at most 100 MB, stores the
  file, then the record, and reads it in the background: the page count, a
  picture of the first page for the shelf, and each page's text for search
  (runs of text joined into words, words split across lines rejoined).
  Documents restored without these details are read when the library opens.
- **pdf.js** loads only when a PDF is added or opened, and parses in its own
  worker. It's the library's "legacy" build: the modern one relies on
  JavaScript only the newest browsers have (`Map.prototype.getOrInsertComputed`)
  and fails on many phones; the legacy one brings standard polyfills. The files
  some PDFs need — fonts not embedded in them, character maps for CJK text,
  image decoders, colour profiles — are copied into the build at `/pdfjs/` (a
  small Vite plugin; served from `node_modules` in development) and read only
  when needed. None of it is precached: the service worker keeps pdf.js and
  those files once fetched. Scripts in PDFs never run.
- **The viewer** draws pages near the screen (an IntersectionObserver, a
  screen and a half either way) and clears far ones to save memory. Each page
  is drawn on a fresh canvas that's swapped in when done, so zooming never
  blanks it, with pdf.js's text layer on top so text can be selected. Every
  page is laid out at the first page's shape until it's read. A document
  opens where you left off, once the pages have their sizes; the page under
  the reading line is remembered as you go. ← → turn pages, + − 0 zoom, H
  shows the highlights; the page number can be typed over to jump.
- **Highlights:** a selection's rectangles (`Range.getClientRects()`) become
  fractions of the page, one per line (`toPageRects`, pure), so they fit at
  any zoom. Tapping a highlight finds it by those rectangles (`hits`) and
  opens its colour and note; a note is saved as the menu closes, however it
  closes. Deleting offers Undo. **Make a note of these** turns a document's
  highlights into a markdown note: each quote with its page, its note
  beneath.
- **Search** finds documents by title and by the words inside, and opens one at
  the page the match is on (`/library/:id?page=…`).
- **Deleting** a document keeps its file a day, for Undo; after that (or once
  its record is gone) the file, picture and text are freed when the library
  next opens. A record whose file is missing (a backup made without
  documents) asks for the file. Password-protected PDFs ask for theirs.
- On the dashboard, **Continue reading** shows the document you opened in the
  last two weeks and haven't finished.

## Search

The ⌘K palette (Search in the phone tab bar) finds things as well as
commands: notes, documents, tasks, habits, routines, log lines and inbox
items.

- **Matching** (`search/lib/engine.ts`, pure): text is folded — lowercase,
  accents removed, so "godel" finds "Gödel" — and split into words. Each query
  word has to match the start of a word, in the title or the text ("karn"
  finds "Karnaugh"; "augh" doesn't); a single letter has to be a whole word,
  or it would match nearly everything.
- **Ranking:** a word in the title counts three times one in the text, a whole
  word more than a prefix, and a title that is, starts with or contains the
  whole query gets a bonus. Pinned notes are nudged up and finished tasks well
  down, so open ones come first unless a finished one is a far better match.
  Ties go to notes, then tasks, habits, routines, the log and the inbox, then
  to the latest.
- **The index** is each record's words, sorted, so a prefix is a binary
  search. It's built the first time a record is searched and cached by the
  record itself (records are replaced, never changed, when edited), with a
  version for what else it shows, like a subject's name. Nothing is indexed
  until you search, and only changed records are indexed again. With 300 long
  notes and 1,000 tasks, the first search (loading and indexing everything)
  takes about 120 ms and each keystroke after it about 25 ms.
- **What's searched:** a note's title and its text as plain lines — markdown
  marks gone, maths as readable text, code included — and its subject; a
  document's title, subject and text (one line per page, so the matching line
  is the page; the text loads when the palette first opens); a
  task's title and subject; a habit's name; a routine's name and steps; a log
  line and its date; an inbox item's text and link. Empty notes are left out.
- **Results** are grouped by kind (at most five each, thirty in all), the kind
  with the best match first, under the commands that match. Matched words are
  marked in titles, and a line of context (cut around the first match, marked
  too) shows why something matched on its text. A note opens on its page; a
  task, habit or routine in its sheet; a log line on the Log page, scrolled to
  its day (showing earlier days if needed) with a brief glow; an inbox item on
  the Inbox page.
- **Loading:** the search code loads the first time the palette opens; until
  then, or if it can't load, the palette finds commands only. The palette
  itself knows nothing about features: the shell passes it a `search`
  function returning `PaletteResult`s.

## Search by meaning

`features/embeddings` finds notes and document pages by what they're about:
"how do I make a boolean function smaller" finds the Karnaugh-map pages and a
note on minimising logic, though they share hardly a word with it. Each
passage of text becomes a vector (an embedding); a search is turned into one
too, and the closest passages win.

- **Where vectors come from** is the embeddings choice in Settings → AI:
  OpenAI, an OpenAI-compatible server (Ollama's `nomic-embed-text`, say), or
  **this device**. Vectors from different models can't be compared, so every
  entry records its model (its "space") and only the current model's entries
  are searched. Switching model doesn't throw the old vectors away; each entry
  is replaced as it's indexed again.
- **Passages** (`lib/chunk.ts`, pure): a note's plain text, or each page of a
  document, split into runs of whole sentences of up to about 900 characters
  (about 200 tokens: under the 256 the small model reads, and short enough to
  be about one thing). A passage never spans two pages, so every match has a
  page. A short last sentence also starts the next passage, for context.
  Almost-empty pages (a page number, a caption) are skipped. What's embedded is
  the title, then the passage, after any prompt the model wants
  (`lib/prompts.ts`: `search_document:` / `search_query:` for nomic, `query:`
  for e5, an instruction for bge, mxbai and arctic queries).
- **Storage** (`lib/vectors.ts`): vectors are made unit length and kept as
  8-bit steps of their largest value with one scale each: a quarter of the
  space, with practically the same ranking. The vectors of 20,000 passages
  take 31 MB at 1536 numbers each (OpenAI's), 8 MB at 384 (this device's).
- **What changed** (`lib/plan.ts`, pure): every source is fingerprinted from
  its title and text, so the plan is new or changed sources (or ones indexed
  with another model) to embed, and gone or kept-out ones to delete. Deleting
  never sends anything.
- **Updating** (`indexer.ts`) embeds passages in batches across sources (64 a
  request, 32 at a time on this device) and saves each source as soon as all
  its passages are done, so stopping or a failure keeps what was finished. One
  update runs at a time, across tabs too (Web Locks); the others hear about
  changes over a BroadcastChannel.
- **When.** With a provider, only when you ask: **Review and index…** opens
  the send preview (every note and document, ticked; untick to keep one out,
  remembered for next time), and nothing goes until Send. Searching from ⌘K
  then shows a **Search by meaning** row that says what it sends and to whom
  (`Sends to OpenAI: "…"`), and sends just your search, only when chosen. On
  this device, once you've downloaded the model, the index keeps itself up to
  date while Momentum is open (a few seconds after a change) and ⌘K searches
  by meaning as you type. In both cases what's gone is taken out by itself.
- **Searching** (`search.ts`) reads the index into memory the first time and
  keeps it current from the change events. The nearest passages are found by
  a dot product over every one (20,000 passages take about 14 ms with the
  model on this device, 50 ms with OpenAI's longer vectors), then one per page
  and three per document at most, eight in all. Matches far below the
  best (0.25 lower) or below a floor are left out, so unrelated notes don't
  pad the list: the floor is 0.2 for the model on this device, measured on
  real notes (unrelated texts score up to about 0.15), and 0.1 for the rest,
  whose scales vary. A search's vector is remembered (fifty of them), so going
  back to one doesn't send it again.
- **In ⌘K** the results are a **By meaning** group under the rest, each with
  the passage (marking any of your words in it) and its page. Something the
  words already found isn't listed twice (`opens`: the note, or the document
  and page). The palette itself stays generic: the shell passes it a
  `MeaningSearch` — searches as you type (`auto`) or when chosen (`ask`),
  and whom it sends to.
- **Related**: under a note, the notes and document pages closest to it, from
  the vectors already in the index (the average of its own): nothing is sent.
- **The model on this device** (`features/ai/local`) is all-MiniLM-L6-v2 with
  8-bit weights: 384 numbers per passage, English, 23 MB, plus ONNX Runtime's
  WebAssembly engine (14 MB, 3.7 MB compressed): 38 MB in all, downloaded
  once, on request, with progress. It runs in a module worker
  (`embed.worker.ts`, over `lib/rpc.ts`): Hugging Face's tokenizer, ONNX
  Runtime on one thread, the mean of the token states, unit length. Texts of
  similar length are batched together to save padding. The engine comes from
  Momentum's own server and the model from Hugging Face; both are kept in
  Cache Storage (`momentum-models`), so it works offline from then on, and a
  newer engine replaces the old copy. The worker sleeps after three minutes
  unused. If a download fails, the others stop with it, and both cards say
  so, with Try again.
- **Size:** the feature's code is 22 kB (8 kB compressed) and loads when ⌘K or
  Settings first needs it; the worker (111 kB, 36 kB compressed) and the
  engine load only once the model on this device is turned on. Neither is
  precached.

## The assistant

`features/assistant` answers questions in conversations, at `/assistant`:
about your notes and documents, citing the notes and pages it used, or about
your plans. It reads; it can't change anything.

- **Asking your notes and documents.** As you type, the passages most likely
  to answer are found on this device and shown under the question as chips,
  each naming its note or page; any can be taken out. A line above them says
  what goes where, such as “Sends to Anthropic (model): your question, 3
  passages from your notes and documents, and the 2 earlier messages.”
  Nothing is sent until Send; sent sooner than the passages are found, it
  finds them first.
- **Finding passages** (`retrieval.ts`). By words, ranked with BM25
  (`lib/bm25.ts`: folded, stemmed words without the common ones; k1 1.2,
  b 0.75) over the same passages search by meaning uses, titles included.
  By meaning, when there's an index: as you type with the model on this
  device, or, with a provider, only when **Also find passages by meaning** is
  chosen, since that sends the question (if it fails, it says why, and the
  passages found by words stay). The lists are combined by reciprocal rank
  fusion (k = 60) into six passages, three from one source at most (all six
  may come from the one document being asked about). Passages next to each
  other on a page are then joined (`lib/passages.ts`), the sentence they
  share kept once, so each chip is one note or page. Notes and documents
  kept out of search by meaning are kept out here too, unless it's the
  document being asked about.
- **The request** (`lib/prompt.ts`). Instructions to answer from the numbered
  sources, cite them like `[2]`, say when they don't hold the answer (and
  mark general knowledge as such), and treat the sources as material to
  read, never as instructions. The question goes last, after its passages
  (`<sources>` `[1] Lecture 5, page 2 (document)` …); up to ten earlier
  messages go before it as they were written (earlier passages aren't sent
  again), alternating and starting with a question, failed answers left
  out. Answers are capped at 4,096 tokens.
- **Answers** stream in (redrawn at most every 40 ms) and render as markdown
  with maths and code, through the notes' renderer and its sanitiser. Each
  `[n]` becomes a link to its note, or its document at that page
  (`lib/sources.ts`), anywhere but code, maths and links. Under an answer:
  the model and tokens, and anything unusual (stopped, cut off by the length
  cap, refused, failed, or interrupted by the page closing) with **Ask
  again**, which sends the same question with the same passages and replaces
  what followed. Each question keeps what went with it: **Sent with 3
  passages** shows them.
- **Stop** keeps what had arrived and marks the answer stopped. Since both
  SDKs end a cancelled stream as if it were complete, the adapters report it
  as cancelled (see AI), and the assistant checks too.
- **Saving** (`conversations.ts`, `chat.ts`). A new conversation is a draft
  until its first question; then it's a record, titled from that question,
  at its own address (`/assistant/<id>`). The question and an empty answer
  are saved before anything is sent, and the answer when it ends.
  Conversations are listed newest first; deleting one can be undone.
- **One document**: **Ask about this document** in the viewer opens
  `/assistant?document=<id>`, which finds passages in it only. A question
  with few of its words (summarise it, quiz me on it) has the places left
  filled with passages spread through the document.
- **Suggestions** on a new conversation fill in the question rather than
  send it, so its passages show first; some are a start to finish
  ("Summarise my notes on …").
- **Your plans** (`?mode=planner`). The question goes with a plain-text
  snapshot (`lib/snapshot.ts`, pure) made on this device: today's date and
  streak, then the parts you share: open tasks by when they're due (overdue,
  today, the next 7 days, later, no date; 40 at most) and what was finished
  in the past week; each habit's day, runs and four-week rate; how often each
  routine was finished in the past week; focus time today, this week and last
  week, by subject; the last 14 days of the log. Which parts are shared is
  remembered (`momentum.assistant`); **Show exactly what's sent** shows the
  text. The planning assistant has no tools: asked to change something, it
  says how to do it in Momentum.
- **Where**: **Ask** in the sidebar, ⌘K (**Ask your notes and documents**,
  **Ask about your plans**), and the document viewer. On phones it isn't in
  the tab bar; ⌘K (Search) and the viewer lead to it. Until a chat provider
  is set up, `AiGate` shows its card.
- **Size**: the page is 32 kB (12 kB compressed), loaded when it's opened;
  its commands and place in the navigation add 2 kB to the first load.

## Flashcards

`features/flashcards` keeps questions and their answers and brings each back
just before you'd forget it, scheduled by FSRS (the Free Spaced Repetition
Scheduler, through `ts-fsrs`, its reference implementation).

- **Cards** (`cards.ts`): a collection. Front and back are markdown (maths
  and code included); each has a subject, where it came from (a note, or a
  document and page) and its schedule. Editing a card keeps its schedule;
  **Start this card again** resets it.
- **Scheduling** (`scheduler.ts`, `lib/schedule.ts`): FSRS with its default
  parameters, short steps while learning (1 and 10 minutes; 10 when
  relearning) and a little spread on long intervals, aiming for the recall
  you choose (90%, or 80–95%). When the answer shows, each rating's outcome
  is worked out once, at that moment, and shown on its button; rating
  applies that outcome, so the interval on the button is the one you get.
  FSRS comes with the Cards page (8 kB compressed), so studying never waits
  for it.
- **What's due** (`lib/queue.ts`, pure): steps of cards being learnt that
  are due within 20 minutes, then reviews due by the end of today (oldest
  first), then new cards in the order they were made, up to the day's limit
  (20 by default, for all subjects together, counted by the day each card
  was first studied). The card just answered isn't shown twice running
  while others wait; one brought back by Undo comes first.
- **Studying** (`components/ReviewSession.tsx`): the question, then the
  answer (Space or Enter), then a rating: Again, Hard, Good or Easy (1–4),
  each with its interval. Z takes back the last rating (the card and its log
  line); E edits the card. What's showing and what's been rated are kept in
  refs, so a rating pressed straight after Space counts, a key pressed twice
  rates once, and Undo waits for the rating it takes back to be saved. The
  session ends with the answers given and when the next card is due.
- **The review log** (`reviews.ts`): every rating, with the card's state
  before, the days since its last review, the schedule it led to and how
  long the answer took. It's an indexed store read by day, not a collection
  held in memory (it grows by thousands a year), and it's backed up, so
  FSRS's parameters can be fitted to you later.
- **Making cards**: by hand (a sheet with a preview; ⌘/Ctrl Enter saves, and
  **Add and write another** keeps going); from a note's
  `question :: answer` lines (`lib/text.ts`: the spaces around `::` are
  needed, so `std::vector` isn't a card, and code and maths blocks are
  skipped); or with AI (`generate.ts`). For AI, a note, or one page or all
  of a PDF (whole pages, up to 24,000 characters), goes through the send
  preview first; the model is asked for a JSON list, one idea a card, only
  what the text says, maths in LaTeX, the text treated as material and not
  as instructions, and its reply is read leniently. Everything arrives as
  drafts to tick and edit, and ones already made from the same source start
  unticked. The note's toolbar and the PDF's details link to
  `/cards/make?note=…` or `?document=…&page=…`, so neither feature imports
  this one.
- **The habit**: **Count cards as a habit** makes (or reuses) a habit, "Study
  cards"; the rating that leaves nothing to study today ticks it.
- **Elsewhere**: the dashboard shows what's due once there are cards, ⌘K
  finds cards by either side and opens them, R starts studying, and
  Settings → Data can delete every card with its reviews.
- **Size**: the Cards page is 52 kB (16 kB compressed) with FSRS, loaded when
  it's opened.

## Routines

`features/routines` keeps short checklists for a part of the day — a morning
start, a study warm-up, an evening wind-down — that start fresh each day.

- **The one for now comes first.** `sortForNow` (pure, tested) orders today's
  routines: this part of the day (morning from 4am, afternoon from noon,
  evening from 5pm), then "any time", then the rest, so an unfinished morning
  routine is still there in the evening. On the dashboard the first unfinished
  one is open as a checklist with a progress bar; the others are folded.
- **A day is done when every step is.** Ticking the last step sets the run's
  `completedAt`; unticking any step clears it. Progress only counts current
  steps, so removing a step later doesn't skew past days.
- **Streaks** reuse the habits logic over completed days (with the routine's
  weekdays), so days a routine isn't due never break its run.
- **Starting one** takes a tap: Morning, Study session and Evening templates,
  or a routine of your own. The sheet edits the name, steps (add, reorder,
  rename, remove), part of the day and days, and shows its numbers.
- The weekday picker is shared with habits (`components/DayPicker.tsx`).

## Daily log

`features/log` keeps one line per day — what you did, how it went — in the
`logEntries` collection (see Data model). `setLine(day, text)` tidies the text
into one line (at most 200 characters, never splitting an emoji), keeps the
time it was first written, and soft-deletes a line saved empty.

- **On the dashboard,** once you've checked in, the hero offers "Add a line
  about today" under the day's message, through a `footer` slot, so the streak
  feature doesn't know the log exists. The line is written in place: Enter or
  leaving the field saves, Escape cancels.
- **The Log page** lists every day with a line, a check-in or focus time,
  newest first and grouped by month (60 days at a time). Past days without a
  line show what happened with a quiet "Add a line"; any day's line can be
  written or changed later. The page composes three features — the log, the
  streak's check-ins and focus totals — with `buildTimeline` (pure, tested)
  doing the joining, so none of them depends on the others. The page's own
  pieces come from `features/log/page.ts` rather than `index.ts`, so the
  dashboard doesn't preload them.
- **L** writes today's line: in place if it's on screen (the dashboard after
  checking in), otherwise on the Log page with the field focused.
  `lineRequestStore` carries the request to whichever editor is showing that
  day.

## Ambient sound

No audio files: `ambience/lib/sounds.ts` builds each soundscape from looped
noise buffers. Wind is band-passed pink noise swept by slow, unrelated LFOs;
rain is a filtered hiss plus scheduled droplet bursts; fire is a low brown-noise
roar plus crackles and pops. A compressor guards the mix. The AudioContext is
created on the first play, which always follows a click or key press.

## Commands and shortcuts

`app/commands.tsx` lists every action once (title, section, keywords, optional
hotkey). The ⌘K / Ctrl K palette searches it (and everything else; see
Search); the same list drives the keyboard
shortcuts and the shortcuts sheet. Single-key shortcuts (C, F, N, I, L, R, M,
S, A, T, `,`, `?`) are ignored while typing or while a dialog (`aria-modal`)
is open. Bindings are refreshed before paint, so a key pressed as soon as
something new shows reaches the handlers that go with it. N adds a task and I captures to the inbox, from anywhere; New note and
Go to Notes are in the palette, and on a note E starts writing. F starts,
pauses or resumes the focus timer; the palette also offers "Start focus on
<subject>" for each subject, skip break and cancel, as they apply.

## Offline, install and reminders

- `vite-plugin-pwa` (injectManifest) builds `src/sw.ts`, which precaches the app
  shell, pages, fonts and icons (Latin subsets only) and serves `index.html` for
  every navigation, so the app — including check-ins — works offline. The AI
  SDKs, pdf.js and the maths fonts are the exceptions: they're fetched the
  first time they're needed and kept from then on. So is the embeddings
  worker; the model it runs, and its engine, are kept in Cache Storage once
  downloaded, so search by meaning on this device works offline too.
- Updates are offered with a toast rather than applied silently.
- **Chunks.** React and Motion are a `vendor` chunk, which rarely changes, so an
  update re-downloads only Momentum's own code. Code the bundler splits out
  because several chunks share it is named `shared-*.js` (rather than after
  whichever module came first). Everything the dashboard needs is preloaded.
- The **evening reminder** fires at a chosen time, once a day, only if you haven't
  checked in. While Momentum is open (even in a background tab) a timer handles
  it: a toast if you're looking at the app, a notification otherwise. The
  service worker can't read `localStorage`, so the bits it needs are mirrored to
  IndexedDB; installed Chromium apps also get periodic background sync, which
  wakes the worker at the browser's discretion.
- Notifications offer a **Check in** action that opens `/?checkin=1`, as does the
  home-screen shortcut.
- `lib/notify.ts` is the one way to show a notification (through the service
  worker when there is one) and to ask for permission; the reminder and the
  focus timer both use it.
- Limits: without a push server, reminders can't be guaranteed while the app is
  fully closed. iOS only allows notifications for apps added to the Home Screen.

## Where future features plug in

[ROADMAP.md](ROADMAP.md) maps every planned feature to a folder and a phase.
In short: each is a new `features/<name>/` with its own stores or collections
(a collection is an object store in a new database version), a lazily loaded
page under `pages/`, commands in the palette, a `CalendarView` if it has days
to show, subjects if its records belong to one, and `AiGate` + the `ai` client
if it uses AI. The focus timer is the worked example.

## Testing

Vitest covers the parts where bugs hide: date arithmetic (month, year, leap-day
and DST boundaries — tests run in `Australia/Sydney`), streak rules, calendar
layout, message selection, the store registry (hydration, localStorage
migration, corruption, write-through, lazy stores, restore and merge),
collections (atomic add, soft delete, merge), the database upgrade paths
(every older version to the current one, data kept), backups (round trip,
opt-in keys, sessions, v1 and v2 files; encryption: round trip, wrong
passwords, altered files, the same password typed differently, iteration
bounds), the focus timer (remaining time across pause and resume, resuming
after a reload, sessions that ended while the app was closed, midnight crossing, auto
check-in once per day, two wake-ups at once, daily totals and levels),
habits (streaks over chosen weekdays, days off, the last week, the four-week
rate, ticking on and off, merging), routines (part of the day, today's order,
editing steps, completing and reopening a day), the inbox (what apps share,
safe links, capturing, making notes), the library (selection rectangles,
page text, highlights as a note, adding files and refusing others, Undo and
freeing deleted files, damaged records), search (folding accents, word starts,
every word, single letters, ranking and ties, snippets, every kind of record,
finished tasks, edits, the per-kind limit), search by meaning (passages within
pages, overlap, long sentences, nearly empty pages; 8-bit vectors; the update
plan; model prompts; nothing sent until asked, only what was ticked, only
what changed, deleting without sending, another model starting afresh,
related notes, snippets; the worker calls, errors, events and transfers;
tokenising, padding, pooling — and, given the real model's files in
`MOMENTUM_TEST_MODEL_DIR`, sensible similarities from it), flashcards (schedules to FSRS and back, damaged
records, what's due and in what order, the new-card limit across subjects,
intervals, cards in notes, reading suggested cards, FSRS's steps and
intervals, saving, logging and undoing a rating, the review log where
backups read it, the habit), the assistant
(keyword ranking and fusion, joining neighbouring passages, the request and
its history, citations, the plans snapshot and its parts, keeping to one
document, answers saved with what was sent, failures, Ask again, Stop
whether the stream ends with an error or quietly), notes (links, backlinks, renaming
links, previews, ticking boxes, `[[` suggestions, tidying empty notes; rendering:
maths but not money, Verilog highlighting, raw HTML as text, TeX that can't
link, clean MathML), the daily log (one line per day, edits, deletion, tidying, the timeline), tasks
(quick add across dates, times, subjects, priorities, repeats and the words it
must leave alone; repeating schedules through short months and missed dates;
finishing, reopening, board moves, grouping), the AI
layer (retries, Retry-After, the gate, error mapping, both adapters and
cancelled streams, usage and cost, settings parsing), light blending, climb progress, trail geometry and
skyline detection (on synthetic images), command search and hotkey matching,
noise generation and reminder scheduling. UI flows — including migrating real
v2 data, a connection test through the real SDK, and search by meaning with
the real model in the browser (downloading it, failing to, indexing, ⌘K,
related notes, offline) and with a stand-in provider that logs every request
(nothing sent before Send or before searching is chosen), and the assistant
against a stand-in chat server (exactly the passages shown and not the ones
taken out, citations opening their pages, follow-ups, Stop, the plans
snapshot without the parts left out, nothing sent while typing), and
flashcards (studying with the keys, Undo, cards from a note's lines and
from a PDF page with AI, nothing sent before Send, search, the habit,
deleting them all) — are checked in a headless browser at desktop and phone
sizes.
