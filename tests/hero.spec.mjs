import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const target = process.env.HERO_QA_URL || './'
const output = process.env.HERO_QA_DIR || fileURLToPath(new URL('../../../outputs/aki/', import.meta.url))
const state = page => page.evaluate(() => window.__akiScene?.getState())
const errors = new WeakMap()
const views = [
  ['desktop',1440,900], ['tablet',768,1024], ['phone-portrait',390,844],
  ['phone-landscape',844,390], ['compact-portrait',320,568], ['compact-landscape',568,320],
]
test.beforeEach(async ({ page }) => {
  const failures = []
  errors.set(page, failures)
  page.on('pageerror', error => failures.push(error.message))
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
})
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]) })
async function ready(page) {
  await page.goto(target)
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => Boolean(window.__akiScene))).toBe(true)
  await expect.poll(async () => (await state(page)).leafArtReady).toBe(true)
  await page.locator('.landscape-image').evaluateAll(images => Promise.all(images.map(image => image.decode())))
}
async function capture(page, name) {
  await mkdir(output, { recursive:true })
  await page.screenshot({ path:path.join(output, `aki-${name}.png`), fullPage:true, scale:'css' })
}
async function expectFits(page, names) {
  const size = page.viewportSize()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  for (const name of names) {
    const button = page.getByRole('button', { name, exact:true })
    await expect(button).toBeVisible()
    const box = await button.boundingBox()
    expect.soft(box.width, `${name} width`).toBeGreaterThanOrEqual(44)
    expect.soft(box.height, `${name} height`).toBeGreaterThanOrEqual(44)
    expect.soft(box.x, name).toBeGreaterThanOrEqual(0)
    expect.soft(box.y, name).toBeGreaterThanOrEqual(0)
    expect.soft(box.x+box.width, name).toBeLessThanOrEqual(size.width+1)
    expect.soft(box.y+box.height, name).toBeLessThanOrEqual(size.height+1)
    expect.soft(await button.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))
    }), `${name} must not be covered`).toBe(true)
  }
}

