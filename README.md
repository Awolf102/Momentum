# Momentum

A calm, minimalist productivity app for building a daily habit. Check in once a
day, keep the flame lit, and watch your streak grow.

- **Daily check-in**, once per calendar day, with a small celebration: the flame
  ignites, embers burst, the number rolls up.
- **Current streak** (survives until a full calendar day is missed), **longest
  streak** and total days, this week at a glance, and a **GitHub-style activity
  calendar** where days glow brighter the deeper they are into a streak.
- **A motivational line** after each check-in, with milestone messages.
- **Focus timer:** Pomodoro sessions (25 min focus, 5 min breaks, a 15 min
  break after every fourth; all adjustable) labelled by subject — Calculus,
  Programming, Reading or your own. The day's first finished session checks you
  in. It keeps time from timestamps, so it's right after the phone sleeps or the
  tab reloads, and a session that ends while Momentum is closed still counts.
  A chime and a notification when a phase ends, the countdown in the tab title,
  today's focus minutes, and a calendar view shaded by focus time.
- **Tasks:** type "Lab report fri 5pm #calculus !high every week" and it
  becomes a task with a date, time, subject, priority and repeat. A list by
  due date, or a To do / Doing / Done board with drag and drop. Today's tasks
  on the dashboard, and N adds one from anywhere.
- **Plan:** the day hour by hour. Set aside time for focus and tasks around
  your classes: drag tasks onto it, move and stretch blocks a quarter hour at a
  time, and import your timetable (.ics) so classes show up. A focus block
  that's on now starts the timer.
- **Plan my day** (optional): AI drafts the day from your tasks, deadlines,
  goals and calendar, around what's already on. The suggestions show on the
  day for you to keep, change or leave out, and nothing goes on the plan
  until you add it.
- **Goals:** something bigger, like a distinction in a subject or a 10 km run,
  with the milestones on the way and the tasks and habits that get you there.
  A bar fills as you tick off steps, and with a day to reach it by, it says
  whether you're ahead, on track or behind.
- **Your week:** on Sundays the dashboard sums up the week (and last week's
  on Mondays): focus time by day and subject, check-ins, habits, tasks done
  and still open, milestones and your log. AI can write it up (what went
  well, what slipped, an idea for next week) if you ask, sending only the
  parts you tick.
- **Analytics:** charts of the last four weeks, three months or year: focus
  by subject, your best hours of the day, your streak's history, how many
  tasks you finish on time, and how well you remember your cards.
- **More habits:** reading, exercise, practice — each with its own streak, on
  every day or just the days you choose (days off never break it), with the
  last week at a glance and its own calendar.
- **Notes** in markdown, made for study: maths ($e^{i\pi}+1=0$, rendered with
  KaTeX), highlighted code (Verilog and VHDL included), checklists you can tick
  while reading, and `[[links]]` between notes — or to tasks — with each note
  listing the notes that link to it. Renaming a note keeps its links working.
- **Note from a photo** (optional): photograph handwritten notes, a whiteboard
  or slides, and AI writes them out as a note — markdown, with maths in LaTeX —
  for you to check and edit before saving. The photos aren't kept.
- **Voice notes** (optional): say it, or use a recording of a lecture, and
  it's written out as a note, to edit or have AI tidy into headings and
  points before saving. The recording isn't kept.
- **Library:** add PDFs — lecture slides, papers, chapters — and read them
  here: highlight in four colours with a note in the margin, pick up where you
  left off, and turn your highlights into a note. Search finds the words
  inside them.
- **Search everything** from ⌘K (Search on phones): notes, documents, cards,
  goals, tasks, habits, routines, the log and the inbox, as you type, with the matching
  words marked and a line of context.
- **Search by meaning** (optional): find notes and PDF pages by what they're
  about — "how do I make a boolean function smaller" finds the Karnaugh-map
  pages — with a small model that runs on your device (a one-time 38 MB
  download; nothing is sent), or your OpenAI or compatible server. Each note
  lists the notes and pages related to it.
