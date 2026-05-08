# AIRSS Dashboard — Progress & Roadmap

> Snapshot of what shipped and what's queued. Living document; update on every milestone close.

Last updated: **2026-05-08**

---

## ✅ Shipped

### Foundation
- Vue 3 + TypeScript strict + Pinia + Vite + `@crxjs/vite-plugin` MV3 scaffolding
- Chrome MV3 manifest with `chrome_url_overrides.newtab` + `options_page`
- `chrome.storage.local` namespaced cache (`airss.cache.*`, `airss.tokens`, `airss.subscriptions`, `airss.shortcuts`)
- Service-worker message bus (`auth/connect`, `tasks/refresh`, `feed/refresh`, `github/refresh`, `github/setConfig`)
- 147 vitest unit tests + Playwright e2e harness
- `vue-tsc --noEmit` strict typecheck clean

### TickTick / dida365 (今日清单)
- OAuth via `chrome.identity.launchWebAuthFlow` (PKCE removed — dida365 doesn't support it)
- Configurable host via `VITE_TICKTICK_OAUTH_HOST` / `VITE_TICKTICK_API_HOST` (default `dida365.com`)
- `getTodaySnapshot` returns `{ pending, completed, completedCount }` — stable list across refresh
- `createTask` — Inbox-first project pick, due-today auto, POST `/open/v1/task`
- `updateTask` — POST `/open/v1/task/{id}` with patch (title / content / desc / due / priority)
- `completeTask` — optimistic toggle + rollback on failure
- Local ledger (`airss.ledger`) for completion-trend (currently dormant — UI removed)

### Feed aggregation
- RSS / Atom pipeline with `DOMParser` (happy-dom workaround in tests)
- Substack — `<handle>.substack.com/feed` via host pattern recognizer
- Medium — `@user` / publication / `tag/<slug>` resolver
- Juejin (掘金)
  - `recommend_all_feed` (全站推荐) via `declarativeNetRequest` Origin/Referer rewrite
  - `cate_feed` (iOS 推荐 / iOS 最新, 20 条 each) via manual curl-paste credentials (uuid + `x-secsdk-csrf-token`)
- Stale-while-revalidate caching with djb2 stable-id dedupe
- Tabs: 掘金 cate sources first → 全站推荐 → RSS-family
- Per-tab unread counter, `markRead` persistence

### GitHub Trending
- Adapter via `e.juejin.cn/resources/github` relay (no auth required)
- Period (day / week / month) + language filter (Swift, JS, TS, Python, Go, Rust, Kotlin, Java, C++, …)
- Pinia `github` store + `airss.github.config` persistence

### Quick Links (快捷入口)
- Persisted `airss.shortcuts` array (`{id, label, url, addedAt}`)
- Settings page CRUD form
- Newtab widget — favicon-only 5-column grid via Google Favicon API, fallback to Fraunces drop-cap on load failure

### UI / Visual design (M9)
- **Direction**: Refined Editorial Minimalism (combo B variant per `.omc/specs/ui-design-prompt.md`)
- **Type system**: Fraunces (display serif, variable opsz/wght/SOFT) + Public Sans (body) + JetBrains Mono (counters / timestamps / tabs / labels)
- **Color tokens** (CSS variables, `prefers-color-scheme` auto-switch):
  - Light: `paper #F5F1EA` / `ink #1A1A18` / `accent #1F3D2D` (墨绿)
  - Dark: `paper #0E0E0C` / `ink #ECE7DD` / `accent #9CB89F` (薄雾绿)
- 1px hairline divisions only — no rounded cards, no shadows, no glassmorphism, no purple gradients
- 3-column ledger: `Tasks (260) | Dispatch (1fr) | Trending (360)` separated by `divide-x divide-hair`
- Top strip: mono date `MON · 08 MAY · 2026` + Fraunces italic `AIRSS` wordmark + connection chip
- Section masthead: `I.` / `II.` / `III.` Roman numerals before each panel title
- Tasks panel
  - Big Fraunces 88pt total count (no completion ratio)
  - Hairline `+ add a task — press enter` quick-add input
  - Priority indicator: `H` / `M` / `L` mono prefix in danger / warn / muted ink
  - Click title → modal with markdown-rendered notes; checkbox stays separate
- Task detail modal
  - Read mode: rendered markdown body (tiny in-house renderer in `src/utils/markdown.ts` — supports headers, bold/italic, inline + fenced code, lists, links, hr; HTML-escapes input)
  - Edit mode: title input + subtitle input + notes textarea + `Cmd/Ctrl+Enter` save + dirty confirmation
  - Metadata grid: status / priority / due / start / created / modified
  - Tags as hairline chips
- Feeds panel
  - Editorial cards (no thumbnails → drop-cap); hover `scale(1.02)` thumbnail
  - Tabs as underline navigators (active = full-width ink rule, hover = animating extension)
- GitHub panel
  - Numeric rank (`01-25` Fraunces drop number) prefix
  - mono period toggle + custom-styled language `<select>`
- Skeletons replaced with hairline ASCII placeholders (no pulsing rectangles)

### Storage / safety
- declarativeNetRequest `rules.json` rewriting Origin / Referer for `api.juejin.cn`
- Manifest host permissions only for required hosts (TickTick / dida365 / juejin / e.juejin / medium / substack)
- `.env.local` gitignored — secrets stay out of repo
- Sender-id check on `chrome.runtime.onMessage` rejects external senders

---

## 🚧 In progress / queued

| Status | Item | Notes |
|---|---|---|
| ⏭ Next | M6 — `chrome.alarms` 2h auto-refresh | tasks + feeds + github |
| ⏭ Next | Priority / due-date pickers in task modal | priority dropdown (none/L/M/H), date input |
| 🔭 Backlog | Drag-to-reorder for shortcuts | + favicon override per item |
| 🔭 Backlog | Markdown editor preview-split mode | side-by-side raw + render |
| 🔭 Backlog | Keyboard shortcuts | digit `1`-`9` to open shortcut, `n` for new task |
| 🔭 Backlog | Task delete | `DELETE /open/v1/project/{pid}/task/{tid}` |
| 🔭 Backlog | Custom-domain Substack | accept `<custom>.com/feed` patterns |
| 🔭 Backlog | M10 — README + `docs/self-host.md` | OAuth setup walkthrough, curl-paste guide |
| 🔭 Backlog | uPlot trend chart re-introduction (opt-in) | dormant code in store; re-show via setting |

---

## File map

```
src/
├── adapters/
│   ├── ticktick/          OAuth + tasks (list / create / update / complete)
│   ├── feed/              RSS / Atom / Substack / Medium fetcher + parser
│   ├── juejin/            all_feed + cate_feed + curl creds + cookie reader
│   └── github/            e.juejin.cn trending relay
├── core/
│   ├── cache.ts           SWR-style cache helpers
│   ├── ledger.ts          local daily completion ledger
│   ├── http.ts            authedFetch with token refresh
│   ├── oauth.ts           OAuth flow
│   ├── subscriptions.ts   feed source CRUD
│   ├── juejinCreds.ts     manual curl creds
│   ├── githubConfig.ts    period / lang / limit
│   └── shortcuts.ts       quick-link CRUD
├── stores/                Pinia: auth, tasks, feed, subscriptions, github, shortcuts
├── newtab/
│   ├── App.vue            top strip + 3-column grid
│   └── components/        ShortcutsWidget, TaskPanel, TaskItem, TaskDetailModal,
│                          FeedPanel, FeedTabs, FeedCard, FeedSkeleton,
│                          GithubPanel, GithubPeriodToggle, GithubLanguagePicker,
│                          Skeleton, CompletionRatio*, TrendChart*, TrendRangeToggle*,
│                          ColdStartOnboarding* (* = dormant)
├── options/               SettingsView + JuejinAuthSection
├── background/sw.ts       service worker / message bus
├── styles/index.css       design tokens + paper grain + .md-* renderer styles
└── utils/
    ├── markdown.ts        in-house markdown renderer
    ├── relativeTime.ts
    └── today.ts
```

---

## Decisions on record

1. **dida365 over TickTick.com** — user is on the Chinese variant; OAuth + API host configurable via env so fork users can override.
2. **PKCE removed** — dida365 / TickTick `oauth/authorize` rejects `code_challenge` params.
3. **Manual curl paste for juejin cate** — `e.juejin.cn` relay does not surface enough info; tab-proxy approach failed against unloaded tabs. Manual paste of uuid + csrf is the working path.
4. **No new runtime deps** — markdown rendered in-house, favicons via Google API, charting (when reintroduced) sticks with already-installed uPlot.
5. **Editorial minimalism, not SaaS template** — strict avoid list: Inter, Space Grotesk, purple gradients, glassmorphism, rounded cards with shadows, "Good morning" header, big centered clock.
6. **Single token surface** — one CSS-var palette switches via `prefers-color-scheme`. No theme toggle button (system preference only).
7. **Stable list semantics** — `getTodaySnapshot` returns pending ∪ completed-today so `today.length` and visible items stay constant across refresh.
