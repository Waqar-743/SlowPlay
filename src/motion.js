const MAPLE = 'M32 5 37 22 45 13 44 28 58 23 51 37 62 40 42 49 34 46 33 59 30 59 30 46 23 49 3 40 14 37 7 23 21 28 20 13 28 22Z'
const COLORS = ['#a3291d', '#c44321', '#df6c2d', '#8c201a', '#b64126']
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function createLeafSprites(image) {
  return COLORS.map(color => {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 128
    const context = sprite.getContext('2d')
    if (image) {
      context.drawImage(image, 0, 0, 128, 128)
      context.globalCompositeOperation = 'source-atop'
      context.globalAlpha = 0.15
      context.fillStyle = color
      context.fillRect(0, 0, 128, 128)
      return sprite
    }
    context.scale(2, 2)
    context.fillStyle = color
    context.fill(new Path2D(MAPLE))
    context.strokeStyle = '#edac614f'
    context.lineWidth = 0.8
    context.beginPath()
    context.moveTo(32, 54); context.lineTo(32, 17)
    context.moveTo(32, 40); context.lineTo(18, 31)
    context.moveTo(32, 40); context.lineTo(46, 31)
    context.moveTo(32, 32); context.lineTo(25, 23)
    context.moveTo(32, 32); context.lineTo(39, 23)
    context.stroke()
    return sprite
  })
}