- **Cards** for spaced repetition: write a question and its answer (maths
  and code too), put them in a note as `question :: answer`, or have AI
  suggest some from a note or a PDF page. Each comes back just before you'd
  forget it (FSRS), so a few minutes a day keep it all fresh: R to study, 1–4
  to say how well you remembered.
- **Quizzes** (optional): choose notes and PDFs (whole, or some pages) and
  AI writes multiple-choice and short-answer questions from them. Answers
  are marked as you go (short ones by you, or by AI), each one you miss links
  back to the page it's on, and the missed ones can become cards.
- **Ask** (optional): ask about your notes and PDFs and get answers that cite
  them — each number opens the note, or the PDF at that page. Before you
  send, you see exactly which passages go with your question, and can take
  any out. Or ask about your plans ("what should I do today?"), sharing only
  the parts you choose. It reads; it never changes anything.
- **Inbox:** catch a thought or a link in a second (I, or share to Momentum
  from another app on Android), then make it a task or a note, add it to
  today's log, or let it go.
- **Routines:** short checklists for the morning, a study session or the
  evening, fresh each day — the one for now first on the dashboard, with
  ready-made ones to start from.
- **Daily log:** one line a day about what you did — right after you check in,
  or any time with L. The Log page shows each day's line beside its check-in
  and focus time, and earlier days can get a line too.
- **The climb:** a marker walks up the ridge in your background, reaching a summit
  at 7, 14, 30, 60, 100, 200 and 365 days. Mountains in photos are found
  automatically, or you can trace the trail yourself.
- **Light that lives:** the mountain and your photos shift from dawn to dusk with
  the clock, or warm from night to golden hour as your streak grows.
- **Reward backgrounds** unlocked at 30, 60 and 100 days — including your own
  travel photos, kept hidden until you earn them.
- **Ambient sound** for studying: wind, rain and a quiet fire, generated live —
  optionally only while a focus session runs.
- **Shareable streak card**: an image of your streak over your background.
- **Keyboard first:** C to check in, F to start or pause focus, N to add a
  task, I to capture to the inbox, L to write today's line, ⌘K for the
  command palette.
- **Installable and offline**, with an optional evening reminder if you haven't
  checked in.
- **Your own photographs as backgrounds**, behind frosted-glass cards, dark mode
  by default with a light theme.
- **Local-first:** everything is saved in your browser's database (IndexedDB),
  with one-file backups of all of it: notes, your library, habits, routines,
  tasks, cards, the inbox, conversations, focus sessions and the log
  included.
- **Sync between devices** (optional): through a small server you run
  yourself, encrypted on your device before it's sent, so the server can't
  read any of it.
- **Optional AI, with your own key:** Anthropic, OpenAI, or a server such as
  Ollama — or nothing but this device: a chat model and search by meaning
  that run in the browser. Momentum works
  fully without it. Before anything is sent, you see exactly what goes and
  to whom (and, before indexing, roughly what it costs); afterwards, how many
  tokens it used. (More AI features arrive in later phases; see
  [docs/ROADMAP.md](docs/ROADMAP.md).)

## Getting started

