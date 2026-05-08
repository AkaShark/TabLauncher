# UI Design Prompt — Chrome New Tab Dashboard (TickTick + Info Feed)

> **使用方式**: 当需要进入 UI 设计阶段时，直接调用 `/frontend-design` 并把本文档作为输入。本文档不会被 ralplan / autopilot 自动消费，是显式的"按需调用"产物。

---

## 调用模板（复制此段作为 frontend-design 的实际输入）

> 请以下文 spec 为依据，产出一个 Chrome MV3 新标签页扩展的高保真静态原型（HTML + CSS，可选轻量 vanilla JS，用于 hover / read-state demo），并提供 1-2 个对照变体让我比较视觉方向。完整需求规格见 `.omc/specs/deep-interview-chrome-newtab-ticktick.md`。
>
> 设计原则按下文 §1 严格执行。原型必须包含 §3 列出的全部 UI 状态（不仅是默认态）。

---

## §1 设计原则（铁律，不可违反）

### 美学方向：**Refined Editorial Minimalism with Character**

不是"性冷淡灰白蓝"，不是"Space Grotesk + purple gradient + glass card"那种 AI slop。要的是**有编辑设计感的极简**：节制、精确、有呼吸感，但选择是经过深思的、有个性的，而不是默认值。

**强制规避（avoid at all costs）**:
- ❌ Inter / Roboto / Arial / -apple-system 这种"默认"字体
- ❌ Space Grotesk + Geist 这种"AI 流"字体组合
- ❌ 紫色渐变 / 蓝色渐变背景
- ❌ Glassmorphism（毛玻璃 + 半透明卡片堆叠）
- ❌ 圆角 12px + 阴影 + 灰底白卡的"通用 SaaS Dashboard 模板"
- ❌ 居中大号"Good morning, [Name]"标语 + 时间数字（Momentum 同款）— 这是被复刻最多的模板，直接放弃
- ❌ Emoji 装饰图标 / Lucide 默认图标的无脑堆砌

**鼓励方向（pick one and commit）**:
- ✅ Editorial / 杂志感：宋体或衬线 display + 等宽 / 几何体 sans 正文，留白与字号反差强
- ✅ Swiss / Bauhaus：网格严密、对齐绝对、无圆角、强排印
- ✅ Soft brutalism：左对齐、短促分割线、单色 + 一种强调色（如赭石 / 墨绿 / 砖红）
- ✅ Notion / Things3 风的 quiet luxury：克制的色彩、精确到 1px 的对齐、状态色用得极省
- ✅ 轻度 monospace 数据视感：小段等宽字体用于时间 / 计数 / source 标签，建立"工具感"

无论选哪个，**做一种就要彻头彻尾地做这一种**，不要四不像。

### 字体配对建议（任选一组，**务必明示选了哪组及理由**）
| 组合 | Display | Body | UI/Mono | 适用方向 |
|------|---------|------|---------|----------|
| A | Fraunces (variable serif) | Söhne / Suisse Int'l | JetBrains Mono | Editorial |
| B | PP Editorial New | IBM Plex Sans | IBM Plex Mono | Editorial + 轻 brutal |
| C | Migra (display serif) | GT America | GT America Mono | Quiet luxury |
| D | ABC Diatype Mono Display | ABC Diatype | ABC Diatype Mono | Mono-first 工具感 |
| E | Söhne Breit | Söhne | Söhne Mono | Swiss neutral |

如果选不到 commercial 字体，用对应 fallback：
- 衬线: `Source Serif 4`, `Newsreader`
- Sans: `Geist Sans`（仅当确实需要 neutral 时）, `Onest`, `Public Sans`
- Mono: `Geist Mono`, `JetBrains Mono`, `IBM Plex Mono`

