import { test, expect, type Page } from '@playwright/test'

async function open(page: Page, route = '/discover') {
  await page.goto(`/app/#${route}`)
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await expect(page.locator('.k-storage-alert')).toHaveCount(0)
}
async function newRecipe(page: Page, name = '测试厨房的番茄蛋') {
  await open(page, '/edit/new')
  await page.locator('input[required]').fill(name)
  await page.getByRole('button', { name: '家常菜', exact: true }).click()
  await page.getByLabel('材料 1', { exact: true }).fill('鸡蛋')
  await page.getByLabel('材料 1 用量', { exact: true }).fill('2 个')
  await page
    .getByRole('textbox', { name: '操作正文', exact: true })
    .fill('打散鸡蛋，慢慢翻炒。')
}

test('catalog, multiword search, composed filters and reload recovery', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  await expect(page.locator('.k-count')).toHaveText('494')
  await page.getByRole('searchbox').fill('简易红烧肉 五花肉')
  await expect(page.locator('.k-count')).toHaveText('1')
  await expect(
    page.getByRole('heading', { name: '红烧肉', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: '用时', exact: true })
    .selectOption('15')
  await expect(page.locator('.k-count')).toHaveText('0')
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('简易红烧肉 五花肉')
  await expect(
    page.getByRole('combobox', { name: '用时', exact: true }),
  ).toHaveValue('15')
  await page.getByRole('button', { name: '清除搜索与筛选 ↗' }).click()
  await expect(page.locator('.k-count')).toHaveText('494')
  await page.getByRole('button', { name: '继续翻阅 ↓' }).click()
  await expect(page.locator('.k-grid .k-card')).toHaveCount(48)
  await page.reload()
  await expect(page.locator('.k-grid .k-card')).toHaveCount(48)
  expect(errors).toEqual([])
})

test('favorites persist and removal supports undo', async ({ page }) => {
  await open(page, '/recipe/braised-pork')
  await page.getByRole('button', { name: '收藏这道菜', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '已收藏', exact: true }),
  ).toBeVisible()
  await open(page, '/favorites')
  await expect(page.locator('.k-count')).toHaveText('1')
  await page
    .getByRole('button', { name: '取消收藏红烧肉', exact: true })
    .click()
  await expect(page.locator('.k-count')).toHaveText('0')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.locator('.k-count')).toHaveText('1')
  await page.reload()
  await expect(page.locator('.k-count')).toHaveText('1')
})

test('reader restores exact step and recent records deduplicate and can be removed', async ({
  page,
}) => {
  await open(page, '/recipe/braised-pork')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '进入分步阅读 ↗' }).click()
  await page.getByRole('button', { name: '下一步 →' }).click()
  await expect(page).toHaveURL(/braised-pork-s2$/)
  await page.reload()
  await expect(page.locator('.k-reader__progress')).toHaveAttribute(
    'aria-valuenow',
    '2',
  )
  await page.getByRole('button', { name: '步骤目录 ≡' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.k-directory button').nth(4).click()
  await expect(page.locator('.k-reader__progress')).toHaveAttribute(
    'aria-valuenow',
    '5',
  )
  await page.getByRole('button', { name: '← 返回菜谱' }).click()
  await page.waitForTimeout(400)
  await open(page, '/recent')
  await expect(page.locator('.k-count')).toHaveText('1')
  await page.getByRole('button', { name: '移除浏览记录' }).click()
  await expect(page.locator('.k-count')).toHaveText('0')
})

