# DeepCook Web

DeepCook 官网与浏览器版。首页以「火候」为叙事线索；`/app/` 提供找菜、收藏、分步阅读与个人菜谱。

- 设计参考：`rerise.co` 的编辑式排版、逐字动画、翻字导航、全屏滚动叙事与慢速缓动
- 色彩与结构为 DeepCook 重做：暖米纸、灶火黄、墨黑与橄榄绿；6 个「火候」章节
- 官网保留原有介绍与 APK（0.5.1）；网页版以本地 Android 0.3.0 源码及当前工作区菜谱为功能基线，未实现的计时、营养、评分评论和 AI 不在网页版提供

## 本地运行

```powershell
npm ci
npm run dev
```

需要 Node.js 24+（测试使用原生 TypeScript 类型擦除）。

开发服务器默认 `http://localhost:5173/`。首页与 `/app/` 是独立的 Vite 多页面入口，在线版复用首页字体、设计变量和逐字翻转链接，样式单独加载。

首屏 Hero 和页脚保持原始布局，不受画布约束。中间六个章节使用固定比例画布：横向 `1280 × 800`，手机竖向 `420 × 900`，短屏手机 `420 × 720`，中等宽度竖向 `800 × 900`。区域内部以百分比网格组织组件，由 `DesignCanvas` 使用 `min(可用宽度 / 设计宽度, 可用高度 / 设计高度)` 统一缩放，字体、间距和组件同步变化；窄窗口优先占满可用宽度，将多余空间留在上下。第三章烹饪模式允许在步骤阅读区内纵向滚动，标题与计时器固定，滚动到边缘不会带动外层页面；其他章节无内部纵向滚动，精选菜谱保留原有的横向浏览。画布样式在 `src/styles/canvas.css`，`useCanvasPages` 根据章节实际位置保持窗口缩放时的阅读位置。

## 构建与预览

```powershell
npm run build
npm run preview
```

产物在 `dist/`。部署时站点根目录即 `dist/`：

- `/` → 首页
- `/app/` → 浏览器版，内部通过 hash 路由导航，可直接刷新任意功能页
- `/catalog/` → Android 菜谱、引用图片及来源/许可清单
- `/download/DeepCook-0.5.1-preview.apk` → 下载文件
- `/photos/*.jpg` → 首页使用的菜谱图

`base` 为 `./`，可部署在任意子路径。`appType` 为 `mpa`，请确保静态服务器支持目录索引（`/app/` → `/app/index.html`）；不支持时可改用 `/app/index.html` 直链。

## 页面结构

| 区块 | 内容 |
| --- | --- |
| Loader | 0–100 计数器，`clip-path` 上掀；同一会话内只播放一次 |
| Hero | 三张菜谱图慢速交叉淡入、逐字标题 `COOK DEEPER.`、旋转印章、下载/在线入口 |
| 01 Manifesto | 产品理念、494 / 372 / 219 / 100% 数据 |
| 02 Find + Tonight | 搜索说明 + 横向菜谱卡轨（6 道精选），左右按钮与原生横滑 |
| 03 Cook | 红烧肉步骤节选、滚动点亮当前步骤、计时器卡片 |
| 04 Understand | 每份营养四列（示例数据）、10 分制评分与本地交流 |
| 05 Next | AI 方向与概念对话，明确标注 COMING SOON / 非实际功能 |
| 06 Download | APK 下载与在线版入口 |
| Footer | 大字标、链接、内容/图片来源说明 |

## 技术栈

- Vite + React 19 + TypeScript
- GSAP + ScrollTrigger（首屏逐字、视差）
- Lenis（平滑滚动）
- Fontsource 本地字体：Archivo Variable、Instrument Serif Italic、Noto Sans SC Variable
- 纯 CSS 设计令牌，无 UI 框架

## 动效与无障碍

- 主缓动 `cubic-bezier(.165,.84,.44,1)`，段落揭示 0.9–1.05s
- 导航、按钮逐字母上翻；标题逐字上升；图片慢速 Ken Burns；菜谱卡悬停不位移、不缩放
- `prefers-reduced-motion` 下跳过 Loader 与逐字，改用原生滚动；菜谱卡轨可直接横向滚动
- 跳转链接、语义化标题、可见焦点、图片 alt、`aria-current` / progressbar 均已处理

## 内容与素材

- 网页版菜谱数据与图片从 `~/DeepCook/app/src/main/assets` 当前工作区只读复制，包含本地尚未提交的菜谱及图片；不执行 fetch/pull，不修改 Android 工程。
- 菜谱内容来源：HowToCook（Unlicense）、Based Cooking（Unlicense）；部分图片来自 FoodiesFeed（CC0 等效）。
- 首页营养数值、评分、评论均为 App 中的**示例数据**，页面已明确标注。
- APK 为 `artifacts/DeepCook-0.5.1-preview.apk` 的副本，使用本机 Debug 签名，仅用于体验。

