# 评分、营养表、评论与交作业移植

本次实现以 GitHub 上 DeepCook `main` 的提交 [`e7c1bce9818f7d0898c32d1835b2fcefe1c641d9`](https://github.com/SakuraVillager/DeepCook/tree/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9) 为参考，只读取远程文本源码，不读取、拉取或修改本机 Android 工程。网页版仍使用现有的 494 道随包菜谱和配图，没有复制远程图片仓库。

## 行为对应

| Android 参考代码（该提交内） | 网页实现 |
| --- | --- |
| [`core/model/KitchenFeatures.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/core/model/KitchenFeatures.kt) | `src/kitchen/community.ts`：营养、评分、评论、作业模型 |
| [`data/KitchenDatabase.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/data/KitchenDatabase.kt) | `src/kitchen/community-storage.ts`：本地持久化、修改单条评分、自己的内容删除 |
| [`feature/recipe/CommunityViewModel.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/feature/recipe/CommunityViewModel.kt) | `src/kitchen/useCommunity.ts`、`Community.tsx`：读取、保存、失败保留输入、草稿 |
| [`feature/recipe/CommunityComponents.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/feature/recipe/CommunityComponents.kt) | `Community.tsx`、`Nutrition.tsx`、`src/styles/community.css`、`src/styles/recipe.css`：紧凑评分分布、营养摘要与完整表格、作业、评论及表单 |
| [`data/CoverStore.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/data/CoverStore.kt) | `prepareCommunityPhoto`：居中裁剪为 1200×900 JPEG、约 82% 初始质量 |
| [`feature/recipe/RecipeScreens.kt`](https://github.com/SakuraVillager/DeepCook/blob/e7c1bce9818f7d0898c32d1835b2fcefe1c641d9/app/src/main/java/com/deepcook/app/feature/recipe/RecipeScreens.kt) | `RecipeView.tsx`：封面右侧简介区内显示评分和营养，来源后显示作业与评论 |

- 每道菜的一条个人评分为 1–10 的整数，再次提交覆盖此前评分。展示均分、总数及“好极了”8–10 /“挺好”6–7 /“一般”1–5 三档分布。
- 营养表与 App 一样：摘要展示热量、脂肪、蛋白质、碳水四列，展开后增加膳食纤维和钠。App 在首 12 道或精选菜谱中使用固定示例 `480 kcal / 22 g / 26 g / 44 g / 3.5 g / 650 mg`，网页按同一规则提供并明确注明「非本菜谱的实测营养值」；其他内置菜谱及个人菜谱显示「无」，不推算。营养示例不写入用户数据库，也不要求升级数据库。
- 评论与作业的正文不能为空，去除首尾空白后保存；输入最多 2000 个 UTF-16 代码单元，与 App 的字符串长度约束一致。作业可以没有照片，评论不带照片。
- 自己的内容作者为“我”；时间倒序，相同时间以 ID 倒序。每组先显示 5 条，按需继续展开。
- 按 App 的首 12 道或精选菜谱规则加入示例评分 `[8, 9, 6]`，以及“小禾”的评论和“阿米”的作业示例，保留源文案及固定时间。网页对示例作明确标识；示例配图沿用菜谱封面，不代表真实线上交流。示例由代码合成，不重复写入本地，也不可作为自己的记录删除。
- 评分、评论和作业均为本地数据，没有登录、公开发布、跨访客或跨设备同步。

## 浏览器存储

使用独立 IndexedDB `deepcook-community`（版本 1），不升级或重置原有 `deepcook-kitchen`。`recipes` 按菜谱 ID 保存个人评分和文本记录，`photos` 按作业 ID 保存 JPEG Blob，`drafts` 按当前标签页会话与菜谱 ID 保存编辑草稿。

图片仅接受不超过 20 MB 的 JPG / PNG / WebP；压缩为 4:3、1200×900 JPEG，从 0.82 质量开始，必要时降低，输出上限 1 MB。不会将原图或 Base64 字符串放入菜谱 JSON。照片读取后使用临时对象 URL，组件卸载或照片变更时释放；仅渲染当前展开的记录图片。

作业记录与附图在同一读写事务内保存或删除，提交成功后才关闭表单。失败会回滚照片写入，并保留编辑框的文字和预览；容量不足提供明确提示和重试。草稿自动保存，刷新后在同一标签页恢复；取消或保存成功清除对应草稿。草稿未保存、照片处理或写入进行中时阻止站内离开，并启用浏览器离开确认。

删除个人菜谱后清理其评分、评论、作业附图及草稿；收藏、历史及其他菜谱不受互动记录删除影响。跨标签页使用 BroadcastChannel 通知刷新；浏览器重新可见时也会重读。发现不符合当前结构的存储记录时保留原数据并提示重试，不自动清空或用示例覆盖。

浏览器配额与本机剩余磁盘不同，运行时写入可能因配额或浏览器设置失败。当前实现不申请远程存储，也不预占大型文件；实际记录和照片随用户操作增长。清理站点数据会删除个人互动及照片。

## 验证

`tests/community.test.mjs` 验证示例与缺失营养规则、分数分档、正文约束及损坏记录处理。`tests/browser/community.spec.ts` 验证持久化、评分替换、评论与作业删除、Blob 附图、草稿恢复、模拟配额失败的事务回滚、跨标签页更新、紧凑首屏布局及六项营养表。原有功能继续由 `tests/browser/kitchen.spec.ts` 回归验证。
