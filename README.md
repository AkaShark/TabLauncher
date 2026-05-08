# AIRSS Dashboard

A Chrome new-tab dashboard pairing **dida365 / TickTick** tasks with **curated feeds** (RSS / Substack / Medium / 掘金) and **GitHub Trending** — wrapped in an editorial-minimalist UI.

> **Repo**: [`TabLauncher`](https://github.com/AkaShark/TabLauncher) · personal-use first, fork-friendly self-host.

## Features

- **今日清单** — dida365 / TickTick OAuth, today's tasks, priority sort (`H` / `M` / `L`), inline create, click-to-edit modal with markdown notes
- **Quick links** — favicon-only shortcut grid, configurable in settings
- **Dispatch** — RSS / Substack / Medium / 掘金 (iOS 推荐 · iOS 最新 · 全站推荐) aggregated card stream with per-tab unread counts
- **Trending** — GitHub Trending widget with day / week / month + language filter
- **Editorial UI** — Fraunces serif + JetBrains Mono + Public Sans, hairline-only divisions, `prefers-color-scheme` theme switching, no SaaS clichés

See **[`docs/PROGRESS.md`](./docs/PROGRESS.md)** for the full feature list, design decisions, and roadmap.

## Quick start

```sh
pnpm install
pnpm dev        # vite dev with @crxjs HMR
pnpm typecheck  # vue-tsc strict
pnpm lint       # eslint + oxlint
pnpm test       # vitest (147 tests)
pnpm e2e        # playwright (requires `pnpm build` first)
pnpm build      # production build → dist/
```

Load `dist/` as an unpacked extension at `chrome://extensions` (toggle Developer mode, then "Load unpacked").

## Configuration

Copy `.env.example` to `.env.local` and fill in:

```env
VITE_TICKTICK_CLIENT_ID=...
VITE_TICKTICK_CLIENT_SECRET=...
VITE_TICKTICK_OAUTH_HOST=dida365.com    # default; switch to ticktick.com for intl
VITE_TICKTICK_API_HOST=api.dida365.com  # default; switch to api.ticktick.com for intl
```

Register your dida365 / TickTick app and add the extension's redirect URL — it's printed on the in-app settings page after the extension loads.

## Self-hosting

Forks should regenerate the extension public key so the extension-id is unique. See [`docs/self-host.md`](./docs/self-host.md).

## Stack

Vue 3 (`<script setup>`) · TypeScript strict · Pinia · Vite · `@crxjs/vite-plugin` (MV3) · Tailwind CSS 3.4 · Vitest · Playwright · uPlot

## License

MIT — see [LICENSE](./LICENSE).
