import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const KEY = 'slow-arcade-rps-v1'
const libraryUrl = process.env.RPS_QA_URL || './'
const entryUrl = (() => {
  if (!process.env.RPS_QA_URL) return './#/rock-paper-scissors'
  const url = new URL(process.env.RPS_QA_URL)
  url.hash = '/rock-paper-scissors'
  return url.href
})()
const outputDirectory = process.env.RPS_QA_OUTPUT_DIR || fileURLToPath(new URL('../../../../outputs/', import.meta.url))
const views = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'compact-portrait', width: 320, height: 568 },
  { name: 'compact-landscape', width: 568, height: 320 },
]

test.beforeEach(async ({ page }) => {
  // A deterministic browser environment controls only the computer's source of
  // randomness; tests still use the same real UI and match transition code.
  await page.addInitScript(() => { Math.random = () => 0.01 })
})

const game = page => page.locator('.rps-game')
const stored = page => page.evaluate(key => {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}, KEY)
const scores = async (page, player, computer) => {
  await expect(page.getByTestId('rps-player-score')).toHaveText(new RegExp(`^${player}\\s*/\\s*3$`))
  await expect(page.getByTestId('rps-computer-score')).toHaveText(new RegExp(`^${computer}\\s*/\\s*3$`))
}
const history = async (page, count) => {
  await expect(page.getByTestId('rps-history-count')).toHaveText(`${count} ${count === 1 ? 'throw' : 'throws'}`)
}
const streaks = async (page, current, best) => {
  await expect(page.getByTestId('rps-current-streak')).toHaveText(String(current))
  await expect(page.getByTestId('rps-best-streak')).toHaveText(String(best))
}
const screenshot = async (page, name) => {
  await mkdir(outputDirectory, { recursive: true })
  await page.screenshot({ path: path.join(outputDirectory, `rps-${name}.png`), fullPage: true })
}
async function openRps(page) {
  await page.goto(entryUrl)
  await expect(game(page)).toHaveAttribute('data-phase', 'title')
  await expect(page.getByRole('textbox', { name: 'Your name (optional)' })).toBeVisible()
}
async function start(page, name) {
  await openRps(page)
  if (name !== undefined) {
    const input = page.getByRole('textbox', { name: 'Your name (optional)' })
    await input.fill(name)
    await input.press('Enter')
  } else await page.getByRole('button', { name: 'Start match', exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByRole('button', { name: 'Rock', exact: true })).toBeFocused()
}
async function choose(page, choice) {
  await expect(game(page)).toHaveAttribute('data-phase', 'ready')
  await page.getByRole('button', { name: choice, exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', /^(reveal|complete)$/)
}
async function next(page) {
  await page.getByRole('button', { name: 'Next round', exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByRole('button', { name: 'Rock', exact: true })).toBeFocused()
}
async function finishMatch(page, choice) {
  for (let round = 0; round < 3; round++) {
    await choose(page, choice)
    if (round < 2) await next(page)
  }
  await expect(game(page)).toHaveAttribute('data-phase', 'complete')
  await expect(page.getByRole('button', { name: 'Play again', exact: true })).toBeFocused()
}
async function fits(page, names) {
  const viewport = page.viewportSize()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const measurements = []
  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    const bounds = await button.boundingBox()
    expect.soft(bounds.width, `${name} target width`).toBeGreaterThanOrEqual(44)
    expect.soft(bounds.height, `${name} target height`).toBeGreaterThanOrEqual(44)
    expect.soft(bounds.x, `${name} left edge`).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.x + bounds.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width + 1)
    expect.soft(bounds.y, `${name} top edge`).toBeGreaterThanOrEqual(0)
    expect.soft(bounds.y + bounds.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height + 1)
    measurements.push({ name, ...bounds })
  }
  return measurements
}
async function handLabelsDoNotOverlap(page) {
  for (const contender of await page.locator('.rps-contender').all()) {
    const hand = await contender.locator('.rps-hand svg').boundingBox()
    const name = await contender.locator(':scope > span').boundingBox()
    const label = await contender.locator(':scope > strong').boundingBox()
    expect.soft(name.y + name.height, 'contender name must sit above the hand').toBeLessThanOrEqual(hand.y + 1)
    expect.soft(hand.y + hand.height, 'hand must not obscure the choice label').toBeLessThanOrEqual(label.y + 1)
  }
}

test('library routes to a lazy RPS module and loads custom artwork at the production base path', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = []
  const scripts = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  page.on('request', request => { if (/\.js(?:$|\?)/.test(request.url())) scripts.push(request.url()) })
  await page.goto(libraryUrl)
  await expect(page.locator('.game-card')).toHaveCount(6)
  await expect(page.getByText('Coming later', { exact: true })).toHaveCount(4)
  await expect(page.getByText('Ready to play', { exact: true })).toHaveCount(2)
  expect(scripts.some(url => /RockPaperScissors-|IslandDrift-|three/i.test(url))).toBe(false)
  await mkdir(outputDirectory, { recursive: true })
  await page.locator('.intro').screenshot({ path: path.join(outputDirectory, 'rps-library-hero-desktop.png') })
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('.intro').screenshot({ path: path.join(outputDirectory, 'rps-library-hero-compact.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Play Rock Paper Scissors', exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', 'title')
  expect(scripts.some(url => /RockPaperScissors-/.test(url))).toBe(true)
  expect(scripts.some(url => /IslandDrift-|three/i.test(url))).toBe(false)
  const painting = page.locator('.rps-intro-art img')
  await expect.poll(() => painting.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  expect(await painting.getAttribute('src')).toContain('/rock-paper-scissors-game/art/rps/duel-card.svg')
  await screenshot(page, 'title-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  await screenshot(page, 'title-phone')
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await screenshot(page, 'title-compact')
  await page.locator('.rps-help summary').click()
  await expect(page.locator('.rps-help')).toHaveAttribute('open', '')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await screenshot(page, 'instructions-compact')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Back to games', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/A little play/)
  await page.getByRole('button', { name: 'Play Rock Paper Scissors from collection', exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', 'title')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/A little play/)
  await page.goForward()
  await expect(game(page)).toHaveAttribute('data-phase', 'title')
  expect(errors).toEqual([])
})

test('a complete named match handles ties, five decisive rounds, live results and play again', async ({ page }) => {
  await start(page, '  Waqar  ')
  await scores(page, 0, 0)
  await history(page, 0)
  const result = page.getByTestId('rps-result')
  await expect(result).toHaveAttribute('role', 'status')
  await expect(result).toHaveAttribute('aria-live', 'polite')
  await expect(result).toHaveAttribute('aria-atomic', 'true')
  await expect(page.getByTestId('rps-player-score')).toHaveAttribute('aria-label', 'Waqar: 0 round wins')
  await choose(page, 'Rock')
  await expect(result).toContainText('Same hand. Try again.')
  await scores(page, 0, 0)
  await history(page, 1)
  await expect(page.getByRole('button', { name: 'Next round', exact: true })).toBeFocused()
  for (const choice of ['Rock', 'Paper', 'Scissors']) await expect(page.getByRole('button', { name: choice, exact: true })).toBeDisabled()
  await next(page)
  const rounds = [ ['Paper', 1, 0], ['Scissors', 1, 1], ['Paper', 2, 1], ['Scissors', 2, 2], ['Paper', 3, 2] ]
  for (const [index, [choice, player, computer]] of rounds.entries()) {
    await choose(page, choice)
    await scores(page, player, computer)
    await history(page, index + 2)
    if (index < rounds.length - 1) await next(page)
  }
  await expect(game(page)).toHaveAttribute('data-phase', 'complete')
  await expect(result).toContainText('Waqar wins the match!')
  await streaks(page, 1, 1)
  await screenshot(page, 'match-win-desktop')
  const saved = await stored(page)
  expect(saved.name).toBe('Waqar')
  expect(saved.match.history).toHaveLength(6)
  expect(saved.match.history.filter(round => round.outcome !== 'tie')).toHaveLength(5)
  await page.getByRole('button', { name: 'Play again', exact: true }).click()
  await scores(page, 0, 0)
  await history(page, 0)
  await streaks(page, 1, 1)
})

test('streaks count completed wins exactly once, persist on refresh and reset only after a loss', async ({ page }) => {
  await start(page)
  await finishMatch(page, 'Paper')
  await streaks(page, 1, 1)
  await page.getByRole('button', { name: 'Play again', exact: true }).click()
  await finishMatch(page, 'Paper')
  await streaks(page, 2, 2)
  await page.reload()
  await streaks(page, 2, 2)
  await page.getByRole('button', { name: 'Resume match', exact: true }).click()
  await streaks(page, 2, 2)
  await expect(page.getByTestId('rps-result')).toContainText('You win the match!')
  await page.getByRole('button', { name: 'Play again', exact: true }).click()
  await choose(page, 'Scissors')
  await streaks(page, 2, 2)
  await next(page)
  await choose(page, 'Scissors')
  await next(page)
  await choose(page, 'Scissors')
  await expect(page.getByTestId('rps-result')).toContainText('Computer wins the match')
  await streaks(page, 0, 2)
  await page.reload()
  await streaks(page, 0, 2)
  await page.getByRole('button', { name: 'Resume match', exact: true }).click()
  await streaks(page, 0, 2)
  await scores(page, 0, 3)
})

test('refresh, restart, sound and return navigation preserve supported progress without stale input', async ({ page }) => {
  await start(page, 'Marina')
  await choose(page, 'Paper')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Your name (optional)' })).toHaveValue('Marina')
  await page.getByRole('button', { name: 'Resume match', exact: true }).click()
  await scores(page, 1, 0)
  await history(page, 1)
  await expect(game(page)).toHaveAttribute('data-phase', 'reveal')
  await next(page)
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Resume match', exact: true }).click()
  await expect(game(page)).toHaveAttribute('data-phase', 'ready')
  await scores(page, 1, 0)
  await page.getByRole('button', { name: 'Restart match', exact: true }).click()
  await scores(page, 0, 0)
  await history(page, 0)
  await expect(page.getByRole('button', { name: 'Rock', exact: true })).toBeFocused()
  await choose(page, 'Paper')
  await next(page)
  await page.getByRole('button', { name: 'Back to games', exact: true }).click()
  await expect(game(page)).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  const before = await stored(page)
  await page.keyboard.press('p')
  await page.keyboard.press('2')
  expect(await stored(page)).toEqual(before)
  await page.getByRole('button', { name: 'Play Rock Paper Scissors', exact: true }).click()
  await page.getByRole('button', { name: 'Resume match', exact: true }).click()
  await scores(page, 1, 0)
  await history(page, 1)
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('keyboard alternatives, interactive focus guards, modifiers, repeats and rapid choices are safe', async ({ page }) => {
  await start(page)
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
    await page.dispatchEvent('body', 'keydown', { key: 'p', [modifier]: true })
  }
  await page.dispatchEvent('body', 'keydown', { key: 'p', repeat: true })
  await history(page, 0)
  const help = page.locator('.rps-help summary')
  await help.focus()
  await page.keyboard.press('p')
  await history(page, 0)
  await page.getByRole('button', { name: 'Rock', exact: true }).focus()
  const keyboardRounds = [ ['1', 0, 0], ['2', 1, 0], ['3', 1, 1], ['r', 1, 1], ['p', 2, 1], ['s', 2, 2] ]
  for (const [index, [key, player, computer]] of keyboardRounds.entries()) {
    await page.keyboard.press(key)
    await scores(page, player, computer)
    await history(page, index + 1)
    await next(page)
  }
  await page.getByRole('button', { name: 'Restart match', exact: true }).click()
  await page.getByRole('button', { name: 'Paper', exact: true }).evaluate(button => { button.click(); button.click(); button.click() })
  await scores(page, 1, 0)
  await history(page, 1)
  await page.keyboard.press('2')
  await page.keyboard.press('p')
  await history(page, 1)
  await next(page)
  await page.dispatchEvent('body', 'keydown', { key: 'P' })
  await scores(page, 2, 0)
  await history(page, 2)
})

test('native sound contexts start on request and close after mute and return to games', async ({ page }) => {
  await page.addInitScript(() => {
    const contexts = []
    const NativeAudioContext = window.AudioContext
    if (NativeAudioContext) {
      window.AudioContext = class ObservedAudioContext extends NativeAudioContext {
        constructor(...args) { super(...args); contexts.push(this) }
      }
    }
    // This test-only observer retains native contexts for read-only lifecycle
    // assertions. It never exposes or changes the application's match state.
    Object.defineProperty(window, Symbol.for('rps.qa.audioContexts'), { value: contexts })
  })
  const audioStates = () => page.evaluate(() => window[Symbol.for('rps.qa.audioContexts')].map(context => context.state))
  await start(page)
  expect(await audioStates()).toEqual([])
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  expect(await audioStates()).toEqual([])
  await choose(page, 'Paper')
  await expect.poll(audioStates).toEqual(['running'])
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await expect.poll(audioStates).toEqual(['closed'])
  await next(page)
  await page.getByRole('button', { name: 'Sound', exact: true }).click()
  await choose(page, 'Paper')
  await expect.poll(audioStates).toEqual(['closed', 'running'])
  await page.getByRole('button', { name: 'Back to games', exact: true }).click()
  await expect(game(page)).toHaveCount(0)
  await expect.poll(audioStates).toEqual(['closed', 'closed'])
})

for (const [label, raw] of [
  ['malformed JSON', '{broken'],
  ['unsupported version', JSON.stringify({ version: 9, streak: 5 })],
  ['invalid history', JSON.stringify({ version: 1, streak: -4, bestStreak: 'bad', match: { phase: 'complete', scores: { player: 3, computer: 0 }, history: [{ player: 'lizard', computer: 'rock' }] } })],
]) {
  test(`${label} cannot crash the game or forge a resumed match`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: raw })
    await openRps(page)
    await streaks(page, 0, 0)
    await page.getByRole('textbox', { name: 'Your name (optional)' }).fill('   ')
    await page.getByRole('button', { name: 'Start match', exact: true }).click()
    await expect(page.getByTestId('rps-player-score')).toHaveAttribute('aria-label', 'You: 0 round wins')
    await choose(page, 'Paper')
    await scores(page, 1, 0)
  })
}

test('unavailable browser storage keeps a complete session playable and explains persistence', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked in QA environment', 'SecurityError') }
  })
  await start(page)
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible()
  await finishMatch(page, 'Paper')
  await streaks(page, 1, 1)
  await page.getByRole('button', { name: 'Play again', exact: true }).click()
  await scores(page, 0, 0)
})

test('custom hand artwork, reduced motion and gameplay controls fit six representative viewports', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  const measurements = []
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(game(page)).toHaveAttribute('data-phase', 'ready')
    const buttons = await fits(page, ['Rock', 'Paper', 'Scissors', 'Restart match', 'Back to games', 'Sound'])
    await handLabelsDoNotOverlap(page)
    for (const choice of ['Rock', 'Paper', 'Scissors']) await expect(page.getByRole('button', { name: choice, exact: true }).locator('svg').first()).toBeVisible()
    const movingElements = await game(page).evaluate(root => [...root.querySelectorAll('*')].filter(element => {
      const style = getComputedStyle(element)
      return style.animationName !== 'none' && style.animationDuration.split(',').some(value => parseFloat(value) > 0.02)
    }).map(element => element.className?.baseVal ?? element.className))
    expect(movingElements, `${view.name}: decorative motion should respect reduced-motion`).toEqual([])
    await screenshot(page, `ready-${view.name}`)
    await choose(page, 'Paper')
    await fits(page, ['Next round', 'Restart match', 'Back to games'])
    await handLabelsDoNotOverlap(page)
    await screenshot(page, `result-${view.name}`)
    await next(page)
    await page.getByRole('button', { name: 'Restart match', exact: true }).click()
    await scores(page, 0, 0)
    measurements.push({ viewport: view, buttons })
  }
  await writeFile(path.join(outputDirectory, 'rps-responsive-measurements.json'), JSON.stringify(measurements, null, 2))
})

test('touch play and live rotation preserve a match, and every action remains reachable', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173/rock-paper-scissors-game/',
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  })
  try {
    const page = await context.newPage()
    await page.addInitScript(() => { Math.random = () => 0.01 })
    await openRps(page)
    await page.getByRole('button', { name: 'Start match', exact: true }).tap()
    await page.getByRole('button', { name: 'Paper', exact: true }).tap()
    await scores(page, 1, 0)
    await history(page, 1)
    await page.setViewportSize({ width: 844, height: 390 })
    await fits(page, ['Next round', 'Restart match', 'Back to games'])
    await scores(page, 1, 0)
    await page.getByRole('button', { name: 'Next round', exact: true }).tap()
    await page.getByRole('button', { name: 'Scissors', exact: true }).tap()
    await scores(page, 1, 1)
    await history(page, 2)
    await screenshot(page, 'touch-rotated-result')
  } finally { await context.close() }
})
