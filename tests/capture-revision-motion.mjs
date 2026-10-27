import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outputDirectory = path.resolve(process.env.ISLAND_QA_OUTPUT_DIR || 'test-results/screenshots')
const baseUrl = (process.env.ISLAND_QA_URL || 'http://127.0.0.1:4173/rock-paper-scissors-game/').replace(/\/$/, '')
await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-webgl'] })
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, recordVideo: { dir: path.resolve('test-results/motion-raw'), size: { width: 844, height: 390 } } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const read = () => page.evaluate(() => window.__islandDrift?.getState())
const frames = []
const saveFrame = async (name) => {
  const snapshot = await read()
  frames.push({ name, elapsed: snapshot.elapsed, x: snapshot.x, z: snapshot.z, heading: snapshot.heading, speed: snapshot.speed, mode: snapshot.mode, lighting: snapshot.lighting, framing: snapshot.framing, camera: snapshot.camera })
  await page.screenshot({ path: path.join(outputDirectory, `island-drift-motion-${name}.png`) })
}

try {
  await page.goto(`${baseUrl}/#/island-drift`)
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await page.getByRole('button', { name: 'Set sail', exact: true }).click()
  await page.waitForFunction(() => window.__islandDrift?.getState().running)
  await page.waitForTimeout(700)
  await page.keyboard.down('ArrowUp')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(1600)
  await saveFrame('day-turn')
  await page.waitForTimeout(1200)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(900)
  await saveFrame('day-wake')
  await page.getByRole('button', { name: 'Switch to night mode', exact: true }).click()
  await page.waitForFunction(() => window.__islandDrift?.getState().lighting.nightBlend > 0.99)
  await saveFrame('night-sailing')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(1700)
  await page.keyboard.up('ArrowRight')
  await page.waitForTimeout(900)
  await saveFrame('night-turn')
  await page.keyboard.up('ArrowUp')
  await page.getByRole('button', { name: 'Pause sailing', exact: true }).click()
  await page.waitForTimeout(600)
  await writeFile(path.join(outputDirectory, 'island-drift-motion-measurements.json'), JSON.stringify({ errors, frames, caveat: 'Actual browser gameplay recorded with Chromium software WebGL at an emulated 844×390 viewport and DPR 1. This is not physical-device frame-rate evidence.' }, null, 2))
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  const video = page.video()
  await context.close()
  if (video) await video.saveAs(path.join(outputDirectory, 'island-drift-close-view-actual-play.webm'))
  await browser.close()
}
