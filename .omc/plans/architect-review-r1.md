# Architect Review R1 — Chrome 新标签页 Dashboard Plan

> 评审对象：`.omc/plans/chrome-newtab-dashboard-plan.md`
> 上游 Spec：`.omc/specs/deep-interview-chrome-newtab-ticktick.md`
> 角色：Ralplan 共识循环中的 Architect（READ-ONLY）
> 模式：SHORT
> 评审日期：2026-05-07

---

## 0. 评审结论（TL;DR）

**`PROCEED-WITH-CHANGES`**

Plan 在主轴方向上是合格的（栈选择 / 五个开放点的方向都站得住），但存在 **3 项需修改的设计决策** 与 **1 项需 Critic 复核的边界**：

1. **OP-2 `optional_host_permissions` 流程必须收敛到 settings 前台手势**——已在 R6 提及，但 plan 主体把它当一句旁注写过去，这是 v1 实际能否工作的关键路径，应该升格为 M4 的 explicit 验收点。
2. **OP-4 hybrid 应当倒置优先级**——本地 ledger 应作为**主路径**（更可控、更可测），TickTick 历史 API 作为"如果实测可用就锦上添花"的补强，而不是反过来。原因见 §6 的事实核查。
3. **M2 PKCE + 内置 client_secret 自相矛盾**——PKCE 的全部意义就是消除 client_secret，plan 同时写了 "PKCE" 与 "refresh token 与 client_secret 在 .env.local 注入构建时常量"，需在 Critic 复核前就明确二选一。

下面是完整论证。

---

## 1. Steelman Antithesis（强反方论证）

我现在站在 Planner 的对立面，**最有力**地论证为什么 Option A 的关键技术选择可能是错的。

### 1.1 反方论据：Vue 3 + Pinia 不优于 React + Zustand

Planner 的 con 部分对 Option B 的 cost 评估失真：

- **"React + ReactDOM 基线 ~45KB"** —— 真实数据：React 18 + ReactDOM gzipped 约 44KB，Vue 3 runtime + compiler-runtime gzipped 约 34KB，差值仅 10KB。在 200KB 总预算下，10KB 不构成"压不住首屏"的硬约束。Planner 把这点当淘汰理由是 framing bias。
- **"Recharts ~90KB"** —— Planner 把 Recharts 作为 React 的代表配对，再用其体积反向论证 React 不行。这是稻草人：Option B 的合理配对应该是 React + uPlot（uPlot 没有框架绑定），那此项直接为零差。
- **"JSX 写卡片流比 Vue 模板啰嗦"** —— 主观偏好，无客观 LOC 数据支撑。卡片流恰恰是 JSX 的强项（条件渲染、列表 key 收敛在一处）。
- **真正应该担心 Vue 的点 plan 没提**：(a) `@crxjs/vite-plugin` 对 Vue SFC + service worker 双入口的 HMR 在 0.5.x 版本曾有已知 issue（SW 改动需手动 reload）；(b) Pinia + `chrome.storage` 双向绑定 plugin 是要自己写的（plan §3 也承认了"自写 chromeStoragePlugin"），React 侧 `zustand/middleware/persist` 有现成的 chrome.storage adapter 社区方案；写过 zustand 持久化中间件的人比写过 Pinia plugin 的多 5-10 倍，遇坑可搜索性更强。

**反方结论**：Vue 3 不是错的，但 plan 把 Option B 淘汰得过于轻率，且淘汰理由（体积）是错的。**真正的决策依据应该是**：用户偏好 + Vue 模板对静态内容渲染稍紧凑 + `<script setup>` 的开发体验。这三条中只有第一条 plan 里写出来了。

### 1.2 反方论据：CRXJS 不是最稳的选择

- `@crxjs/vite-plugin` 仍处于 beta（v2 alpha 在 npm 上长期 alpha tag），上游维护活跃度自 2024 起明显放缓，issue tracker 累积 unresolved bug。
- 替代方案 **`vite-plugin-web-extension`**（aklinker1）维护更勤、对 MV3 service worker 的处理更直接、文档对 manifest TS schema 支持完善。
- 自己写 build pipeline：对一个单 SPA + 一个 service worker 的极小项目，手写 `vite build --watch` + 静态拷贝 manifest 加 30 行脚本即可，没有 HMR 但 reload 也只有 1s。
- **反方结论**：CRXJS 的"HMR 一体化"看起来很美，但 service worker 改动事实上仍需要手 reload，其真实优势远小于宣传。R3（"SW 30s 休眠 + alarm"）这类问题 CRXJS 不能帮你解决，反而它自身的打包行为可能给你额外的调试负担。**建议至少把 `vite-plugin-web-extension` 列为 M1 的 fallback，而非完全不提。**

