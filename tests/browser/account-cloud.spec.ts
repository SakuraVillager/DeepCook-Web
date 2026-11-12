import { test, expect, type Page } from '@playwright/test'
const API = 'http://127.0.0.1:4199/deepcook-api/v1'
const PASSWORD = 'a long test kitchen password 123'
test.use({ reducedMotion: 'reduce' })
async function open(page: Page, path = '/profile') {
  await page.goto(`/app/#${path}`)
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await expect(page.locator('.k-storage-alert')).toHaveCount(0)
}
async function accountForm(
  page: Page,
  username: string,
  register = false,
  merge = false,
) {
  await open(page)
  await page
    .getByRole('button', {
      name: register ? '注册账号 ↗' : '登录 ↗',
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(register ? /#\/register\?/ : /#\/login\?/)
  const form = page.locator('.k-auth-form')
  await form
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill(username)
  await form.getByLabel('密码', { exact: true }).fill(PASSWORD)
  if (register) {
    await form.getByLabel('再次输入密码', { exact: true }).fill(PASSWORD)
    await form
      .getByRole('textbox', { name: '账号昵称', exact: true })
      .fill('初始厨房')
  }
  await form.getByRole('checkbox').setChecked(merge)
  await form
    .getByRole('button', {
      name: register ? '创建账号' : '登录账号',
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/#\/profile$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.k-account')).toContainText('@' + username)
}
async function cloud(page: Page) {
  return (await page.request.get(API + '/account/data')).json()
}
async function photoFixture(page: Page) {
  return {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 300
        canvas.height = 300
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#c36f29'
        ctx.fillRect(0, 0, 300, 300)
        return canvas.toDataURL('image/png').split(',')[1]!
      }),
      'base64',
    ),
  }
}

test('account forms fit phone, tablet and desktop widths', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '注册账号 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/register\?/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page
      .locator('.k-auth-form')
      .getByRole('button', { name: '创建账号', exact: true })
      .scrollIntoViewIfNeeded()
    await expect(
      page
        .locator('.k-auth-form')
        .getByRole('button', { name: '创建账号', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
    expect(
      await page
        .locator('.k-auth-form')
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBeTruthy()
    if (width !== 768) {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
      await page.screenshot({
        path: test.info().outputPath(`registration-${width}.png`),
      })
    }
  }
})

test('registration imports the guest kitchen and all private data follows the account across browsers', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000)
  const username = 'kitchen_' + crypto.randomUUID().slice(0, 8)
  const recipe = 'world-ukrainian-borscht'
  await open(page, '/recipe/' + recipe)
  await page.getByRole('button', { name: '收藏这道菜', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '已收藏', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '评价一下 ↗' }).click()
  await page.getByRole('slider', { name: '我的评分', exact: true }).fill('9')
  await page.getByRole('button', { name: '发布评分', exact: true }).click()
  const note = '账号归属-' + username
  await page.getByRole('button', { name: '写评论 ↗' }).click()
  await page.getByRole('textbox', { name: '评论内容', exact: true }).fill(note)
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await accountForm(page, username, true, true)
  await expect
    .poll(async () =>
      (await cloud(page)).data.favorites.some(
        (r: { recipeId: string }) => r.recipeId === recipe,
      ),
    )
    .toBeTruthy()
  await page.getByRole('textbox', { name: '厨房昵称' }).fill('跨设备厨房')
  await page.getByRole('button', { name: '保存 ↗', exact: true }).click()
  await expect(page.locator('.k-profile-card h2')).toHaveText('跨设备厨房')
  await page
    .getByRole('group', { name: '喜欢这些味道' })
    .getByRole('button', { name: '甜', exact: true })
    .click()
  await expect(
    page
      .getByRole('group', { name: '喜欢这些味道' })
      .getByRole('button', { name: '甜', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .locator('.k-profile-photo-actions input[type=file]')
    .setInputFiles(await photoFixture(page))
  await page.getByRole('button', { name: '保存头像', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByAltText('我的头像')).toHaveAttribute(
    'src',
    /\/account\/media\/[a-f0-9]{64}\.jpg$/,
  )
  await expect(page.locator('.header-account__name')).toHaveText('跨设备厨房')
  await expect(page.locator('.header-account__avatar img')).toHaveAttribute(
    'src',
    /\/account\/media\//,
  )
  await open(page, '/settings')
  await page
    .getByRole('combobox', { name: '明暗模式', exact: true })
    .selectOption('dark')
  await expect(
    page.getByRole('combobox', { name: '明暗模式', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('combobox', { name: '正文字号', exact: true })
    .selectOption('large')
  await expect(
    page.getByRole('combobox', { name: '正文字号', exact: true }),
  ).toBeEnabled()
  await open(page, '/edit/new')
  await page.locator('input[required]').fill('跨设备的拿手菜')
  await page.getByRole('button', { name: '家常菜', exact: true }).click()
  await page.getByLabel('材料 1', { exact: true }).fill('鸡蛋')
  await page
    .locator('.k-cover-editor input[type=file]')
    .setInputFiles(await photoFixture(page))
  await page
    .getByRole('textbox', { name: '操作正文', exact: true })
    .first()
    .fill('小火煎熟。')
  await page.getByRole('button', { name: '保存这道菜 ↗', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/user-/)
  const ownRecipe = page.url().split('#')[1]!
  const second = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    const other = await second.newPage()
    await accountForm(other, username)
    await expect(other.locator('.k-profile-card h2')).toHaveText('跨设备厨房')
    await expect(other.getByAltText('我的头像')).toHaveAttribute(
      'src',
      /\/account\/media\//,
    )
    await other
      .getByAltText('我的头像')
      .evaluate((image: HTMLImageElement) => image.decode())
    await expect(
      other
        .getByRole('group', { name: '喜欢这些味道' })
        .getByRole('button', { name: '甜', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    for (const width of [320, 390, 768, 1024, 1440]) {
      await other.setViewportSize({ width, height: 900 })
      await expect(other.locator('.header-account')).toBeVisible()
      await expect(other.locator('.header-account__name')).toHaveText(
        '跨设备厨房',
      )
      expect(
        await other.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy()
    }
    const remote = await cloud(other)
    expect(remote.data.preferences.theme).toBe('dark')
    expect(remote.data.preferences.readingSize).toBe('large')
    expect(
      remote.data.recent.some(
        (r: { recipeId: string }) => r.recipeId === recipe,
      ),
    ).toBeTruthy()
    expect(
      remote.data.favorites.some(
        (r: { recipeId: string }) => r.recipeId === recipe,
      ),
    ).toBeTruthy()
    expect(remote.data.recipes).toHaveLength(1)
    expect(remote.data.recipes[0].cover).toMatch(
      /^\/deepcook-api\/v1\/account\/media\//,
    )
    expect(remote.data.profile.avatar).not.toMatch(/^data:/)
    await open(other, ownRecipe)
    await expect(
      other.getByRole('heading', { name: '跨设备的拿手菜', exact: true }),
    ).toBeVisible()
    await open(other, '/recipe/' + recipe)
    await expect(
      other.getByRole('button', { name: '我的评分 9/10 ↗' }),
    ).toBeVisible()
    const post = other.locator('.k-community-post').filter({ hasText: note })
    await expect(
      post.getByRole('button', { name: '删除这条评论' }),
    ).toBeVisible()
    await open(other)
    await other.getByRole('button', { name: '退出登录 ↗' }).click()
    await expect(
      other.getByRole('button', { name: '登录 ↗', exact: true }),
    ).toBeVisible()
    await expect(other.getByAltText('我的头像')).toHaveCount(0)
    const denied = await other.request.get(
      API + remote.data.profile.avatar.replace('/deepcook-api/v1', ''),
    )
    expect(denied.status()).toBe(401)
    expect((await other.request.get(API + '/account/data')).status()).toBe(401)
  } finally {
    await second.close()
  }
})

test('a lost account save response is retried once without duplicating or reversing the change', async ({
  page,
}) => {
  const username = 'retry_' + crypto.randomUUID().slice(0, 8)
  await accountForm(page, username, true)
  let lost = false
  await page.route(API + '/account/data', async (route) => {
    if (route.request().method() !== 'PUT' || lost) return route.continue()
    lost = true
    await route.fetch()
    await route.abort('failed')
  })
  await page.getByRole('textbox', { name: '厨房昵称' }).fill('重试后的厨房')
  await page.getByRole('button', { name: '保存 ↗', exact: true }).click()
  await expect(page.locator('.k-profile-card h2')).toHaveText('重试后的厨房')
  const remote = await cloud(page)
  expect(remote.data.profile.name).toBe('重试后的厨房')
  expect(remote.revision).toBe(1)
})

test('an expired session can be left without exposing its cached kitchen as guest data', async ({
  page,
}) => {
  const username = 'expired_' + crypto.randomUUID().slice(0, 8)
  await accountForm(page, username, true)
  await page.evaluate(() =>
    window.dispatchEvent(new Event('deepcook-session-expired')),
  )
  await expect(page.getByRole('button', { name: '重新登录 ↗' })).toBeVisible()
  await page.getByRole('button', { name: '退出登录 ↗' }).click()
  await expect(
    page.getByRole('button', { name: '登录 ↗', exact: true }),
  ).toBeVisible()
  expect((await page.request.get(API + '/account/data')).status()).toBe(401)
})

test('a concurrent update rebases favorites while preserving another device preference', async ({
  page,
}) => {
  const username = 'merge_' + crypto.randomUUID().slice(0, 8)
  await accountForm(page, username, true)
  let changed = false
  await page.route(API + '/account/data', async (route) => {
    if (route.request().method() !== 'PUT' || changed) return route.continue()
    changed = true
    const snapshot = await cloud(page)
    snapshot.data.preferences.readingSize = 'extra'
    const response = await page.request.put(API + '/account/data', {
      headers: { Origin: 'http://127.0.0.1:4173' },
      data: {
        revision: snapshot.revision,
        data: snapshot.data,
        mutationId: crypto.randomUUID(),
      },
    })
    expect(response.ok()).toBeTruthy()
    await route.continue()
  })
  await open(page, '/recipe/shrimp')
  await page.getByRole('button', { name: '收藏这道菜', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '已收藏', exact: true }),
  ).toBeVisible()
  const remote = await cloud(page)
  expect(remote.data.preferences.readingSize).toBe('extra')
  expect(
    remote.data.favorites.filter(
      (r: { recipeId: string }) => r.recipeId === 'shrimp',
    ),
  ).toHaveLength(1)
})

test('the header opens dedicated account pages and returns to the original recipe after registration', async ({
  page,
}) => {
  await open(page, '/recipe/corn-soup')
  const header = page.locator('header.site-header')
  await header.getByRole('link', { name: '注册或登录', exact: true }).click()
  await expect(page).toHaveURL(/#\/login\?next=%2Frecipe%2Fcorn-soup$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .locator('.k-auth-tabs')
    .getByRole('link', { name: '注册', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/register\?next=%2Frecipe%2Fcorn-soup$/)
  const username = 'entry_' + crypto.randomUUID().slice(0, 8)
  await page
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill(username)
  await page.getByLabel('密码', { exact: true }).fill(PASSWORD)
  await page.getByLabel('再次输入密码', { exact: true }).fill(PASSWORD)
  await page
    .getByRole('textbox', { name: '账号昵称', exact: true })
    .fill('入口测试')
  await page.getByRole('checkbox').uncheck()
  await page.getByRole('button', { name: '创建账号', exact: true }).click()
  await expect(page).toHaveURL(/#\/recipe\/corn-soup$/)
  await expect(header.locator('.header-account__name')).toHaveText('入口测试')
  await expect(header.locator('.header-account__avatar')).toHaveText('入')
  await header
    .getByRole('link', { name: '进入入口测试的厨房', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/profile$/)
  await page.reload()
  await expect(header.locator('.header-account__name')).toHaveText('入口测试')
  await page.getByRole('button', { name: '退出登录 ↗' }).click()
  await expect(
    header.getByRole('link', { name: '注册或登录', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(
    header.getByRole('link', { name: '注册或登录', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '打开菜单' }).click()
  await page.locator('.mobile-menu__link--account').click()
  await expect(page).toHaveURL(/#\/login\?next=%2Fprofile$/)
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page.locator('body')).not.toHaveClass(/is-locked/)
})

test('direct registration stays usable when the recipe catalog cannot be loaded', async ({
  page,
}) => {
  await page.route('**/catalog/recipes.json', (route) => route.abort('failed'))
  await page.goto('/app/#/register?next=https%3A%2F%2Fevil.example')
  await expect(page.locator('.k-auth-form')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '创建账号', exact: true }),
  ).toBeEnabled()
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await page
    .locator('.k-auth-tabs')
    .getByRole('link', { name: '登录', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/login\?next=%2Fprofile$/)
  await page.reload()
  await expect(page.locator('.k-auth-form')).toBeVisible()
})
