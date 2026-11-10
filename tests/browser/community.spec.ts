import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})
async function open(page: Page, id = 'braised-pork') {
  await page.goto(`/app/#/recipe/${id}`)
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await expect(
    page
      .getByRole('button', { name: '评价一下 ↗' })
      .or(page.getByRole('button', { name: /我的评分/ })),
  ).toBeEnabled()
}
async function communityCounts(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        recipes: unknown[]
        photos: Blob[]
        drafts: { text: string; hasPhoto: boolean }[]
      }>((resolve, reject) => {
        const req = indexedDB.open('deepcook-community', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction(['recipes', 'photos', 'drafts'])
          const r = tx.objectStore('recipes').getAll(),
            p = tx.objectStore('photos').getAll(),
            d = tx.objectStore('drafts').getAll()
          tx.oncomplete = () =>
            resolve({
              recipes: r.result,
              photos: p.result,
              drafts: d.result.map((draft) => ({
                text: draft.text,
                hasPhoto: draft.photo instanceof Blob,
              })),
            })
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}
async function fixture(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f0b41c'
    ctx.fillRect(0, 0, 100, 100)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return {
    name: 'my-dish.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64'),
  }
}

test('one local rating updates in place and survives reload', async ({
  page,
}) => {
  await open(page)
  await expect(page.locator('.k-rating__score > span')).toHaveText('3 条评分')
  await page.getByRole('button', { name: '评价一下 ↗' }).click()
  await page.getByRole('slider', { name: '我的评分', exact: true }).fill('10')
  await page.getByRole('button', { name: '保存评分', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '我的评分 10/10 ↗' }),
  ).toBeVisible()
  await expect(page.locator('.k-rating__score > span')).toHaveText('4 条评分')
  await expect(page.locator('.k-rating__score > b')).toHaveText('8.3')
  await page.reload()
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await page.getByRole('button', { name: '我的评分 10/10 ↗' }).click()
  await page.getByRole('slider', { name: '我的评分', exact: true }).fill('7')
  await page.getByRole('button', { name: '保存评分', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '我的评分 7/10 ↗' }),
  ).toBeVisible()
  await expect(page.locator('.k-rating__score > span')).toHaveText('4 条评分')
  await expect(page.locator('.k-rating__score > b')).toHaveText('7.5')
})

test('comments remain local to the recipe and only own posts can be deleted', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '写评论 ↗' }).click()
  await expect(
    page.getByRole('button', { name: '保存评论', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('textbox', { name: '评论内容', exact: true })
    .fill('  火候刚好，下一次少放一点糖。  ')
  await page.getByRole('button', { name: '保存评论', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const own = page
    .locator('.k-community-post')
    .filter({ hasText: '火候刚好，下一次少放一点糖。' })
  await expect(own).toBeVisible()
  await expect(own.getByRole('button', { name: '删除这条评论' })).toBeVisible()
  await expect(
    page
      .locator('.k-community-post')
      .filter({ hasText: 'App 示例' })
      .getByRole('button'),
  ).toHaveCount(0)
  await page.reload()
  await expect(own).toBeVisible()
  await open(page, 'silky-eggs')
  await expect(own).toHaveCount(0)
  await open(page)
  await expect(own).toBeVisible()
  await own.getByRole('button', { name: '删除这条评论' }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(own).toHaveCount(0)
  await expect(
    page.locator('.k-community-post').filter({ hasText: 'App 示例' }),
  ).toHaveCount(2)
})

test('submission photos are durable bounded Blobs and are deleted atomically with the post', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '收藏这道菜', exact: true }).click()
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page
    .getByRole('textbox', { name: '下厨心得', exact: true })
    .fill('第一次做，记录一下成品。')
  await page
    .locator('.k-community-form input[type=file]')
    .setInputFiles(await fixture(page))
  await expect(page.getByAltText('作业照片预览')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await page.getByRole('button', { name: '保存作业', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const post = page
    .locator('.k-community-post')
    .filter({ hasText: '第一次做，记录一下成品。' })
  await expect(post.locator('img')).toHaveAttribute('src', /^blob:/)
  const photoInfo = await page.evaluate(
    () =>
      new Promise<{ size: number; type: string; valid: boolean }>((resolve) => {
        const req = indexedDB.open('deepcook-community', 1)
        req.onsuccess = () => {
          const read = req.result
            .transaction('photos')
            .objectStore('photos')
            .getAll()
          read.onsuccess = () =>
            resolve({
              size: read.result[0].size,
              type: read.result[0].type,
              valid: read.result[0] instanceof Blob,
            })
        }
      }),
  )
  expect(photoInfo.valid).toBeTruthy()
  expect(photoInfo.size).toBeLessThanOrEqual(1048576)
  expect(photoInfo.type).toBe('image/jpeg')
  await page.reload()
  await expect(post.locator('img')).toHaveAttribute('src', /^blob:/)
  await post.getByRole('button', { name: '删除这条作业' }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(post).toHaveCount(0)
  expect((await communityCounts(page)).photos).toHaveLength(0)
  await expect(
    page.getByRole('button', { name: '已收藏', exact: true }),
  ).toBeVisible()
})

test('comment and photo draft restore after reload and explicit cancel clears it', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page
    .getByRole('textbox', { name: '下厨心得', exact: true })
    .fill('这份草稿还没写完。')
  await page
    .locator('.k-community-form input[type=file]')
    .setInputFiles(await fixture(page))
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  await expect
    .poll(async () => {
      const data = await communityCounts(page)
      return data.drafts.some(
        (d) => d.text === '这份草稿还没写完。' && d.hasPhoto,
      )
    })
    .toBeTruthy()
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: '下厨心得', exact: true }),
  ).toHaveValue('这份草稿还没写完。')
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await communityCounts(page)).drafts).toHaveLength(0)
  expect((await communityCounts(page)).photos).toHaveLength(0)
})

