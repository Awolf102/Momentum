# Momentum — Roadmap to Version 3

Version 3 turns Momentum from a streak app into a personal productivity
platform: planning, notes, documents, learning and insight, with optional
bring-your-own-key AI. This document maps the requested features onto the
existing architecture (see [ARCHITECTURE.md](ARCHITECTURE.md)), names the shared
foundations they need, orders the work into phases, and flags what should be
cut or changed. It is updated at the end of every phase.

## Where we are starting

Built so far (v1 + v2): daily check-ins and streak rules, the activity calendar,
motivational messages, backgrounds with time-of-day light and rewards, the climb,
the share card, procedural ambient sound, the evening reminder, offline/PWA
support and the ⌘K command palette.

**Gaps between the brief and the code.** The brief refers to existing "log" and
"focus" data and to "existing focus labels". None of these exist yet: the first
feature list I received started at item 12, so items 1–11 (which presumably
included a focus timer and a log) were never built. In this roadmap:

- **Subjects** (the focus labels: studying, programming, exercise, reading…)
  become a shared foundation in Phase 2, because documents, habits, tasks and
  analytics all tag by subject.
- **The focus timer and a daily log** are scheduled in Phase 2. The "timer"
  brief that is still to come will slot in there. (It has: see Progress.)
- Phase 1's storage migration therefore covers the data that exists today:
  streak, appearance, climb trails, ambience, reminder settings and photos.

## Principles → decisions

| Principle   | Decision                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local-first | One versioned IndexedDB database (`momentum`) holds everything. Stores keep their synchronous in-memory API and write through to IndexedDB, so components don't change. The app is fully usable with no keys.                                             |
| BYO-key AI  | `features/ai` is the only code that talks to providers: Anthropic, OpenAI and any OpenAI-compatible endpoint (including Ollama), each via its official SDK, loaded on demand. Models are text the user types or picks from the provider's own model list. |
| Privacy     | Keys live in a separate `secrets` object store: never in a store, a log, a broadcast message or a backup unless the user opts in. AI calls happen only on an explicit action, and each AI feature shows what will be sent before sending it.              |
| Performance | Pages are code-split by route. Heavy libraries (pdf.js, KaTeX, syntax highlighting, the in-browser embedding model) load only on the screens that need them. PDF parsing and embeddings run in Web Workers. Bundle size is reported every phase.          |
| Look        | The shell keeps the background, glass cards and serif numerals. New pages use the same `GlassCard`, tokens and motion rules, and work on phones first.                                                                                                    |

## How the features fit the feature-folder architecture

Every feature is a folder under `src/features/` with a public `index.ts`, its own
stores or IndexedDB collections, pure tested logic in `lib/`, and commands
registered in the palette. Pages under `src/pages/` compose features, and the
router in `src/app/` mounts the pages.

| #   | Feature                        | Folder                                           | Builds on                                                     |
| --- | ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| 1   | Document library + PDF viewer  | `features/library`, `workers/pdf.worker.ts`      | storage (blobs), subjects; pdf.js lazy                        |
| 2   | Embeddings + semantic search   | `features/embeddings`, `workers/embed.worker.ts` | `ai.embed`, library chunks; transformers.js lazy for local    |
| 3   | Chat with documents/assistant  | `features/assistant`                             | `ai.chat`, embeddings, read-only views of tasks/notes/focus   |
| 4   | Flashcards + spaced repetition | `features/flashcards`                            | `ai.chat`, notes/library sources, habits (due cards as habit) |
| 5   | Practice quizzes               | `features/quizzes`                               | `ai.chat`, library (page links)                               |
| 6   | Image to notes                 | `features/capture` (vision)                      | `ai.chat` with images, notes, markdown renderer               |
| 7   | Voice notes                    | `features/capture` (audio)                       | transcription provider, notes                                 |
| 8   | Tasks + quick add              | `features/tasks`                                 | subjects, recurrence + quick-add parsers (pure)               |
| 9   | Kanban                         | `features/tasks` (a board view)                  | tasks                                                         |
| 10  | Time blocking + .ics import    | `features/planner`                               | tasks, focus sessions, ics parser (pure)                      |
| 11  | Goals                          | `features/goals`                                 | tasks, habits                                                 |
| 12  | AI planner + weekly review     | `features/planner`, `features/review`            | `ai.chat`, tasks, calendar, focus, log                        |
| 13  | Notes                          | `features/notes`                                 | markdown renderer, backlinks index                            |
| 14  | Quick capture inbox            | `features/inbox`                                 | PWA share target, notes/tasks                                 |
| 15  | Global search                  | `features/search`                                | keyword index over every collection; embeddings when present  |
| 16  | Routines                       | `features/routines`                              | dashboard slot                                                |
| 17  | Multiple habits                | `features/habits` (generalises `streak`)         | streak lib (already pure over day lists), calendar            |
| 18  | Analytics                      | `features/analytics`                             | pure aggregations over every collection; SVG charts           |
| 19  | Encrypted backup               | `features/backup`                                | Phase 1 backup format + WebCrypto                             |
| 20  | Sync backend                   | `server/` (separate package) + a remote backend  | the storage backend interface from Phase 1                    |

