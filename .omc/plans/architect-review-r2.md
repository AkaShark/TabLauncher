# Architect Review R2 — Chrome 新标签页 Dashboard Plan

> 评审对象：`.omc/plans/chrome-newtab-dashboard-plan.md`（R2 修订版）
> 上游输入：Architect R1 + Critic R1（共 12 项必改）+ Spec
> 角色：Ralplan 共识循环中的 Architect R2（READ-ONLY）
> 模式：SHORT
> 评审日期：2026-05-07

---

## 0. TL;DR

**最终评审结论：`R2-NEEDS-MINOR-FIX`**

12 项必改动作 **11 项 OK / 1 项 INCOMPLETE / 0 项 WRONG**。整体落地质量高，但 R2 引入了 **3 个新问题**（其中 1 个属技术性硬 bug），需要 Planner 在进入 Critic R2 终裁前打 1-3 个微补丁；不必进入 R3。

落地汇总：done = 11，partial = 1，wrong = 0。

---

## 1. 12 项动作的逐项核查表

| # | 动作 | 应在哪个章节 | 实际是否在该章节 | 质量评级 |
|---|---|---|---|---|
| 1 | manifest 固定 key + 多机一致性 | §M1 交付物 + §4 文件结构 + §M1 验收 + §7.3 手动验证 + ADR | YES — `manifest.config.ts` 含"固定 key（pubkey base64）"（L135 / L269）；`keys/extension-pub.pem` git 跟踪（L136）；§M1 验收"多机 fresh install 后 chrome://extensions 显示 ID 一致"（L282）；§7.3 列出第二台机器 ID 一致检查（L504） | **OK** |
| 2 | OP-4 改本地 ledger 单路径 + R1 改写 + 数据点 <7 onboarding | §2 OP-4 + §M3 + §6 R1 + §1.1 P3 | YES — OP-4 决策"v1 本地 ledger 单路径"（L91-99）；§M3 完全无 if/else 双路径，单路径 ledger（L308-317）；R1 改写"TickTick API 长期不可用 → ledger 兜底，无功能丧失"（L447）；`ColdStartOnboarding.vue` 数据点<7 显示（L186, L312） | **OK** |
| 3 | M2 PKCE/secret 二选一依 M0 判定 | §M2 + ADR | YES — §M2 显式两分支"仅落地一种"（L288-290）；ADR 显式记录（L516, L523-524） | **OK** |
| 4 | 新增 M0 spike 里程碑 | §M0 | YES — §M0 完整存在（L254-263），含两份研究文档 `ticktick-api-probe.md` + `juejin-cookie-schema.md`，验收要求 yes/no 明确结论 | **OK** |
| 5 | AC-T1/AC-F3 冷暖拆分 | §M2 + §M6 + §7.2 | YES — AC-T1-warm ≤500ms / AC-T1-cold skeleton ≤200ms + 5s 重试入口（L300-302）；AC-F3-warm/cold 同结构（L381-383）；e2e 拆 `cold-start.spec.ts` + `warm-start.spec.ts`（L242-243, L480-489） | **OK** |
| 6 | 全面删除 outbox | §1.1 P5 + OP-3 + §M2 + §M8 + §7.1 + R10 | YES — P5 改写为"离线时 disable + tooltip"（L18）；OP-3 表"checkbox disabled + tooltip"（L83）；§M2 显式"无 outbox"（L295）；§M8 显式"不实现 outbox"（L403）；§7.1 表里无 `outbox.spec.ts`；R10 v1.1 backlog（L456） | **OK** |
| 7 | CI/工程化基建 + LICENSE 提到 M1 | §4 + §M1 | YES — §4 含 `.github/workflows/{ci.yml,release.yml}` + `dependabot.yml` + `PULL_REQUEST_TEMPLATE.md`（L148-153）；`LICENSE` + `NOTICE.md` 在 M1（L145-146, L273）；§M1 验收"PR 自动跑 CI 通过"（L283） | **OK** |
| 8 | M10 显式 10 步 + ≤30 分钟 | §M10 | YES — 10 步清单完整（L427-436）；时间盒 20-30 分钟（L439）；§7.3 同步（L510） | **OK** |
| 9 | M9 6 项可枚举验收 + 2 轮时间盒 | §M9 | YES — 6 项可枚举验收逐条列出（L416-422）；autopilot 硬上限 2 轮（L415）；引用 `.omc/specs/ui-design-prompt.md`（已确认存在） | **OK** |
| 10 | 测试栈细节（sinon-chrome + 5 API + happy-dom + SW 拆分） | §3 表格 + §7.1 | YES — §3 表格"sinon-chrome（chrome API mock 起点）+ 自写补充 5 个核心 API"（L124）；§7.1 SW 测试策略"纯函数 + 适配层"明确（L474） | **OK**（但见 §2 新问题：sinon-chrome 已 6 年未更新） |
| 11 | M4 Mermaid 时序图 | §M4 | **PARTIAL** — Mermaid 时序图已添加（L323-341），覆盖 SettingsView → permissions.request 前台手势 → SW → fetch → storage → newtab；**但有 1 处技术错误**：图中 `S->>SW: postMessage(addSource)`，newtab 页与 SW 通信应使用 `chrome.runtime.sendMessage`（或 connect/port），不是 `postMessage`（postMessage 是 window/worker 的 DOM API，与 chrome 扩展 SW 通信无关）。 | **INCOMPLETE** |
| 12 | Risk Register 具体化（R2 / R4 / R8） | §6 + §M5 | YES — R2 改写 adapter 启动 schema 探测 + 降级（L448）；R4 含 `actions/upload-artifact` YAML 示例（L450）；R8 含 README §3.2 章节 + 5 项替代方案（L454, L437） | **OK** |

