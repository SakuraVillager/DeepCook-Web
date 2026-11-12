import { test, expect } from '@playwright/test'

test('APP introduction fits phones, tablets and desktops with working download and browser entries', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/android/')
    await page.evaluate(() => document.fonts.ready)
    await expect(
      page.getByRole('heading', { name: /把厨房，\s*装进口袋。/ }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
    await expect(
      page.getByRole('link', { name: '先用在线版' }),
    ).toHaveAttribute('href', '../app/')
    const download = page.locator('.android-download__card a[download]')
    await expect(download).toHaveAttribute(
      'href',
      '../download/DeepCook-0.5.1-preview.apk',
    )
    await page.locator('#download').scrollIntoViewIfNeeded()
    await expect(download).toBeInViewport()
    await expect(page.locator('.android-download__note')).toContainText(
      '新版安装包将随后更新',
    )
  }
  const apk = await page.request.head('/download/DeepCook-0.5.1-preview.apk')
  expect(apk.ok()).toBeTruthy()
  expect(Number(apk.headers()['content-length'])).toBeGreaterThan(17_000_000)
  await page.goto('/android')
  await expect(page).toHaveURL(/\/android\/$/)
  await page.getByRole('link', { name: 'DeepCook 官网首页' }).click()
  await expect(page).toHaveURL(/\/index.html$/)
})

test('homepage links to the APP introduction and replaces old AI placeholders', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('deepcook-intro', '1'))
  await page.goto('/#next')
  await expect(page.locator('#next')).not.toContainText(
    /仅为设计方向|非实际功能|COMING SOON|还没有 AI/,
  )
  const cta = page.locator('#next').getByRole('link', { name: '下载 APP 体验' })
  await expect(cta).toBeInViewport()
  await cta.click()
  await expect(page).toHaveURL(/\/android\/#download$/)
  await expect(page.locator('.android-download__card')).toBeInViewport()
  await page.goto('/#download')
  await page.locator('.download-card--apk').click()
  await expect(page).toHaveURL(/\/android\/$/)
})

test('mobile APP navigation closes and reaches the correct section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/android/')
  await page.getByRole('button', { name: '打开菜单' }).click()
  await page
    .getByRole('navigation', { name: '移动端导航' })
    .getByRole('link', { name: 'AI 下厨' })
    .click()
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await expect(page).toHaveURL(/#ai$/)
  await expect(page.locator('#ai h2')).toBeInViewport()
  expect(
    await page
      .locator('body')
      .evaluate((el) => el.classList.contains('is-locked')),
  ).toBeFalsy()
})
