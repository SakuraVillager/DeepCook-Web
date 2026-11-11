import { test, expect, type Page } from '@playwright/test'
const API = 'http://127.0.0.1:4199/deepcook-api/v1'
test.use({ reducedMotion: 'reduce' })
async function open(page: Page, id = 'braised-pork') {
  await page.goto(`/app/#/recipe/${id}`)
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await expect(page.locator('.k-rating button').first()).toBeEnabled()
}
async function publish(page: Page, text: string, submission = false) {
  await page
    .getByRole('button', { name: submission ? '交作业 ↗' : '写评论 ↗' })
    .click()
  await page
    .getByRole('textbox', {
      name: submission ? '下厨心得' : '评论内容',
      exact: true,
    })
    .fill(text)
  await page
    .getByRole('button', {
      name: submission ? '发布作业' : '发布评论',
      exact: true,
    })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(ownPost(page, text)).toBeVisible()
}
const ownPost = (page: Page, text: string) =>
  page.locator('.k-community-post').filter({ hasText: text })
async function attachPhoto(page: Page, color = '#ed9033') {
  const encoded = await page.evaluate((color) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 900
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1200, 900)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  }, color)
  await page.locator('input[type=file]').setInputFiles({
    name: 'dish.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(encoded, 'base64'),
  })
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
}

test('failed image upload keeps the composer and never publishes text without its photo', async ({
  page,
}) => {
  await open(page, 'steamed-fish')
  const text = `上传失败-${Date.now()}`
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page.getByRole('textbox', { name: '下厨心得', exact: true }).fill(text)
  await attachPhoto(page, '#8b3232')
  let published = false
  page.on('request', (r) => {
    if (
      r.url().endsWith('/recipes/steamed-fish/posts') &&
      r.method() === 'POST'
    )
      published = true
  })
  await page.route(`${API}/recipes/steamed-fish/uploads/*`, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: '图片上传失败，请重试。' }),
        })
      : route.continue(),
  )
  await page.getByRole('button', { name: '发布作业', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '图片上传失败',
  )
  expect(published).toBe(false)
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: '下厨心得', exact: true }),
  ).toHaveValue(text)
  await page.unroute(`${API}/recipes/steamed-fish/uploads/*`)
  await page.getByRole('button', { name: '发布作业', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(ownPost(page, text).locator('img')).toHaveAttribute(
    'src',
    /^http:/,
  )
})

test('an existing public homework photo is migrated from its original browser', async ({
  page,
  browser,
}) => {
  await open(page, 'silky-eggs')
  const token = await page.evaluate(() =>
    localStorage.getItem('deepcook-community-visitor-v1'),
  )
  const id = `post-${crypto.randomUUID()}`
  const text = `旧附图补传-${Date.now()}`
  const result = await page.request.post(`${API}/recipes/silky-eggs/posts`, {
    headers: {
      Origin: 'http://127.0.0.1:4173',
      Authorization: `Bearer ${token}`,
    },
    data: { id, submission: true, text },
  })
  expect(result.ok()).toBeTruthy()
  await page.evaluate(async (id) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 900
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#6343ae'
    ctx.fillRect(0, 0, 1200, 900)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg'),
    )
    await new Promise<void>((resolve) => {
      const r = indexedDB.open('deepcook-community', 1)
      r.onsuccess = () => {
        const tx = r.result.transaction('photos', 'readwrite')
        tx.objectStore('photos').put(blob, id)
        tx.oncomplete = () => resolve()
      }
    })
  }, id)
  await page.reload()
  await expect(ownPost(page, text).locator('img')).toHaveAttribute(
    'src',
    /^http:/,
  )
  const otherContext = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    const other = await otherContext.newPage()
    await open(other, 'silky-eggs')
    await expect(ownPost(other, text).locator('img')).toHaveAttribute(
      'src',
      /^http:/,
    )
    await ownPost(other, text).locator('img').scrollIntoViewIfNeeded()
    await ownPost(other, text)
      .locator('img')
      .evaluate((img: HTMLImageElement) => img.decode())
    await expect
      .poll(() =>
        ownPost(other, text)
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(1200)
  } finally {
    await otherContext.close()
  }
})