The streak logic already works on a plain list of days and the calendar already
renders any `DateKey → level` map. Multiple habits therefore reuse both
unchanged; the work is a `streak` store migration from one history to a map of
habits, with the main streak kept as the headline.

## Shared foundations

**Phase 1 (this phase).**

- **Routed app shell.** A sidebar on desktop and a bottom tab bar on phones. The
  dashboard stays the home screen. Pages are lazy-loaded.
- **Storage.** IndexedDB as the primary store, with a versioned database schema
  and per-record schema versions with migrations. Existing localStorage data is
  migrated on first run and survives. Cross-tab sync uses BroadcastChannel.
  Backup v2 covers every store and photo, with API keys only on opt-in.
- **AI provider layer.** Chat (streaming, cancellable) and embeddings
  interfaces, retries with backoff that honour `Retry-After`, a rate-limit
  cooldown, a concurrency limit, error normalisation, usage tracking, and a mock
  provider for tests.
- **Settings → AI.** Chat and embedding providers and models chosen
  separately, keys, a Test connection button, and a monthly token/cost counter.

**Introduced when first needed.**

- **Subjects registry** (Phase 2, built with the focus timer): name and colour,
  soft-deleted so history keeps them; used everywhere a thing can be "about"
  something. Icons can come later.
- **Collections API** (Phase 2, built with the focus timer): typed IndexedDB
  collections with indexes, `createdAt`/`updatedAt`/`deletedAt` on every record
  (soft deletes keep sync possible later), atomic adds across tabs, merge on
  import, and change events for live queries.
- **Markdown renderer** (Phase 3): one component with KaTeX and code
  highlighting, both lazy, shared by notes, chat answers and image-to-notes.
- **Search index** (Phase 3): keyword index fed by every collection; semantic
  results merge in once embeddings exist.
- **Workers** (Phase 4): a small typed RPC wrapper for PDF parsing and embedding.
- **AI action preview** (Phase 4): a component that shows exactly what will be
  sent (documents, excerpts, counts) and the model, before any AI call.

## Phases

Each phase gets its own branch and PR, and ends with a summary, screenshots at
desktop and phone sizes, and a bundle-size report.

1. **Foundations** — shell and routing, IndexedDB storage and migrations, the AI
   provider layer, Settings → AI, backup v2.
2. **Planning core and habits** — subjects, the focus timer and daily log (the
   upcoming timer brief), tasks with quick add and recurrence, the kanban view,
   multiple habits, routines, the quick-capture inbox, and encrypted backup
   (moved earlier, see below).
3. **Notes and search** — markdown notes with LaTeX, code and `[[backlinks]]`,
   links to tasks; global keyword search wired into ⌘K.
4. **Documents and AI** — library, PDF viewer with highlights and margin notes,
   chunking and embeddings (API or in-browser) in workers, semantic search,
   chat with documents with page citations, and the read-only general assistant.
5. **Learning** — flashcards with FSRS and a review queue (due cards as a habit),
   practice quizzes, image to notes, voice notes.
6. **Time and insight** — time blocking with .ics import, goals, the AI planner,
   the weekly review, analytics.
7. **Sync (optional)** — a small self-hostable server with auth and SQLite or
   Postgres, a sync protocol over the soft-deleted, timestamped records, and an
   optional AI proxy so keys can live on the server. The app keeps working
   without it.

The **Higgsfield asset pack** lands best after Phase 2, once the timer, badges
and empty states it decorates exist. Backgrounds, the photo's time-of-day
versions and the flame stages could go in earlier.

