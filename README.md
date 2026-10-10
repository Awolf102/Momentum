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
  task, L to write today's line, ⌘K for the command palette.
- **Installable and offline**, with an optional evening reminder if you haven't
  checked in.
- **Your own photographs as backgrounds**, behind frosted-glass cards, dark mode
  by default with a light theme.
- **Local-first:** everything is saved in your browser's database (IndexedDB),
  with one-file backups of all of it, tasks, focus sessions and the log
  included.
- **Optional AI, with your own key:** Anthropic, OpenAI, or a server such as
  Ollama. Momentum works fully without it. (The AI features themselves arrive
  in later phases; see [docs/ROADMAP.md](docs/ROADMAP.md).)

## Getting started

Requires Node.js 20.19+ (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173
```

To try it on your phone over your local network, run `npm run dev -- --host`.

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Start the dev server            |
| `npm run build`     | Type-check and build to `dist/` |
| `npm run preview`   | Serve the production build      |
| `npm test`          | Run the unit tests (Vitest)     |
| `npm run lint`      | Lint with oxlint                |
| `npm run typecheck` | Type-check only                 |
| `npm run format`    | Format with Prettier            |

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
2. **Choose models** for chat and for embeddings (they can come from different
   providers). Type a model name, or **Load list** to pick from the models your
   key can use. Anthropic doesn't offer embeddings.
3. **Test connection** sends one short test message and shows the reply.

**Ollama on your computer:** start it so the browser may reach it, e.g.
`OLLAMA_ORIGINS=http://localhost:5173 ollama serve` (use the address you open
Momentum at), then use `http://localhost:11434` as the server address. No key
needed.

**Cost:** usage is counted per model each month. Prices aren't built in, because
they change; add your provider's price per million tokens to see an estimate.

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

## Focus timer

Pick a subject on the dashboard and press **Start focus** (or F). Pause, resume,
skip a break or cancel — a cancelled session doesn't count. Session and break
lengths, ambient sound while focusing, notifications and your subjects are in
**Settings → Focus**. The calendar's **Focus** view shades days by focus
minutes.

## Keyboard shortcuts

| Keys        | Action                       |
| ----------- | ---------------------------- |
| ⌘K / Ctrl K | Command palette              |
| C           | Check in for today           |
| F           | Start / pause / resume focus |
| N           | Add a task                   |
| L           | Write today's log line       |
| M           | View the climb               |
| S           | Share streak card            |
| A           | Play / pause ambient sound   |
| T           | Switch light / dark theme    |
| ,           | Settings                     |
| ?           | All shortcuts                |

## Installing

Momentum is a progressive web app. In Chrome or Edge use **Install app**
(or **Settings → App**); on iPhone, **Share → Add to Home Screen**. Once
loaded it works offline. Try a production build locally with
`npm run build && npm run preview` — the service worker isn't active in
`npm run dev`.

**Hosting:** `dist/` is a static site. Pages have real paths (`/settings/ai`),
so the host should serve `index.html` for unknown paths (the usual
single-page-app setting); once installed, the service worker handles this
itself.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · wouter · IndexedDB (idb) ·
Anthropic and OpenAI SDKs (loaded on demand) · Web Audio · Workbox (vite-plugin-pwa) · Vitest

## Project structure

```
src/
├── app/          App shell: routes, sidebar, tab bar, header, commands
├── pages/        Pages composed from features (dashboard, tasks, log, settings)
├── features/     streak · focus · subjects · tasks · log · calendar · motivation
│                 appearance · climb · share · ambience · reminder · pwa
│                 backup · ai
├── components/   Shared UI (glass card, sheet, settings card, icons…)
├── lib/          Dates, the database and stores, secrets, routes, hooks
└── styles/       Tailwind, design tokens, glass utility
```

The architecture, data model and design decisions are explained in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); what's next is in
[docs/ROADMAP.md](docs/ROADMAP.md).