/** One imperative animation loop; React only changes discrete settings. */
export function createLandscape(root, canvas, initial) {
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) return { update() {}, destroy() {} }
  const plane = root.querySelector('.landscape-plane')
  const haze = [...root.querySelectorAll('.haze')]
  const abort = new AbortController()
  let sprites = createLeafSprites()
  const leafArt = new Image()
  let leafArtReady = false
  let options = { ...initial }
  let width = 1, height = 1, ratio = 1, compact = false
  let leaves = [], grass = [], raf = 0, last = 0, elapsed = 0, frames = 0
  let running = false, disposed = false, dusk = initial.mode === 'dusk' ? 1 : 0
  let interactions = 0, averageCost = 0
  const pointer = { x: 0, y: 0, active: false, tx: 0, ty: 0, sx: 0, sy: 0 }
  const shouldRun = () => !disposed && !options.paused && document.visibilityState !== 'hidden'

  function leaf(index, scattered = false) {
    const depth = 0.2 + Math.random() * 0.8
    return {
      id: index, depth, x: width * (0.28 + Math.random() * 0.82),
      y: scattered ? Math.random() * height : -70 - Math.random() * height * 0.18,
      size: (8 + depth * depth * 35) * (index % 13 === 0 ? 1.5 : 1),
      speed: 15 + depth * 43, angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.2, phase: Math.random() * 6.28,
      flutter: 1 + Math.random() * 2, ix: 0, iy: 0, sprite: index % sprites.length,
    }
  }
  function resize() {
    const bounds = root.getBoundingClientRect()
    const oldWidth = width, oldHeight = height
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height)
    compact = width < 768 || matchMedia('(pointer: coarse)').matches
    ratio = Math.min(devicePixelRatio || 1, compact ? 1.25 : 1.6)
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const count = compact ? 25 : 52
    if (!leaves.length || leaves.length !== count) leaves = Array.from({ length: count }, (_, index) => leaf(index, true))
    else leaves.forEach(item => { item.x *= width / oldWidth; item.y *= height / oldHeight })
    grass = Array.from({ length: compact ? 110 : 240 }, (_, index) => ({
      x: width * index / (compact ? 109 : 239), y: height + Math.random() * 12,
      height: (18 + Math.random() * 56) * (compact ? 0.7 : 1),
      phase: Math.random() * 6.28, width: 0.5 + Math.random() * 1.2,
      lean: (Math.random() - 0.5) * 24,
      alpha: 0.13 + Math.random() * 0.35,
    }))
    paint()
  }
  function grassSway(blade) {
    const breeze = Math.sin(elapsed * (0.9 + options.wind * 0.65) + blade.x * 0.009)
    return (blade.lean - 3 - options.wind * 19 + breeze * (3 + options.wind * 13)
      + Math.sin(elapsed * 1.8 + blade.phase) * 3) * blade.height / 80
  }
  function paint() {
    context.clearRect(0, 0, width, height)
    for (const item of leaves) {
      const flutter = Math.cos(elapsed * item.flutter + item.phase)
      const face = Math.max(0.13, Math.abs(flutter)) * (flutter < 0 ? -1 : 1)
      context.save()
      context.translate(item.x, item.y)
      context.rotate(item.angle + Math.sin(elapsed * 1.7 + item.phase) * 0.28)
      context.scale(face, 0.72 + Math.sin(elapsed * 1.2 + item.phase) * 0.18)
      context.globalAlpha = (0.42 + item.depth * 0.55) * (1 - dusk * 0.13)
      context.drawImage(sprites[item.sprite], -item.size / 2, -item.size / 2, item.size, item.size)
      context.restore()
    }
    for (const blade of grass) {
      const sway = grassSway(blade)
      context.beginPath()
      context.moveTo(blade.x, blade.y)
      context.quadraticCurveTo(blade.x + sway * 0.15, blade.y - blade.height * 0.6,
        blade.x + sway, blade.y - blade.height)
      context.quadraticCurveTo(blade.x + sway * 0.4 + blade.width, blade.y - blade.height * 0.45,
        blade.x + blade.width, blade.y)
      context.fillStyle = `rgba(${Math.round(121 - dusk * 60)},${Math.round(137 - dusk * 64)},${Math.round(57 - dusk * 13)},${blade.alpha})`
      context.fill()
    }
    root.style.setProperty('--dusk', dusk.toFixed(4))
  }
  function tick(now) {
    raf = 0
    if (!shouldRun()) { sync(); return }
    raf = requestAnimationFrame(tick)
    const interval = compact ? 1000 / 30 : 1000 / 60
    if (now - last < interval - 1) return
    const dt = clamp((now - last) / 1000, 0, 0.05)
    last = now
    elapsed += dt
    const start = performance.now()
    const targetDusk = options.mode === 'dusk' ? 1 : 0
    dusk += (targetDusk - dusk) * Math.min(1, dt * 3.6)
    if (Math.abs(dusk - targetDusk) < 0.003) dusk = targetDusk
    const smooth = 1 - Math.exp(-dt * 4)
    pointer.sx += (pointer.tx - pointer.sx) * smooth
    pointer.sy += (pointer.ty - pointer.sy) * smooth
    plane.style.transform = `translate3d(${-pointer.sx * 17}px,${-pointer.sy * 11}px,0) scale(1.055)`
    haze.forEach((layer, index) => {
      layer.style.transform = `translate3d(${Math.sin(elapsed * (0.055 + index * 0.025) + index * 2) * width * 0.025 + pointer.sx * 7}px,${Math.sin(elapsed * 0.13 + index) * 4}px,0)`
      layer.style.opacity = String((0.08 + Math.sin(elapsed * 0.17 + index) * 0.02) * (1 - dusk * 0.3))
    })
    for (let index = 0; index < leaves.length; index++) {
      const item = leaves[index]
      if (pointer.active) {
        const dx = item.x - pointer.x, dy = item.y - pointer.y
        const distance = Math.hypot(dx, dy)
        if (distance > 1 && distance < 135) {
          const force = (1 - distance / 135) * dt * 185
          item.ix += dx / distance * force
          item.iy += dy / distance * force
          item.angle += force * 0.012
          interactions++
        }
      }
      item.x += ((-10 - options.wind * 78) * item.depth
        + Math.sin(elapsed * 0.7 + item.phase) * (7 + options.wind * 6) + item.ix) * dt
      item.y += (item.speed + Math.sin(elapsed * item.flutter + item.phase) * 9 + item.iy) * dt
      item.angle += item.spin * dt * (0.4 + options.wind)
      item.ix *= Math.exp(-dt * 2.8); item.iy *= Math.exp(-dt * 2.8)
      if (item.y > height + 80 || item.x < -90 || item.x > width + 140) leaves[index] = leaf(item.id)
    }
    paint()
    frames++
    averageCost += (performance.now() - start - averageCost) * 0.06
  }
  function sync() {
    running = shouldRun()
    root.dataset.running = String(running)
    if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick) }
    if (!running) { cancelAnimationFrame(raf); raf = 0; last = 0 }
  }
  function update(next) {
    options = { ...next, wind: clamp(Number(next.wind) || 0, 0, 1) }
    if (!shouldRun()) { dusk = options.mode === 'dusk' ? 1 : 0; paint() }
    sync()
  }
  function move(event) {
    if (event.pointerType === 'touch' || compact || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = root.getBoundingClientRect()
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top
    pointer.active = !event.target.closest('button,input,dialog')
    pointer.tx = pointer.x / width - 0.5; pointer.ty = pointer.y / height - 0.5
  }
  function leave() { pointer.active = false; pointer.tx = pointer.ty = 0 }
  root.addEventListener('pointermove', move, { signal: abort.signal })
  root.addEventListener('pointerleave', leave, { signal: abort.signal })
  document.addEventListener('visibilitychange', sync, { signal: abort.signal })
  window.addEventListener('blur', leave, { signal: abort.signal })

  // Magnetic feedback is direct DOM/CSS work, never a per-pointer React update.
  root.querySelectorAll('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || compact || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const bounds = button.getBoundingClientRect()
      button.style.setProperty('--mx', `${clamp((event.clientX - bounds.left - bounds.width / 2) * 0.12, -7, 7)}px`)
      button.style.setProperty('--my', `${clamp((event.clientY - bounds.top - bounds.height / 2) * 0.16, -6, 6)}px`)
    }, { signal: abort.signal })
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--mx', '0px'); button.style.setProperty('--my', '0px')
    }, { signal: abort.signal })
  })
  const observer = new ResizeObserver(resize)
  observer.observe(root)
  resize(); sync()
  leafArt.onload = () => {
    if (disposed) return
    sprites = createLeafSprites(leafArt)
    leafArtReady = true
    if (document.visibilityState !== 'hidden') paint()
  }
  leafArt.src = `${import.meta.env.BASE_URL}art/maple-leaf.webp`
  const diagnostics = Object.freeze({
    getState: () => ({
      frames, elapsed, running, hidden: document.visibilityState === 'hidden',
      wind: options.wind, mode: options.mode, dusk, paused: options.paused,
      leafCount: leaves.length, grassCount: grass.length, interactions, leafArtReady,
      width, height, ratio, canvasWidth: canvas.width, canvasHeight: canvas.height,
      parallax: { x: pointer.sx, y: pointer.sy }, averageDrawMs: averageCost,
      grassTip: grass[0] ? grass[0].x + grassSway(grass[0]) : 0,
      leaves: leaves.filter(item => item.x > 15 && item.x < width - 15 && item.y > 15 && item.y < height - 15)
        .map(({ id, x, y, size, angle, depth }) => ({ id, x, y, size, angle, depth })),
    }),
  })
  window.__akiScene = diagnostics
  return {
    update,
    destroy() {
      disposed = true; cancelAnimationFrame(raf); abort.abort(); observer.disconnect()
      leafArt.onload = null
      context.clearRect(0, 0, width, height)
      if (window.__akiScene === diagnostics) delete window.__akiScene
    },
  }
}