## Recommended cuts and changes

- **Kanban is a view, not a feature.** It ships with tasks in Phase 2.
- **Encrypted backup moves to Phase 2.** It's small (WebCrypto AES-GCM with a
  PBKDF2-derived key), and once tasks, notes and documents exist an unencrypted
  backup that may contain API keys is the wrong default.
- **Embeddings providers.** Anthropic has no embeddings API, so embeddings come
  from OpenAI, any OpenAI-compatible endpoint (Ollama serves local embedding
  models) or the in-browser model. The in-browser model downloads its weights
  (tens of MB) once, so it needs a connection on first use and is opt-in.
- **Voice notes.** Transcription needs an endpoint that offers it (OpenAI or a
  compatible server); Anthropic doesn't transcribe audio. The browser's Web
  Speech API could be a keyless fallback, but some browsers send audio to their
  vendor's servers, so it should be clearly labelled or left out.
- **AI cost counter.** Model names aren't hardcoded, so prices can't be either.
  Usage is counted in tokens per model, and an estimated cost appears once you
  enter a price per million tokens for that model.
- **Weekly review "every Sunday".** Without a server this runs the first time
  Momentum is opened on or after Sunday, with an optional reminder. (Built as
  the week on the dashboard on Sundays, and last week's on Mondays; see
  below.)
- **Analytics after the data exists.** "Best hours" and "focus by subject" need
  focus sessions (Phase 2) to accumulate, so analytics comes in Phase 6.
- **Sync last, and minimal.** The Phase 1 storage interface keeps it possible.
  It's worth deciding later whether the AI proxy is needed at all, since keys
  already stay on the device.

## Risks

- **Browser storage eviction.** Safari may clear site data for web apps that
  aren't installed and haven't been used for a while. Mitigations: install
  prompt, `navigator.storage.persist()`, and backup reminders (Phase 2).
- **CORS for direct API calls.** Anthropic needs its direct-browser-access
  header (set by the SDK). OpenAI allows browser calls. Ollama must be started
  with `OLLAMA_ORIGINS` set to Momentum's origin. Settings explains each.
- **Bundle growth.** Mitigated by route splitting and lazy SDKs; tracked per
  phase.

## Progress

