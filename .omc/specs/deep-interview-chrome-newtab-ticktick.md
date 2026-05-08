# Deep Interview Spec: Chrome 个人定制化新标签页 (TickTick + Info Feed Dashboard)

## Metadata
- Interview ID: chrome-newtab-001
- Rounds: 11
- Final Ambiguity Score: **12.2%**
- Type: greenfield
- Generated: 2026-05-07
- Threshold: 20%
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.40 | 0.368 |
| Constraint Clarity | 0.85 | 0.30 | 0.255 |
| Success Criteria | 0.85 | 0.30 | 0.255 |
| **Total Clarity** | | | **0.878** |
| **Ambiguity** | | | **0.122** |

## Goal
构建一个 Chrome MV3 扩展，通过 `chrome_url_overrides.newtab` 替换默认新标签页，提供一个**多 widget 个人定制化 Dashboard**，每次按 Cmd+T 打开都能"一眼看到今日进度 + 一手最新资讯"。

**双支柱定位**：
1. **任务管理支柱** — 基于 TickTick 的今日任务 + 完成进度
2. **信息流支柱** — 聚合 RSS（Substack / Medium / 个人 AI 博客）+ 掘金（自定义 adapter）

**布局**: 左右分栏 — 左侧任务区（窄），右侧信息流卡片（宽）。

## Constraints

### 平台与架构
- Chrome 扩展，**Manifest V3**
- 单页应用：`chrome_url_overrides.newtab` → `index.html`
- 无后端服务（无中央代理）
- 所有数据 / token 存于 `chrome.storage.local`
- 网络：扩展直连 TickTick API + 各 RSS 源 + 掘金 API

### 数据获取（混合策略）
- **TickTick**: 官方 OAuth2 API，`chrome.identity.launchWebAuthFlow`
- **Substack**: 直接 fetch `https://<pub>.substack.com/feed`（标准 RSS）
- **Medium**: 直接 fetch `https://medium.com/feed/@<user>` / `medium.com/feed/<publication>` / `medium.com/feed/tag/<tag>`
- **个人 AI 博客 / 其他订阅源**: 用户在 settings 里粘贴 RSS URL
- **掘金**: 自定义 adapter，调用 `api.juejin.cn` 内部 JSON 端点（参考 https://github.com/zhuyuqian/juejin-plugin 的实现路径；可能需要登录态 cookie 或 token 才能拿到关注/推荐流）

### 部署
- 仅本人使用 + 代码开源到 GitHub
- 他人 fork 后填入自己的 TickTick `client_id` / `client_secret`，自行打包成开发模式扩展加载
- 不发布到 Chrome Web Store

### 隐私
- 全部数据本地存储
- 已读状态、订阅列表、缓存 feed 都在 `chrome.storage.local`
- 不上传任何数据到第三方

## Non-Goals (v1 显式排除)
- ❌ 不发布到 Chrome Web Store
- ❌ 不做后端代理服务
- ❌ 不做多用户 / 团队 / 共享
- ❌ 不接 Notion / Google Calendar / GitHub / Linear / Jira（v2 候选）
- ❌ 不做 Launcher 类（书签九宫格、命令面板）
- ❌ 不做美学/壁纸/名言这类装饰
- ❌ 不做 TickTick 习惯打卡 / 番茄钟集成（v2）
- ❌ 不做 deadline 倒计时 widget（v2）
- ❌ 不做信息流的"在面板内读完整文章"（v2 — 点击只跳转新 tab 打开原文）
- ❌ 不做"稍后读 / 收藏"列表（v2）
- ❌ 不做可拖拽 bento-style widget 网格（v1 用固定左右分栏）
- ❌ 不做手动选择"哪些 TickTick 列表纳入今日"——v1 使用 TickTick "今日"智能清单的默认逻辑

## Acceptance Criteria

### 任务支柱（左栏）
- [ ] **AC-T1 性能**: 打开新标签页 ≤ 500ms 内可见今日任务列表（命中缓存即可，后台异步刷新）
- [ ] **AC-T2 任务交互**: 用户可在页面上勾选完成任务，状态在 ≤ 2s 内同步回 TickTick
- [ ] **AC-T3 实时进度**: 显示今日完成比（如 `3/8`），勾选后 UI ≤ 200ms 更新该比值
- [ ] **AC-T4 趋势图**: 提供过去 7 天 / 30 天完成量趋势图，可在两种粒度间切换

