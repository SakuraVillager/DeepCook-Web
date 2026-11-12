import { test, expect, type Page } from '@playwright/test'

async function openCook(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('deepcook-intro', '1'))
  await page.goto('/#cook')
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      page
        .locator('#cook')
        .evaluate((el) =>
          parseFloat(getComputedStyle(el).getPropertyValue('--cook-travel')),
        ),
    )
    .toBeGreaterThan(100)
  await expect
    .poll(() =>
      page
        .locator('.cook__viewport')
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(2)
}
async function at(page: Page, progress: number, after = 0) {
  await page.evaluate(
    ({ progress, after }) => {
      const section = document.querySelector<HTMLElement>('#cook')!
      const distance = parseFloat(
        getComputedStyle(section).getPropertyValue('--cook-travel'),
      )
      window.scrollTo({
        top:
          window.scrollY +
          section.getBoundingClientRect().top +
          distance * progress +
          after,
        behavior: 'instant',
      })
    },
    { progress, after },
  )
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
}

test('the recipe scrolls inside a screen-sized pinned chapter, then leaves with the left copy', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCook(page)
  const left = page.locator('.cook__left'),
    panel = page.locator('.cook__panel'),
    viewport = page.locator('.cook__viewport')
  const top = (await left.boundingBox())!.y
  const panelStart = (await panel.boundingBox())!.y
  const distance = await page
    .locator('#cook')
    .evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--cook-travel')),
    )
  expect((await viewport.boundingBox())!.height).toBe(1000)
  expect(
    await page
      .locator('.cook__reader')
      .evaluate((el) => getComputedStyle(el).overflowY),
  ).toBe('clip')
  for (const progress of [0.25, 0.5, 0.8]) {
    await at(page, progress)
    expect(Math.abs((await left.boundingBox())!.y - top)).toBeLessThan(2)
    expect(Math.abs((await viewport.boundingBox())!.y)).toBeLessThan(2)
    expect(
      Math.abs(
        (await panel.boundingBox())!.y - (panelStart - distance * progress),
      ),
    ).toBeLessThan(3)
    expect(
      await page.locator('.cook__reader').evaluate((el) => el.scrollTop),
    ).toBe(0)
  }
  await at(page, 1)
  await expect(page.locator('.cook__progress')).toHaveAttribute(
    'aria-valuenow',
    '6',
  )
  await expect(page.locator('.cook__panel .step').last()).toBeInViewport()
  await expect(page.locator('.cook__panel > .cook__foot')).toBeInViewport()
  await at(page, 1, 250)
  expect(Math.abs((await left.boundingBox())!.y - (top - 250))).toBeLessThan(3)
  expect(Math.abs((await viewport.boundingBox())!.y + 250)).toBeLessThan(3)
  expect((await page.locator('#understand').boundingBox())!.y).toBeCloseTo(
    750,
    0,
  )
  await at(page, 0.5)
  expect(Math.abs((await left.boundingBox())!.y - top)).toBeLessThan(2)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({ path: test.info().outputPath('cook-pinned.png') })
})

test('wheel scrolling over either column drives the recipe with smooth scrolling enabled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openCook(page)
  await expect(page.locator('.cook__reader')).toHaveCSS('opacity', '1')
  await expect(page.locator('.cook__left h2')).toHaveCSS('opacity', '1')
  const leftTop = (await page.locator('.cook__left').boundingBox())!.y
  let previous = await page.evaluate(() => window.scrollY)
  for (const selector of ['.cook__left', '.cook__reader']) {
    const rect = (await page.locator(selector).boundingBox())!
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await page.mouse.wheel(0, 180)
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(previous + 140)
    previous = await page.evaluate(() => window.scrollY)
    expect(
      Math.abs((await page.locator('.cook__left').boundingBox())!.y - leftTop),
    ).toBeLessThan(3)
  }
  expect(
    await page.locator('.cook__reader').evaluate((el) => el.scrollTop),
  ).toBe(0)
})

test('phone and tablet layouts keep the visible canvas bounded while reading the entire recipe', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height })
    await openCook(page)
    const initial = (await page.locator('.cook__left').boundingBox())!.y
    await at(page, 0.6)
    expect(
      Math.abs((await page.locator('.cook__left').boundingBox())!.y - initial),
    ).toBeLessThan(2)
    expect((await page.locator('.cook__viewport').boundingBox())!.height).toBe(
      height,
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
    await at(page, 1)
    await expect(page.locator('.cook__panel .step').last()).toBeInViewport()
    await expect(page.locator('.cook__progress')).toHaveAttribute(
      'aria-valuenow',
      '6',
    )
  }
})

test('keyboard focus reveals clipped steps without an inner scroll trap', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCook(page)
  await page.locator('.cook__panel .step').last().focus()
  await expect(page.locator('.cook__panel .step').last()).toBeInViewport()
  expect(
    await page.locator('.cook__reader').evaluate((el) => el.scrollTop),
  ).toBe(0)
})

test('touch scrolling on the recipe moves the page while its chapter stays pinned', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    await openCook(page)
    const initial = await page.evaluate(() => window.scrollY)
    const left = (await page.locator('.cook__left').boundingBox())!.y
    const rect = (await page.locator('.cook__reader').boundingBox())!
    const cdp = await context.newCDPSession(page)
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height * 0.85
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    for (let n = 1; n <= 8; n++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - n * 22 }],
      })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(initial + 100)
    expect(
      Math.abs((await page.locator('.cook__left').boundingBox())!.y - left),
    ).toBeLessThan(2)
    expect(
      await page.locator('.cook__reader').evaluate((el) => el.scrollTop),
    ).toBe(0)
  } finally {
    await context.close()
  }
})
