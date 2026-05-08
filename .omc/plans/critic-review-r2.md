# Critic Review R2 — 终裁报告

> Subject: `.omc/plans/chrome-newtab-dashboard-plan.md` (含 R2 + R2.1 微补丁)
> Inputs: spec + Critic R1 + Architect R2
> Mode: Ralplan SHORT, Critic 终裁
> Date: 2026-05-07

## A. R1 §E 12 项必改核查 — 12/12 PASS

| # | 项 | 落地 | 证据 |
|---|---|------|------|
| 1 | manifest 固定 key | ✅ | L135/272/285 + §7.3 L508 |
| 2 | OP-4 单路径 ledger | ✅ | L91-99；§M3 L309-320；ColdStartOnboarding L187/L315 |
| 3 | M2 PKCE/secret 二选一 | ✅ | L291-293 显式"仅落地一种" |
| 4 | M0 spike 里程碑 | ✅ | §M0 L254-266 + Failure-Mode Fallback |
| 5 | AC-T1/F3 cold/warm | ✅ | L22 P1；§7.2 L485-494 |
| 6 | 删除 outbox | ✅ | P5/OP-3/M2/M8/Risk 全部清理；R10 v1.1 backlog |
| 7 | CI/LICENSE 提至 M1 | ✅ | §4 L148-153；§M1 L276-279 |
| 8 | M10 十步 + ≤30 分钟 | ✅ | §M10 L431-441 |
| 9 | M9 六项 + 2 轮时间盒 | ✅ | L419/L421-427 |
| 10 | 测试栈细节 | ✅ | §3 L124；§7.1 L479 |
| 11 | M4 Mermaid 时序图 | ✅ | L326-344 |
| 12 | Risk Register 具体化 | ✅ | R2/R4/R8 全部具体化 |

## B. R2 微补丁核查 — 3/3 PASS

| # | 微补丁 | 落地 | 证据 |
|---|--------|------|------|
| NEW-1 | postMessage → chrome.runtime.sendMessage | ✅ | L339 + L346 通道说明 |
| NEW-2 | sinon-chrome 替换为 jest-webextension-mock | ✅ | §3 L124；§7.1 L467/L479 |
| NEW-3 | M0 Failure-Mode Fallback (X/Y 路径) | ✅ | §M0 L264-266 |

## C. 残余 Open Questions（LOW，非阻塞）
- Q1 M2 PATCH 失败 checkbox 回滚硬条款（autopilot M2 顺手补 1 行 catch）
- Q2 LICENSE holder 占位（M1 实施时填）
- Q3 alarm 25s vs ≥4 源 8s/源最坏情况擦边（M6 实测确认）
- Q4 并发 cap=6 在 core/http.ts 的实现签名（M4 实施落地）
- Q5 spec ambiguity 12.2% 未在 plan 复述（已通过 R2 修订体现）

## D. 数字汇总
- BLOCKING: **0**
- HIGH: **0**
- MEDIUM: **0**
- LOW: 5（全部 autopilot 阶段顺手补）

# 最终判决：APPROVE

可路由进入 autopilot Phase 2。

## E. 给 Autopilot 的 5 条交接

1. **M0 是硬阻塞**，必须先 commit `.omc/research/ticktick-api-probe.md` + `juejin-cookie-schema.md`，每份含 yes/no 结论 + Failure-Mode 选择，否则禁止进入 M1。
2. **Phase 2 第一里程碑 = M0+M1 合并交付**（research 文档 + manifest 固定 key + CI 三 workflow + LICENSE+NOTICE）。CI 必须在 PR 自动绿，第二台机器 fresh install extension-id 一致。
3. **M2 OAuth 仅落地一种**，依 M0 结论删除另一分支脚手架；M2 实施时顺手补 Q1。
4. **M9 严格 2 轮时间盒**，超时降级 M10，不被"再调一轮"绑架。
5. **M5 掘金 adapter 的存在性依赖 M0 路径 Y**：若选 Y2（v1 不接掘金），删除 `src/adapters/juejin/*` 与 `JuejinAuthSection.vue`，M5 整体推 v2 backlog，README §3.2 同步说明。
