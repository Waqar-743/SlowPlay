import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = process.env.ISLAND_QA_OUTPUT_DIR || 'test-results/screenshots'
const screenshot = async (page, name) => {
  await mkdir(outputDirectory, { recursive: true })
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true })
}
const noHorizontalOverflow = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}
const loadedImages = async (page) => {
  const images = page.locator('img')
  for (const img of await images.all()) await img.scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('img').evaluateAll((elements) => elements.every((img) => img.complete && img.naturalWidth > 0))).toBe(true)
}
const state = (page) => page.evaluate(() => window.__islandDrift?.getState())
const openIsland = async (page) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Play Island Drift', exact: true }).click()
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(window.__islandDrift?.getState))).toBe(true)
}

test('catalogue, filters, About, images and lazy game loading use the production base path', async ({ page }) => {
  const failures = []
  const gameRequests = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
  page.on('request', (request) => { if (/IslandDrift-.*\.js/.test(request.url())) gameRequests.push(request.url()) })
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/A little play/)
  await expect(page.locator('.game-card')).toHaveCount(6)
  await expect(page.getByText('Coming later', { exact: true })).toHaveCount(5)
  expect(gameRequests).toHaveLength(0)
  await page.getByRole('link', { name: 'Find your next game', exact: true }).click()
  await expect.poll(() => page.locator('#games').evaluate((element) =>
    Math.abs(element.getBoundingClientRect().top - Number.parseFloat(getComputedStyle(element).scrollMarginTop)))).toBeLessThan(3)
  await loadedImages(page)
  await noHorizontalOverflow(page)
  await page.getByRole('button', { name: 'About this arcade' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const filter = page.getByRole('group', { name: 'Filter games by category' }).getByRole('button').nth(1)
  await filter.click()
  await expect(filter).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('.game-card').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'All games', exact: true }).click()
  await expect(page.locator('.game-card')).toHaveCount(6)
  await page.evaluate(() => window.scrollTo(0, 0))
  await screenshot(page, 'arcade-library-desktop')
  await page.getByRole('button', { name: 'Play Island Drift', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Set sail', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await expect(page.locator('canvas')).toBeVisible()
  expect(gameRequests).toHaveLength(1)
  expect(failures).toEqual([])
})

test('library fits phone portrait and landscape with visible keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await loadedImages(page)
  await noHorizontalOverflow(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await screenshot(page, 'arcade-library-phone')
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toBeVisible()
  expect(await focused.evaluate((element) => getComputedStyle(element).outlineStyle !== 'none' || getComputedStyle(element).boxShadow !== 'none')).toBe(true)
  await page.setViewportSize({ width: 844, height: 390 })
  await noHorizontalOverflow(page)
  await expect(page.getByRole('button', { name: 'Play Island Drift', exact: true })).toBeVisible()
})

test('game module and WebGL canvas clean up after returning to the collection', async ({ page }) => {
  await openIsland(page)
  await page.getByRole('button', { name: /Back to games/i }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/A little play/)
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean(window.__islandDrift))).toBe(false)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await page.keyboard.press('w')
  await page.getByRole('button', { name: 'Play Island Drift', exact: true }).click()
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
  expect((await state(page)).speed).toBe(0)
})
