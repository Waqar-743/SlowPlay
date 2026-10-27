import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = process.env.ISLAND_QA_OUTPUT_DIR || 'test-results/screenshots'
const state = (page) => page.evaluate(() => window.__islandDrift?.getState())
const angleDifference = (left, right) => Math.atan2(Math.sin(left - right), Math.cos(left - right))
const entryUrl = process.env.ISLAND_QA_URL
  ? `${process.env.ISLAND_QA_URL.replace(/\/$/, '')}/#/island-drift`
  : './#/island-drift'

const views = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'compact-portrait', width: 320, height: 568 },
  { name: 'compact-landscape', width: 568, height: 320 },
]

async function openIsland(page) {
  // Visiting the same hash again is a same-document navigation; use a fresh
  // document so each viewport also verifies its own immediate start framing.
  await page.goto('about:blank')
  await page.goto(entryUrl)
  await page.getByRole('button', { name: 'Day', exact: true }).click({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Set sail', exact: true }).click({ timeout: 15_000 })
  await expect.poll(async () => (await state(page))?.running).toBe(true)
  await expect(page.locator('canvas')).toBeVisible()
}

function expectCloseFraming(snapshot, label) {
  const boat = snapshot.framing.boat
  expect.soft(boat.height, `${label}: boat needs a close foreground presence`).toBeGreaterThanOrEqual(0.25)
  expect.soft(boat.height, `${label}: close camera must preserve navigable water`).toBeLessThanOrEqual(0.48)
  expect.soft(boat.left, `${label}: port side is clipped`).toBeGreaterThanOrEqual(0.015)
  expect.soft(boat.right, `${label}: starboard side is clipped`).toBeLessThanOrEqual(0.985)
  expect.soft(boat.top, `${label}: helmsman is clipped`).toBeGreaterThanOrEqual(0.08)
  expect.soft(boat.bottom, `${label}: stern is clipped`).toBeLessThanOrEqual(0.96)
  expect.soft((boat.left + boat.right) / 2, `${label}: boat should stay near the middle of the navigation view`).toBeGreaterThan(0.35)
  expect.soft((boat.left + boat.right) / 2).toBeLessThan(0.65)
  expect.soft((boat.top + boat.bottom) / 2, `${label}: boat should occupy the lower foreground`).toBeGreaterThan(0.48)
}

async function expectControlsFit(page) {
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const viewport = page.viewportSize()
  for (const name of ['Steer left', 'Steer right', 'Brake or reverse', 'Sail forward', 'Pause sailing', 'Reset boat']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    const bounds = await button.boundingBox()
    expect.soft(bounds.x, `${name}: outside the left edge`).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.x + bounds.width, `${name}: outside the right edge`).toBeLessThanOrEqual(viewport.width + 1)
    expect.soft(bounds.y, `${name}: outside the top edge`).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.y + bounds.height, `${name}: outside the bottom edge`).toBeLessThanOrEqual(viewport.height + 1)
  }
  for (const name of ['Steer left', 'Steer right', 'Brake or reverse', 'Sail forward']) {
    const bounds = await page.getByRole('button', { name, exact: true }).boundingBox()
    expect.soft(bounds.width).toBeGreaterThanOrEqual(44)
    expect.soft(bounds.height).toBeGreaterThanOrEqual(44)
  }
}

async function expectBoatNotCoveredByHud(page, snapshot) {
  const canvas = await page.locator('canvas').boundingBox()
  const boat = snapshot.framing.boat
  const bounds = { left: canvas.x + boat.left * canvas.width, right: canvas.x + boat.right * canvas.width, top: canvas.y + boat.top * canvas.height, bottom: canvas.y + boat.bottom * canvas.height }
  for (const selector of ['.id-hud-left', '.id-hud-actions', '.id-compass', '.id-speed']) {
    const hud = await page.locator(selector).boundingBox()
    if (!hud) continue
    const overlapWidth = Math.max(0, Math.min(bounds.right, hud.x + hud.width) - Math.max(bounds.left, hud.x))
    const overlapHeight = Math.max(0, Math.min(bounds.bottom, hud.y + hud.height) - Math.max(bounds.top, hud.y))
    expect.soft(overlapWidth * overlapHeight, `${selector} covers the boat`).toBe(0)
  }
}

test('the close camera starts near the boat and stays readable in both modes at all screen sizes', async ({ page }) => {
  test.setTimeout(300_000)
  const failures = []
  const measurements = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
  await mkdir(outputDirectory, { recursive: true })
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height })
    await openIsland(page)
    const initial = await state(page)
    expectCloseFraming(initial, `${view.name} immediately after start`)
    await expectControlsFit(page)
    await page.waitForTimeout(500)
    const day = await state(page)
    expectCloseFraming(day, `${view.name} day`)
    await expectBoatNotCoveredByHud(page, day)
    await page.screenshot({ path: path.join(outputDirectory, `island-drift-close-day-${view.name}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Switch to night mode', exact: true }).click()
    await expect.poll(async () => (await state(page)).mode).toBe('night')
    await page.waitForTimeout(1700)
    const night = await state(page)
    expectCloseFraming(night, `${view.name} night`)
    await expectBoatNotCoveredByHud(page, night)
    await expectControlsFit(page)
    await page.screenshot({ path: path.join(outputDirectory, `island-drift-close-night-${view.name}.png`), fullPage: true })
    measurements.push({ viewport: view, initial: initial.framing, day: day.framing, night: night.framing })
    await writeFile(path.join(outputDirectory, 'close-camera-measurements.json'), JSON.stringify(measurements, null, 2))
  }
  expect(failures).toEqual([])
})

test('the close camera follows turns, preserves the boat in frame, and resets without a distant fly-in', async ({ page }) => {
  test.setTimeout(75_000)
  await page.setViewportSize({ width: 844, height: 390 })
  await openIsland(page)
  const initial = await state(page)
  expectCloseFraming(initial, 'before turning')
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await state(page)).heading, { timeout: 20_000 }).toBeGreaterThan(1.2)
  await page.keyboard.up('ArrowRight')
  await expect.poll(async () => {
    const current = await state(page)
    return Math.abs(angleDifference(current.camera.heading, current.heading))
  }).toBeLessThan(0.12)
  const turned = await state(page)
  expect(Math.abs(angleDifference(turned.camera.heading, initial.camera.heading))).toBeGreaterThan(1)
  expectCloseFraming(turned, 'after turning')
  await page.keyboard.down('ArrowUp')
  await expect.poll(async () => (await state(page)).distance).toBeGreaterThan(2)
  await page.keyboard.up('ArrowUp')
  const underway = await state(page)
  expectCloseFraming(underway, 'underway')
  await page.getByRole('button', { name: 'Reset boat', exact: true }).click()
  const reset = await state(page)
  expect(reset.x).toBe(0)
  expect(reset.z).toBe(42)
  expect(reset.speed).toBe(0)
  expect(reset.distance).toBeGreaterThanOrEqual(underway.distance)
  expectCloseFraming(reset, 'immediately after reset')
  await page.getByRole('button', { name: 'Pause sailing', exact: true }).click()
  const paused = await state(page)
  await page.waitForTimeout(450)
  const still = await state(page)
  expect(still.x).toBe(paused.x)
  expect(still.z).toBe(paused.z)
  await page.locator('.id-pause-card').getByRole('button', { name: 'Restart voyage', exact: true }).click()
  expectCloseFraming(await state(page), 'immediately after restart')
  expect((await state(page)).distance).toBe(0)
})