### 信息流支柱（右栏）
- [ ] **AC-F1 订阅管理**: 在 settings 页能添加 / 删除 RSS URL 订阅源（手动粘贴 URL 即可）
- [ ] **AC-F2 平台特化源**: 内置 Substack（输入 publication 名）、Medium（输入用户/publication/tag）、掘金（输入登录 cookie 或 token）的快捷添加流程
- [ ] **AC-F3 首屏性能**: 打开新标签页 ≤ 1s 内可见最近 N 条卡片（命中缓存即可，N 默认 30，可在 settings 调整）
- [ ] **AC-F4 多源聚合**: 各订阅源按发布时间倒序合并，重复 item（链接相同或标题+源相同）去重
- [ ] **AC-F5 卡片形态**: 每张卡片含标题 + 来源 + 发布时间 + 摘要 + 缩略图（缩略图优先 RSS 提供的 media:thumbnail，其次解析正文 og:image，最后省略）
- [ ] **AC-F6 跳转**: 点击卡片在新 tab 打开原文链接
- [ ] **AC-F7 已读区分**: 点击过的卡片标记为已读，下次渲染时视觉上明显淡化（透明度 / 灰阶 / 对勾标识任一即可）
- [ ] **AC-F8 定期刷新**: 后台每 2h 自动刷新所有源（用 `chrome.alarms`），用户也可手动点"刷新"按钮即时拉取

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "Dashboard + Launcher + 美学 + 工作流入口全都要" | Round 2 真实行为追问 | 砍到 Dashboard 单一主轴 |
| "高度定制化 = Dashboard 只接 TickTick 单源" | Round 7 后用户主动回滚 | **修正**：Dashboard = 任务 + 信息流双支柱，"定制化"指多 widget 组合 |
| "需要发布到 Chrome Web Store" | Round 6 Simplifier | 自用 + GitHub 开源他人自部署 |
| "进度 = 模糊感觉" | Round 5 强制视觉化 | 落地为：完成比 + 7/30 天趋势图 |
| "信息流 = 各家平台 API 分别接" | Round 8 Simplifier | RSS 80% + 选择性 API 补（仅掘金） |
| "信息流 = 卡片内读全文" | Round 9 选项暴露 | 标题/摘要卡片 + 跳转新 tab 读 |
| "双支柱 = bento 拖拽" | Round 10 选项暴露 | v1 固定左右分栏，简化实现 |

## Technical Context (greenfield)

**核心栈推荐**（待 ralplan 阶段最终确认）:
- **扩展层**: Manifest V3, `chrome_url_overrides.newtab` → `index.html`
- **前端**: Vue 3 / React + Vite，单页 SPA，TypeScript
- **TickTick OAuth**: `chrome.identity.launchWebAuthFlow` + 授权码流程，redirect URL `https://<extension-id>.chromiumapp.org/`
- **RSS 解析**: 浏览器原生 `DOMParser` 解析 XML，或 `rss-parser` 轻量库
- **掘金 adapter**: 独立模块，封装 `api.juejin.cn` 调用；用户在 settings 配置登录 cookie / 推荐流参数
- **存储**:
  - `chrome.storage.local`: token、订阅源列表、用户配置
  - `chrome.storage.local` 或 IndexedDB: feed 缓存、已读状态、任务缓存
- **缓存策略**: stale-while-revalidate
- **后台刷新**: `chrome.alarms` 每 2h 触发 service worker 拉取所有源
- **图表**: uPlot 或 Chart.js
- **缩略图提取**: RSS 内 media:thumbnail / enclosure → fallback 通过 fetch 原文 HTML 解析 `<meta property="og:image">`

