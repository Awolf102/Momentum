# Momentum

A calm, minimalist productivity app for building a daily habit. Check in once a
day, keep the flame lit, and watch your streak grow.

- **Daily check-in**, once per calendar day, with a small celebration: the flame
  ignites, embers burst, the number rolls up.
- **Current streak** (survives until a full calendar day is missed), **longest
  streak** and total days, this week at a glance, and a **GitHub-style activity
  calendar** where days glow brighter the deeper they are into a streak.
- **A motivational line** after each check-in, with milestone messages.
- **The climb:** a marker walks up the ridge in your background, reaching a summit
  at 7, 14, 30, 60, 100, 200 and 365 days. Mountains in photos are found
  automatically, or you can trace the trail yourself.
- **Light that lives:** the mountain and your photos shift from dawn to dusk with
  the clock, or warm from night to golden hour as your streak grows.
- **Reward backgrounds** unlocked at 30, 60 and 100 days — including your own
  travel photos, kept hidden until you earn them.
- **Ambient sound** for studying: wind, rain and a quiet fire, generated live.
- **Shareable streak card**: an image of your streak over your background.
- **Keyboard first:** C to check in, ⌘K for the command palette.
- **Installable and offline**, with an optional evening reminder if you haven't
  checked in.
- **Your own photographs as backgrounds**, behind frosted-glass cards, dark mode
  by default with a light theme, and everything saved on your device with
  export/import backups.

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
2. **Keep it on one device.** Open **Settings → Background → Your photo**. The
   photo is resized in the browser and stored locally; it is never uploaded.

**Reward photos** unlock with your longest streak: put them in
`src/assets/backgrounds/unlocks/30/` (or `60/`, `100/`, any number of days), or
add them from **Settings → Background → Rewards → Reward photo**.

## Keyboard shortcuts

| Keys        | Action                     |
| ----------- | -------------------------- |
| ⌘K / Ctrl K | Command palette            |
| C           | Check in for today         |
| M           | View the climb             |
| S           | Share streak card          |
| A           | Play / pause ambient sound |
| T           | Switch light / dark theme  |
| ,           | Settings                   |
| ?           | All shortcuts              |

## Installing

Momentum is a progressive web app. In Chrome or Edge use **Install app**
(or **Settings → App**); on iPhone, **Share → Add to Home Screen**. Once
loaded it works offline. Try a production build locally with
`npm run build && npm run preview` — the service worker isn't active in
`npm run dev`.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · Web Audio · Workbox (vite-plugin-pwa) · Vitest

## Project structure

```
src/
├── app/          App shell: providers, header, footer, settings
├── pages/        Pages composed from features (the dashboard)
├── features/     streak · calendar · motivation · appearance · climb · share
│                 ambience · reminder · pwa · settings
├── components/   Shared UI (glass card, sheet, icons…)
├── lib/          Dates, persistent storage, hooks
└── styles/       Tailwind, design tokens, glass utility
```

The architecture, data model and design decisions are explained in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
