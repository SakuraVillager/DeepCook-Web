import { test, expect, type Page } from '@playwright/test'

test.use({ hasTouch: true, reducedMotion: 'reduce' })

async function open(page: Page, route = '/read/braised-pork/braised-pork-s1') {
  await page.goto(`/app/#${route}`)
  await expect(page.locator('.k-loading')).toHaveCount(0)
  await expect(page.locator('.k-reader__instruction')).toBeVisible()
}

// Send real browser touch input, so native scrolling and touch-action also participate.
async function swipe(
  page: Page,
  dx: number,
  dy = 0,
  selector = '.k-reader__content',
) {
  const box = (await page.locator(selector).boundingBox())!
  const viewport = page.viewportSize()!
  const left = Math.max(26, box.x),
    right = Math.min(viewport.width - 26, box.x + box.width)
  const top = Math.max(180, box.y),
    bottom = Math.min(viewport.height - 110, box.y + box.height)
  const x = dx < 0 ? right - 30 : dx > 0 ? left + 30 : (left + right) / 2
  const y = dy < 0 ? bottom - 30 : dy > 0 ? top + 30 : (top + bottom) / 2
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 0 }],
    })
    for (let n = 1; n <= 6; n++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (dx * n) / 6, y: y + (dy * n) / 6, id: 0 }],
      })
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
}

test('phone and iPad swipes move one step, restore after reload and stop at both ends', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1180, height: 820 },
  ]) {
    await page.setViewportSize(viewport)
    await open(page)
    await expect(page.locator('.k-reader__swipe-hint')).toBeVisible()
    await swipe(page, 150)
    await expect(page.locator('.k-reader__progress')).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    await swipe(page, -150)
    await expect(page).toHaveURL(/braised-pork-s2$/)
    await expect(page.locator('.k-reader__progress')).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
    await page.reload()
    await expect(page.locator('.k-loading')).toHaveCount(0)
    await swipe(page, 150)
    await expect(page).toHaveURL(/braised-pork-s1$/)
    await open(page, '/read/braised-pork/braised-pork-s15')
    await swipe(page, -150)
    await expect(page).toHaveURL(/braised-pork-s15$/)
    await expect(
      page.getByRole('button', { name: '返回菜谱 ↗', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.k-reader__footer')).toBeInViewport()
  }
})

test('touch scrolling stays native on long phone and iPad steps and horizontal turns reset scroll', async ({
  page,
}) => {
  const catalog = (await (
    await page.request.get('/catalog/recipes.json')
  ).json()) as { id: string; steps: { id: string; text: string }[] }[]
  const longest = catalog
    .flatMap((recipe) =>
      recipe.steps.slice(0, -1).map((step, index) => ({ recipe, step, index })),
    )
    .sort((a, b) => b.step.text.length - a.step.text.length)[0]!
  for (const width of [390, 1180]) {
    await page.setViewportSize({ width, height: 844 })
    await open(page, `/read/${longest.recipe.id}/${longest.step.id}`)
    const selector = width <= 900 ? '.k-reader__content' : '.k-reader__copy'
    const scroll = page.locator(selector)
    await swipe(page, 0, -180, selector)
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    await expect(page).toHaveURL(new RegExp(`${longest.step.id}$`))
    await swipe(page, -150, 0, selector)
    await expect(page).toHaveURL(
      new RegExp(`${longest.recipe.steps[longest.index + 1]!.id}$`),
    )
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0)
  }
})

test('short, vertical, multi-touch, cancelled, selected and interactive gestures do not turn steps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '/read/braised-pork/braised-pork-s2')
  await page.evaluate(() => {
    const content = document.querySelector('.k-reader__content')!
    const fire = (
      type: string,
      points: [number, number][],
      target = content,
    ) => {
      const touches = points.map(
        ([clientX, clientY], identifier) =>
          new Touch({ identifier, target, clientX, clientY }),
      )
      target.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === 'touchend' ? [] : touches,
          changedTouches: touches,
        }),
      )
    }
    const drag = (
      start: [number, number],
      end: [number, number],
      target = content,
    ) => {
      fire('touchstart', [start], target)
      fire('touchmove', [end], target)
      fire('touchend', [end], target)
    }
    drag([250, 350], [230, 350])
    fire('touchstart', [[250, 350]])
    fire('touchmove', [[230, 390]])
    fire('touchmove', [[80, 390]])
    fire('touchend', [[80, 390]])
    fire('touchstart', [
      [250, 350],
      [280, 350],
    ])
    fire('touchmove', [[80, 350]])
    fire('touchend', [[80, 350]])
    fire('touchstart', [[250, 350]])
    fire('touchcancel', [[80, 350]])
    fire('touchend', [[80, 350]])
    drag([10, 350], [180, 350])
    const range = document.createRange()
    range.selectNodeContents(document.querySelector('.k-reader__instruction')!)
    window.getSelection()!.addRange(range)
    drag([250, 350], [80, 350])
    window.getSelection()!.removeAllRanges()
    const button = document.createElement('button')
    content.append(button)
    drag([250, 350], [80, 350], button)
    button.remove()
  })
  await expect(page).toHaveURL(/braised-pork-s2$/)
  await page.getByRole('button', { name: '步骤目录 ≡' }).click()
  await swipe(page, -150)
  await expect(page).toHaveURL(/braised-pork-s2$/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await swipe(page, -150)
  await expect(page).toHaveURL(/braised-pork-s3$/)
})

test('a swipe starting on a step photo also turns the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '/read/braised-pork/braised-pork-s9')
  await page.locator('.k-reader__visual').scrollIntoViewIfNeeded()
  await swipe(page, -150, 0, '.k-reader__visual')
  await expect(page).toHaveURL(/braised-pork-s10$/)
})