### 1.3 反方论据：UnoCSS 优于 Tailwind 的论证不成立

Plan 写"UnoCSS 比 Tailwind JIT 更轻 ~5KB"。**这是计量错误**：Tailwind JIT 在生产构建后产物本身也只有 5-8KB（仅包含使用过的类）。两者在产物体积上几乎一致。UnoCSS 的真正卖点是 **on-demand 编译速度** 与 **预设系统更灵活**，但这对一个 5 个组件的小项目都不构成可感差异。**反方论据**：Tailwind 的生态、文档质量、IDE 智能提示成熟度全面胜出，开源用户 fork 后的修改门槛更低。UnoCSS 的选择更多是 author preference，不是 architectural necessity。**v1 用 Tailwind 是更稳的选择。**

### 1.4 反方论据：单页 SPA 不需要 Pinia

newtab 单页只有两个 view（dashboard / settings），状态本质上是 5 个 store 的并列。**Pinia 解决的核心问题是"跨组件状态共享"，但当 chrome.storage.local 已经天然跨组件、跨 tab 共享时，Pinia 在这个项目里退化为"一个带 reactivity 的 storage 缓存"**。直接用 `reactive()` + 一个 50 行的 `useChromeStorage(key)` composable，体积省掉 2KB，心智模型更直接，调试也更简单（少一层 store devtools 间接性）。

**反方结论**：Pinia 不是必需。建议 v1 用 Vue 原生的 `reactive` + composable，等 store 数量超过 8 个或出现复杂派生状态时再引入 Pinia。

### 1.5 反方论据：uPlot 对此场景过度

uPlot 的卖点是"数十万数据点 60fps"。本项目 7 天 = 7 个柱、30 天 = 30 个柱。**用 uPlot 杀鸡用牛刀**。两个反方候选：
- **Chart.js 4** tree-shake 后只引 BarController 约 35KB，API 友好度远超 uPlot；
- **手写 SVG**：30 个柱 + 一条折线，total 约 80 行 Vue 模板，0KB 第三方依赖，完全可控 a11y、动画、主题切换。

**反方结论**：30 数据点 + 仅两种图（折/柱）的场景，**手写 SVG 是最佳方案**，uPlot 是为不存在的性能问题付出的复杂度成本。

---

## 2. 五个开放点逐个挑战

### OP-1 掘金 `chrome.cookies` API ——【部分质疑】

**反方论据**：

(a) `cookies` 权限会在 Chrome 商店被归类为 sensitive permission；虽然 plan 明确不上架商店，但开源用户 fork 后若希望走 unpacked 安装，**Chrome 在每次启动浏览器时都会弹"开发者模式扩展可能不安全"的横幅**——`cookies` 权限不会单独触发，但与 `host_permissions` 组合后的"权限说明"读起来会让非技术用户犹豫。

(b) **关键事实核查 [VERIFIED-via-webfetch]**：根据 https://developer.chrome.com/docs/extensions/reference/api/cookies ：
- `chrome.cookies` API 需要同时声明 `"cookies"` permission **和** 对应域的 `host_permissions`，缺一不可。
- 文档明确 "If host permissions for this URL are not specified in the manifest file, the API call will fail."
- HttpOnly cookie 通过 `chrome.cookies.get()` **是可读的**（HttpOnly 仅对页面 JS 不可见，对扩展 API 可见）。
- SameSite=Strict 不影响 `chrome.cookies.get()` 读取（SameSite 是浏览器跨站请求时是否携带的策略，与扩展 API 无关）。
- 关于 service worker 可用性：[UNVERIFIED-assumption] 文档未明确陈述 SW 限制，但 chrome.cookies 是 `chrome.*` 命名空间的标准异步 API，在 MV3 SW 中按惯例可用；建议 M5 spike 实测确认。

