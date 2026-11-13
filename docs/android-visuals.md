# Android 介绍页视觉素材

使用内置 imagegen 制作三张 APP 功能界面示意图。当前环境没有已连接的 Android 设备或可运行的模拟器，因此这些图片不作为实机截图；页面的图片说明与替代文本均标明「功能界面示意」。

| 素材 | 展示功能 | 项目路径 |
| --- | --- | --- |
| 找菜 | 搜索、分类、菜谱卡片与收藏 | [find.png](../public/android/screens/find.png) |
| 做菜 | 当前步骤、步骤目录与计时 | [cook.png](../public/android/screens/cook.png) |
| AI 下厨 | 人数换算、缺料替代与菜谱问答 | [ai.png](../public/android/screens/ai.png) |

图中菜谱、时长与回答用于展示交互，不代表原文的全部数据或在线生成结果。AI 区域根据 Android 的 DishAiSection 和 CookingScreen 实现组织，在线回答需要配置服务。

三张图片以第一张为风格参考，使用暖黄原生界面与一致的纵向比例；网页以 CSS 绘制边框，图片本身没有设备外壳。后续有合适的实机截图时，可按同名文件替换。

网页图标从 Android `app/src/main/res/drawable/ic_launcher.xml` 提取，保持 108 × 108 视口、三个路径及原始配色；浏览器图标位于 [favicon.svg](../public/favicon.svg)，页面复用 [BrandMark](../src/components/BrandMark.tsx)。

## 生成提示词

### find

```text
Use case: ui-mockup. Asset type: one portrait mobile application screen for a real Chinese recipe app's website, not a photograph. Create a carefully typeset, high fidelity Android Jetpack Compose / Material 3 app interface illustration for DeepCook, based on this existing product. Render a single flat straight-on screen at approximately 1024x2048, no device frame, no perspective, no surroundings, no shadow, no marketing captions outside the UI. The entire image is the screen. Warm pale yellow canvas #fff8e8, white recipe cards with thin warm gray outlines, charcoal Chinese sans-serif typography, warm yellow accent #ffe0a3, brown active icons #805600. Top Android status bar showing 9:41. Below a small top bar: DeepCook on left, a magnifying glass on right. Large friendly headline exactly “今天，想做点什么？”. Subtitle “从一道喜欢的菜开始”. A low, clean search field with a search icon and text “搜索菜名、食材”. A horizontal category row with “精选” active yellow, “家常菜”, “早餐”, “甜点”. Four equally sized recipe cards in a TWO COLUMN grid, each showing a beautiful realistic food photograph in its upper two thirds and a plain white text area, title and understated metadata below. Cards: “红烧肉” (glossy braised pork), “番茄炒蛋” (tomatoes and eggs), “小笼包” (steamed dumplings in bamboo steamer), “清炒包菜” (stir fried cabbage). Metadata: “60 min · 难度 3”, “15 min · 难度 1”, “45 min · 难度 3”, “10 min · 难度 1” respectively. Small outline star in each card corner. Bottom navigation in a pale warm solid panel with three icons and exact labels “菜谱”, “收藏”, “我的”, first active. Bottom gesture handle. Generous but realistic Android spacing, legible accurate Chinese glyphs, refined simple native interface. No fictional chat, no metrics, no extra features, no watermark. This is an illustration of existing app functions, not an actual screenshot.
```

### cook

```text
Use case: ui-mockup. Asset type: portrait DeepCook Android cooking-mode interface illustration, second of three website images. The provided image is ONLY a style reference: match its flat warm native Android interface, excellent Chinese typography, pale yellow canvas, brown accents, straight-on framing and 1:2 aspect ratio; replace all content with a cooking-mode screen. Single screen, roughly 1024x2048, no device frame, no photographic backdrop, no perspective, no added website text. Top Android status bar showing 9:41. A slim top bar with back arrow, title “红烧肉”, and a small timer icon. Below, a subtle caption “烹饪模式” and progress “03 / 06”, with a thin yellow progress line half filled. A small pill “小火慢炖”. Main content has large dark “03” and a bold heading “慢炖入味”. One large beautiful food photograph of glossy Chinese braised pork simmering in a dark pot, with fine steam, situated in a rounded rectangle around the upper-middle of the screen. Below it, generous readable Chinese cooking text exactly “加入热水没过五花肉。煮开后转小火，盖上锅盖慢炖，让肉慢慢变得软糯。” A warm yellow lightly outlined timer card below, heading “下厨计时”, very large dark digits “45:00”, a small pill button “开始计时” and an outline plus icon for another timer. A small utility row “步骤目录” on left and “问一问” with microphone icon on right. Fixed bottom navigation with two comfortably sized buttons: outlined “上一步” on left and filled warm yellow “下一步” on right. Bottom gesture handle. This should feel like an achievable native Kotlin Compose interface for the actual app, restrained and beautifully typeset, without chat bubbles or fictional features. No watermark. This is a clearly disclosed functional illustration, not a claimed actual-device screenshot.
```

### ai

```text
Use case: ui-mockup. Asset type: portrait DeepCook Android AI recipe-helper interface illustration, third of three website images. The input image is ONLY a visual style reference: keep the flat warm native Android UI, pale warm yellow #fff8e8 background, charcoal clean Chinese typography, brown #805600 and warm yellow #ffe0a3 accents, sharp accurate Chinese glyphs and approximately 1:2 portrait screen ratio. Replace all the content with the existing app's recipe detail AI panel, not a fictional generic chatbot. Render a single flat straight-on screen, no device frame, no surroundings, no perspective, no photo backdrop, no marketing headings outside the interface. Top Android status bar 9:41. Slim toolbar with back arrow, title “红烧肉”, outline star. A short wide food photo of braised pork at top, followed by the heading “材料” and a small dropdown pill “2 人份”. Compact ingredient rows on a clean white area with thin horizontal rules, names left quantities right: “五花肉” “500 g”; “生抽” “2 勺”; “老抽” “1 勺”; “冰糖” “20 g”. Below, one generous native rounded card containing a small sparkle icon and bold heading “问 AI”; supporting text “缺料、失手、份量都可以问。” Two outlined assist chips exactly “缺料替代” and “哪儿不对？”. A neat outlined question field containing exactly “没有老抽，可以用什么代替？” with send arrow. Below it, a warm yellow answer panel with short beautifully typeset text exactly “可以用少量生抽替代，颜色会浅一些。先少放，尝过后再调整咸淡。” A small brown caption “AI 建议，仅供参考” and small action “再问一次”. At bottom a tasteful small row with microphone outline and label “做菜现场，也能问一问”. Bottom gesture handle. Keep hierarchy and restrained white space consistent with the reference. Chinese recipe app, native Material 3, not a desktop site. No watermark, no fake verification badges, no success statistics. This is a clearly disclosed AI feature interface illustration, not a claimed actual-device screenshot.
```

