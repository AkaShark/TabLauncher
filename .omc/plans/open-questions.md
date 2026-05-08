# Open Questions

## chrome-newtab-dashboard-plan - 2026-05-07

- [ ] TickTick Open API 是否支持按时间范围拉取已完成任务？— 决定 OP-4 走 API 直连还是本地 ledger 累积；M3 启动当天用真实 access_token 实测，结果写入 `.omc/research/ticktick-completion-history.md`
- [ ] zhuyuqian/juejin-plugin 当前 endpoint 是否仍可用？— 决定 M5 是否需要现场重新抓包逆向；M5 启动前 spike 一次
- [ ] 敏感 token 应存 `chrome.storage.local`（含加密包装）还是 `chrome.storage.session`？— 安全 vs SW 重启续航的权衡，倾向 local + 轻量加密；留待 Architect 复议
- [ ] `chrome.permissions.request` 是否在所有 Chrome 版本中都强制要求前台用户手势？— 影响 settings 页能否在加载订阅源失败时自动重申 host 权限；M4 实测确认
- [ ] 用户是否接受打包时由 fork 者自行注入 `client_secret`（而非运行时输入）？— 影响 README 流程；当前默认接受，若收到反馈再迭代