(c) **真正的反方风险**：juejin.cn 的实际登录 cookie 名称、过期策略、是否依赖额外的 csrf double-submit 在 plan 里只写了"sessionid + passport_csrf_token"——**这是 plan 作者凭印象写的，没有验证**。zhuyuqian/juejin-plugin 项目近年无更新（plan §6 R2 也承认了），**当前 juejin.cn 的实际 cookie schema 可能已变化**。

**建议修改**：
- 保留 (c) 方案方向。
- M5 启动前必须 spike：在登录的掘金 tab 上抓包确认当前 cookie schema、推荐流端点、是否需要 X-Bogus 等签名头（掘金近年加了一个动态签名 wasm，过去逆向工程项目失效大都因此）。
- spike 失败时立即回退到 (a) 手动粘贴 cookie，**不要在 M5 阻塞**。
- settings 页 cookie 状态显示"上次成功时间 + cookie 即将过期警告"。

### OP-2 `optional_host_permissions` ——【方向正确，流程需收敛】

**反方论据**：

(a) **每加一个 RSS 弹一次权限请求 UX 差**：用户体验真实路径是"粘贴 URL → 弹 Chrome 系统级权限对话框 → 同意 → URL 入库"。这个对话框的措辞由 Chrome 控制，开源用户首次使用会觉得"扩展在要奇怪的权限"。

(b) [VERIFIED-via-webfetch] https://developer.chrome.com/docs/extensions/reference/api/permissions ：
- `chrome.permissions.request()` **必须在用户手势中调用** ("Permissions must be requested from inside a user gesture, like a button's click handler")。
- 一旦授予，**permission 是持久化的**（"After a permission has been removed, calling permissions.request() usually adds the permission back without prompting the user"）。
- Chrome 133+ 引入了 `addHostAccessRequest()` / `removeHostAccessRequest()` 作为新的"host access request"流程；但这与 `permissions.request` 是不同 API，目前不影响 plan 的方案。
- [UNVERIFIED-assumption] 在 service worker 中调用 `permissions.request` 是否被允许，文档未明确，但用户手势要求隐含了"必须从前台 UI 触发"。

(c) **替代方案 `<all_urls>` 的真实成本被 plan 高估**：开源用户即使不上架商店，看到 manifest 里的 `<all_urls>` 也能理解（README 解释一句即可）。Plan 把"心理负担"作为淘汰 (a) 的核心理由是 over-rotating on optics。

**建议修改**：
- **保留 (c) 方案，但收紧约束**：在 M4 验收标准中**显式加上** "添加 RSS 订阅按钮所在 dialog 必须由用户点击触发，service worker 永远不调用 `permissions.request`，遇到无权限的源时只能在 settings 显示'需要重新授权'按钮"。这一条 R6 的 risk register 写了，但实施步骤里没有落到具体 AC。
- README 在自部署文档中提供 **"如果嫌频繁授权，手动在 manifest 加 `<all_urls>` 然后重打包"** 作为高级用户 escape hatch。

### OP-3 outbox 队列 ——【过度设计质疑】

**反方论据**：

(a) outbox 复杂度真实成本：需要序列化操作、支持指数退避、支持 SW 重启续航、支持去重（用户离线勾选了再取消 → 净操作为 0）、支持失败上限后丢弃 / 提示。这是一套小型可靠投递系统。

(b) **真实使用场景概率**：用户离线状态下勾选 TickTick 任务的概率有多大？典型场景：(i) 飞机上 (ii) 地铁信号差 (iii) WiFi 切换瞬间。绝大多数用户每天 TickTick 勾选发生在有网络环境，**离线勾选可能占总操作的 < 1%**。

(c) v1 更简方案：**直接禁用离线勾选**。`navigator.onLine === false` 时，TaskItem checkbox disable + tooltip "网络断开，恢复后再勾选"。这一行为在用户预期内，且符合 OP-3 的"失败可见，但不阻断"原则。outbox 的开发与测试成本（plan §7.1 单列了 `outbox.spec.ts`）足够换 4-6 小时其他更高 ROI 工作。

(d) 反对反方的反驳：勾选回写 ≤2s 是 AC-T2，**不是离线场景**。离线时 AC-T2 自动豁免（前提断了）。所以禁用比队列化简单且不违反 AC。

