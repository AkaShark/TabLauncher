# AIRSS Dashboard 长程迭代计划 v2 (Option A' 收紧版)

**Status**: Approved (Architect APPROVE-WITH-CHANGES → A' synthesized)
**Synthesis log**: 见文末 §8
**Author**: Planner (Claude Opus 4.7)
**Date**: 2026-05-08
**Time-box**: open-ended, 完成 P1+P2+P3 三阶段

---

## 1. Requirements Summary

来自用户：把 3 条候选方向（Options 导入 UI + RSSHUB_BASE / arXiv 高噪源折叠 / 整体性能 UX 巡检）全部纳入，并主动思考补全功能/需求。

来自 codebase audit（Explore agent 报告）：
- 没有 bulk-import 路径，`SettingsView.vue:1-391` 一次只能加一条
- 没有 settings store，配置散落在 `core/githubConfig.ts`、`core/juejinCreds.ts`、`stores/feed.ts:32-34` 等处；refresh interval / RSSHUB base / 主题等均硬编码
- arXiv 在 `preset-ai-sources.ts:40-43` 有 `highVolume` 标记但未被任何 UI 使用；feed 仅按 source-type 聚 tab，无 category/tag 概念
- `FeedPanel.vue:25` + `stores/feed.ts:35` 用 `slice(0, 30)` 硬截断，没有虚拟列表，也没有 perf mark/measure
- `sw.ts:12` 注明 `chrome.alarms 2h 周期刷新` 在 M6 推迟；当前刷新只发生在新标签页打开 + 手动
- `e2e/sanity.spec.ts:1-33` 只检测 heading，没有滚动 / 性能 / 多源场景

---

## 2. RALPLAN-DR Summary

### Principles (5)
1. **数据驱动**：先有 perf 基线（mark/measure + 简易指标），再做"优化"；否则不收
2. **小步快跑**：每个阶段独立可发布，验收完成才进下一阶段；禁止跨阶段并行
3. **配置集中**：所有用户偏好走单一 settings store + chrome.storage.local；杜绝再增散落配置
4. **不破坏现状**：seed/preset 数据是 v1，未来可演进；现有订阅/已读/认证状态零迁移成本
5. **可观测优先于美化**：UX 改进必须能被 e2e + 单测覆盖；视觉抛光延到最后

### Decision Drivers (top 3)
1. **复合收益**：一次迭代要同时让"加源更省心"+"看 feed 不刷屏"+"未来可量化优化"
2. **风险可控**：3 条方向耦合在 store / Options / FeedPanel 三个文件，必须避免冲突重构
3. **长程可中断**：用户随时叫停后，已完成的阶段必须能独立运行；不留半截脚手架

### Viable Options (>=2)

#### Option A — 三阶段串行（推荐）
- P1：settings store + RSSHUB_BASE 设置 + 一键导入 UI（含 category 分组勾选）
- P2：FeedSourceConfig 增加 `category` + `tags` 字段；FeedPanel 增加分类折叠 + 高噪源默认折叠
- P3：perf 仪表（mark/measure）+ chrome.alarms 周期刷新 + 虚拟列表 + UX 巡检（键盘导航、空/错状态、a11y）+ bundle visualizer

**Pros**: 每阶段独立验收；P1 数据模型为 P2 铺好；perf 改造在最后避免重做
**Cons**: P3 偏长，可能需要再细分

#### Option B — 横切式三件并行
P1/P2/P3 各自切薄片，每周期都各做一点

**Pros**: 用户每次会话都能看到三条线在动
**Cons**: store 改动会冲突；很容易卡在"P2 折叠依赖 P1 category 字段还没落"的循环依赖

#### Option C — 仅做 P1 + P3（先放弃 arXiv 折叠）
**Pros**: 范围最小
**Cons**: 用户已明确 3 条全要 → 不满足需求；invalidated

**选择 Option A**：原因见 Drivers 1+3。Option B 因 store schema 变更耦合而失稳；Option C 不满足用户范围。

---

## 3. Acceptance Criteria

### P1 — Settings Store + Bulk Import (验收 5 项)
- [ ] 新增 `src/stores/settings.ts`（Pinia + chrome.storage.local 持久化），至少包含 `rsshubBase: string` 默认 `https://rsshub.app`，`refreshIntervalMin: number` 默认 120
- [ ] `preset-ai-sources.ts` 在导入时按 settings.rsshubBase 重写所有 `viaRsshub:true` 项的 host
- [ ] Options 页新增"AI 推荐源"分组卡：按 category（lab/research/media/china）分组、checkbox 勾选、`一键导入选中` 按钮；导入走现有 `addRss/addSubstack`
- [ ] Bulk import 必须报告 `{ added, skipped(dupe), failed }` 三类计数；失败列出原因（permission denied / invalid url）
- [ ] 单测：`settings.spec.ts` + `bulk-import.spec.ts` 覆盖 dedupe / RSSHub 重写 / 失败上报；e2e: Options 页一键导入后 newtab 出现至少 1 个新 tab

### P2 — Source Categorization & Folding (验收 4 项)
- [ ] `FeedSourceConfig` 新增可选 `category?: string` + `tags?: string[]`；预设源导入时落上 category；老订阅保持兼容
- [ ] `FeedPanel.vue` tab 改为两层：一级 category（默认折叠 highVolume 类目）+ 二级源 tab；保留 "全部" 视图
- [ ] arXiv 等 highVolume 源默认收起，点击展开；该状态持久到 settings
- [ ] 单测：feed.tabs.spec 扩展覆盖 category 分组；e2e: 默认进入新标签页时 arXiv tab 不在第一屏

### P3 — Perf + UX 巡检 (验收 7 项)
- [ ] `src/utils/perf.ts` 提供 `mark/measure` 包装；在 SW fetch、aggregate、首屏渲染各打 3 个关键 mark
- [ ] 新增 `src/utils/metrics.ts`：env 控制开关（默认开发开/生产关），把 measure 结果汇入 console.table；不上报远端
- [ ] `chrome.alarms` 周期刷新落地（替代 sw.ts:12 TODO）；周期取自 settings.refreshIntervalMin
- [ ] `FeedPanel` 长列表虚拟化（`@tanstack/vue-virtual` 或自实现 IntersectionObserver 分页）；移除 `MAX_RENDER=30` 硬截断或改为动态
- [ ] 键盘导航：j/k 切 item、o 打开、m 标记已读；非输入态全局生效
- [ ] 空/错/部分失败状态视觉抛光 + a11y aria-live 通知
- [ ] `vite-plugin-visualizer` 接入；产出 `dist/stats.html`，main bundle gzip ≤ 200KB（基线后再调）

### 全局
- [ ] 每阶段结束 typecheck + test + lint + e2e 全绿
- [ ] 每阶段单独 PR（或单独 squash commit），commit message 注明阶段和 ADR 链接

---

## 4. Implementation Steps

### P1 (~1-2 sessions)
1. 新建 `src/stores/settings.ts`：定义接口、加载/保存到 `chrome.storage.local` key `airss.settings.v1`
2. `preset-ai-sources.ts` 加导出函数 `withRsshubBase(base: string): PresetSource[]` 做 URL 重写
3. `core/subscriptions.ts` 增加 `addBulk(items: PresetSource[]): Promise<BulkResult>`
4. `SettingsView.vue` 新增"推荐源"折叠卡：分组渲染 + 全选/反选 + 导入按钮 + 结果 toast
5. 新增"通用设置"卡：RSSHub base + refresh interval（输入框 + 保存）
6. 单测 + e2e
7. typecheck / lint / build / e2e 全绿后 commit

### P2 (~1-2 sessions)
1. `adapters/feed/types.ts` 加 `category?` `tags?`；migration：旧订阅读出后默认 `category='custom'`
2. `core/subscriptions.ts addRss/addSubstack/...` 接受可选 category
3. P1 的 bulk import 顺手把 preset category 落到 source
4. `FeedPanel.vue` 改两层 tab；persist 折叠态到 settings store
5. 单测扩展 + e2e（高噪源默认折叠）
6. 验收 + commit

### P3 (~2-3 sessions)
1. `utils/perf.ts` + `utils/metrics.ts`，instrument SW + aggregate + FeedPanel 首屏
2. SW chrome.alarms 周期刷新；alarm name `airss.refresh`，handler 复用现有 `feed/refresh` 路径
3. 虚拟列表方案选型（推荐 `@tanstack/vue-virtual`，体积 ~3KB gzip），接入 FeedPanel
4. 键盘导航 composable `useFeedKeybindings`；快捷键文档写入 README
5. 空/错/loading 状态打磨；a11y 走查（axe-core 跑一遍）
6. `vite-plugin-visualizer` 接入；首次基线写入 `docs/perf-baseline.md`
7. 全部测试 + 验收 + commit

---

## 5. Risks & Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| R1: P2 给 FeedSourceConfig 加字段，老用户 chrome.storage 数据不兼容 | 升级后看不到订阅 | migration 函数：读出时默认补 `category='custom'`；写入测试覆盖 |
| R2: 一键导入时 host permission 弹窗洪水 | UX 极差 | 一次性 `permissions.request({origins: [...]})`；失败回落到逐条 |
| R3: 虚拟列表与现有 IntersectionObserver 图片懒加载冲突 | 缩略图错位 | 选型时验证；备选自实现 windowing 配 chunk render |
| R4: chrome.alarms 在 SW 重启后丢失 | 周期刷新不稳 | onInstalled / onStartup 重新注册 alarm；e2e 模拟 SW 重启不可行，单测覆盖注册逻辑 |
| R5: settings store 与现有散落配置（githubConfig/juejinCreds）形成双源 | 配置漂移 | P1 只新增 RSSHub/refresh 两项；存量配置在 P3 才合并迁移 |
| R6: 用户中途叫停 | 半成品阻塞 | 三阶段独立 commit；每阶段过验收才推下一阶段 |

---

## 6. Verification Steps

每阶段结束跑：
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
```

并且：
- P1 验收：手动在 Options 勾选 6 个 source 一键导入，回新标签页确认出现
- P2 验收：默认进入新标签页 arXiv tab 折叠；展开后能看到 item
- P3 验收：DevTools Performance 录制首屏 < 200ms（开发机基线）；`docs/perf-baseline.md` 写入数字

---

## 7. ADR (placeholder, 终稿前补全)

- **Decision**: Option A 三阶段串行
- **Drivers**: 复合收益 / 风险可控 / 长程可中断
- **Alternatives considered**: B 横切并行（store 冲突）、C 只做 P1+P3（不满足范围）
- **Why chosen**: 数据模型 P1→P2 单向依赖最小化重构；P3 perf 在数据稳定后做最准
- **Consequences**: P3 较长可能再拆；引入 settings store 后未来配置迁移有锚点
- **Follow-ups**: OPML 导入、读已读全局快捷键、TickTick OAuth 流抛光、og:image 缩略图（thumbnail.ts:6 TODO）

---

## 8. Architect Synthesis → A' (adopted)

Architect verdict: APPROVE-WITH-CHANGES. 关键收紧点：

1. **删 `addBulk` 核心 API**：`core/subscriptions.ts:52-55` 的 `add()` 已是 url 幂等；UI 直接循环 `addRss/addSubstack` 即可，结果聚合放 Vue 组件
2. **删 `category` / `tags` schema**：现有 `FeedSourceConfig.enabled` (`types.ts:28`) 足以做 arXiv 默认折叠 — preset 标 `enabled:false` 即可，零迁移
3. **`chrome.alarms` 前置 P1**：`sw.ts:244` 当前只 `onInstalled` 注册；A' 要求 `onInstalled + onStartup + 顶层 onAlarm` 三连，否则浏览器重启后周期刷新静默死掉
4. **权限批量必须在用户手势内**：`permissions.request({origins:[...]})` 必须从 click handler 同步发起，await 之前要先收集所有 host
5. **虚拟列表门控在测量后**：`feed.ts:305-310` 每次 storage event 全量重建 `items`，瓶颈可能是 Pinia 反应而非 DOM；P3 step 3 必须先有 perf 数据再选型

### 阶段重排

- **P1-lite (1 会话)**：settings store(`rsshubBase` only) + 预设导入 UI + arXiv 在 preset 标 `enabled:false` + chrome.alarms 三连注册
- **P2-lite (1 会话)**：`utils/perf.ts` + 实测 `rebuildFromRaw` 成本 + 决定虚拟列表 + 键盘导航 + a11y
- **P3 (按需)**：仅当 P1+P2 仍不够才引入 `category` schema 与更深 UX 巡检；否则归 follow-up

### 删除的范围

- `core/subscriptions.ts addBulk` —— 不做
- `FeedSourceConfig.category / tags` —— 不做
- 老订阅 migration 函数 —— 不做（无 schema 变更）

### 保留的范围

- 全部 7 项 P3 验收里：perf 仪表 / chrome.alarms（移到 P1） / 键盘导航 / 空错状态打磨 / bundle visualizer 留 P2-lite；虚拟列表门控测量

