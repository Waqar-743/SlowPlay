import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const target = process.env.HERO_QA_URL || './'
const output = process.env.HERO_QA_DIR || fileURLToPath(new URL('../../../outputs/grotto/', import.meta.url))
const state = page => page.evaluate(() => window.__grotto?.getState())
const motion = page => page.evaluate(() => window.__grottoScene?.getState())
const audio = page => page.evaluate(() => window.__grottoAudio?.getState())
const failures = new WeakMap()
const views = [
  ['desktop',1440,900], ['tablet',768,1024], ['phone-portrait',390,844],
  ['phone-landscape',844,390], ['compact-portrait',320,568], ['compact-landscape',568,320],
  ['narrow-panel',280,500], ['short-portrait',320,480],
]
const scenes = [['Hidden waterfall','waterfall'],['Rain on leaves','rain'],['Night ocean','ocean'],['Cave drips','cave']]
const button = (page,name) => page.getByRole('button',{name,exact:true})

test('navigation, pointer parallax and the immersive playback controls work',async({page})=>{
  await ready(page)
  for(const label of ['Soundscapes','Science','Teams','Pricing','Get the app']){
    await button(page,label).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(button(page,label)).toBeFocused()
  }
  await page.mouse.move(1400,40)
  await expect.poll(async()=>(await motion(page)).pointer[0]).toBeGreaterThan(.8)
  await expect.poll(async()=>(await motion(page)).pointer[1]).toBeGreaterThan(.8)
  await button(page,'Enter immersive view').click()
  await button(page,'Start focus session').click()
  await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.0001)
  await button(page,'Pause motion').click()
  expect((await motion(page)).running).toBe(false)
  await button(page,'Resume motion').click()
  await expect.poll(async()=>(await motion(page)).running).toBe(true)
  await button(page,'Pause focus session').click()
  await button(page,'Exit immersive view').click()
  await page.setViewportSize({width:390,height:844})
  await button(page,'Open navigation').click()
  await page.getByRole('dialog').getByRole('button',{name:'Science',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('A gentler working rhythm.')
  await page.keyboard.press('Escape')
  await expect(button(page,'Open navigation')).toBeFocused()
})

test('a real graphics context loss keeps the poster and recovers flowing water',async({page})=>{
  await ready(page)
  const supported=await page.evaluate(()=>{
    const extension=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context')
    if(!extension)return false
    window.__qaGraphics=extension
    extension.loseContext()
    return true
  })
  expect(supported).toBe(true)
  await expect.poll(async()=>(await motion(page)).webgl).toBe(false)
  expect((await motion(page)).running).toBe(false)
  await expect(page.locator('.grotto-canvas')).toHaveCSS('opacity','0')
  expect(await page.locator('.grotto-image').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true)
  await page.waitForTimeout(300)
  await page.evaluate(()=>window.__qaGraphics.restoreContext())
  await expect.poll(async()=>(await motion(page)).webgl).toBe(true)
  const frame=(await motion(page)).frames
  await expect.poll(async()=>(await motion(page)).frames).toBeGreaterThan(frame+3)
  expect((await motion(page)).resources).toBe(2)
  expect((await motion(page)).error).toBe('')
})

test.beforeEach(async ({page}) => {
  const errors=[]
  failures.set(page,errors)
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url())})
})
test.afterEach(async ({page}) => {expect(failures.get(page)).toEqual([])})

async function ready(page) {
  await page.goto(target)
  await page.evaluate(async()=>{await document.fonts.ready;return true})
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__grotto&&window.__grottoScene&&window.__grottoAudio))).toBe(true)
  await expect.poll(async()=>(await motion(page)).ready).toBe(true)
  expect((await motion(page)).webgl).toBe(true)
  expect((await motion(page)).error).toBe('')
  await settled(page)
}
async function settled(page) {
  await page.locator('.focus-dock').evaluate(async element=>{
    await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})))
    return true
  })
}
async function capture(page,name) {
  await mkdir(output,{recursive:true})
  await page.screenshot({path:path.join(output,'grotto-'+name+'.png'),fullPage:true,scale:'css',animations:'disabled'})
}
async function fits(page,names) {
  await settled(page)
  const viewport=page.viewportSize(),boxes=[]
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  for(const name of names){
    const control=button(page,name)
    await expect(control).toBeVisible()
    const box=await control.boundingBox()
    expect.soft(box.width,name+' width').toBeGreaterThanOrEqual(44)
    expect.soft(box.height,name+' height').toBeGreaterThanOrEqual(44)
    expect.soft(box.x,name+' left').toBeGreaterThanOrEqual(0)
    expect.soft(box.y,name+' top').toBeGreaterThanOrEqual(0)
    expect.soft(box.x+box.width,name+' right').toBeLessThanOrEqual(viewport.width+1)
    expect.soft(box.y+box.height,name+' bottom').toBeLessThanOrEqual(viewport.height+1)
    expect.soft(await control.evaluate(element=>{
      const r=element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))
    }),name+' uncovered').toBe(true)
    boxes.push({name,...box})
  }
  for(let index=0;index<boxes.length;index++)for(const other of boxes.slice(index+1)){
    const box=boxes[index]
    const width=Math.max(0,Math.min(box.x+box.width,other.x+other.width)-Math.max(box.x,other.x))
    const height=Math.max(0,Math.min(box.y+box.height,other.y+other.height)-Math.max(box.y,other.y))
    expect.soft(width*height,box.name+' overlaps '+other.name).toBeLessThanOrEqual(1)
  }
  return boxes
}
async function openSettings(page){
  await button(page,'Focus settings').click()
  await expect(page.getByRole('dialog',{name:'Make room for focus.',exact:true})).toBeVisible()
}
async function closeSettings(page){
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(button(page,'Focus settings')).toBeFocused()
}