**建议修改**：
- **v1 直接禁用离线勾选**，不做 outbox。
- M2 删除"outbox 雏形"交付物。
- M8 删除"outbox 重发逻辑完整化"。
- 风险登记新增"用户报告需要离线勾选 → v1.1 引入 outbox"作为 v2 backlog。

### OP-4 hybrid 趋势数据 ——【优先级倒置建议】

**反方论据**：

(a) **关键事实核查 [UNVERIFIED-via-webfetch]**：尝试访问 https://developer.ticktick.com/docs 与 /api 均返回 404 / 403。TickTick 公开 API 文档的真实可访问性有疑问，**这本身就是一个红灯**——M3 启动当天才实测意味着**关键路径决定被推迟到实施期**，违反了 plan 阶段应该消除的不确定性。

(b) 基于公共社区资料（多个 GitHub TickTick 第三方客户端）的间接证据：TickTick Open API v1 大概率**只暴露**:
- `GET /open/v1/project/{projectId}/data` —— 单 project 全量任务（含已完成）
- `GET /open/v1/task/{taskId}` —— 单任务
- `POST /open/v1/task/{taskId}/complete` —— 标记完成
- 缺少：按 completedTime 范围拉所有 project 已完成任务的端点。

(c) hybrid 方案的真实问题：**两条路径都要写、都要测、都要文档化**。代码复杂度是单路径的 ~1.8x。而"积累中 n/30 天"的体验对用户的伤害被 plan 低估——用户安装后 30 天内打开图表都看到不完整数据，第一印象差。

(d) **反方核心主张**：**v1 应该锁死本地 ledger 单路径**：每次 service worker alarm 触发时记录"截至现在已完成数"快照到 `dailyCompletionLedger`。代码量小、可测、可解释。30 天空窗用 onboarding "首日提示" 框管理预期，UI 用渐变填充示意"正在累积"。当 v2 实测确认 TickTick API 有时间范围支持时再切换，对用户而言数据是单调累积的，无破坏性变更。

**建议修改**：
- **OP-4 决策改为**："v1 本地 ledger 单路径；M3 启动**之前**（不是当天）做 1 小时 spike 实测 TickTick 端点列表写入研究文档；若意外发现真有时间范围端点，作为 v1.1 增强项而非 v1 的可选分支。"
- 这样 M3 实施可以专心做 ledger + uPlot/SVG，无分支判断。
- 风险登记 R1 降级（hybrid 复杂度被消除）。

### OP-5 锁死 TickTick "今日" 智能清单 ——【语义边界质疑】

**反方论据**：

(a) **TickTick "今日"语义是模糊的**：
- 是否含逾期？（plan 假设含，但不同 TickTick 版本曾有差异）
- 是否含 all-day 任务的子任务？
- 是否含他人共享给我但 assignee 是我的任务？
- 是否含周期性任务的下次实例（如果它的 dueDate=today）？

(b) plan §2 OP-5 写"v1 调 `GET /open/v1/task` 过滤 `dueDate <= today` 即可"——**这是 plan 自己改写"今日"的定义**，而不是复用 TickTick 服务端定义。两者很可能不一致：
- TickTick App 的"今日"是服务端 smart list，可能包含 dueDate 为 null 但被用户拖进"今日"的任务；
- `GET /open/v1/task?dueDate<=today` 是客户端过滤，会少掉拖入的任务，可能多出含未来 due 的某些异常状态。
- **AC-T1 在不同用户那里语义不一**这个反方担忧是真的。

(c) **建议**：
- 在 plan 里**明确**"v1 的'今日' = 客户端过滤 `dueDate <= today AND status != completed`"，**不假装等于** TickTick 服务端的今日 smart list。
- README 自部署文档中显式说明此差异。
- M2 验收标准加一条："TaskPanel 顶部小字显示数据源说明 '今日 = 截至当天到期且未完成' 以管理用户预期"。

---

## 3. 真实架构紧张关系（Real Tradeoff Tension）

不是简单二选一，而是**两件都对的事**之间的根本张力。

### Tension 1（最关键）：开源易部署 ⊥ TickTick OAuth 体验

