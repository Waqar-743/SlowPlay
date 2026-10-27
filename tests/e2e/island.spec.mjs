import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// Logic regressions use fewer software-rendered pixels; the dedicated close
// camera review and the explicit multi-touch context retain DPR 1.
test.use({ deviceScaleFactor: 0.5 })

const outputDirectory = process.env.ISLAND_QA_OUTPUT_DIR || 'test-results/screenshots'
const state = (page) => page.evaluate(() => window.__islandDrift?.getState())
const saveScreenshot = async (page, name) => {
  await mkdir(outputDirectory, { recursive: true })
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true })
}
const openIsland = async (page) => {
  await page.goto('./#/island-drift')
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(async () => (await state(page))?.running).toBe(true)
}
const resume = async (page) => {
  await page.locator('.id-pause-card').getByRole('button', { name: 'Resume sailing', exact: true }).click()
  await expect.poll(async () => (await state(page)).running).toBe(true)
}
const checkFits = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  for (const name of ['Steer left', 'Steer right', 'Brake or reverse', 'Sail forward']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    const box = await button.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1)
  }
}

test('keyboard sailing, pause/resume, blur recovery, reset, settings and saved day/night work', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await openIsland(page)
  await page.keyboard.down('ArrowUp')
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(1)
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await state(page)).heading).toBeGreaterThan(0.2)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('ArrowUp')
  await page.keyboard.press('p')
  await expect.poll(async () => (await state(page)).running).toBe(false)
  await expect(page.locator('.id-pause-card').getByRole('button', { name: 'Resume sailing', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('.id-pause-card').getByRole('button', { name: 'Back to games', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.id-pause-card').getByRole('button', { name: 'Resume sailing', exact: true })).toBeFocused()
  const paused = await state(page)
  await page.waitForTimeout(450)
  expect((await state(page)).x).toBe(paused.x)
  expect((await state(page)).z).toBe(paused.z)
  await resume(page)
  const distanceBeforeRecovery = (await state(page)).distance
  await page.getByRole('button', { name: 'Reset boat', exact: true }).click()
  await expect.poll(async () => (await state(page)).speed).toBe(0)
  expect((await state(page)).x).toBe(0)
  expect((await state(page)).z).toBe(42)
  expect((await state(page)).distance).toBeGreaterThanOrEqual(distanceBeforeRecovery)
  await page.keyboard.down('w')
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(0.5)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect.poll(async () => (await state(page)).running).toBe(false)
  await page.keyboard.up('w')
  await resume(page)
  await page.getByRole('button', { name: 'Reset boat', exact: true }).click()
  await page.waitForTimeout(400)
  expect((await state(page)).speed).toBe(0)
  await page.getByRole('button', { name: 'Sailing settings', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(async () => (await state(page)).running).toBe(false)
  await page.getByRole('checkbox', { name: /Ocean sounds/ }).check()
  await page.getByRole('button', { name: 'Night mode', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Night mode', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'All set', exact: true }).click()
  await resume(page)
  await expect.poll(async () => (await state(page)).mode).toBe('night')
  await page.getByRole('button', { name: 'How to sail', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.getByRole('dialog').locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Ready to wander', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.id-dialog')).toHaveCount(0)
  await expect(page.locator('.id-pause-card').getByRole('button', { name: 'Resume sailing', exact: true })).toBeFocused()
  await page.locator('.id-pause-card').getByRole('button', { name: 'Restart voyage', exact: true }).click()
  await expect.poll(async () => (await state(page)).distance).toBe(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Night', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await expect.poll(async () => (await state(page))?.mode).toBe('night')
  await page.getByRole('button', { name: 'Sailing settings', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Ocean sounds/ })).toBeChecked()
  expect(errors).toEqual([])
})

test('day and night remain playable across desktop, tablet, phone portrait and landscape', async ({ page }) => {
  test.setTimeout(90_000)
  await openIsland(page)
  const views = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone-portrait', width: 390, height: 844 },
    { name: 'phone-landscape', width: 844, height: 390 },
  ]
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height })
    await checkFits(page)
    expect((await state(page)).running).toBe(true)
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(700)
    await saveScreenshot(page, `island-drift-day-${view.name}`)
    await page.getByRole('button', { name: 'Switch to night mode', exact: true }).click()
    await expect.poll(async () => (await state(page)).mode).toBe('night')
    await page.waitForTimeout(1700)
    await saveScreenshot(page, `island-drift-night-${view.name}`)
    await page.getByRole('button', { name: 'Switch to day mode', exact: true }).click()
    await expect.poll(async () => (await state(page)).mode).toBe('day')
    await page.waitForTimeout(1700)
  }
})

test('mobile multi-touch supports simultaneous steering/throttle, interruption and orientation change', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/rock-paper-scissors-game/', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await openIsland(page)
  const cdp = await context.newCDPSession(page)
  const throttle = await page.getByRole('button', { name: 'Sail forward', exact: true }).boundingBox()
  const right = await page.getByRole('button', { name: 'Steer right', exact: true }).boundingBox()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x: throttle.x + throttle.width / 2, y: throttle.y + throttle.height / 2, id: 1 },
    { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 2 },
  ] })
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(1)
  await expect.poll(async () => (await state(page)).heading).toBeGreaterThan(0.15)
  await expect(page.getByRole('button', { name: 'Sail forward', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Steer right', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(page.getByRole('button', { name: 'Sail forward', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Steer right', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const beforeResize = await state(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await checkFits(page)
  const afterResize = await state(page)
  expect(afterResize.distance).toBeGreaterThanOrEqual(beforeResize.distance)
  expect(afterResize.heading).toBeCloseTo(beforeResize.heading, 1)
  expect(afterResize.running).toBe(true)
  await page.getByRole('button', { name: 'Reset boat', exact: true }).click()
  await page.waitForTimeout(350)
  expect((await state(page)).speed).toBe(0)
  await context.close()
})

test('a real browser voyage completes the entire coastline with keyboard input', async ({ page }) => {
  test.setTimeout(420_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await openIsland(page)
  const held = { ArrowUp: false, ArrowRight: false, ArrowLeft: false }
  const deadline = Date.now() + 360_000
  while (Date.now() < deadline) {
    const boat = await state(page)
    if (boat.sectors.length === 16) break
    const angle = Math.atan2(boat.z, boat.x)
    const targetAngle = angle + 0.22
    const heading = Math.atan2(Math.cos(targetAngle) * 47 - boat.x, -(Math.sin(targetAngle) * 47 - boat.z))
    const error = Math.atan2(Math.sin(heading - boat.heading), Math.cos(heading - boat.heading))
    const desired = { ArrowUp: boat.speed < 7, ArrowRight: error > 0.025, ArrowLeft: error < -0.025 }
    for (const key of Object.keys(held)) {
      if (held[key] !== desired[key]) {
        await page.keyboard[desired[key] ? 'down' : 'up'](key)
        held[key] = desired[key]
      }
    }
    await page.waitForTimeout(100)
  }
  for (const key of Object.keys(held)) if (held[key]) await page.keyboard.up(key)
  const boat = await state(page)
  expect(boat.sectors, `elapsed sailing=${boat.elapsed.toFixed(1)}s; distance=${boat.distance.toFixed(1)}m`).toHaveLength(16)
  expect(boat.distance).toBeGreaterThan(240)
  await expect(page.locator('.id-progress-row')).toContainText('100%')
})

test('the running browser boat meets the shore and reverses back to clear water', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await openIsland(page)
  await page.keyboard.down('w')
  await expect(page.getByRole('status')).toContainText('Easy ashore', { timeout: 20_000 })
  await page.keyboard.up('w')
  const shore = await state(page)
  await page.keyboard.down('s')
  await expect.poll(async () => (await state(page)).z, { timeout: 10_000 }).toBeGreaterThan(shore.z + 3)
  await page.keyboard.up('s')
  expect((await state(page)).speed).toBeLessThan(0)
})

test('reduced-motion preference preserves gameplay and exposes the matching settings note', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openIsland(page)
  await page.keyboard.down('w')
  await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(0.5)
  await page.keyboard.up('w')
  const beforeChange = await state(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect((await state(page)).distance).toBeGreaterThanOrEqual(beforeChange.distance)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect((await state(page)).distance).toBeGreaterThanOrEqual(beforeChange.distance)
  await page.getByRole('button', { name: 'Sailing settings', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Reduced motion is on')
})

test('compact phone portrait and landscape keep touch controls reachable', async ({ page }) => {
  test.setTimeout(60_000)
  for (const view of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(view)
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/A little play/)
    await openIsland(page)
    if ((await state(page)).mode !== 'day') {
      await page.getByRole('button', { name: 'Switch to day mode', exact: true }).click()
      await page.waitForTimeout(1700)
    }
    await checkFits(page)
    await saveScreenshot(page, `island-drift-day-${view.width}x${view.height}`)
    await page.getByRole('button', { name: 'Switch to night mode', exact: true }).click()
    await page.waitForTimeout(1700)
    await saveScreenshot(page, `island-drift-night-${view.width}x${view.height}`)
  }
})