test('authoring, blank-only prefill, edit IDs, and deletion cleanup', async ({
  page,
}) => {
  await newRecipe(page, '简易红烧肉')
  await page.getByRole('button', { name: '帮我补全 ↗' }).click()
  await expect(page.locator('.k-notice')).toContainText('已按「红烧肉」')
  await expect(page.getByLabel('材料 1', { exact: true })).toHaveValue('鸡蛋')
  await expect(
    page.getByRole('textbox', { name: '操作正文', exact: true }).first(),
  ).toHaveValue('打散鸡蛋，慢慢翻炒。')
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
  const url = page.url()
  await page.getByRole('button', { name: '收藏这道菜', exact: true }).click()
  await page.getByRole('button', { name: '编辑这道菜 ↗' }).click()
  await page.locator('input[required]').fill('我家的红烧肉')
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(url)
  await expect(
    page.getByRole('heading', { name: '我家的红烧肉', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '已收藏', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '我家的红烧肉', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '删除菜谱', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page).toHaveURL(/#\/mine$/)
  await open(page, '/favorites')
  await expect(page.locator('.k-count')).toHaveText('0')
  await open(page, '/recent')
  await expect(page.locator('.k-count')).toHaveText('0')
})

test('failed persistence keeps input and supports retry; browser reload restores a draft', async ({
  page,
}) => {
  await newRecipe(page)
  page.on('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.locator('input[required]')).toHaveValue('测试厨房的番茄蛋')
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<typeof original>
    ) {
      if (args[1] === 'user')
        throw new DOMException('Full', 'QuotaExceededError')
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/edit\/new$/)
  await expect(page.locator('input[required]')).toHaveValue('测试厨房的番茄蛋')
  await expect(page.locator('.k-toast')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
})

test('profile tags, name and display settings persist; clearing favorites preserves profile', async ({
  page,
}) => {
  await open(page, '/profile')
  await page.getByLabel('厨房昵称').fill('小林的厨房')
  await page.getByRole('button', { name: '保存 ↗', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '小林的厨房', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('group', { name: '喜欢这些味道' })
    .getByRole('button', { name: '辣', exact: true })
    .click()
  await page
    .getByRole('group', { name: '这些先不放' })
    .getByRole('button', { name: '辣', exact: true })
    .click()
  await expect(
    page
      .getByRole('group', { name: '喜欢这些味道' })
      .getByRole('button', { name: '辣', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await open(page, '/settings')
  await page.getByLabel('明暗模式', { exact: true }).selectOption('dark')
  await page.getByLabel('正文字号', { exact: true }).selectOption('extra')
  await page.getByLabel('显示步骤图片').uncheck()
  await expect(page.getByLabel('显示步骤图片')).toBeEnabled()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute(
    'data-kitchen-theme',
    'dark',
  )
  await expect(page.getByLabel('正文字号', { exact: true })).toHaveValue(
    'extra',
  )
  await expect(page.getByLabel('显示步骤图片')).not.toBeChecked()
  await open(page, '/profile')
  await expect(
    page.getByRole('heading', { name: '小林的厨房', exact: true }),
  ).toBeVisible()
})

test('responsive pages do not overflow and reduced motion remains readable', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of [
      '/discover',
      '/recipe/braised-pork',
      '/profile',
      '/settings',
      '/edit/new',
      '/read/braised-pork/braised-pork-s2',
    ]) {
      await open(page, route)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${route}`,
      ).toBeTruthy()
      await expect(page.locator('main')).toBeVisible()
    }
  }
})

test('the production shell and catalog reopen offline after the first visit', async ({
  page,
  context,
}) => {
  await open(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    await document.fonts.ready
  })
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.open('deepcook-shell-v1'))
          .keys()
          .then((keys) => keys.some((k) => k.url.endsWith('.js'))),
      ),
    )
    .toBeTruthy()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.k-count')).toHaveText('494')
  await page.getByRole('searchbox').fill('简易红烧肉')
  await expect(page.locator('.k-count')).toHaveText('1')
  await page.getByRole('button', { name: '查看红烧肉', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '红烧肉', exact: true }),
  ).toBeVisible()
})

test('corrupt local records are retained and bundled recipes remain available', async ({
  page,
}) => {
  await open(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('deepcook-kitchen', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction('data', 'readwrite')
          tx.objectStore('data').put({ corrupt: 'retain-me' }, 'user')
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()
  await expect(page.locator('.k-storage-alert')).toContainText('原数据已保留')
  await expect(page.locator('.k-count')).toHaveText('494')
  await expect(
    page.getByRole('button', { name: '收藏红烧肉', exact: true }).first(),
  ).toBeDisabled()
  const retained = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('deepcook-kitchen', 1)
        req.onsuccess = () => {
          const read = req.result
            .transaction('data')
            .objectStore('data')
            .get('user')
          read.onsuccess = () => resolve(read.result)
        }
      }),
  )
  expect(retained).toEqual({ corrupt: 'retain-me' })
})

test('remote prefill uses the pinned source when local content has no match', async ({
  browser,
}) => {
  // Request interception must run without a service worker consuming the index.
  const context = await browser.newContext({
    serviceWorkers: 'block',
    baseURL: 'http://127.0.0.1:4173',
  })
  const page = await context.newPage()
  let requested = ''
  await page.route('**/catalog/howtocook_index.json', (route) =>
    route.fulfill({
      json: {
        ref: 'pinned-commit',
        dishes: [
          {
            name: '量子厨房测试料理',
            path: 'dishes/meat_dish/quantum.md',
            group: 'meat_dish',
          },
        ],
      },
    }),
  )
  await page.route('https://raw.githubusercontent.com/**', (route) => {
    requested = route.request().url()
    return route.fulfill({
      body: '# 量子厨房测试料理的做法\n\n一道用于验证的测试菜。\n预估烹饪难度：★★\n\n## 必备原料和工具\n- 鸡蛋\n- 盐\n\n## 计算\n- 鸡蛋 = 2 个\n- 盐 = 少许\n\n## 操作\n1. 打散鸡蛋。\n2. 放盐翻炒。\n\n## 附加内容\n- 小火慢慢做。',
      contentType: 'text/plain',
    })
  })
  await open(page, '/edit/new')
  await page.locator('input[required]').fill('量子厨房测试料理')
  await page.getByRole('button', { name: '帮我补全 ↗' }).click()
  await expect(page.locator('.k-notice')).toContainText(
    '已按「量子厨房测试料理」',
  )
  expect(requested).toContain('/pinned-commit/dishes/meat_dish/quantum.md')
  await expect(
    page.getByRole('textbox', { name: '材料 1', exact: true }),
  ).toHaveValue('鸡蛋')
  await expect(
    page.getByRole('textbox', { name: '操作正文', exact: true }).first(),
  ).toHaveValue('打散鸡蛋。')
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
  await context.close()
})

test('uploaded cover and cropped avatar survive a browser reload', async ({
  page,
}) => {
  const file = {
    name: 'kitchen.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#f0b41c'
        ctx.fillRect(0, 0, 64, 64)
        return canvas.toDataURL('image/png').split(',')[1]!
      }),
      'base64',
    ),
  }
  await newRecipe(page)
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.locator('.k-cover-editor img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg/,
  )
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
  await page.reload()
  await expect(page.locator('.k-detail-hero img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg/,
  )
  await open(page, '/profile')
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('放大', { exact: true }).fill('1.5')
  await page.getByRole('button', { name: '保存头像', exact: true }).click()
  await expect(page.locator('.k-avatar img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg/,
  )
  await page.reload()
  await expect(page.locator('.k-avatar img')).toHaveAttribute(
    'src',
    /^data:image\/jpeg/,
  )
})

test('online footer reuses the homepage footer and keeps app navigation intact', async ({
  page,
}) => {
  await open(page, '/recipe/braised-pork')
  const footer = page.locator('footer.footer')
  await expect(footer.locator('.footer__word')).toHaveText('DEEPCOOK')
  await expect(
    footer.getByRole('link', { name: '下载 Android 版' }),
  ).toHaveAttribute('href', '../download/DeepCook-0.5.1-preview.apk')
  await expect(
    footer.getByRole('link', { name: '在线使用', exact: true }),
  ).toHaveAttribute('href', '../app/')
  await expect(footer.getByRole('link', { name: 'AI 路线' })).toHaveAttribute(
    'href',
    '../index.html#next',
  )
  const expectedRoute = page.url()
  await footer.getByRole('button', { name: '回到顶部' }).click()
  await expect(page).toHaveURL(expectedRoute)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  const onlineStyle = await footer.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    columns: getComputedStyle(el.querySelector('.footer__grid')!)
      .gridTemplateColumns,
  }))
  await page.evaluate(() => sessionStorage.setItem('deepcook-intro', '1'))
  await page.goto('/')
  await expect(page.locator('footer.footer .footer__word')).toHaveText(
    'DEEPCOOK',
  )
  expect(
    await page
      .locator('footer.footer')
      .evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        columns: getComputedStyle(el.querySelector('.footer__grid')!)
          .gridTemplateColumns,
      })),
  ).toEqual(onlineStyle)
})

test('cursor dot and ring stay concentric while moving and resizing on both entries', async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem('deepcook-intro', '1'))
  for (const path of ['/app/', '/']) {
    await page.goto(path)
    await page.mouse.move(120, 260)
    await expect(page.locator('.cursor')).toHaveCSS('opacity', '1')
    for (const [x, y] of [
      [700, 420],
      [330, 220],
      [850, 510],
    ]) {
      await page.mouse.move(x!, y!)
      const distances = await page.evaluate(async () => {
        const values: number[] = []
        for (let i = 0; i < 6; i++) {
          await new Promise(requestAnimationFrame)
          const dot = document
              .querySelector('.cursor__dot')!
              .getBoundingClientRect(),
            ring = document
              .querySelector('.cursor__ring')!
              .getBoundingClientRect()
          values.push(
            Math.hypot(
              dot.x + dot.width / 2 - ring.x - ring.width / 2,
              dot.y + dot.height / 2 - ring.y - ring.height / 2,
            ),
          )
        }
        return values
      })
      expect(Math.max(...distances)).toBeLessThan(0.1)
    }
    await page.locator('header a').first().hover()
    await expect(page.locator('.cursor')).toHaveClass(/is-active/)
    await expect
      .poll(() =>
        page
          .locator('.cursor__ring')
          .evaluate((el) => el.getBoundingClientRect().width),
      )
      .toBe(64)
    const distance = await page.evaluate(() => {
      const d = document.querySelector('.cursor__dot')!.getBoundingClientRect(),
        r = document.querySelector('.cursor__ring')!.getBoundingClientRect()
      return Math.hypot(
        d.x + d.width / 2 - r.x - r.width / 2,
        d.y + d.height / 2 - r.y - r.height / 2,
      )
    })
    expect(distance).toBeLessThan(0.1)
  }
})

test('detail body remains centered and chapter rail sticks only inside its section', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await open(page, '/recipe/braised-pork')
    await expect(page.locator('.k-method')).toBeVisible()
    const centers = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.k-detail-section > :not(.k-section-title)',
        ),
      ].map((el) => {
        const rect = el.getBoundingClientRect()
        return Math.abs(
          rect.x + rect.width / 2 - document.documentElement.clientWidth / 2,
        )
      }),
    )
    expect(Math.max(...centers)).toBeLessThan(1)
    await page.evaluate(() =>
      scrollTo(
        0,
        document.getElementById('steps')!.getBoundingClientRect().top +
          scrollY +
          200,
      ),
    )
    const rail = page.locator('#steps .k-section-title')
    await expect
      .poll(() =>
        rail.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(102)
    await page.evaluate(() => scrollBy(0, 450))
    await expect
      .poll(() =>
        rail.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(102)
    await page.evaluate(() =>
      scrollTo(
        0,
        document.getElementById('source')!.getBoundingClientRect().top +
          scrollY,
      ),
    )
    await expect
      .poll(() => rail.evaluate((el) => el.getBoundingClientRect().bottom))
      .toBeLessThan(102)
    await expect(page.locator('.k-detail-nav a[aria-current]')).toHaveText(
      '来源',
    )
  }
})