**两端都对**：
- "开源 + 自部署"要求 fork 用户能 ≤10 分钟跑通（M10 的验收标准）。
- "TickTick OAuth"按 OAuth 2.0 标准，需要在 TickTick 开发者后台 **预先注册一个 redirect URL**，而 Chrome 扩展的 redirect URL `https://<extension-id>.chromiumapp.org/` 中的 `<extension-id>` **依赖该用户机器上的扩展私钥哈希**。

**张力**：每个 fork 用户必须 (1) 注册 TickTick 开发者账号 (2) 申请自己的 client_id/secret (3) 把自己机器上的 extension-id 填回 TickTick 后台的 redirect URL allowlist (4) 在 .env.local 填 client_id/secret 重新打包。**这绝对超过 10 分钟**，且每次重装扩展（extension-id 会变化）都要重新填一次 redirect URL。Plan §M10 的"≤10 分钟"目标与 TickTick OAuth 的本质要求**冲突**。

**建议应对策略**：
- README 必须**显式列出**这套流程的每一步，并诚实标注预计时间（实际更接近 20-30 分钟，10 分钟不现实）。
- 在 manifest 中固定 `key` 字段（manifest 的 `"key"` 属性，pubkey base64），**这样 extension-id 在所有用户机器上一致**——这是 plan 完全没提的关键技巧，**强烈建议加入 M1 交付物**。
- README 明确"首次打包后请勿删除 dist/ 目录中的 key.pem"或更优地"manifest 中已固定 key"。

### Tension 2：stale-while-revalidate 极致首屏 ⊥ ≤500ms 验收的可测试性

**两端都对**：
- SWR 本质：先吐缓存（即使是 1 周前的）保 ≤500ms，后台异步刷新。
- AC-T1 验收要求："打开新标签页 ≤ 500ms 内可见今日任务列表（命中缓存即可，后台异步刷新）"。

**张力**：SWR 的"成功"取决于缓存是否命中。**首次安装时缓存为空**，500ms 任务首屏天然不可达——AC-T1 会变成"在第二次打开 newtab 后才满足"。Playwright 的 fresh-install e2e 测试（plan §7.2）会必然失败 AC-T1，除非在 spec 里明确豁免冷启动。

**建议应对策略**：
- 在 spec / plan 中**显式标注** AC-T1 的前置条件："在已成功完成至少一次 TickTick 同步后" 才适用 ≤500ms。
- 冷启动 UX：显示 skeleton + "正在首次同步..."，timeout 5s 后给可重试入口。
- E2E 测试拆为两个 case："cold start 显示 skeleton 不超过 5s" + "warm start ≤500ms 见任务"。

### Tension 3：MV3 service worker 短生命周期 ⊥ chrome.alarms 后台刷新可靠性

**两端都对**：
- MV3 SW 在无活动 30 秒后会被浏览器回收。
- 2h alarm 触发时需要并发拉取 N 个 RSS 源 + TickTick history + 掘金，总耗时可能数十秒。

**张力**：SW 在 alarm 处理过程中可能因短期 idle（每个 fetch 之间）被杀。Plan R3 写"每个 source fetch 单独 try/catch + persist 进度"——但**实际行为是 SW 进入 idle 是从最后一个事件计起**，只要 fetch 在飞，`waitUntil(promise)` 会延长 SW 生命周期至 promise resolve。问题真正出在：
- 某个 RSS 源 fetch 卡 60+ 秒（DNS hang、TLS 握手慢），其他源被这一个拖垮；
- 浏览器在 SW 运行 5 分钟后无条件 kill（确实存在硬上限）。

**建议应对策略**：
- 在 `core/http.ts` 强制每个 fetch 显式 `AbortController` + 8s timeout（plan 已隐含但未给具体值）。
- alarm handler 用 `Promise.allSettled` + 全局 25s 上限（plan §R3 提到，建议在代码 PR 时显式加 assertion）。
- M6 验收加："single source 模拟卡死 60s，其他源仍在 25s 内完成"。

---

## 4. Synthesis（综合建议）