### 色彩系统
- **不超过 5 种角色色** + 1 种 accent
- 至少给出 **light + dark 双主题**
- accent 不要是紫 / 蓝；考虑墨绿 (#1F3D2D)、暗赭 (#A0522D)、深酒红 (#5B1F2F)、深靛 (#1A2A40)、电石黄 (#E8E000) 等
- 状态色（成功 / 警告）用同一 accent 的明度变体而不是另起一组红绿

### 间距 & 排版
- 基础 8px 栅格，但**允许 4px 对齐用于行内排印细节**
- 至少出现一次"反常规"留白（例如顶部留 96px+ 空白让左栏标题落得更低）
- 行高、字重、字距都要明示（kerning 不是默认 normal）
- 不全都圆角，或全都直角；选定主形态后辅以 1-2 处对照（例如卡片直角 + 头像圆形）

### 动效
- CSS-only 优先；总动画时长 ≤ 240ms / 单次
- 入场允许 staggered reveal（0.05s 错峰）但只做一次，刷新不重放
- hover：feed 卡片只允许 1px 边框变化 + 缩略图 1.02 缩放，不要全卡片放大
- 已读 → 透明度从 1 到 0.5 用 ease-out 200ms 过渡
- 拒绝 parallax / 鼠标跟随光斑 / framer-motion springs

---

## §2 信息架构（设计师必须照此布局）

```
┌──────────────────────────────────────────────────────────────────┐
│  顶部裸条 (24-32px)：日期 + 当前完成比 + 刷新时间 + ⋯ 设置按钮      │
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                 │
│   左栏 ~32%    │              右栏 ~68%                          │
│                │                                                 │
│   今日任务     │   信息流卡片网格 (单列或 2 列)                   │
│   - 任务列表   │                                                 │
│   - 完成比环   │   每张卡片：缩略图(可选) + 标题 + 来源·时间       │
│   - 7d/30d 切换│              + 1-2 行摘要                       │
│   - 趋势条形图 │                                                 │
│                │   滚动加载 / 已读淡化                            │
│                │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
```

**布局硬约束**:
- 左右分栏（v1 不做拖拽 bento）
- 没有"Good morning"问候语
- 没有居中大号时钟
- 没有壁纸背景图（壁纸是 v2 的事）
- 顶部裸条信息密度高，不做巨大 header
- feed 卡片不全是缩略图，没图的卡片优雅退化为"标题 + 摘要 + 来源"，不留空白占位

---

## §3 必须设计的状态/页面（缺一不可）

1. **默认态**（首屏，命中缓存，已有数据）
2. **空态 / 首次安装**（未连 TickTick + 无订阅源）— 引导添加，但不能用模板插画
3. **加载态**（缓存为空、首次拉取）— skeleton 或 ASCII 分割线占位，不用 spinner
4. **离线 / 拉取失败**（feed 某些源失败、TickTick token 过期）— 行内提示，可点击重试
5. **设置页**（侧拉抽屉或独立 options 页）：TickTick 连接、订阅源管理（添加 RSS、添加 Substack/Medium handle、添加掘金 token）、刷新频率、主题切换
6. **Hover / 已读** 对比示意（同一卡片两态对照）
7. **Light + Dark 主题** 对照（同一首屏两版）

---

## §4 交付物

- `prototype/index.html` — 单文件高保真原型（CSS + 必要 JS 内联或同目录），打开即看到默认态
- `prototype/states/` — 上面 7 种状态独立 HTML，方便对照
- `DESIGN.md` — 一页说明：选了哪个方向（A/B/C/D/E）、为什么、字体来源、色板、关键决策（≤ 500 字）
- 2 个变体（variant-1 / variant-2），变体之间应在**字体方向 + 色彩 + accent**上有明显差异，但都遵循 §1 铁律

---

## §5 验收

### 美学
- 一眼能说出是哪一种风格（不是"通用 SaaS Dashboard"）
- 没有任何 §1 黑名单元素
- 字体选择有明确理由

### 功能
- §3 全部 7 个状态都有可视化交付
- 双主题切换可演示
- 从默认态用键盘 Tab 能完整 navigate（焦点态可见）

### 实现
- HTML 静态文件直接打开可见，不依赖构建
- CSS 用 `@import` 加载字体或在 `<link>` 头标声明
- 引用了 §1 中的字体组合之一并标注
- 给出明确的 design tokens（CSS variables）让后续 React/Vue 实现可直接消费

---

## §6 参考但不要抄

- Things 3 的"今日"页：信息层级、勾选交互
- Notion 的"今日"模板：双栏密度、字号节奏
- Linear 的 web app：状态色克制、键盘可达
- Readwise Reader：feed 卡片的"已读 / 未读"视觉
- The Browser Company / Arc 的 settings：抽屉信息密度
- 反例：Momentum / Infinity / Tabliss 的居中大问候 + 大背景图——**避免**

主流 tab 页扩展 90% 长得像 Momentum，正因如此本项目要刻意走另一条路。