test('independent visitors share ratings and comments without sharing ownership', async ({
  page,
  browser,
}) => {
  const otherContext = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    const other = await otherContext.newPage()
    await open(page)
    await page.getByRole('button', { name: '评价一下 ↗' }).click()
    await page.getByRole('slider', { name: '我的评分', exact: true }).fill('10')
    await page.getByRole('button', { name: '发布评分', exact: true }).click()
    await expect(
      page.getByRole('button', { name: '我的评分 10/10 ↗' }),
    ).toBeVisible()
    await open(other)
    await expect(other.locator('.k-rating__score > span')).toHaveText(
      '1 条评分',
    )
    await expect(
      other.getByRole('button', { name: '评价一下 ↗' }),
    ).toBeVisible()
    const text = `共享评论-${Date.now()}`
    await publish(page, text)
    await other.getByRole('button', { name: '刷新交流 ↻' }).click()
    const visible = ownPost(other, text)
    await expect(visible).toBeVisible()
    await expect(visible.getByRole('button')).toHaveCount(0)
    await expect(visible.locator('header b')).toHaveText(/访客/)
    const id = await visible.getAttribute('data-post-id')
    const token = await other.evaluate(() =>
      localStorage.getItem('deepcook-community-visitor-v1'),
    )
    const denied = await other.request.delete(
      `${API}/recipes/braised-pork/posts/${id}`,
      {
        headers: {
          Origin: 'http://127.0.0.1:4173',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    expect(denied.status()).toBe(403)
    await ownPost(page, text)
      .getByRole('button', { name: '删除这条评论' })
      .click()
    await page.getByRole('button', { name: '确认删除', exact: true }).click()
    await other.getByRole('button', { name: '刷新交流 ↻' }).click()
    await expect(visible).toHaveCount(0)
  } finally {
    await otherContext.close()
  }
})

test('homework photos are shared across browsers and removed with their post', async ({
  page,
  browser,
}) => {
  await open(page, 'silky-eggs')
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  const text = `云端附图-${Date.now()}`
  await page.getByRole('textbox', { name: '下厨心得', exact: true }).fill(text)
  const buffer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 3
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'dish.png',
    mimeType: 'image/png',
    buffer: Buffer.from(buffer, 'base64'),
  })
  await expect(page.getByAltText('作业照片预览')).toBeVisible()
  const sent = page.waitForRequest(
    (r) =>
      r.url().endsWith('/recipes/silky-eggs/posts') && r.method() === 'POST',
  )
  await page.getByRole('button', { name: '发布作业', exact: true }).click()
  const body = (await sent).postDataJSON()
  expect(Object.keys(body).sort()).toEqual([
    'id',
    'photo',
    'submission',
    'text',
  ])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(ownPost(page, text).locator('img')).toHaveAttribute(
    'src',
    /^http:\/\/127\.0\.0\.1:4199\/deepcook-api\/v1\/photos\//,
  )
  await page.reload()
  await expect(ownPost(page, text).locator('img')).toHaveAttribute(
    'src',
    /^http:\/\/127\.0\.0\.1:4199\/deepcook-api\/v1\/photos\//,
  )
  const url = (await ownPost(page, text).locator('img').getAttribute('src'))!
  const otherContext = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    const other = await otherContext.newPage()
    await open(other, 'silky-eggs')
    await expect(ownPost(other, text)).toBeVisible()
    await expect(ownPost(other, text).locator('img')).toHaveAttribute(
      'src',
      url,
    )
    await ownPost(other, text).locator('img').scrollIntoViewIfNeeded()
    await ownPost(other, text)
      .locator('img')
      .evaluate((img: HTMLImageElement) => img.decode())
    await expect
      .poll(() =>
        ownPost(other, text)
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(1200)
  } finally {
    await otherContext.close()
  }
  await ownPost(page, text)
    .getByRole('button', { name: '删除这条作业' })
    .click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(ownPost(page, text)).toHaveCount(0)
  expect((await page.request.get(url)).status()).toBe(404)
})