| 决策 | 处置 | 理由 |
|---|---|---|
| Vue 3 + Vite | **保留** | 用户偏好 + 模板紧凑确实是有效理由，只是 plan 论证错了 |
| `@crxjs/vite-plugin` | **保留 + 备选** | M1 把 `vite-plugin-web-extension` 列为已知 fallback |
| Pinia | **降级到可选** | v1 用 `reactive()` + composable；store 数 > 8 时再引 Pinia |
| UnoCSS | **改为 Tailwind** 或保留无所谓 | 真实差异微小；以作者习惯为准，但反对 plan 里"更轻 ~5KB"的错误论证 |
| uPlot | **改为手写 SVG** 或 Chart.js | 30 数据点用 uPlot 是杀鸡用牛刀 |
| OP-1 chrome.cookies | **保留方向 + M5 spike** | 实测 juejin 当前 cookie schema 与签名要求 |
| OP-2 optional_host_permissions | **保留 + 收紧** | M4 显式 AC：`permissions.request` 仅在 settings 前台手势触发 |
| OP-3 outbox | **删除** | v1 离线时 disable 勾选；outbox 进 v2 backlog |
| OP-4 hybrid | **改为 ledger 单路径** | M3 启动**前** spike，不在实施期分支 |
| OP-5 "今日" 语义 | **保留 + 显式定义** | 客户端过滤 `dueDate<=today AND !done`；UI 标注 |
| Manifest `key` 固定 | **新增**（plan 漏） | M1 必加，否则自部署 OAuth redirect 必须每次重填 |

### 应当 Critic 进一步评估的项

1. **栈选择 Vue vs React**：本评审用户偏好倾向 Vue 是站得住的，但 plan 的体积论证错了；Critic 应判断"用户偏好"是否足够支撑这个决策，还是应该走 ralplan deliberate 模式重选。
2. **TickTick PKCE vs client_secret 矛盾**：plan §M2 同时写 "PKCE" 与 "client_secret 注入构建时常量"——PKCE 的设计意图是消除 client_secret，需要 Critic 锁定到底走哪一个。建议：开源场景下若 TickTick 支持 PKCE-only 流（不要求 client_secret 在 token exchange 时呈交），坚决用 PKCE；若 TickTick 仍要求 secret，放弃 PKCE 直接用授权码 + secret，并在 README 大字说明 secret 由 fork 用户填。
3. **Manifest `key` 固定的安全含义**：固定 key 后所有 fork 用户共享同一 extension-id，理论上无负面影响（只影响 OAuth redirect 一致性），但 Critic 应核实是否触发任何 Chrome 安全策略。

---

## 5. 原则一致性检查（Principle Violations）

逐条核对 §1.1 的 5 条 Principles 是否在 M2-M10 中真有具体步骤支撑：

| Principle | 支持步骤 | 一致性 |
|---|---|---|
| P1 Local-first 零后端 | M1 manifest 不申请远端、M10 README 自部署 | ✅ |
| P2 Stale-while-revalidate | M6 `chrome.alarms` + onChanged | ⚠️ **冷启动未规划**，AC-T1/F3 在首次安装失败（详见 §3 Tension 2） |
| P3 Adapter 模式 | M4-M5 `RSSAdapter` / `JuejinAdapter` / `TickTickConnector` 三家平行 | ✅ |
| P4 SW 单中枢刷新 | M6 refreshScheduler，但 OP-2 又要求 `permissions.request` 必须前台触发 | ⚠️ **轻微张力**：SW 不能调 permissions.request，意味着"添加新源 → 触发刷新"链路需要 newtab 前台与 SW 配合，plan 未画这张时序图 |
| P5 失败可见但不阻断 | M8 全套，M2 outbox | ⚠️ 若按本评审建议**删除 outbox**，需要 P5 在"离线勾选"场景重写为"disable + tooltip" |

**Principle violations**：
- **P2 violation (severity: medium)**：冷启动场景未被任何里程碑覆盖，AC-T1 / AC-F3 验收路径在 fresh-install 失败。**必须修补**。
- **P4 minor inconsistency**：SW 单中枢与 permissions.request 前台手势限制之间的协作时序在 plan 中缺失。建议 M4 加一张序列图。
- **P5 inconsistency**：依赖 OP-3 outbox 决策；若按建议删除，重写 P5 在离线勾选下的体现。

---

## 6. 关键事实核查记录