test('local artwork, local fonts and genuinely changing WebGL frames load correctly',async({page})=>{
  await ready(page)
  await expect(page.getByRole('heading',{level:1})).toHaveText(/Sink into.*deep.*focus/)
  expect(await page.locator('canvas').count()).toBe(1)
  expect(await page.evaluate(()=>{
    const loaded=[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family.toLowerCase())
    return loaded.some(name=>name.includes('fraunces'))&&loaded.some(name=>name.includes('inter'))
  })).toBe(true)
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(item=>item.name))
  for(const asset of ['grotto.webp','grotto-depth.png'])expect(resources.some(url=>url.includes(asset))).toBe(true)
  expect(resources.filter(url=>/\.(?:ttf|woff2?)(?:\?|$)/.test(url)).every(url=>new URL(url).origin===new URL(page.url()).origin)).toBe(true)
  const before=await motion(page)
  const imageBefore=await page.locator('canvas').screenshot()
  await expect.poll(async()=>(await motion(page)).frames).toBeGreaterThan(before.frames+5)
  await expect.poll(async()=>(await motion(page)).time).toBeGreaterThan(before.time+.15)
  expect((await page.locator('canvas').screenshot()).equals(imageBefore)).toBe(false)
  expect((await audio(page)).playing).toBe(false)
  expect((await audio(page)).state).toBe('uninitialized')
  await capture(page,'waterfall-desktop')
})

test('a real user starts sound and countdown, then pauses and resumes both',async({page})=>{
  await ready(page)
  const initial=await state(page)
  expect(initial.remaining).toBe(initial.duration)
  await button(page,'Start focus session').click()
  await expect.poll(async()=>(await audio(page)).state).toBe('running')
  await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.0001)
  await expect.poll(async()=>(await state(page)).remaining,{timeout:5000}).toBeLessThan(initial.remaining)
  expect((await state(page)).playing).toBe(true)
  await button(page,'Pause focus session').click()
  const paused=await state(page)
  expect(paused.playing).toBe(false)
  await expect.poll(async()=>(await audio(page)).state).toBe('suspended')
  expect((await audio(page)).energy).toBe(0)
  await page.waitForTimeout(1200)
  expect((await state(page)).remaining).toBe(paused.remaining)
  await button(page,'Resume focus session').click()
  await expect.poll(async()=>(await state(page)).remaining,{timeout:5000}).toBeLessThan(paused.remaining)
  await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.0001)
  await button(page,'Pause focus session').click()
})

test('four scenes, audible volume, timer duration and reset have working controls',async({page})=>{
  await ready(page)
  await button(page,'Start focus session').click()
  for(const[label,id]of scenes){
    await button(page,label).click()
    await expect(button(page,label)).toHaveAttribute('aria-pressed','true')
    await expect.poll(async()=>(await state(page)).scene).toBe(id)
    expect((await motion(page)).scene).toBe(id)
    expect((await audio(page)).scene).toBe(id)
    await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.00001)
  }
  await capture(page,'cave-desktop')
  await openSettings(page)
  const volume=page.getByRole('slider',{name:'Ambient volume',exact:true})
  await volume.focus();await page.keyboard.press('Home')
  expect((await state(page)).volume).toBe(0)
  expect((await audio(page)).volume).toBe(0)
  await expect.poll(async()=>(await audio(page)).energy).toBeLessThan(.0001)
  await page.keyboard.press('End')
  expect((await state(page)).volume).toBe(1)
  expect((await audio(page)).volume).toBe(1)
  await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.00001)
  for(const minutes of[5,15,50,25]){
    await button(page,minutes+' minutes').click()
    expect((await state(page)).duration).toBe(minutes*60)
    expect((await state(page)).remaining).toBe(minutes*60)
    expect((await state(page)).playing).toBe(false)
  }
  await closeSettings(page)
  await button(page,'Start focus session').click()
  await expect.poll(async()=>(await state(page)).remaining,{timeout:5000}).toBeLessThan(1500)
  await openSettings(page)
  await page.getByRole('button',{name:/^Reset timer/}).click()
  expect((await state(page)).remaining).toBe(1500)
  expect((await state(page)).playing).toBe(false)
  await closeSettings(page)
  await page.reload()
  await expect.poll(async()=>(await state(page))?.scene).toBe('cave')
  expect((await state(page)).volume).toBe(1)
  expect((await state(page)).playing).toBe(false)
})