**汇总：OK=11，INCOMPLETE=1（#11），WRONG=0。**

---

## 2. R2 引入的新问题

### NEW-1（**HIGH，硬技术错误**）：M4 Mermaid 时序图 `postMessage` 用错 API

§M4 时序图 L336：`S->>SW: postMessage(addSource)`。

- newtab 页（chrome 扩展页面，运行在扩展上下文）与 service worker 通信应使用 **`chrome.runtime.sendMessage`** 或 `chrome.runtime.connect()` 建立 port。
- `postMessage` 是 `Window`/`Worker`/`MessageChannel` 的 DOM API，扩展页面并没有直接的 `Worker` 句柄指向 service worker（MV3 SW 不是普通 Web Worker，无 `worker.postMessage` 句柄）。
- 这条会让实施者在 M4 编码时直接撞墙；同时该错误也表明 R2 修订只是机械加图，没有验证图的可达性。
- **修补**：把 `postMessage(addSource)` 改为 `chrome.runtime.sendMessage({type: 'addSource', ...})`，对端在 SW 内 `chrome.runtime.onMessage.addListener` 处理。

### NEW-2（**MEDIUM**）：sinon-chrome 维护状态停滞

§3 + §7.1 把 `sinon-chrome` 作为 chrome API mock 起点。

- npm registry 实测：**`sinon-chrome` latest = 3.0.1，最后发布日期 2019-04-01**，距今约 6 年；包元数据 `modified` 字段 2022-06-26 也仅为 metadata 同步，无新版本。
- 该库基本针对 MV2 时代 chrome.* API；对 MV3 新增 API（`chrome.alarms`、`chrome.permissions.request`、`chrome.identity.launchWebAuthFlow`、新版 `chrome.cookies` 行为）已落后。
- Plan 已意识到这点（"自写补充 5 个核心 API"），但仍把它定位为"起点"会让贡献者在调试 mock 时面对一个长期不更新的库。
- **建议替代**：(a) 直接用 `vi.stubGlobal('chrome', mockObj)` + 一份内部 `tests/helpers/chromeMock.ts` 自写所有需要的 API；(b) 或评估 `webextension-polyfill` + `jest-webextension-mock`（前者是 Mozilla 维护的 Promise 化 polyfill，后者活跃度更高）。建议在 §3 注脚中说明 sinon-chrome 仅作 boilerplate 参考，不依赖其新版本。

### NEW-3（**LOW-MEDIUM**）：M0 spike 工作量 vs M0 阻塞性

§M0 必须实测 (a) TickTick OAuth 端点 / scope / PKCE 支持 (b) 已完成任务时间范围 API (c) juejin 当前 cookie schema (d) recommend_v2 是否需要 X-Bogus 签名头。

- 单是 (d) X-Bogus 签名头逆向工程历史上是逆向社区的硬骨头（掘金/抖音同源风控套件，wasm 实现）。M0 若卡在 (d) 上，整个 plan 阻塞——但 plan §M0 验收只要"yes/no 结论"，没说"no 时怎么继续"。
- 如果 M0 (d) 结论是 "yes，需要 X-Bogus"，且未在 M0 内决定降级路径，M5 会再次卡住。
- **修补**：M0 验收增加一句"若 juejin 需 X-Bogus 等签名头，本里程碑直接落地降级决定（v1 = 手动 cookie + 手动 paste 推荐流响应 / 或砍掉掘金 v1 推到 v1.1），不留到 M5"。

