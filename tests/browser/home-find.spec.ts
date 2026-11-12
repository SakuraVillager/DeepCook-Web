import { test, expect, type Page } from '@playwright/test'

async function openFind(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('deepcook-intro', '1'))
  await page.goto('/#features')
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      page
        .locator('#features')
        .evaluate((el) =>
          parseFloat(getComputedStyle(el).getPropertyValue('--find-travel')),
        ),
    )
    .toBeGreaterThan(300)
  await expect
    .poll(() =>
      page
        .locator('.find__viewport')
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(2)
}
async function at(page: Page, progress: number, after = 0) {
  await page.evaluate(
    ({ progress, after }) => {
      const el = document.querySelector('#features')!
      const travel = parseFloat(
        getComputedStyle(el).getPropertyValue('--find-travel'),
      )
      window.scrollTo({
        top:
          window.scrollY +
          el.getBoundingClientRect().top +
          travel * progress +
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

test('finish all horizontal recipes before the full-screen chapter exits, including reverse scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFind(page)
  const heading = page.locator('.find__heading'),
    screen = page.locator('.find__viewport'),
    rail = page.locator('.showcase__viewport')
  const headingY = (await heading.boundingBox())!.y
  const max = await rail.evaluate((el) => el.scrollWidth - el.clientWidth)
  for (const p of [0.25, 0.7, 1, 0.4, 0]) {
    await at(page, p)
    expect(Math.abs((await heading.boundingBox())!.y - headingY)).toBeLessThan(
      2,
    )
    expect(Math.abs((await screen.boundingBox())!.y)).toBeLessThan(2)
    expect((await screen.boundingBox())!.height).toBe(1000)
    expect(
      Math.abs((await rail.evaluate((el) => el.scrollLeft)) - max * p),
    ).toBeLessThan(2)
  }
  await at(page, 1)
  await expect(page.locator('.recipe-card').last()).toBeInViewport()
  await expect(page.locator('.showcase-card-end__cta')).toBeInViewport()
  await expect(page.getByRole('button', { name: '下一道菜' })).toBeDisabled()
  await at(page, 1, 200)
  expect(Math.abs((await screen.boundingBox())!.y + 200)).toBeLessThan(2)
  expect(
    Math.abs((await heading.boundingBox())!.y - (headingY - 200)),
  ).toBeLessThan(2)
  expect((await page.locator('#cook').boundingBox())!.y).toBeCloseTo(800, 0)
})

test('arrow controls and native horizontal scrolling share the page progress', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openFind(page)
  const initial = await page.evaluate(() => scrollY)
  await page.getByRole('button', { name: '下一道菜' }).click()
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(initial + 100)
  await expect(page.getByRole('button', { name: '上一道菜' })).toBeEnabled()
  await page.getByRole('button', { name: '上一道菜' }).click()
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeLessThan(initial + 2)
  await page.locator('.showcase__viewport').evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth
  })
  await expect(page.getByRole('button', { name: '下一道菜' })).toBeDisabled()
  await expect(page.locator('.showcase-card-end__cta')).toBeInViewport()
  expect(
    Math.abs((await page.locator('.find__viewport').boundingBox())!.y),
  ).toBeLessThan(2)
})

test('phone and tablet compositions keep the canvas pinned until the last recipe', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height })
    await openFind(page)
    const y = (await page.locator('.find__heading').boundingBox())!.y
    await at(page, 0.6)
    expect(
      Math.abs((await page.locator('.find__heading').boundingBox())!.y - y),
    ).toBeLessThan(2)
    expect((await page.locator('.find__viewport').boundingBox())!.height).toBe(
      height,
    )
    await at(page, 1)
    await expect(page.locator('.showcase-card-end__cta')).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
})

test('vertical wheel over cards advances the horizontal rail with smooth scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openFind(page)
  await expect(page.locator('.showcase')).toHaveCSS('opacity', '1')
  const y = (await page.locator('.find__heading').boundingBox())!.y
  const initial = await page.evaluate(() => scrollY)
  await page.locator('.showcase__viewport').hover()
  await page.mouse.wheel(0, 300)
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(initial + 250)
  await expect
    .poll(() =>
      page.locator('.showcase__viewport').evaluate((el) => el.scrollLeft),
    )
    .toBeGreaterThan(200)
  expect(
    Math.abs((await page.locator('.find__heading').boundingBox())!.y - y),
  ).toBeLessThan(2)
})