test('settings are keyboard operable and immersive exit restores focus',async({page})=>{
  await ready(page)
  await button(page,'Soundscapes').click()
  await expect(page.getByRole('dialog')).toContainText(/synthesi[sz]ed in your browser/i)
  await page.keyboard.press('Escape')
  await expect(button(page,'Soundscapes')).toBeFocused()
  await openSettings(page)
  await page.getByRole('slider',{name:'Ambient volume',exact:true}).focus()
  await page.keyboard.press('ArrowLeft')
  expect((await state(page)).volume).toBeLessThan(.65)
  await closeSettings(page)
  const enter=button(page,'Enter immersive view')
  await enter.focus();await page.keyboard.press('Enter')
  expect((await state(page)).immersive).toBe(true)
  const exit=button(page,'Exit immersive view')
  await expect(exit).toBeVisible();await expect(exit).toBeFocused()
  await capture(page,'immersive-desktop')
  await page.keyboard.press('Escape')
  expect((await state(page)).immersive).toBe(false)
  await expect(enter).toBeFocused()
  await enter.click();await exit.click()
  await expect(enter).toBeFocused()
})

test('eight desktop, tablet and phone viewports keep controls readable and reachable',async({page})=>{
  test.setTimeout(process.env.CI ? 240000 : 120000)
  await ready(page)
  const measurements=[]
  for(const[name,width,height]of views){
    await page.setViewportSize({width,height})
    await expect.poll(async()=>Math.round((await motion(page)).width)).toBe(width)
    const buttons=await fits(page,['Start focus session','Focus settings','Enter immersive view','Pause motion',...scenes.map(([label])=>label)])
    expect(await page.getByRole('heading',{level:1}).evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
    const renderer=await motion(page)
    expect(renderer.ratio).toBeLessThanOrEqual(width<768?1.25:1.6)
    await capture(page,'waterfall-'+name)
    await button(page,'Night ocean').click()
    await expect.poll(async()=>(await motion(page)).scene).toBe('ocean')
    await page.waitForTimeout(450)
    await capture(page,'night-ocean-'+name)
    await button(page,'Hidden waterfall').click()
    measurements.push({name,width,height,ratio:renderer.ratio,canvasWidth:renderer.canvasWidth,canvasHeight:renderer.canvasHeight,buttons})
  }
  await mkdir(output,{recursive:true})
  await writeFile(path.join(output,'responsive-measurements.json'),JSON.stringify({method:'Browser viewport simulation; no physical devices tested.',measurements},null,2))
})

test('motion obeys pause, reduced motion and simulated hidden-tab visibility',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  // Visibility is explicitly simulated; this verifies the production handler,
  // not physical-device background behavior or OS scheduling.
  await page.addInitScript(()=>{
    let hidden=false
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden})
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hidden?'hidden':'visible'})
    window.__qaSetVisibility=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'))}
  })
  await ready(page)
  const before=await motion(page)
  expect(before.paused).toBe(true);expect(before.running).toBe(false)
  await page.waitForTimeout(300)
  expect((await motion(page)).frames).toBe(before.frames)
  expect((await motion(page)).time).toBe(before.time)
  await button(page,'Resume motion').click()
  await expect.poll(async()=>(await motion(page)).frames).toBeGreaterThan(before.frames+3)
  await page.evaluate(()=>window.__qaSetVisibility(true))
  const hidden=await motion(page)
  expect(hidden.running).toBe(false)
  await page.waitForTimeout(300)
  expect((await motion(page)).frames).toBe(hidden.frames)
  expect((await motion(page)).time).toBe(hidden.time)
  await page.evaluate(()=>window.__qaSetVisibility(false))
  await expect.poll(async()=>(await motion(page)).frames).toBeGreaterThan(hidden.frames+3)
  await button(page,'Pause motion').click()
  const paused=await motion(page)
  await page.waitForTimeout(300)
  expect((await motion(page)).frames).toBe(paused.frames)
  expect((await motion(page)).time).toBe(paused.time)
})

