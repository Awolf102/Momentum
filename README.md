# Momentum

A calm, minimalist productivity app for building a daily habit. Check in once a
day, keep the flame lit, and watch your streak grow.

**Version 1** focuses on one thing: a daily productivity streak that feels good
to keep.

- **Daily check-in**, once per calendar day, with a small celebration: the flame
  ignites, embers burst, the number rolls up.
- **Current streak**, which survives until a full calendar day is missed.
- **Longest streak** and total days.
- **This week** at a glance, plus a **GitHub-style activity calendar** where
  days glow brighter the deeper they are into a streak.
- **A motivational line** after each check-in, with special messages at
  milestones (1, 3, 7, 14, 30, 100, 365 days…).
- **Your own photographs as backgrounds**, behind frosted-glass cards, with an
  adjustable overlay for readability.
- **Dark mode by default**, with a light theme.
- **Saved on your device** (localStorage + IndexedDB), with export and import
  backups.

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

There are two ways:

1. **Make it part of the app.** Put the image in
   [`src/assets/backgrounds/`](src/assets/backgrounds/), e.g.
   `src/assets/backgrounds/australia-mountains.jpg`. It's picked up
   automatically, named after the file ("Australia Mountains"), and becomes the
   default background. Around 2560 px wide at JPEG quality ~85 loads quickly.
2. **Keep it on one device.** Open **Settings → Background → Your photo**. The
   photo is resized in the browser and stored locally; it is never uploaded.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · Vitest

## Project structure

```
src/
├── app/          App shell: providers, header, footer, settings
├── pages/        Pages composed from features (the dashboard)
├── features/     streak · calendar · motivation · appearance · settings
├── components/   Shared UI (glass card, sheet, icons…)
├── lib/          Dates, persistent storage, hooks
└── styles/       Tailwind, design tokens, glass utility
```

The architecture, data model and design decisions are explained in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