test('quota failure preserves the composer and aborts the photo write, then retry succeeds', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page
    .getByRole('textbox', { name: '下厨心得', exact: true })
    .fill('保存失败也要保留这份作业。')
  await page
    .locator('.k-community-form input[type=file]')
    .setInputFiles(await fixture(page))
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  await expect
    .poll(async () =>
      (await communityCounts(page)).drafts.some((d) => d.hasPhoto),
    )
    .toBeTruthy()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    ;(window as any).restoreCommunityPut = () => {
      IDBObjectStore.prototype.put = original
    }
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<typeof original>
    ) {
      if (this.name === 'recipes')
        throw new DOMException('No space', 'QuotaExceededError')
      return original.apply(this, args)
    }
  })
  await page.getByRole('button', { name: '保存作业', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '浏览器存储空间不足',
  )
  await expect(
    page.getByRole('textbox', { name: '下厨心得', exact: true }),
  ).toHaveValue('保存失败也要保留这份作业。')
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  expect((await communityCounts(page)).photos).toHaveLength(0)
  await page.evaluate(() => (window as any).restoreCommunityPut())
  await page.getByRole('button', { name: '保存作业', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page
      .locator('.k-community-post')
      .filter({ hasText: '保存失败也要保留这份作业。' }),
  ).toBeVisible()
  expect((await communityCounts(page)).photos).toHaveLength(1)
})

test('corrupt community records are retained and do not prevent using the recipe', async ({
  page,
}) => {
  await open(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('deepcook-community', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction('recipes', 'readwrite')
          tx.objectStore('recipes').put(
            { schema: 99, keep: 'original' },
            'braised-pork',
          )
          tx.oncomplete = () => resolve()
        }
      }),
  )
  await page.reload()
  await expect(page.locator('.k-rating .k-community-error')).toContainText(
    '原数据已保留',
  )
  await expect(page.getByRole('button', { name: '评价一下 ↗' })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: '进入分步阅读 ↗' }),
  ).toBeVisible()
  expect((await communityCounts(page)).recipes).toEqual([
    { schema: 99, keep: 'original' },
  ])
})

