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
  Momentum is opened on or after Sunday, with an optional reminder.
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
| 5     | Building  | Flashcards with FSRS (`feature/flashcards`, PR #15), stacked on the assistant; practice quizzes (`feature/quizzes`, PR #16), stacked on flashcards; image to notes (`feature/image-notes`), stacked on quizzes                                                                                                                                             |
| 6–7   | Planned   |                                                                                                                                                                                                                                                                                                                                                            |

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