test('a lost publish response retains the draft and retry does not publish a duplicate', async ({
  page,
}) => {
  await open(page, 'steamed-fish')
  const text = `网络重试-${Date.now()}`
  await page.getByRole('button', { name: '交作业 ↗' }).click()
  await page.getByRole('textbox', { name: '下厨心得', exact: true }).fill(text)
  await attachPhoto(page, '#21719a')
  let intercepted = false
  await page.route(`${API}/recipes/steamed-fish/posts`, async (route) => {
    if (route.request().method() !== 'POST' || intercepted)
      return route.continue()
    intercepted = true
    await route.fetch()
    await route.abort('failed')
  })
  await page.getByRole('button', { name: '发布作业', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '已保留',
  )
  await expect(
    page.getByRole('textbox', { name: '下厨心得', exact: true }),
  ).toHaveValue(text)
  await page.getByRole('button', { name: '发布作业', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(ownPost(page, text).locator('img')).toHaveAttribute(
    'src',
    /^http:/,
  )
  await expect(ownPost(page, text)).toHaveCount(1)
  const feed = await page.request.get(`${API}/recipes/steamed-fish`)
  const json = await feed.json()
  expect(
    json.posts.filter((p: { text: string }) => p.text === text),
  ).toHaveLength(1)
})

test('old private records stay private and cached public records remain readable offline', async ({
  page,
  context,
}) => {
  await open(page, 'world-danish-pancake')
  const old = `旧本地记录-${Date.now()}`
  await page.evaluate(async (text) => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('deepcook-community', 1)
      req.onsuccess = () => {
        const tx = req.result.transaction('recipes', 'readwrite')
        tx.objectStore('recipes').put(
          {
            schema: 1,
            recipeId: 'world-danish-pancake',
            ownRating: 6,
            posts: [
              {
                id: `post-${crypto.randomUUID()}`,
                recipeId: 'world-danish-pancake',
                submission: false,
                text,
                photo: null,
                author: '我',
                sample: false,
                createdAt: Date.now(),
              },
            ],
          },
          'world-danish-pancake',
        )
        tx.oncomplete = () => resolve()
      }
    })
  }, old)
  await page.reload()
  await expect(
    ownPost(page, old).getByText('仅本机', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.k-rating__score > span')).toHaveText('暂无评分')
  const feed = await (
    await page.request.get(`${API}/recipes/world-danish-pancake`)
  ).json()
  expect(feed.posts).toHaveLength(0)
  const shared = `缓存公开记录-${Date.now()}`
  await publish(page, shared)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await page.reload()
  await expect(ownPost(page, old)).toBeVisible()
  await expect(ownPost(page, shared)).toBeVisible()
  await expect(page.locator('.k-rating .k-community-error')).toContainText(
    '暂时无法连接',
  )
  await expect(page.locator('.k-rating button').first()).toBeDisabled()
  await context.setOffline(false)
})

test('server pagination loads every record once at phone and desktop widths', async ({
  page,
}) => {
  await open(page, 'kung-pao')
  const token = await page.evaluate(() =>
    localStorage.getItem('deepcook-community-visitor-v1'),
  )
  const stamp = `分页-${Date.now()}-`
  for (let n = 0; n < 13; n++) {
    const response = await page.request.post(`${API}/recipes/kung-pao/posts`, {
      headers: {
        Origin: 'http://127.0.0.1:4173',
        Authorization: `Bearer ${token}`,
      },
      data: {
        id: `post-${crypto.randomUUID()}`,
        submission: false,
        text: stamp + n,
      },
    })
    expect(response.ok()).toBeTruthy()
  }
  await page.getByRole('button', { name: '刷新交流 ↻' }).click()
  await expect(
    page.locator('.k-community-card[aria-label="菜谱评论"] h3 > span'),
  ).toHaveText('13')
  for (
    let n = 0;
    n < 5 &&
    (await page.getByRole('button', { name: '查看更多评论 ↓' }).count());
    n++
  ) {
    await page.getByRole('button', { name: '查看更多评论 ↓' }).click()
  }
  const posts = page.locator('.k-community-post').filter({ hasText: stamp })
  await expect(posts).toHaveCount(13)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.locator('#community').scrollIntoViewIfNeeded()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
})