test('deleting a personal recipe cleans its rating, posts, photos and other-tab drafts', async ({
  page,
}) => {
  await page.goto('/app/#/edit/new')
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await page.locator('input[required]').fill('作业清理测试菜谱')
  await page.getByRole('button', { name: '家常菜', exact: true }).click()
  await page.getByLabel('材料 1', { exact: true }).fill('鸡蛋')
  await page.getByLabel('材料 1 用量', { exact: true }).fill('2 个')
  await page
    .getByRole('textbox', { name: '操作正文', exact: true })
    .fill('打散鸡蛋，慢慢翻炒。')
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
  const id = decodeURIComponent(page.url().split('/recipe/')[1]!)
  await page.getByRole('button', { name: '评价一下 ↗' }).click()
  await page.getByRole('button', { name: '保存评分', exact: true }).click()
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page
    .getByRole('textbox', { name: '下厨心得', exact: true })
    .fill('删除菜谱也清理附图。')
  await page
    .locator('.k-community-form input[type=file]')
    .setInputFiles(await fixture(page))
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  await page.getByRole('button', { name: '保存作业', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await communityCounts(page)).photos).toHaveLength(1)
  await page.evaluate(
    (recipeId) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('deepcook-community', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction('drafts', 'readwrite')
          tx.objectStore('drafts').put(
            { kind: 'comment', text: '其他标签页草稿', score: 8, photo: null },
            `other-session/${recipeId}`,
          )
          tx.oncomplete = () => resolve()
        }
      }),
    id,
  )
  await page.getByRole('button', { name: '删除菜谱', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page).toHaveURL(/#\/mine$/)
  const saved = await communityCounts(page)
  expect(saved.photos).toHaveLength(0)
  expect(saved.drafts).toHaveLength(0)
  expect(saved.recipes).toEqual([
    { schema: 1, recipeId: id, ownRating: null, posts: [] },
  ])
})

test('local ratings propagate between tabs and community layout fits narrow and wide screens', async ({
  page,
  context,
}) => {
  await open(page)
  const other = await context.newPage()
  await other.emulateMedia({ reducedMotion: 'reduce' })
  await open(other)
  await page.getByRole('button', { name: '评价一下 ↗' }).click()
  await page.getByRole('button', { name: '保存评分', exact: true }).click()
  await expect(
    other.getByRole('button', { name: '我的评分 8/10 ↗' }),
  ).toBeVisible()
  await other.close()
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.locator('#community').scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
  await page.getByRole('button', { name: '写评论 ↗' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
})

test('compact rating and nutrition stay beside the cover and the full table shows all six App fields', async ({
  page,
}) => {
  await open(page)
  await expect(page.locator('.k-detail-intro .k-rating')).toHaveCount(1)
  await expect(page.locator('.k-detail-intro .k-nutrition')).toHaveCount(1)
  await expect(page.locator('.k-nutrition__summary b')).toHaveText([
    '480',
    '22',
    '26',
    '44',
  ])
  await expect(page.locator('.k-nutrition > .k-fine')).toContainText(
    'App 内置示例',
  )
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    const cover = (await page.locator('.k-recipe-visual').boundingBox())!
    const rating = (await page.locator('.k-rating').boundingBox())!
    const nutrition = (await page.locator('.k-nutrition').boundingBox())!
    expect(rating.x).toBeGreaterThan(cover.x + cover.width)
    expect(nutrition.x).toBe(rating.x)
    expect(rating.height).toBeLessThan(150)
    expect(nutrition.y + nutrition.height).toBeLessThanOrEqual(
      cover.y + cover.height,
    )
  }
  await page.getByRole('button', { name: '查看全部 ↗' }).click()
  const modal = page.getByRole('dialog', { name: '完整营养表' })
  await expect(modal.getByRole('row')).toHaveCount(7)
  await expect(
    modal.getByRole('row', { name: '热量 480 kcal', exact: true }),
  ).toBeVisible()
  await expect(
    modal.getByRole('row', { name: '膳食纤维 3.5 g', exact: true }),
  ).toBeVisible()
  await expect(
    modal.getByRole('row', { name: '钠 650 mg', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
  await page.getByRole('button', { name: '评价一下 ↗' }).click()
  await expect(page.getByRole('dialog', { name: '给这道菜评分' })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
})

test('missing nutrition is never inferred and its full table fits a narrow phone', async ({
  page,
}) => {
  await open(page, 'world-danish-pancake')
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(page.locator('.k-nutrition__summary b')).toHaveText([
    '无',
    '无',
    '无',
    '无',
  ])
  await expect(page.locator('.k-nutrition > .k-fine')).toContainText(
    '暂无营养数据',
  )
  const cover = (await page.locator('.k-recipe-visual').boundingBox())!
  const rating = (await page.locator('.k-rating').boundingBox())!
  expect(rating.y).toBeGreaterThan(cover.y + cover.height)
  await page.getByRole('button', { name: '查看全部 ↗' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('cell')).toHaveText([
    '无',
    '无',
    '无',
    '无',
    '无',
    '无',
  ])
  const box = (await modal.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  await modal.getByRole('button', { name: '收起营养表 ↗' }).click()
  await expect(modal).toHaveCount(0)
})
