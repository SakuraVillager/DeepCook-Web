# DeepCook Web

DeepCook 的官方网站首页。以「火候」为叙事线索，介绍 DeepCook Android 菜谱 App，提供 APK 下载与在线版入口。

- 设计参考：`rerise.co` 的编辑式排版、逐字动画、翻字导航、全屏滚动叙事与慢速缓动
- 色彩与结构为 DeepCook 重做：暖米纸、灶火黄、墨黑与橄榄绿；7 个「火候」章节
- 内容以当前 Android 0.5.1 为准：494 道离线菜谱、搜索、烹饪模式、计时、营养/评分、收藏与自建菜谱

## 本地运行

```powershell
npm install
npm run dev
```

开发服务器默认 `http://localhost:5173/`。`/app/` 由 Vite 中间件重写到 `public/app/index.html`。

## 构建与预览

```powershell
npm run build
npm run preview
```

产物在 `dist/`。部署时站点根目录即 `dist/`：

- `/` → 首页
- `/app/` → 在线版占位页
- `/download/DeepCook-0.5.1-preview.apk` → 下载文件
- `/photos/*.jpg` → 首页使用的菜谱图

`base` 为 `./`，可部署在任意子路径。`appType` 为 `mpa`，请确保静态服务器支持目录索引（`/app/` → `/app/index.html`）；不支持时可改用 `/app/index.html` 直链。

## 页面结构

| 区块 | 内容 |
| --- | --- |
| Loader | 0–100 计数器，`clip-path` 上掀；同一会话内只播放一次 |
| Hero | 三张菜谱图慢速交叉淡入、逐字标题 `COOK DEEPER.`、旋转印章、下载/在线入口 |
| Ticker | 火候跑马灯，滚动速度会影响滚动速度与轻微倾斜 |
| 01 Manifesto | 产品理念、494 / 372 / 219 / 100% 数据 |
| 02 Find | 搜索与筛选说明、真实搜索界面示意（番茄 + 鸡蛋 = 11 道） |
| 03 Cook | 红烧肉步骤节选、滚动点亮当前步骤、计时器卡片 |
| 04 Understand | 每份营养四列（示例数据）、10 分制评分与本地交流 |
| 05 Menu | 6 道菜谱横向卡片，桌面 pin + 横向位移，移动端原生横滑 |
| 06 Next | AI 方向与概念对话，明确标注 COMING SOON / 非实际功能 |
| 07 Download | APK 下载与在线版入口 |
| Footer | 大字标、链接、内容/图片来源说明 |

## 技术栈

- Vite + React 19 + TypeScript
- GSAP + ScrollTrigger（首屏逐字、跑马灯、菜单 pin、视差）
- Lenis（平滑滚动）
- Fontsource 本地字体：Archivo Variable、Instrument Serif Italic、Noto Sans SC Variable
- 纯 CSS 设计令牌，无 UI 框架

## 动效与无障碍

- 主缓动 `cubic-bezier(.165,.84,.44,1)`，段落揭示 0.9–1.05s
- 导航、按钮逐字母上翻；标题逐字上升；图片慢速 Ken Burns
- `prefers-reduced-motion` 下跳过 Loader、逐字与 pin，改用原生滚动；菜单区可横向滚动
- 跳转链接、语义化标题、可见焦点、图片 alt、`aria-current` / progressbar 均已处理

## 内容与素材

- 菜谱数据与照片来自 `E:\yhz\Projects\DeepCook` 的 App 内置素材（`app/src/main/assets/photos`）。
- 菜谱内容来源：HowToCook（Unlicense）、Based Cooking（Unlicense）；部分图片来自 FoodiesFeed（CC0 等效）。
- 首页营养数值、评分、评论均为 App 中的**示例数据**，页面已明确标注。
- APK 为 `artifacts/DeepCook-0.5.1-preview.apk` 的副本，使用本机 Debug 签名，仅用于体验。

## 更新下载版本

1. 用新的 Preview APK 替换 `public/download/DeepCook-0.5.1-preview.apk`（或改名）。
2. 同步修改首页 Hero、下载卡片、Footer 与 `public/app/index.html` 中的版本号、大小与链接。
3. 如需更新菜谱截图，从 App assets 复制到 `public/photos/`，并在 `src/data/recipes.ts` 中更新封面路径。

## 范围说明

本轮只实现**官网首页**。在线版本身尚未实现，`/app/` 是设计好的占位入口；AI 功能也尚未在 App 中提供，首页第 06 段仅为路线说明。