Requires Node.js 20.19+ (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173
```

To try it on your phone over your local network, run `npm run dev -- --host`.

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Type-check and build to `dist/`                |
| `npm run preview`   | Serve the production build                     |
| `npm run desktop`   | Serve it at `localhost:4173`, for the Dock app |
| `npm test`          | Run the unit tests (Vitest)                    |
| `npm run lint`      | Lint with oxlint                               |
| `npm run typecheck` | Type-check only                                |
| `npm run format`    | Format with Prettier                           |

## Adding your mountain photograph

1. **Make it part of the app.** Put the image in
   [`src/assets/backgrounds/`](src/assets/backgrounds/), e.g.
   `src/assets/backgrounds/australia-mountains.jpg`. It's picked up
   automatically, named after the file ("Australia Mountains"), and becomes the
   default background. Around 2560 px wide at JPEG quality ~85 loads quickly.
2. **Keep it on one device.** Open **Settings → Appearance → Your photo**. The
   photo is resized in the browser and stored locally; it is never uploaded.

**Reward photos** unlock with your longest streak: put them in
`src/assets/backgrounds/unlocks/30/` (or `60/`, `100/`, any number of days), or
add them from **Settings → Appearance → Rewards → Reward photo**.

## Using AI (optional)

Open **Settings → AI**.

1. **Add a provider.** Paste an API key from
   [Anthropic](https://platform.claude.com/) or
   [OpenAI](https://platform.openai.com/api-keys), or enter the address of an
   OpenAI-compatible server. Keys are stored only on this device and sent only
   to their own provider.
2. **Choose models** for chat, for embeddings and for transcription (they can
   come from different providers). Type a model name, or **Load list** to pick
   from the models your key can use. Anthropic doesn't offer embeddings or
   transcription.
3. **Test connection** sends one short test message and shows the reply (for
   transcription, a second of silence).

**Ollama on your computer:** start it so the browser may reach it, e.g.
`OLLAMA_ORIGINS=http://localhost:5173 ollama serve` (use the address you open
Momentum at: Settings → AI shows it, under the server address), then use
`http://localhost:11434` as the server address. No key needed. For the app
in a Mac's Dock, see [On a Mac's Dock](#on-a-macs-dock).

**A chat model on this device:** choose **This device** under Chat. Three
sizes of Qwen3.5 run in the browser on your Mac's graphics processor
(WebGPU: Safari 26 or a recent Chrome): 0.8B, **2B** (recommended for an
8 GB Mac) and 4B (needs more memory than an 8 GB Mac comfortably has).
Press **Download** once (about 0.5, 1.1 or 2.4 GB, from Hugging Face; a
download that stops picks up where it left off), then it works offline and
nothing you ask leaves the device. It loads the first time you use it and
unloads after ten minutes unused; if it runs out of memory, it's unloaded
and Momentum suggests the smaller one. **Remove** frees the space.

**Thinking and reply length:** under **Replies**, each AI feature (Ask,
flashcards, quizzes, summaries, Plan my day, notes from photos) has a
**Think before answering** switch, off by default. Small local models such
as Qwen think for a minute or more before a simple answer; off, Momentum
asks an OpenAI-compatible server not to (Ollama's `reasoning_effort: "none"`),
so they answer straight away. While a model works on a reply, the feature
shows "Thinking…" with the time so far. **Longest reply** caps every
request (8K tokens unless you change it), so no reply runs on for ever; one
that reaches it is kept and marked as cut off.

**Cost:** usage is counted per model each month. Prices aren't built in, because
they change; add your provider's price per million tokens to see an estimate.

### Search by meaning

Under **Embeddings**, choose where vectors come from:

- **This device:** press **Download** (or **Download and build the index**
  under Search by meaning). The model (MiniLM, English) and the engine that
  runs it are 38 MB, downloaded once from Hugging Face and Momentum, then kept
  — it works offline. Your notes and PDFs are indexed on the device as they
  change, and ⌘K searches by meaning as you type. Nothing is sent anywhere.
- **OpenAI or a compatible server** (Ollama's `nomic-embed-text` works well):
  **Review and index…** lists every note and PDF that would be sent, with its
  size and the estimated cost; untick anything you'd rather keep to yourself,
  then **Send**. In ⌘K, a **Search by meaning** row says exactly what it will
  send and to whom, and sends only your search, only when you choose it.

Results appear under **By meaning** in ⌘K, with the page for PDFs. To host the
model files yourself, build with `VITE_MODEL_HOST=https://your.server`, using
the same paths as Hugging Face (`/<repo>/resolve/main/<file>`).

### Ask

Open **Ask** in the sidebar, or ⌘K → **Ask your notes and documents**; on a
PDF, **Ask about this document** keeps to that one. It uses your chat model.

- **Your notes and documents:** as you type, the passages that best match
  your question appear under it, found on this device. Take out any you'd
  rather not send; **Send** sends your question with exactly those, and the
  conversation so far. The answer cites them by number: click one to open the
  note, or the PDF at that page. **Stop** keeps what has arrived; **Ask
  again** tries once more with the same passages. With search by meaning on
  this device, passages are found by meaning as you type too; with a
  provider's index, **Also find passages by meaning** sends just your question
  to find more.
- **Your plans:** choose what to share — tasks, habits, routines, focus time,
  the daily log — and ask "what should I do today?" or "which habits am I
  letting slip?". **Show exactly what's sent** shows the summary that goes
  with your question. It can't change anything.

Notes and PDFs you've kept out of search by meaning are left out of the
passages too, unless you ask about that PDF itself. Conversations are kept on
this device and in backups. Delete one from its page (with Undo), or all of
them in **Settings → Data**.

**Backups** leave API keys out unless you turn on **Include API keys**, and a
backup with keys is always protected with a password (AES-GCM, with the key
derived from your password; nothing is readable without it). You can protect
any backup this way in **Settings → Data**.

## Tasks

Type a task the way you'd say it; what Momentum understood shows underneath:

| Type                                                         | Gets                       |
| ------------------------------------------------------------ | -------------------------- |
| `today`, `tomorrow`, `fri`, `next fri`                       | A due date                 |
| `in 3 days`, `next week`, `12 Oct`                           | A due date                 |
| `5pm`, `at 9:30am`, `17:00`                                  | A time                     |
| `#calculus`, `#digital-logic`                                | A subject                  |
| `!`, `!!`, `!!!` (or `!high`)                                | Low, medium, high priority |
| `every mon and thu`, `daily`, `every 2 weeks`, `fortnightly` | A repeat                   |

Put words in "quotes" to keep them as they are. Tap a task to edit it; switch
to **Board** to drag tasks between To do, Doing and Done.

## Plan

Open **Plan** in the sidebar (or press P, or the dashboard's **Today's plan**).
The day runs hour by hour, with your classes and other imported events, the
time now, and the focus sessions you've done down the left.

- **Add a block:** pick a time on the day, or **+ Block**. A block is focus
  time (with a subject) or anything else: gym, lunch, travel.
- **Move it:** drag it, or select it and use ↑ ↓; drag its bottom edge, or hold
  Shift with ↑ ↓, to change its length. Times snap to quarter hours. On a phone,
  hold a block a moment before dragging it. Tap it to change or remove it.
- **Plan tasks:** tasks that are overdue, due that day or without a date wait
  beside the day (under **To plan** on a phone). Drag one on with a mouse, or
  **+** puts it in the next free hour. Tick it off from its block.
- **Focus:** a focus block that's on now has ▶ to start the timer on its subject.
- **← →** go to the day before and after.

### Plan my day

With a chat model set up (see Using AI), **Plan my day** drafts the rest of
the day (or another day) around your classes and blocks: the tasks overdue
and due soon, steps towards your goals and the habits still to do. Before
anything is sent you see what goes — calendar events, blocks already
planned, tasks, goals, habits — and can leave any out (events and blocks
then go only as busy times, so nothing is planned over them). The
suggestions show dashed on the day with the reason for each: untick the
ones you don't want, change a time or a title, then **Add** (Undo takes them
off again) or **Discard**.

### Calendars

Import your timetable or any calendar as an **.ics** file with **Import a
calendar**, or drop the file on the page. Google Calendar and Outlook can export
one, and most uni timetables offer one to download. It's read on this device;
nothing is uploaded, and its events can't be changed here. Import a newer file
to update it. Repeating classes, cancelled and moved times, all-day events and
time zones (Outlook's names included) come through; a repeat Momentum can't
follow yet is shown once, and the import says so.

## Goals

Open **Goals** in the sidebar (or ⌘K → **New goal**). Give a goal a name, why
it matters, a subject and a day to reach it by, and list the first milestones,
one a line.

- **Milestones** are the big steps: tick them off, tap one to change its title
  or day, move it up or down, or remove it (Undo).
- **Tasks** linked to a goal are steps too. Add one with the same quick add as
  Tasks ("Past paper fri" takes the goal's subject), or link tasks you have.
  A repeating task stays linked as it moves on and shows how often it's been
  done, rather than counting as a step.
- **Habits** linked to a goal show their streaks and the last four weeks; make
  one from the goal and it's linked at once.
- **Progress:** the bar fills as steps are done. With a day to reach it by, a
  mark on the bar shows how much of the time has gone, and the goal says
  whether you're ahead, on track or behind.
- **Reach it, or put it away:** both keep the goal, with a way to reopen it.
  The dashboard shows your first three goals on the go; reorder them on the
  Goals page.

## Your week

On Sundays the dashboard shows the week so far, and on Mondays the week just
gone; **See the week** (or ⌘K → **Review my week**) opens it in full: focus
time against the week before, by day and by subject, check-ins, habits on
their days, tasks done and those due that are still open, milestones
reached and each day's log line. ← → page through earlier weeks. Settings →
App turns the Sunday card off.

With a chat model set up, **Write it up** asks AI for what went well, what
slipped and an idea for next week. You choose which parts are sent (your log
can stay out), and the write-up is kept with its week.

## Analytics

Open **Analytics** in the sidebar (or ⌘K → **Go to Analytics**) and choose
**4 weeks**, **3 months** or **12 months**:

- **Focus by subject:** your focus time over the period, coloured by subject,
  and each subject's total and share.
- **Best hours:** when in the day you focus most, the two best hours in a row,
  and which days of the week.
- **Streak history:** how your streak rose and broke, your longest run, and
  how many days you checked in.
- **Tasks:** of the tasks that were due, how many you finished on time, late,
  or not yet.
- **Card recall:** how often you remembered the cards that were due, against
  the recall you aim for (set on the Cards page).

It's all worked out on your device; nothing is sent.

## Notes

Open **Notes** (or ⌘K → New note). A note opens to read; **Write** (or E)
edits it, and it saves as you type. Escape goes back to reading.

| Write                                 | Gets                                |
| ------------------------------------- | ----------------------------------- |
| `# Heading`, `**bold**`, `- item`     | Markdown, including tables          |
| `- [ ] Revise chapter 4`              | A checklist, tickable while reading |
| `$e^{i\pi}+1=0$`, `$$ … $$`           | Maths, inline or on its own line    |
| ` ```verilog ` … ` ``` `              | Highlighted code                    |
| `[[Karnaugh maps]]`, `[[Note\|text]]` | A link to a note (it can be new)    |
| `[[task:Lab report]]`                 | A link to a task                    |

Type `[[` to pick from your notes. Pin a note to keep it at the top; give it a
subject to filter by. Nothing written in a note runs as code: HTML shows as
text and unsafe links are removed.

### From a photo

The camera button on Notes (or ⌘K → **Note from a photo**) turns photos of
handwritten notes, a whiteboard or slides into a note. A chat model that can
read pictures needs to be set up (most current ones from Anthropic and OpenAI
can).

- **Add photos**, one a page, or paste or drop pictures. Turn one that's
  sideways, move one earlier, or take one out.
- **Make the note…** shows what will be sent first: each photo, its size, and
  about how many tokens. Nothing is sent before **Send**; photos are scaled
  down on your device to what the model reads anyway.
- The note comes back as you watch, with its title, maths in LaTeX and `[?]`
  for words it couldn't read. Edit it, give it a subject, and **Save as a
  note**. Stop keeps what came so far. The photos aren't kept.

### Voice notes

The microphone button on Notes (or ⌘K → **Voice note**) turns speech into a
note. Transcription needs OpenAI or a compatible server, chosen in
**Settings → AI → Transcription** (Anthropic doesn't offer it); recording
doesn't.

- **Record** up to an hour, with Pause and Resume, or **Choose a recording**
  you have: MP3, M4A, WAV, WebM or OGG, up to 25 MB. Play it back first if
  you like.
- **Make the note…** shows what will be sent: the recording, how long it is,
  and where it goes. Nothing is sent before **Send**.
- The transcript opens as the note, to read and edit. **Tidy it into
  notes…** has the chat model organise it into headings and points (its own
  preview first, and a click takes you back to the transcript as it was).
  Give it a title and a subject, and **Save as a note**. The recording isn't
  kept.

## Library

Open **Library** and **Add PDF** (or drop PDFs on the page, or ⌘K → Add a
PDF). Each is read in the background — its pages, a picture of the first page,
and its text for Search — and stays on this device.

Reading: type a page number to jump, ← and → for the previous and next page,

- − and 0 to zoom, **H** for your highlights. A document opens where you left
  off, and the dashboard offers to continue the one you're partway through.

**Highlights:** select text and pick a colour, or **Note** to write in the
margin. Tap a highlight to change it. The highlights panel lists them in
order; **Make a note of these** turns them into a note with each quote and its
page. Backups include your PDFs unless you turn off **Include documents**.

## Cards

Open **Cards** in the sidebar (or ⌘K → **New card**).

- **Write a card**: a question on the front, the answer on the back, in
  markdown with maths between $ signs. **Add and write another** keeps going.
- **From a note**: write lines like `Gray code :: neighbouring cells differ in
one bit`, then **Make cards from this note** (the cards icon on the note).
  You choose which lines become cards.
- **With AI** (with a chat model set up): from a note, or a PDF's
  **Document details** → **Make cards from this PDF**, choose one page or the
  whole PDF and **Suggest cards…**. You see what will be sent first; the
  suggestions come back as drafts to tick and edit.
- **Study** with **Study now**, R from anywhere, or a subject's **Study**:
  Space shows the answer, then 1–4 for Again, Hard, Good or Easy (each
  button shows when you'll see the card again). Z undoes, E edits.

New cards start at 20 a day; in **Options** you can change that, aim to
remember more or less (90% suits most people), and **Count cards as a
habit**, ticked once the day's cards are done.

## Quizzes

Open **Quizzes** in the sidebar (or ⌘K → **New practice quiz**), or start
from a PDF's **Document details** → **Make a practice quiz**, or the quiz
button on a note. A chat model needs to be set up.

- **Make one**: tick notes and PDFs; for a PDF, write the pages you want
  (`3-7, 10`, or leave it for all of them). Choose how many questions (5, 10
  or 20) and what kind: mixed, multiple choice or short answer. **Make
  quiz…** shows exactly what will be sent before anything is; when there's
  too much to send, pages are taken from all through what you chose.
- **Take it**: multiple choice is 1–4, marked straight away. For a short
  answer, type it and press Enter to see the model answer, then mark it
  yourself (1 right, 2 partly, 3 wrong) or press G to have AI mark it, which
  sends only the question, the model answer and yours. **I don't know** shows
  the answer. Enter moves on; leave whenever you like and carry on later.
- **Afterwards**: your score (partly right counts half), and each question
  you missed with the right answer, why, and **Read it again**, a link to
  the page it's on. Try the missed ones again, take the whole quiz again,
  or **Make cards to remember them**.

## Focus timer

Pick a subject on the dashboard and press **Start focus** (or F). Pause, resume,
skip a break or cancel — a cancelled session doesn't count. Session and break
lengths, ambient sound while focusing, notifications and your subjects are in
**Settings → Focus**. The calendar's **Focus** view shades days by focus
minutes.

## Keyboard shortcuts

| Keys        | Action                            |
| ----------- | --------------------------------- |
| ⌘K / Ctrl K | Search, and every command         |
| C           | Check in for today                |
| F           | Start / pause / resume focus      |
| N           | Add a task                        |
| I           | Capture to inbox                  |
| L           | Write today's log line            |
| R           | Study cards                       |
| P           | Plan the day                      |
| ← →         | Day before / after (plan)         |
| ↑ ↓         | Move a block; with Shift, resize  |
| Space, 1–4  | Show the answer, rate it          |
| Z           | Undo the last rating (cards)      |
| 1–4, 1–3    | Choose an answer, mark one (quiz) |
| G           | Have AI mark an answer (quiz)     |
| ← →         | Previous / next page (PDF)        |
| + − 0       | Zoom in / out / fit (PDF)         |
| H           | Highlights (PDF)                  |
| E           | Write (on a note)                 |
| M           | View the climb                    |
| S           | Share streak card                 |
| A           | Play / pause ambient sound        |
| T           | Switch light / dark theme         |
| ,           | Settings                          |
| ?           | All shortcuts                     |

## Sync (optional)

Momentum works on its own, on one device. To keep a phone and a laptop the
same, run the sync server in `server/` somewhere both can reach, and sign in
from **Settings → Sync** on each.

**The server** needs only Node 22 (it uses Node's own SQLite; nothing to
install):

```bash
npm run sync-server -- invite   # a one-time invite code for an account
npm run sync-server -- serve    # http://127.0.0.1:8787
npm run sync-server -- users    # accounts, and how much each keeps
```

Or with Docker: `docker build -f server/Dockerfile -t momentum-sync .`, then
`docker run -p 8787:8787 -v momentum-sync:/data momentum-sync`. Settings come
from the environment: `PORT`, `HOST` (127.0.0.1 unless you change it),
`MOMENTUM_SYNC_DB` (where the database goes), `MOMENTUM_SYNC_SIGNUP`
(`invite`, or `open` for anyone), `MOMENTUM_SYNC_ORIGINS` (the address the app
is served from, so only it may call the server) and `MOMENTUM_SYNC_QUOTA_MB`
(each account's space, 200 MB). Put it behind HTTPS (Caddy or nginx, say)
before opening it to the internet: an app served over HTTPS can only reach an
HTTPS server.

**In the app:** on the first device, **Settings → Sync → Create an account**
with the server's address, a username, a password and the invite code; on
the others, **Sign in**. Each device then syncs when something changes, when
it comes back into view, and every few minutes; **Sync now** (or ⌘K) does it
at once.

- **Private by design:** your password never leaves the device. From it comes
  the key that encrypts every record before it's sent, so the server keeps
  only what it can't read. It does see your username, how many records you
  have of each kind and how large, and when they changed.
- **Forget the password** and what's on the server can't be opened: each
  device keeps its own copy, and backups still work. There's no reset.
- **What syncs:** tasks, notes, habits and check-ins, routines, focus sessions
  and subjects, the log, goals, the plan and calendars, cards and their
  reviews, quizzes, the inbox, conversations, the library's documents and
  highlights, and your weekly write-ups. **What doesn't:** API keys, PDF files
  and photos (add a PDF again to read it on another device), appearance,
  sound, reminders, AI setup and the search-by-meaning index.
- When the same thing is changed on two devices, the later change wins.
  Settings combine: check-ins, habits, routines and write-ups made on either
  are kept, and a new device takes the account's settings rather than
  sending its own. Deleting things one by one syncs; clearing everything in
  Settings → Data clears this device only.

## Installing

Momentum is a progressive web app. In Chrome or Edge use **Install app**
(or **Settings → App**); on iPhone, **Share → Add to Home Screen**. Once
loaded it works offline. Try a production build locally with
`npm run build && npm run preview` — the service worker isn't active in
`npm run dev`.

### On a Mac's Dock

Safari's **File → Add to Dock** makes Momentum an app of its own. It isn't
a separate build: it's the page you added, running at that page's address
(its _origin_), with storage of its own (your data in a Safari tab doesn't
carry over; use a backup or sync to move it). The origin decides what it
can reach:

- **Added from `http://localhost:4173`** (as below), it can reach a server
  on this Mac (`http://localhost:11434`, `http://127.0.0.1:…`) and HTTPS
  addresses such as your Tailscale `https://….ts.net` ones.
- **Added from an `https://` address** (a hosted copy, or one served by
  `tailscale serve`), Safari won't let it reach any plain `http://` address,
  not even `localhost`: it blocks the request before it's sent (Chrome
  allows `localhost`). It can still reach `https://` servers.

To install the desktop app so it can use Ollama on the same Mac:

```bash
npm install && npm run build
npm run desktop          # serves the build at http://localhost:4173, always that port
```

Then open http://localhost:4173 in Safari, choose **File → Add to Dock**,
and allow its origin in Ollama (the Ollama app reads it from `launchctl`;
quit and reopen Ollama afterwards):

```bash
launchctl setenv OLLAMA_ORIGINS "http://localhost:4173"
```

Settings → AI shows the exact origin of whichever copy you're in, under
the server address, and warns before sending if the browser would block
it. Once loaded, the Dock app works offline; the server is only needed to
install it and to get updates. To keep it running whenever you're logged
in (so updates arrive by themselves), install the launch agent:

```bash
sed -e "s#__REPO__#$PWD#g" -e "s#__NODE__#$(command -v node)#g" \
  docs/desktop/com.momentum.desktop.plist \
  > ~/Library/LaunchAgents/com.momentum.desktop.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.momentum.desktop.plist
```

(`launchctl bootout gui/$(id -u)/com.momentum.desktop` stops it.) After
`git pull` and `npm run build`, the Dock app offers the new version. On a
Linux PC running Ollama as a service, allow the same origin with
`sudo systemctl edit ollama`, adding `Environment="OLLAMA_ORIGINS=http://localhost:4173"`
under `[Service]`, then `sudo systemctl restart ollama`. Add the origins of
any other copies (a laptop's, a hosted one) separated by commas.

**Hosting:** `dist/` is a static site. Pages have real paths (`/settings/ai`),
so the host should serve `index.html` for unknown paths (the usual
single-page-app setting); once installed, the service worker handles this
itself.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · wouter · IndexedDB (idb) ·
marked, DOMPurify, KaTeX and highlight.js for notes, pdf.js for the library, ONNX
Runtime Web and Hugging Face's tokenizer for search by meaning, WebLLM for chat
on this device, ts-fsrs for
cards, and the Anthropic and OpenAI SDKs (all loaded on demand) · Web Audio · Workbox (vite-plugin-pwa) · Vitest

## Project structure

```
src/
├── app/          App shell: routes, sidebar, tab bar, header, commands
├── pages/        Pages composed from features (dashboard, tasks, plan, goals,
│                 your week, analytics, notes, photo and voice notes, library,
│                 cards, quizzes, ask, inbox, log, settings)
├── features/     streak · habits · routines · focus · subjects · tasks · planner
│                 goals · review · analytics · notes · capture · library
│                 search · embeddings
│                 flashcards · quizzes
│                 assistant · inbox · log · calendar
│                 motivation · appearance · climb · share · ambience
│                 reminder · pwa · backup · sync · ai
├── components/   Shared UI (glass card, sheet, settings card, icons…)
├── lib/          Dates, the database and stores, secrets, routes, hooks
└── styles/       Tailwind, design tokens, glass utility
server/           The optional sync server (Node, SQLite; no dependencies)
```

The architecture, data model and design decisions are explained in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); what's next is in
[docs/ROADMAP.md](docs/ROADMAP.md).