test('simulated touch, high pixel density and rotation preserve settings and playback',async({browser},testInfo)=>{
  const context=await browser.newContext({
    baseURL:testInfo.project.use.baseURL,viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:3,
  })
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url())})
  try{
    await ready(page)
    expect((await motion(page)).ratio).toBeLessThanOrEqual(1.25)
    expect((await motion(page)).canvasWidth).toBeLessThanOrEqual(488)
    await button(page,'Cave drips').tap();await button(page,'Start focus session').tap()
    await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.00001)
    await button(page,'Focus settings').tap()
    const slider=page.getByRole('slider',{name:'Ambient volume',exact:true})
    const box=await slider.boundingBox()
    await page.touchscreen.tap(box.x+box.width*.84,box.y+box.height/2)
    await expect.poll(async()=>(await state(page)).volume).toBeGreaterThan(.7)
    await capture(page,'settings-phone')
    await closeSettings(page)
    await page.setViewportSize({width:844,height:390})
    await expect.poll(async()=>(await motion(page)).width).toBe(844)
    expect((await state(page)).scene).toBe('cave');expect((await state(page)).playing).toBe(true)
    await fits(page,['Pause focus session','Focus settings','Enter immersive view','Pause motion',...scenes.map(([label])=>label)])
    await capture(page,'playing-touch-landscape')
    await button(page,'Pause focus session').tap()
    await expect.poll(async()=>(await audio(page)).state).toBe('suspended')
    expect(errors).toEqual([])
  }finally{await context.close()}
})

test('simulated wall-clock completion stops audio and allows another complete-length session',async({page})=>{
  // Completion is tested with a controlled Date.now offset. The earlier
  // countdown test independently waits for real wall-time seconds.
  await page.addInitScript(()=>{
    const realNow=Date.now.bind(Date)
    let offset=0
    Date.now=()=>realNow()+offset
    window.__qaAdvanceWallClock=milliseconds=>{offset+=milliseconds}
  })
  await ready(page)
  const initial=await state(page)
  await button(page,'Start focus session').click()
  await expect.poll(async()=>(await state(page)).playing).toBe(true)
  await page.evaluate(milliseconds=>window.__qaAdvanceWallClock(milliseconds),initial.duration*1000+1500)
  await expect.poll(async()=>(await state(page)).status).toBe('complete')
  expect((await state(page)).remaining).toBe(0)
  expect((await state(page)).playing).toBe(false)
  await expect(page.getByTestId('focus-timer')).toHaveText('00:00')
  await expect(page.locator('.completion-note')).toContainText('Your focus session is complete')
  await expect.poll(async()=>(await audio(page)).state).toBe('suspended')
  expect((await audio(page)).energy).toBe(0)
  await capture(page,'completed-session-simulated-clock')
  await button(page,'Start another session').click()
  await expect.poll(async()=>(await state(page)).playing).toBe(true)
  expect((await state(page)).remaining).toBe(initial.duration)
  await button(page,'Pause focus session').click()
})

test('simulated WebGL2 unavailability retains the still scene and working focus controls',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext=function(type,...options){
      return type==='webgl2'?null:original.call(this,type,...options)
    }
  })
  // Do not call ready(): an intentionally unavailable renderer never becomes
  // WebGL-ready. Its painted fallback and player must remain usable.
  await page.goto(target)
  await page.evaluate(async()=>{await document.fonts.ready;return true})
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__grotto&&window.__grottoScene&&window.__grottoAudio))).toBe(true)
  expect((await motion(page)).webgl).toBe(false)
  expect((await motion(page)).running).toBe(false)
  expect((await motion(page)).error).toMatch(/WebGL2 unavailable/)
  const image=page.locator('.grotto-image')
  await image.evaluate(element=>element.decode())
  expect(await image.evaluate(element=>element.naturalWidth)).toBeGreaterThan(100)
  await expect(image).toBeVisible()
  await fits(page,['Start focus session','Focus settings','Enter immersive view','Pause motion',...scenes.map(([label])=>label)])
  await button(page,'Rain on leaves').click()
  await button(page,'Start focus session').click()
  const initial=(await state(page)).remaining
  await expect.poll(async()=>(await audio(page)).energy).toBeGreaterThan(.00001)
  await expect.poll(async()=>(await state(page)).remaining,{timeout:5000}).toBeLessThan(initial)
  await button(page,'Pause focus session').click()
  await openSettings(page)
  await button(page,'5 minutes').click()
  expect((await state(page)).remaining).toBe(300)
  await closeSettings(page)
  await capture(page,'still-fallback-simulated-no-webgl')
})