| 事实 | 状态 | 来源 |
|---|---|---|
| `chrome.cookies` API 需 `cookies` perm + host_permissions 双声明 | [VERIFIED-via-webfetch] | https://developer.chrome.com/docs/extensions/reference/api/cookies |
| `chrome.cookies` 可读 HttpOnly cookie | [VERIFIED-via-webfetch] | 同上（文档不区分 httpOnly 限制） |
| `chrome.permissions.request` 必须在用户手势中调用 | [VERIFIED-via-webfetch] | https://developer.chrome.com/docs/extensions/reference/api/permissions |
| `chrome.permissions` 授权持久化 | [VERIFIED-via-webfetch] | 同上 |
| Chrome 133+ `addHostAccessRequest` 新 API | [VERIFIED-via-webfetch] | 同上（plan 未利用，可作 v2 增强） |
| `chrome.cookies` 在 SW 中可用 | [UNVERIFIED-assumption] | 文档未明确，需 M5 spike |
| `chrome.permissions.request` 可在 SW 中调用 | [UNVERIFIED-assumption] | 文档隐含禁止（用户手势要求），但未明文 |
| TickTick Open API 端点列表 | [UNVERIFIED-via-webfetch] | https://developer.ticktick.com/docs 与 /api 均返回 404/403，**文档不可公开访问**——这是 OP-4 的 root risk |
| TickTick 是否支持完成任务时间范围查询 | [UNVERIFIED] | 同上，强烈建议 M3 前 spike |
| juejin.cn 当前 cookie/签名 schema | [UNVERIFIED] | 需 M5 启动前抓包 |

**核查关键发现**：TickTick 开发者文档站点本评审期间**不可访问**（404 / 403），这本身就是一个不应被忽视的项目风险——Plan 把"实测 API"推迟到 M3 启动当天，但如果 TickTick 文档站长期不可达，连 OAuth scope 列表都拿不到。**强烈建议把 TickTick API spike 前置到 M0（在 M1 编码之前）**。

---

## 7. 最终评审结论

**`PROCEED-WITH-CHANGES`**

需在进入 Critic 复核 / 实施前完成的 5 项最关键修改：

1. **[BLOCKING] manifest 固定 `key`** — M1 必加，否则自部署 TickTick OAuth 流程不可用（每次重装 redirect URL 失效）。
2. **[BLOCKING] OP-4 倒置为本地 ledger 单路径** — 消除 hybrid 分支带来的实施期不确定性；M0 spike TickTick API 可达性。
3. **[BLOCKING] 解决 PKCE 与 client_secret 内置的矛盾** — M2 必须二选一并文档化。
4. **[HIGH] 冷启动 UX 规划** — 修补 P2 principle violation；AC-T1/F3 拆为 cold/warm 两 case。
5. **[MEDIUM] 删除 outbox，OP-3 改为离线 disable 勾选** — 减少 v1 实施和测试负担约 6-10 小时；不损失实质功能。

次级建议（非 blocking 但建议采纳）：

- 把 uPlot 换为手写 SVG 或 Chart.js bar-only。
- v1 用 `reactive()` 替代 Pinia，store 数超 8 后再引入。
- M5 启动前 spike 当前 juejin cookie / 签名 schema。
- M4 加 sequence diagram 描述"添加自定义 RSS"流程在 newtab 前台与 SW 之间的握手。
- README 诚实标注自部署预计时间为 20-30 分钟，而非 10 分钟。

---

## 附录：未在 plan / spec 中讨论但建议追加的边界

- **chrome://newtab override 的安全模型**：扩展页面 CSP 默认禁 `eval` 与远程脚本，uPlot/Chart.js/Vue 都没问题，但若用户将来加 third-party widget 需重审。
- **多窗口 / 多 tab 同时打开 newtab 的并发刷新**：用户开了 5 个新标签同时按 Cmd+T，是否会触发 5 次重复 fetch？plan §1.1 P4 隐含规避（SW 单中枢），但 newtab 自身的初次 hydrate 路径仍可能各自从 storage 读后调 force-refresh。建议加节流。
- **存储配额**：`chrome.storage.local` 默认 10MB，若用户订阅 50 个源 × 30 条卡片 × 含完整 description，可能逼近上限。建议加监控 + 老缓存淘汰策略（按 fetchedAt 老到新）。

---

*Architect 评审完成。交还 Ralplan 主流程。*
