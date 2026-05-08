# Critic Review R1 — Chrome 新标签页 Dashboard Plan

> Subject: `.omc/plans/chrome-newtab-dashboard-plan.md`
> Inputs: spec + Architect R1 + open-questions
> Mode: Ralplan SHORT, Critic 终裁
> Date: 2026-05-07

## Pre-commitment Predictions
1. OAuth/PKCE 与 client_secret 矛盾（命中）
2. 冷启动 vs 暖启动 AC 不分（命中）
3. 风险登记空泛缓解（命中）
4. 测试栈 SW 可行性细节缺失（命中）
5. 无 CI / LICENSE / README 自部署步骤（命中）
命中率 5/5，Plan 在工程化基建有系统性盲区。

## A. 强制 5 项检查
- A.1 Principle Consistency — **FAIL**：P2 在冷启动下被违反；P4 与 OP-2 时序缺失；P5 依赖 outbox 一旦删需重写
- A.2 Fair Alternatives — **FAIL**：React 45KB / UnoCSS 5KB / uPlot vs Recharts framing bias 全部成立
- A.3 Risk Mitigation Clarity — **PARTIAL FAIL**：R2/R4/R8 三条空泛
- A.4 Testable AC — **PARTIAL FAIL**：AC-T1/F3 冷暖未分；AC-F5 无视觉 baseline；AC-F8 alarm 触发未自动化
- A.5 Concrete Verification — **PARTIAL FAIL**：M1/M2/M3/M6/M9/M10 多步验收仍是人工动作

## B. Architect 5 项裁决（全部 ACCEPT）
| # | 议题 | 裁决 |
|---|---|---|
| BLOCKING-1 | manifest `key` 固定 | ACCEPT |
| BLOCKING-2 | OP-4 改本地 ledger 单路径 + M0 spike | ACCEPT |
| BLOCKING-3 | PKCE / client_secret 二选一 | ACCEPT + MODIFY (M0 spike 包含 OAuth 模式判定) |
| HIGH | 冷启动 AC 拆 cold/warm | ACCEPT |
| MEDIUM | 删除 outbox，离线 disable 勾选 | ACCEPT |

## C. Critic 自有视角（5 项 FAIL）
- C.1 M9 范围黑洞——视觉验收无客观标准 + 无时间盒
- C.2 测试栈细节缺失——chrome.* API mock + SW 测试环境未规划
- C.3 M10 自部署步骤未显式化——10 分钟不现实，应改 20-30 分钟
- C.4 CI / 包管理空白——无 .github/workflows/、无 dependabot、无 PR 模板
- C.5 LICENSE 时机错——应在 M1 而非 M10

## D. 最终判决：`ITERATE`

主轴方向正确，但 3 BLOCKING + 1 HIGH + 1 MEDIUM + 5 Critic 自有发现必须 R2 修补。无 CRITICAL 数据/安全升级，THOROUGH 模式覆盖足够。

## E. R2 必改 12 项动作（按优先级）

### P0 — BLOCKING (4)
1. **manifest 固定 `key`** + `keys/extension-pub.pem` checked-in + `docs/self-host.md` extension-id 章节；M1 验收加多机一致性检查
2. **OP-4 改本地 ledger 单路径** + 删 §M3 if/else 双路径 + Risk R1 改写 + UI 数据点 < 7 时 onboarding 提示
3. **§M2 PKCE/secret 二选一**（依 M0 spike 结论）+ README 显著位置说明
4. **新增 M0 spike 里程碑**：交付 `.omc/research/ticktick-api-probe.md` + `.omc/research/juejin-cookie-schema.md`，含 OAuth 模式判定 + 时间范围 API 实测

### P1 — HIGH/MEDIUM (4)
5. **AC-T1/AC-F3 拆 cold/warm**：冷启动 = skeleton ≤200ms + 首次同步 ≤5s + 重试入口；e2e 拆 cold-start.spec.ts / warm-start.spec.ts
6. **全面删除 outbox**：OP-3 / M2 / M8 / tests / P5 措辞 / Risk Register v2 backlog
7. **CI/工程化基建**：`.github/workflows/ci.yml` + `release.yml` + `dependabot.yml` + `PULL_REQUEST_TEMPLATE.md` + LICENSE 提到 M1（非 M10）+ NOTICE.md
8. **§M10 显式 10 步清单** + 时间从 ≤10 分钟改 ≤30 分钟（README 含截图）

### P2 — Critic 加固 (4)
9. **§M9 6 项可枚举验收 + 2 轮 autopilot 时间盒**；先确认 `.omc/specs/ui-design-prompt.md` 存在
10. **测试栈细节**：chrome API mock = `sinon-chrome` + 5 API 自写补充；SW 测试拆纯函数+适配层；happy-dom/node 环境
11. **§M4 添加 Mermaid 协作时序图**：SettingsView → permissions.request (前台手势) → SW → fetch → storage.onChanged → newtab 刷新
12. **Risk Register 具体化**：R2 = adapter 启动 schema 探测 + 降级；R4 = CI 显式排除 .env*；R8 = README §3.2 替代方案

## 关键 R2 必改项 Top 5

1. manifest 固定 `key`（自部署 OAuth 物理前提）
2. OP-4 单路径 + M0 spike 里程碑
3. PKCE/secret 二选一 + M0 模式判定
4. AC 冷暖拆分修复 P2 violation
5. CI/LICENSE/M10 工程化基建（系统性盲区）