### NEW-4（**LOW**，已自洽，仅记录）：AC-T2 ≤2s 同步在断网瞬间是否有 race

OP-3 表已规定离线时 checkbox disabled。但 race window：用户在 `online → offline` 翻转的 100ms 内点击。

- §M2 / §M8 没显式说明 UI 行为：是按勾选时刻判定，还是 fetch 失败后再回滚？
- 实际不阻塞：`navigator.onLine` 翻转 + `online`/`offline` 事件足够小，且 fetch 失败会触发 catch 回滚 checkbox 状态。但 plan 缺一句兜底"PATCH 失败时 UI 状态自动回滚 + 提示"。
- **修补建议（非阻塞）**：M2 验收加一行"PATCH 失败时 checkbox 视觉状态回滚"。

### NEW-5（**N/A**，已澄清）：LICENSE 在 M1 是否需要 holder 占位

§M1 + §4 列 `LICENSE`（MIT）。MIT 模板需 `<year>` + `<copyright holders>`。Plan 未指定。

- 自部署项目 + 单作者，建议 README 实施期由 Planner 指明（如 "Copyright (c) 2026 <作者名>"）。这不构成 BLOCKING / HIGH，仅是 M1 落地时一行替换工作。无需 R3。

---

## 3. 残余 BLOCKING / HIGH 风险

| 等级 | 项 | 说明 |
|---|---|---|
| HIGH | NEW-1 时序图 `postMessage` 硬错误 | 实施者会直接撞墙；必须修补成 `chrome.runtime.sendMessage` |
| MEDIUM | NEW-2 sinon-chrome 6 年未更新 | 不阻塞但会增加测试设施维护成本，建议加注脚或换库 |
| MEDIUM | NEW-3 M0 X-Bogus 阻塞应急未规划 | M0 失败路径不明，建议显式补一句降级决定 |

**无 BLOCKING 残余**——3 BLOCKING（manifest key / OP-4 单路径 / PKCE-secret 二选一）以及 HIGH（冷暖 AC 拆分）都已实质落地且方向正确。

---

## 4. 最终评审结论

**`R2-NEEDS-MINOR-FIX`**

理由：12/12 中 11 项 OK，1 项（M4 时序图）字面落地但有硬技术错误；R2 引入 3 个新问题（1 HIGH + 2 MEDIUM），均可在 1-3 行级修补内解决，不必进入 R3。

**Planner 微补丁清单（建议在交 Critic R2 之前执行）：**

1. **必改**：§M4 Mermaid 时序图 L336 `S->>SW: postMessage(addSource)` → `S->>SW: chrome.runtime.sendMessage(addSource)`；对端注解 `chrome.runtime.onMessage.addListener`。
2. **建议改**：§3 表格 / §7.1 sinon-chrome 行加注脚 "sinon-chrome v3.0.1 last published 2019；用作 boilerplate 参考，5 核心 API 全部自写补充实现，不依赖 sinon-chrome 新版本"。或评估替换为自写 `tests/helpers/chromeMock.ts`。
3. **建议改**：§M0 验收增"若 juejin 判定需要 X-Bogus 等签名头，M0 直接落地 v1 降级决定（手动 cookie / 推到 v1.1），不延后至 M5"。
4. **可选**：§M2 验收加一行"PATCH 失败 → checkbox 视觉状态回滚 + 行内错误提示"，闭合 NEW-4 race。

---

## 5. 给 Critic R2 的关键提示

1. **重点验 NEW-1**：M4 时序图的 `postMessage` 是否被 Planner R2.1 改成 `chrome.runtime.sendMessage`；这是落地期会直接报错的硬 bug，不是风格问题。
2. **次要验 NEW-2 / NEW-3**：sinon-chrome 注脚 + M0 X-Bogus 应急决策是否补上；不补则 v1 实施期的两个最大不确定性仍在。
3. **不必再质疑 P0 BLOCKING 三项**：manifest key / OP-4 单路径 / PKCE 二选一在 R2 已扎实落地，Critic R2 直接信任本评审的逐项核查表即可，把火力放在 NEW-1/2/3。

---

## 附录：核查证据

- sinon-chrome npm 元数据：`registry.npmjs.org/sinon-chrome` → `dist-tags.latest = "3.0.1"`，`time["3.0.1"] = "2019-04-01T14:11:19.922Z"`（实测）。
- `.omc/specs/ui-design-prompt.md` 存在（M9 引用有效）。
- Plan 文件行号引用以当前版本为准（见 §1 表格"实际是否在该章节"列）。

*Architect R2 评审完成。交还 Ralplan 主流程，建议路由 → Planner 微补丁 → Critic R2 终裁。*