| Phase | Status    | Notes                                                                                                                                                                                                                                                                                                                                                      |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | In review | Branch `claude/v3-phase-1-foundations` (PR #2), stacked on the v2 branch (PR #1)                                                                                                                                                                                                                                                                           |
| 2     | In review | Focus timer, subjects and collections (`feature/focus-timer`); daily log (`feature/daily-log`); tasks with quick add, repeats and the board (`feature/tasks`); password-protected backups (`feature/encrypted-backup`); more habits (`feature/habits`); routines (`feature/routines`); the inbox (`feature/inbox`). Each its own PR, stacked in that order |
| 3     | In review | Notes with maths, code and links (`feature/notes`, PR #10); search in ⌘K (`feature/search`), stacked on notes                                                                                                                                                                                                                                              |
| 4     | In review | Document library and PDF viewer with highlights (`feature/library`), stacked on search; search by meaning (`feature/embeddings`), stacked on the library; chat with documents and the assistant (`feature/assistant`), stacked on search by meaning                                                                                                        |
| 5     | In review | Flashcards with FSRS (`feature/flashcards`, PR #15), stacked on the assistant; practice quizzes (`feature/quizzes`, PR #16), stacked on flashcards; image to notes (`feature/image-notes`, PR #17), stacked on quizzes; voice notes (`feature/voice-notes`, PR #18), stacked on image to notes                                                             |
| 6     | In review | Time blocking with .ics import (`feature/time-blocking`, PR #19), stacked on voice notes; goals with milestones, linked tasks and habits (`feature/goals`, PR #20), stacked on time blocking; the AI planner and weekly review (`feature/ai-planner`, PR #21), stacked on goals; analytics (`feature/analytics`, PR #22), stacked on the AI planner        |
| 7     | In review | The sync server and sync in the app, encrypted on the device (`feature/sync`, PR #23), stacked on analytics                                                                                                                                                                                                                                                |

### What Phase 1 changed in the plan

- **`max_tokens` is cheap on Anthropic.** Its docs say output-token rate limits
  count only generated tokens, so the chat default is high (64 000, capped at
  each model's own limit from the Models API) rather than small.
- **The SDKs are big.** Anthropic's is 223 KB (56 KB gzipped) and OpenAI's
  371 KB (82 KB gzipped). Both load only on the first AI request and are left
  out of the offline precache; the service worker keeps them after first use.
  The in-browser embedding model (Phase 4) will follow the same pattern.
- **Lazy pages bring their own stores.** The store registry now loads a store
  when a lazy page first creates it, and backups read data for stores that
  haven't loaded yet, so nothing is missed. Later phases can rely on this.
- **One OpenAI-compatible server.** Chat and embeddings share one compatible
  address (e.g. Ollama for both). If people want two different servers, a
  list of custom endpoints can replace the single address.
- **`AiGate` waits for its first user.** The "add a key in Settings" card is
  built (the readiness check behind it is unit-tested), but no AI feature uses
  it until Phase 4.
- **Local servers and browsers.** A hosted Momentum calling `localhost` (Ollama)
  needs `OLLAMA_ORIGINS`, and Chromium may ask for local-network permission.
  Settings explains the first; the second is the browser's own prompt.

### What the focus timer changed in the plan

- **Check-in rules the brief expected don't exist yet.** The timer brief asks
  to respect streak freezes, effort levels and the one-line log. Only "once per
  calendar day" exists today. The timer checks in through the streak's own
  `checkIn()`, so freezes, effort and the log will apply to it automatically
  when they're built (the log is still Phase 2).
- **Collections load whole.** A collection is read into memory at start-up.
  That's right for focus sessions (a few a day is a few thousand records over
  years) and keeps reads synchronous for React. Tasks and notes can add
  index-backed queries (`by-day`, `by-subject` already exist for sessions) if
  they outgrow it.
- **Subjects are the first shared registry.** Tasks, notes, documents and
  habits should tag by the same subjects rather than each keeping a list.
- **The calendar takes views.** Each feature with days to show gives the
  calendar a `CalendarView`; multiple habits (Phase 2) will add one per habit
  without touching the calendar.

### What habits changed in the plan

- **The daily check-in wasn't moved into a habits map.** The plan was to
  migrate the streak's history into `habits.default`. Rewards, the climb, the
  share card, reminders and the timer's auto check-in all read the main
  streak, so habits were added beside it instead: their own definitions and a
  `habitCheckIns` collection. Nothing about the main streak changed. If a
  habit should ever become the headline, that's a view choice, not a
  migration.
- **Habits can be due on chosen weekdays,** so their streaks have their own
  (tested) logic: days off neither break nor extend a run.

### What the inbox changed in the plan

- **The inbox sorts into tasks and the log for now.** Notes arrive in Phase 3;
  "make it a note" joins the other two then.
- **Sharing works on Android.** The share target is part of the web app
  manifest; iOS doesn't offer installed web apps in its share sheet, so there
  capture is by I, the dashboard or the home-screen shortcut.

### What notes changed in the plan

- **The markdown renderer lives in `features/notes/markdown`** and loads in
  pieces: markdown and the sanitiser on first use, KaTeX only for a note with
  maths and highlight.js only for one with code. Chat answers and
  image-to-notes (Phases 4–5) can call the same `loadRenderer`.
- **There's no backlinks index.** Links stay in the note text as `[[Title]]`
  and backlinks are worked out when a note is shown; for a student's notes
  (hundreds, not hundreds of thousands) that's instant, and it can't drift out
  of step. The search index (next) is where an index earns its keep.
- **"Make it a note" joined the inbox**, as planned.
- **Notes took the Log's place in the phone tab bar** (it holds five). The Log
  is still in the sidebar on wide screens, and on phones in Search (⌘K).

### What search changed in the plan

- **The keyword index lives in memory and builds itself as you search.**
  Each record's words are worked out the first time it's searched and kept
  until it changes, so there's nothing to store, migrate or keep in step, and
  nothing runs until the palette opens. At a student's scale (hundreds of
  notes, thousands of tasks) a search takes milliseconds. A stored index can
  come later if libraries of PDFs need one.
- **Semantic results (Phase 4) slot in beside it.** The palette takes
  results in groups, so "related" matches from embeddings can be one more
  group, without the palette knowing where they came from.
- **The palette is search.** It was already behind the phone tab bar's
  Search; it now finds things as well as commands.

### What the library changed in the plan

- **No PDF worker of our own.** pdf.js already parses in its own worker, so
  `workers/pdf.worker.ts` isn't needed; the embeddings worker (next) is the
  first of our own.
- **pdf.js's legacy build.** The modern build needs JavaScript features only
  the newest browsers have, and failed in testing; the legacy build adds
  standard polyfills and works on the phones students carry.
- **Text is read when a PDF is added,** one string per page. Search uses it
  now (with the page to open at), and chunking for embeddings will start from
  it rather than parsing PDFs again.
- **Highlights are fractions of the page,** so they survive zooming, other
  screen sizes and (later) sync between devices.

### What search by meaning changed in the plan

- **The model on this device runs on ONNX Runtime directly,** with Hugging
  Face's tokenizer, not through transformers.js: that package also installs
  Node-only parts (a 300 MB native runtime, an image library) that a browser
  app never uses. What's needed — tokenise, run, average, normalise — is about
  a hundred lines, and tested.
- **The model is all-MiniLM-L6-v2** (English, 23 MB with 8-bit weights), the
  one that could be checked end to end here. A stronger retrieval model such
  as bge-small (about 50% bigger, slower) can be added as another built-in
  choice; the code takes a model description, not a name.
- **Its files come from Hugging Face** when you download it, from the `main`
  revision (pinning a commit or a checksum needs the real files to check
  against). `VITE_MODEL_HOST` points a build at a copy of your own. The engine
  comes from Momentum's own server.
- **With a provider, a search is sent only when chosen,** not as you type:
  typing is not asking to send. On this device, nothing is sent, so it
  searches as you type.
- **The send preview is built** (`SendPreview` in `features/ai`): the
  provider, the model, exactly what goes (with boxes to leave things out),
  the size and the cost. Chat with documents will use it too.
- **Related notes came with it,** under each note, from vectors already
  indexed.
- **The index isn't backed up.** It's derived from notes and documents, and is
  rebuilt after a restore (the preview shows what that sends).
- **Next:** chat with documents, citing pages, using this index to find the
  passages to send; then the read-only assistant.

### What the assistant changed in the plan

- **One page for both.** Chat with documents and the read-only assistant are
  one **Ask** page: a conversation is about your notes and documents (citing
  pages) or about your plans. Conversations, streaming, Stop and Ask again
  are shared; what differs is what goes with the question.
- **Passages are found by words too, on the device.** Questions often name
  the terms in the notes ("Karnaugh map"), so a keyword ranking (BM25) over
  the same passages finds them with no index and nothing sent, and works
  before search by meaning is set up. With an index, the two are combined.
- **The composer is the send preview.** Rather than a sheet before every
  question, the passages appear as you type, each one removable, with a
  line saying where they go; Send sends exactly that. The send preview sheet
  stays for indexing, where there's a lot to review at once.
- **What's kept out of search by meaning is kept out of questions too,**
  unless it's the document being asked about: unticking a note once keeps it
  out of both.
- **The assistant sees a snapshot, not tools.** Your plans are summed up on
  the device as plain text, from the parts you choose, and can be read in
  full before sending. With no tools it can't change anything. Tools (adding
  a task, say), each confirmed, can come with the AI planner in Phase 6.
- **Cancelled answers were reported as finished.** Both SDKs end a cancelled
  stream quietly; the Phase 1 adapters now report it as cancelled.
- **Next:** Phase 5, learning: flashcards with FSRS and a review queue,
  practice quizzes, image to notes, voice notes.

### What flashcards changed in the plan

- **Subjects are the decks.** Cards have a subject, like tasks, notes and
  documents, so there's no second way of grouping things to keep in step.
  Study all of them or one subject's.
- **FSRS from `ts-fsrs`, not our own.** It's the reference implementation
  (MIT, no dependencies, 8 kB compressed); reproducing the formulas would
  risk subtle errors. 5.4.2, the stable release (6.0 is in beta).
- **The review log is kept from the first rating,** in a store read by day,
  so fitting FSRS's parameters to you (its optimizer) can come later with
  the history already there.
- **Cards from notes need no AI:** `question :: answer` lines. AI
  suggestions go through the send preview and come back as drafts to keep
  or not.
- **Due cards as a habit is a switch:** it makes a "Study cards" habit,
  ticked once the day's cards are done.
- **Next:** practice quizzes, then image to notes and voice notes.

### What quizzes changed in the plan

- **Notes as well as PDFs, several at once.** The plan said "from selected
  documents"; a quiz can mix PDFs (whole, or pages written as in a print
  dialog) and notes. When they don't all fit in one request, pages are
  taken from all through them rather than from the start.
- **Short answers are marked by you, or by AI when you ask.** Marking
  yourself against the model answer sends nothing; **Check with AI** sends
  only the question, the model answer and your answer. Your mark can
  always replace AI's.
- **Wrong answers link back to the page,** as planned, and can also become
  cards, so a quiz feeds the spaced repetition from Phase 5's first part.
- **Multiple choice is checked, not trusted.** The right choice must be
  written out (a bare number can't say whether it counts from 0 or 1), and
  choices are shuffled because models favour putting the answer first.
- **What's sent, and reading replies, is shared** in `features/ai/material.ts`,
  so cards and quizzes (and whatever comes next) fit text into a request
  and read JSON replies the same way.
- **Next:** image to notes (a vision model turns a photo of handwritten
  notes or a whiteboard into markdown), then voice notes.

### What image to notes changed in the plan

- **The AI layer carries pictures.** A message can hold text and pictures;
  each provider gets them its own way. Nothing else in the app had to
  change, and voice notes can follow the same pattern for audio.
- **The chat model, not a separate vision setting.** Most current chat
  models read pictures; one that can't says so with an error, which the
  page explains, rather than every user setting a third model.
- **Photos are scaled down on the device** to what the model reads anyway
  (1568 px, 1.15 megapixels), so uploads are smaller and the token
  estimate is right. They aren't kept: notes have no attachments yet.
- **You check it before it's a note.** The transcription opens to read and
  edit, with `[?]` where a word couldn't be read; only **Save** makes it a
  note.
- **Next:** voice notes (record, transcribe with a speech-to-text API,
  save as a note), the last of Phase 5.

### What voice notes changed in the plan

- **Transcription is a third AI task,** beside chat and embeddings, with
  its own provider and model: OpenAI (Whisper or a GPT transcribe model) or
  a compatible server. It's a call of its own (`ai.transcribe`) rather than
  audio inside chat messages, the way pictures went: that's what OpenAI and
  compatible servers offer, and Anthropic's models don't take audio.
- **The Web Speech API is left out.** In Chrome it sends audio to Google,
  which the send preview couldn't honestly describe.
- **The transcript is the note; tidying is a choice.** What was said comes
  back as said, to read and edit. **Tidy it into notes** is a second send,
  to the chat model, that organises it into headings and points, and can
  be undone. A lecture's words aren't rewritten unless you ask.
- **Length and size in the preview, not tokens.** Whisper is priced by
  the minute, so a token count would mislead.
- **One request per recording.** Recording speech at 32 kbps keeps an hour
  to about 15 MB, inside the 25 MB providers take at once, so nothing is
  split; a bigger file is turned away with the reason.
- **No attachments, again.** The recording isn't kept with the note, as
  with photos.
- **Phase 5 is complete.** Next is Phase 6: time blocking with .ics
  import, goals, the AI planner and weekly review, and analytics.

### What time blocking changed in the plan

- **Files, not subscriptions.** Calendars come in as .ics files, read-only,
  as planned. A calendar's web address would need a server to fetch it past
  CORS, so importing a newer file replaces an imported one; Phase 7's
  optional server could subscribe instead.
- **Times keep their zone.** Events are kept as written (a wall-clock time
  and its zone) and put on the day with `Intl`, so a weekly class stays at
  its time through daylight saving, and Outlook's Windows zone names work.
- **Blocks are records of their own, not task times.** A task's block links
  to the task and leaves its due date and time alone: a deadline isn't when
  you'll do it. Tasks due at a time are marked on the day instead.
- **Repeats it can't follow are shown once, and counted,** rather than
  guessed at; the import says how many.
- **On a phone, hold a block to drag it,** so the day still scrolls under a
  finger; the arrow keys do the same for keyboards.
- **A page, a dashboard card and P,** rather than a tab on phones, whose bar
  has room for five.
- **Next:** goals (long-term, with milestones, linked to tasks and habits),
  then the AI planner and weekly review, which can draft blocks onto this
  timeline, then analytics.

### What goals changed in the plan

- **Steps are milestones and one-off tasks.** The bar is the share of them
  done. Repeating tasks and habits never finish, so they show how steadily
  they're done instead (times done, streaks, four weeks) and aren't steps.
- **Tasks are linked by series,** so a repeating task stays linked as it
  moves on to its next time; a deleted task or habit drops out and comes
  back with Undo.
- **Pace is steps against time.** With a day to reach it by, the bar marks
  the share of time gone since the goal was made; within ten points either
  way is on track. It's a nudge, not a forecast.
- **Links live on the goal.** Tasks and habits don't know their goals, so
  the task sheet doesn't show one yet; the AI planner can read goals when it
  drafts a day.
- **No key of its own:** G is the quiz's AI mark, so goals are in the
  sidebar, ⌘K and the dashboard.
- **Two older bugs, found while building it:** adding a subject from inside
  a form (the card sheet, the plan's block sheet) reloaded the page and lost
  what was being written, fixed on the flashcards branch and merged forward
  through the stack; and the day something was made was read as the day in
  UTC (a habit made at 9am in Sydney showed yesterday as missed), fixed here
  for habits, routines, the task sheet and the assistant's plans.
- **Next:** the AI planner and weekly review (drafting a day from tasks,
  deadlines, goals and the calendar, onto the plan's timeline), then
  analytics.

### What the AI planner and weekly review changed in the plan

- **A draft to choose from, not a plan.** "Plan my day" suggests blocks
  that show dashed on the day beside what's there, each ticked to keep; you
  change times or titles, untick what you don't want and add the rest (with
  Undo), or discard it. Suggestions over an event, a block or each other,
  or outside the time left, are left out and counted, so a reply can't
  double-book the day.
- **Times go, even when titles don't.** Calendar events and blocks can be
  left out of what's sent, but their times always go (as "busy"), so the
  draft can't land on a class you'd rather not name.
- **The review is worked out, not stored.** A week's numbers are counted
  from what's on the device each time it's shown, so they follow edits
  (a task reopened, a session deleted). Only the AI write-up is kept.
- **Sundays, and Mondays too.** The week shows on the dashboard on Sundays,
  and last week's on Mondays for anyone who didn't open Momentum on the
  Sunday, rather than waiting for "the first time opened on or after
  Sunday". It can be turned off; there's no Sunday notification yet (the
  evening reminder is the only one).
- **Writing it up is optional,** like every AI feature: the page is useful
  without a model, and the write-up sends only the parts ticked (the log,
  word for word, can stay home).
- **Next:** analytics (focus by subject, best hours, streak history, task
  completion, card retention), then the Phase 6 summary and Phase 7.

### What analytics changed in the plan

- **Charts drawn here, not a library.** Columns, stacked parts and a stepped
  area are a few hundred lines of markup in the glass style, and a charting
  library would have weighed more than the page.
- **Best hours by the clock.** A session counts in the hours it ran, so one
  from 9:50 to 10:20 is mostly 10 o'clock. Where a paused session's breaks
  fell isn't kept, so its focus is spread over its whole span.
- **Recall is of cards that were due.** Ratings of new cards and cards
  still being learned are counted but left out of the rate, which is the
  share the schedule aims for, so the two can be compared.
- **On time is by the day.** A task done any time on its due day is on time;
  one due today isn't late until tomorrow.
- **Nothing stored.** The page is worked out from the collections and the
  review log each time, so it follows edits, imports and restores.

### Phase 6, done

Time blocking with calendars, goals, Plan my day, the weekly review and
analytics are built, each in its own PR, stacked in that order. What didn't
fit is noted in each PR: calendars are files, not subscriptions;
tasks have no time estimate for the planner to use; there's no Sunday
notification; and analytics can't place a paused session's breaks. **Next:**
Phase 7, the optional sync server.

### What sync changed in the plan

- **No AI proxy.** Keeping API keys on a server would break the rule that
  keys are stored only on the device, so it's left out unless you ask for
  it. Each device keeps its own keys, as before.
- **Encrypted on the device, end to end.** The password never leaves the
  device: it gives a secret to sign in with and a key that seals every
  record. The server, even one you run, can't read what's synced; it sees
  usernames, which kind of record, ids, sizes and times.
- **SQLite only, with no dependencies.** Node's own SQLite, HTTP and crypto
  keep the server one folder you can run anywhere; Postgres can come later
  behind its small database module.
- **The later edit wins, record by record,** as with backups. Settings
  travel whole, so devices settle on one version: one that hasn't changed
  them since it last synced takes the other's as it is, and when both have,
  they combine by the store's own rules. Clearing everything in Settings →
  Data stays on the device.
- **Files stay on each device.** PDFs and photos are too large to sync as
  records; documents and highlights sync, and a PDF is added again on
  another device.
- **Sign-up by invite** unless the server is set to open, and the account
  can be deleted from the app with the password.

### Phase 7, done

The sync server and sync in the app are built, in one PR (#23) stacked on
analytics. What didn't fit is noted in the PR: files don't sync, a password
can't be changed or recovered, clearing everything stays on the device, and
times come from each device's clock. That's the last phase in this plan.

## Local AI improvements

Version 3 is built. This plan is about running AI on your own machines:
small local models (Ollama on a laptop and a gaming PC, reached over
Tailscale), a model in the browser for an 8 GB MacBook Air, and falling
back between them when one is off, asleep or busy. Four phases, each its
own branch and PR, each stacked on the one before.

| Phase | Branch                     | What                                                       |
| ----- | -------------------------- | ---------------------------------------------------------- |
| 1     | `feature/thinking-control` | Thinking on or off per feature; a cap on every reply       |
| 2     | `fix/desktop-local-ai`     | The installed (Dock) app reaching a server on `localhost`  |
| 3     | `feature/on-device-chat`   | A chat model in the browser, on the GPU, with no server    |
| 4     | `feature/ai-fallback`      | An ordered list of chat providers, falling through in turn |

**How it fits.** Everything stays behind `features/ai`: features call
`ai.chat` and `ai.complete` as they do now, and the client decides how the
request goes out. Settings stay in `momentum.ai` (new fields are optional
in `parse`, so no version bump), keys stay in `secrets`, and models are
still never hardcoded for servers: they come from each provider's model
list. The model on this device is the exception it already is (a short
built-in list, like MiniLM).

1. **Thinking and reply limits.** A feature says which it is (Ask, cards,
   quizzes, summaries, planning or photos) and the client looks up that
   feature's Thinking switch (off by default) and the reply cap. Off, an OpenAI-compatible server gets Ollama's documented
   `reasoning_effort: "none"` (OpenRouter its `reasoning.effort`); it's
   dropped and remembered if a server refuses it, and never sent to
   Anthropic or OpenAI, whose models don't think unless asked. Every
   request's `maxTokens` becomes the smaller of what the feature needs and
   the cap in Settings (with room added for thinking when it's on). Streams
   gain a `thinking` event (from the `reasoning` deltas Ollama sends, or a
   `<think>` block in the text), so every feature can show "Thinking… 14 s"
   until the reply starts, and each says when a reply was cut off.
2. **The desktop app.** There's no wrapper: the Dock app is the PWA,
   installed from wherever it was opened. Find what stops it reaching
   `http://localhost` from the code and the browsers' rules, fix what the
   app controls (saying exactly what's blocked, before sending, and from
   which origin), and document how to install and launch it so it can.
3. **Chat on this device.** `browser` becomes a chat provider too. A
   worker (over `lib/rpc.ts`, like the embeddings worker) runs Qwen3.5
   0.8B, 2B or 4B on WebGPU, downloaded once on request into Cache Storage,
   loaded on first use and unloaded after ten minutes idle. The adapter
   turns its stream into the same events as the other providers, so every
   feature, Phase 1's switches and the cap work unchanged.
4. **A chain of chat providers.** Chat's single provider becomes an
   ordered list of entries, each with its own address, key and model (the
   shape one provider has today, kept per entry rather than shared). The
   client checks each network entry's health (a `GET /models`, 2.5 s,
   remembered for a minute), tries them in order, and falls through on
   errors that are about that provider (unreachable, timed out, 5xx, no
   such model, no first token in time), never on ones that would fail
   anywhere. Cloud entries are skipped unless allowed as a fallback.
   Answers record which entry and model wrote them; usage is counted per
   entry. Embeddings never fall back (vectors from different models can't
   be compared): their jobs wait and retry, and searches fall back to
   keywords, saying so.

**Testing** stays as it is: the mock provider and fake SDKs for the
client and adapters, a stand-in worker for the model on this device, and a
stand-in OpenAI-compatible server (which streams thinking, then an answer)
for click-throughs at desktop and phone sizes. What can't be checked here —
real Ollama, the Dock app, WebGPU, downloads from Hugging Face — gets
step-by-step checks in each PR.