test('real HTML, generated artwork, settings, day/dusk, pause and persisted preferences work', async ({page}) => {
  await ready(page)
  await expect(page.getByRole('heading', {level:1})).toHaveText(/Let the world.*fall quiet/)
  expect(await page.locator('canvas').count()).toBe(1)
  expect(await page.evaluate(() => document.fonts.check('20px Cormorant') && document.fonts.check('12px DM'))).toBe(true)
  await capture(page,'daylight-desktop')
  await page.getByRole('button',{name:'Set the mood',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const slider = page.getByRole('slider',{name:'Wind strength'})
  await slider.focus(); await page.keyboard.press('End')
  await expect(page.locator('output')).toHaveText('100%')
  expect((await state(page)).wind).toBe(1)
  await page.getByRole('button',{name:'Dusk',exact:true}).click()
  await expect.poll(async()=> (await state(page)).dusk).toBe(1)
  await page.getByRole('button',{name:'Back to the moment',exact:true}).click()
  await expect(page.getByRole('button',{name:'Set the mood',exact:true})).toBeFocused()
  await capture(page,'dusk-desktop')
  await page.getByRole('button',{name:'Pause motion',exact:true}).click()
  const paused = await state(page)
  await page.waitForTimeout(350)
  expect((await state(page)).frames).toBe(paused.frames)
  expect((await state(page)).grassTip).toBe(paused.grassTip)
  await page.getByRole('button',{name:'Switch to daylight',exact:true}).click()
  expect((await state(page)).dusk).toBe(0)
  await page.getByRole('button',{name:'Resume motion',exact:true}).click()
  await expect.poll(async()=> (await state(page)).frames).toBeGreaterThan(paused.frames+3)
  await page.getByRole('button',{name:'Switch to dusk',exact:true}).click()
  await page.reload()
  await expect(page.getByRole('button',{name:'Switch to daylight',exact:true})).toBeVisible()
  expect((await state(page)).wind).toBe(1)
})

test('individual leaves, foreground grass, haze, wind, parallax and nearby interaction really animate', async ({page}) => {
  await ready(page)
  const before = await state(page)
  const beforeCanvas = await page.locator('canvas').evaluate(canvas=>canvas.toDataURL())
  const beforeHaze = await page.locator('.haze-front').evaluate(element=>element.style.transform)
  await page.waitForTimeout(550)
  const after = await state(page)
  expect(after.frames).toBeGreaterThan(before.frames+5)
  expect(after.elapsed).toBeGreaterThan(before.elapsed)
  expect(after.grassTip).not.toBe(before.grassTip)
  expect(await page.locator('canvas').evaluate(canvas=>canvas.toDataURL())).not.toBe(beforeCanvas)
  expect(await page.locator('.haze-front').evaluate(element=>element.style.transform)).not.toBe(beforeHaze)
  expect(after.leaves.some(leaf=>before.leaves.some(old=>old.id===leaf.id && Math.abs(leaf.y-old.y)>1))).toBe(true)
  expect(new Set(after.leaves.map(leaf=>Math.round(leaf.size))).size).toBeGreaterThan(5)
  const leaf = after.leaves.find(item=>item.x>720 && item.y>100 && item.y<650) || after.leaves[0]
  await page.mouse.move(leaf.x,leaf.y)
  await expect.poll(async()=> (await state(page)).interactions).toBeGreaterThan(after.interactions)
  await page.mouse.move(1280,180)
  await expect.poll(async()=> Math.abs((await state(page)).parallax.x)).toBeGreaterThan(.15)
  await page.getByRole('button',{name:'Adjust wind strength',exact:true}).click()
  const slider=page.getByRole('slider',{name:'Wind strength'})
  await slider.focus(); await page.keyboard.press('Home')
  expect((await state(page)).wind).toBe(0)
  await page.keyboard.press('End')
  expect((await state(page)).wind).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button',{name:'Adjust wind strength',exact:true})).toBeFocused()
})

test('magnetic buttons, press feedback, underlines and immersive keyboard exit work', async ({page}) => {
  await ready(page)
  const enter=page.getByRole('button',{name:'Enter the scenery',exact:true})
  await enter.hover()
  const box=await enter.boundingBox()
  await page.mouse.move(box.x+box.width*.8,box.y+box.height*.7)
  expect(await enter.evaluate(element=>parseFloat(element.style.getPropertyValue('--mx')))).toBeGreaterThan(1)
  const mood=page.getByRole('button',{name:'Set the mood',exact:true})
  await mood.hover(); await page.waitForTimeout(350)
  expect(await mood.evaluate(element=>getComputedStyle(element,'::after').transform)).not.toBe('matrix(0, 0, 0, 1, 0, 0)')
  await enter.hover(); await page.mouse.down(); await page.waitForTimeout(240)
  expect(await enter.evaluate(element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBeLessThan(.995)
  await page.mouse.up()
  await expect(page.locator('.hero')).toHaveClass(/is-immersive/)
  const exit=page.getByRole('button',{name:'Exit scenery Esc',exact:true})
  await expect(exit).toBeFocused()
  await expect(page.locator('.interface')).toHaveAttribute('inert','')
  await capture(page,'immersive-desktop')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Pause motion in scenery',exact:true})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(enter).toBeFocused()
  await page.getByRole('button',{name:'Scenery view',exact:true}).click()
  await exit.click()
  await expect(enter).toBeFocused()
})

test('desktop, tablet and phone layouts preserve controls, artwork and resolution limits through resizing', async ({page}) => {
  test.setTimeout(120_000)
  await ready(page)
  const measurements=[]
  for (const [name,width,height] of views) {
    await page.setViewportSize({width,height})
    await page.locator('.landscape-image').evaluateAll(images=>Promise.all(images.map(image=>image.decode())))
    await expect.poll(async()=>Math.round((await state(page)).width)).toBe(width)
    await expectFits(page,['Enter the scenery','Set the mood','Scenery view','Adjust wind strength','Switch to dusk','Pause motion'])
    expect(await page.getByRole('heading',{level:1}).evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
    const snapshot=await state(page)
    expect(snapshot.leafCount).toBe(width<768 ? 25 : 52)
    expect(snapshot.ratio).toBeLessThanOrEqual(width<768 ? 1.25 : 1.6)
    const source=await page.locator('.daylight-image img').evaluate(image=>image.currentSrc)
    expect(source.includes('portrait')).toBe(width/height<=.75)
    await capture(page,`daylight-${name}`)
    await page.getByRole('button',{name:'Switch to dusk',exact:true}).click()
    await expect.poll(async()=> (await state(page)).dusk).toBe(1)
    await capture(page,`dusk-${name}`)
    await page.getByRole('button',{name:'Switch to daylight',exact:true}).click()
    await expect.poll(async()=> (await state(page)).dusk).toBe(0)
    measurements.push({name,width,height,leaves:snapshot.leafCount,grass:snapshot.grassCount,ratio:snapshot.ratio,source})
  }
  await mkdir(output,{recursive:true})
  await writeFile(path.join(output,'responsive-measurements.json'),JSON.stringify(measurements,null,2))
})

test('reduced motion starts still, explicit play works, and hidden-tab rendering safely stops and resumes', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>{
    let hidden=false
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'})
    window.__qaVisibility=next=>{hidden=next;document.dispatchEvent(new Event('visibilitychange'))}
  })
  await ready(page)
  const still=await state(page)
  expect(still.running).toBe(false)
  await page.waitForTimeout(250)
  expect((await state(page)).frames).toBe(still.frames)
  expect(await page.locator('h1').evaluate(element=>getComputedStyle(element).animationName)).toBe('none')
  await page.getByRole('button',{name:'Resume motion',exact:true}).click()
  await expect.poll(async()=> (await state(page)).frames).toBeGreaterThan(still.frames+3)
  await page.evaluate(()=>window.__qaVisibility(true))
  const hidden=await state(page)
  expect(hidden.running).toBe(false)
  await page.waitForTimeout(350)
  expect((await state(page)).frames).toBe(hidden.frames)
  await page.evaluate(()=>window.__qaVisibility(false))
  await expect.poll(async()=> (await state(page)).frames).toBeGreaterThan(hidden.frames+3)
  await page.getByRole('button',{name:'Pause motion',exact:true}).click()
  expect((await state(page)).running).toBe(false)
})

test('touch settings, wind adjustment, pause and rotation work at high device pixel ratio', async ({browser}, testInfo) => {
  const context=await browser.newContext({
    baseURL:testInfo.project.use.baseURL,viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:3,
  })
  const page=await context.newPage()
  const failures=[]
  page.on('pageerror',error=>failures.push(error.message))
  page.on('response',response=>{if(response.status()>=400)failures.push(response.url())})
  try {
    await ready(page)
    expect((await state(page)).ratio).toBeLessThanOrEqual(1.25)
    expect((await state(page)).canvasWidth).toBeLessThanOrEqual(488)
    await page.getByRole('button',{name:'Adjust wind strength',exact:true}).tap()
    const range=page.getByRole('slider',{name:'Wind strength'})
    const box=await range.boundingBox()
    await page.touchscreen.tap(box.x+box.width*.86,box.y+box.height/2)
    await expect.poll(async()=> (await state(page)).wind).toBeGreaterThan(.7)
    await page.getByRole('button',{name:'Dusk',exact:true}).tap()
    await page.getByRole('button',{name:'Pause scene motion',exact:true}).tap()
    expect((await state(page)).paused).toBe(true)
    await capture(page,'settings-phone')
    await page.getByRole('button',{name:'Close scene settings',exact:true}).tap()
    await expect(page.getByRole('button',{name:'Adjust wind strength',exact:true})).toBeFocused()
    await page.setViewportSize({width:844,height:390})
    expect((await state(page)).mode).toBe('dusk')
    await page.getByRole('button',{name:'Set the mood',exact:true}).tap()
    await capture(page,'settings-landscape')
    await page.getByRole('button',{name:'Daylight',exact:true}).tap()
    await page.getByRole('button',{name:'Resume scene motion',exact:true}).tap()
    await page.getByRole('button',{name:'Close scene settings',exact:true}).tap()
    await expectFits(page,['Enter the scenery','Set the mood','Scenery view','Adjust wind strength','Switch to dusk','Pause motion'])
    await page.getByRole('button',{name:'Enter the scenery',exact:true}).tap()
    await expect(page.getByRole('button',{name:'Exit scenery Esc',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Exit scenery Esc',exact:true}).tap()
    expect(failures).toEqual([])
  } finally { await context.close() }
})