## 更新下载版本

1. 用新的 Preview APK 替换 `public/download/DeepCook-0.5.1-preview.apk`（或改名）。
2. 同步修改首页 Hero、下载卡片与 Footer 中的版本号、大小与链接。
3. 如需更新菜谱截图，从 App assets 复制到 `public/photos/`，并在 `src/data/recipes.ts` 中更新封面路径。

## 浏览器版

沿用首页设计变量、Archivo / Instrument Serif / Noto Sans SC 字体、米纸/墨黑/暖黄/橄榄绿、大字、细线、图片卡轨和逐字翻转。应用内容采用响应式网格和自然滚动，长菜谱不放进固定高度缩放画布；分步阅读使用全屏布局、固定顶部进度和底部翻步。宽屏采用正文与配图/材料参考左右分栏，字号、步骤编号与图片高度随屏幕调整；长正文和材料清单各自在栏内滚动。900px 以下切换单栏，中间阅读区整体滚动，翻步后恢复到内容顶部。应用不启用 Lenis，确保长列表、表单和键盘滚动正常。

- 找菜：494 道内置菜谱、6 道精选；多词全部匹配，搜索菜名/地域/分类/原名别名/材料；250 ms 防抖，分类/用时/难度组合筛选；恢复搜索条件与列表展开数量。
- 详情：封面、原文份量、材料、准备、步骤图片与观察提示、注意事项、分段跳转和来源。缺失参数显示「无」，不推测。
- 阅读：任意步骤进入、目录跳转、前后翻步、刷新恢复；返回详情定位当前步骤；设置中可启用浏览器 Screen Wake Lock（支持时）。
- 收藏：倒序、取消和撤销；最近浏览去重，最多 50 条，可逐条删除或清空。
- 个人菜谱：新建、编辑、删除，封面上传；材料、步骤增删与步骤排序；保留编辑 ID；保存完成后退出。IndexedDB 事务失败保留输入，损坏记录保留原数据并提示重试；编辑草稿通过 sessionStorage 在当前标签页恢复。
- 资料补全：复用本地菜谱优先，未命中时才查询随包索引对应的固定 HowToCook commit；失败可重试或手填。只填空白字段，保留手写内容和来源。远程原文请求依赖访问 GitHub 的网络与 CORS。
- 我的厨房：昵称、相册头像与方形内容裁剪，喜欢/忌口互斥标签。偏好仅记录，尚不参与搜索推荐。
- 设置：跟随系统/明暗模式、三档阅读字号、步骤图、阅读常亮；分项清理收藏、历史或显示/阅读设置；来源和许可。网页使用固定品牌色，不映射 Android 动态色。

个人数据保存在当前浏览器 IndexedDB，不提供账号、云同步或跨设备共享；清理站点数据会移除个人记录。多个标签页的写入通过读写事务串行处理，用 BroadcastChannel 刷新其他标签页状态。

生产构建在 `/app/` 范围注册 Service Worker：首次联网访问后缓存应用入口、加载过的脚本/样式/字体和菜谱 JSON；图片按需缓存，最多 160 个资源。再次离线打开可浏览完整文本目录，未缓存或被淘汰的图片显示占位。需要 HTTPS 或 localhost；开发模式不注册。官网首页不在 Service Worker 控制范围内。

### 同步 Android 内容

```bash
python3 tools/sync-catalog.py ~/DeepCook
```

脚本复制原始 recipes.json、806 个当前引用图片（494 张封面 + 312 张步骤图），以及来源索引、图片清单、许可文件。保留原始目录（含嵌套路径）、ID 和内容，不下载或重建菜谱。数据和图片原样复制，因此完整静态产物约 200 MB；图片在页面中延迟加载。修改源内容后重新同步并运行测试。

### 验证

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

使用已安装的 Chrome 可省略浏览器下载，例如 Linux 下运行 `CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`。浏览器测试自动启动生产预览，覆盖组合搜索、收藏与撤销、阅读位置、个人菜谱编辑/删除、补全不覆盖手写资料、存储失败与草稿恢复、资料/设置、320–2560 宽度、横屏阅读比例与长正文滚动、reduced-motion、离线重开、损坏存储保留。测试使用独立浏览器上下文。

主要实现位于 `src/kitchen/`，应用样式位于 `src/styles/kitchen.css`，详情样式位于 `src/styles/recipe.css`，分步阅读独立放在 `src/kitchen/Reader.tsx` 与 `src/styles/reader.css`。详情使用左右等宽留白的三栏网格，材料、步骤、来源始终位于中央；左侧章节说明在各自区域内吸附，滚到区域末端时自然退出，窄屏改放正文上方。首页与在线版共用 `Footer`、`footer.css` 和 `cursor.css`；圆点、圆环共享同一个动画锚点，移动和悬停缩放时保持同心，其余官网样式独立加载。`src/OnlineEdition.tsx` 是应用入口导出。