### 待 ralplan / Architect 进一步定夺的开放点
1. **掘金登录态**: 是否要求用户手动从浏览器 devtools 复制 cookie，还是引导用户在已登录的掘金 tab 里点扩展按钮自动抓取？前者简单后者更友好
2. **RSS 跨域**: MV3 service worker 中 fetch 第三方 RSS，需在 manifest `host_permissions` 中声明 `<all_urls>` 或具体域名清单。开源后用户自定义 RSS 时如何处理？
3. **任务列表来源边界**: AC-T1 用 TickTick "今日"智能清单的默认行为（含逾期），如未来需自定义需新增 AC
4. **离线与错误态**: 网络断开 / token 过期 / RSS 拉取失败时各 widget 的降级 UI（v1 范围）
5. **图表数据计算**: 7/30 天完成量趋势依赖 TickTick 的"已完成任务"历史接口，需确认 API 是否支持时间范围过滤；不支持则可能需要本地累积

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Dashboard | core domain | layout(left/right split), widgets[] | 容器，渲染 TaskPanel + FeedPanel |
| TaskPanel | core domain | todayTasks[], completionRatio, trendData | 由 TickTickConnector 喂数据 |
| TodayTaskList | core domain | tasks[], lastSyncedAt | TickTick 今日智能清单结果 |
| CompletionRatio | derived | doneCount, totalCount | 派生自 TodayTaskList |
| TrendChart | core domain | range(7d/30d), seriesData[] | 聚合 TickTick 历史完成数据 |
| FeedPanel | core domain | items[], lastRefreshedAt | 由 SubscriptionRegistry + 各 Adapter 喂数据 |
| FeedItem | core domain | title, source, publishedAt, summary, thumbnail, url, isRead | FeedPanel 的最小单元 |
| FeedSource | core domain | type(rss/substack/medium/juejin), url/handle, label, enabled | 一个订阅源 |
| SubscriptionRegistry | supporting | sources[] | 用户配置的订阅源集合，存于 chrome.storage |
| RSSAdapter | supporting | fetchAndParse(url) | 通用 RSS/Atom 解析器 |
| JuejinAdapter | supporting | fetchRecommendFeed(token), fetchFollowFeed(token) | 调 api.juejin.cn |
| TickTickConnector | supporting | clientId, clientSecret, accessToken, refreshToken | 任务 widget 的数据接口 |
| ReadState | supporting | itemUrl → readAt | 已读状态本地表 |
| RefreshScheduler | supporting | alarm("feed-refresh", 2h) | chrome.alarms 触发后台刷新 |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|-------|-------------|-----|---------|--------|-----------|
| 1 | 4 (Dashboard, Launcher, Aesthetic, Workflow) | 4 | - | - | N/A |
| 2 | 3 (Dashboard, Tasks, Progress) | 2 | - | 1 | 25% |
| 3 | 4 (+ SaaSConnector) | 1 | - | 3 | 75% |
| 4 | 4 (Tasks→TickTickTasks 细化) | 0 | 1 | 3 | 100% |
| 5 | 5 (Progress→CompletionRatio + TrendChart) | 1 | 1 | 3 | 80% |
| 6 | 5 | 0 | 0 | 5 | 100% |
| 7 | 5 | 0 | 0 | 5 | 100% |
| **8** | **8 (+ InfoFeed, FeedSource, FeedItem)** | 3 | 0 | 5 | 62.5% |
| 9 | 9 (+ ReadState 因卡片形态确认) | 1 | 0 | 8 | 89% |
| 10 | 10 (+ TaskPanel/FeedPanel 因左右分栏) | 2 | 1 | 8 | 91% |
| 11 | 13 (+ Adapter 拆分 + RefreshScheduler) | 3 | 0 | 10 | 77% |

第 11 轮 ontology 略有扩展（adapter 拆分）但都是同一支柱内的实现细节，主轴本体（Dashboard / TaskPanel / FeedPanel）从 R10 起完全稳定。

## Interview Transcript

<details>
<summary>Full Q&A (11 rounds)</summary>

### Round 1 — Goal
**Q:** 新标签页第一眼希望成为什么？
**A:** 上面 4 个集合都要 (Dashboard / Launcher / 美学 / 工作流)
**Ambiguity:** 79.5%

### Round 2 — Goal (真实行为)
**Q:** Cmd+T 后最初 3 秒在做什么？
**A:** 看一眼今天要干什么 / 进度怎么样
**Ambiguity:** 68%

### Round 3 — Goal (数据源)
**Q:** "今天要干什么"信息存在哪里？
**A:** 在某个 SaaS 里
**Ambiguity:** 61.5%

### Round 4 — Constraints (Contrarian)
**Q:** 只接一个 SaaS 是哪个？
**A:** TickTick
**Ambiguity:** 46.5%

### Round 5 — Goal+Criteria (视觉化)
**Q:** "看一眼进度"心里看到的是什么？
**A:** 今日完成比 + 周/月趋势
**Ambiguity:** 31.7%

### Round 6 — Constraints (Simplifier)
**Q:** 只给自己用还是发布给别人？
**A:** 只给自己用，但代码开源到 GitHub 让别人自行部署
**Ambiguity:** 21.2%

### Round 7 — Criteria (任务支柱 v1)
**Q:** v1 必须达成的硬标准？
**A:** 全部 4 项（500ms 首屏、勾选回写、实时完成比、趋势图切换）
**Ambiguity:** 10.1%

### ⚠️ 用户回滚 — 主动补充信息流支柱
**用户**: "我还需要信息流的展示，比如订阅的 AI 资讯，关注的 Substack / Medium / 掘金 文章"
**Ambiguity 重置:** 44%

### Round 8 — Constraints (信息流获取机制)
**Q:** 信息流用什么方式获取？
**A:** 混合：RSS 兑 80%，个别不提供 RSS 的用官方 API 补
**Ambiguity:** 39%

### Round 9 — Goal (信息流形态)
**Q:** 信息流交互期望？
**A:** 卡片流（含摘要/缩略图）+ 点击跳转
**Ambiguity:** 31.5%

### Round 10 — Constraints (页面布局)
**Q:** 双 widget 怎么摆？
**A:** 左右分栏：左任务，右信息流
**Ambiguity:** 27.9%

### Round 11 — Criteria (信息流 v1)
**Q:** 信息流 widget v1 必须达成的？
**A:** 各源按发布时间汇总排序去重 / 掘金参考 zhuyuqian/juejin-plugin / Substack Medium 你确定 / 跳转原页面 / 2h 定期刷新 / 已读未读视觉区分 / settings 管订阅源
**Ambiguity:** 12.2% ✅

</details>
