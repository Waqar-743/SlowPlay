import * as THREE from 'three'
import { createBoatState, stepBoat, islandRadius, collisionRocks, WORLD_RADIUS } from './physics'

const ART = `${import.meta.env.BASE_URL}art/`
const TAU = Math.PI * 2
const random = (seed) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n) }

function brushTexture(kind) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const colors = { wood: '#9d7049', sand: '#efdc9e', grass: '#819753', rock: '#8c9791', water: '#5bafab', cloud: '#fff9e9' }
  ctx.fillStyle = colors[kind]
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 700; i++) {
    ctx.globalAlpha = 0.03 + random(i + 8) * 0.1
    ctx.fillStyle = i % 3 ? '#fff8d5' : '#253e3b'
    ctx.fillRect(random(i) * 128, random(i + 50) * 128, kind === 'wood' ? 30 : 2 + random(i + 12) * 6, kind === 'wood' ? 1 : 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function groundGeometry(scale, rings) {
  const count = 96
  const vertices = []
  const uvs = []
  const indices = []
  for (const [radius, height] of rings) {
    for (let i = 0; i <= count; i++) {
      const a = i / count * TAU
      const r = islandRadius(a) * scale * radius
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      vertices.push(x, height + (radius > 0.1 ? Math.sin(a * 5) * 0.09 : 0), z)
      uvs.push(x / 9, z / 9)
    }
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < count; i++) {
      const a = j * (count + 1) + i
      const b = a + count + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createIslandScene(container, { input, onSnapshot, onNotice, reducedMotion = false, mode = 'day' }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(58, 1, 0.2, 850)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.domElement.setAttribute('aria-label', 'Island Drift sailing scene. Use the on-screen controls or WASD and arrow keys to sail.')
  renderer.domElement.setAttribute('role', 'img')
  container.appendChild(renderer.domElement)
  let active = false
  let state = createBoatState()
  let targetNight = mode === 'night' ? 1 : 0
  let night = targetNight
  let elapsed = 0
  let snapshotAt = 0
  let noticeAt = -8
  let frame
  let destroyed = false
  const resources = []
  const materials = {}
  const textures = {}
  const loader = new THREE.TextureLoader()
  for (const kind of ['wood', 'sand', 'grass', 'rock', 'water', 'cloud']) {
    textures[kind] = brushTexture(kind)
    resources.push(textures[kind])
    loader.load(`${ART}texture-${kind}.webp`, (texture) => {
      if (destroyed) { texture.dispose(); return }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
      resources.push(texture)
      if (materials[kind]) { materials[kind].map = texture; materials[kind].needsUpdate = true }
      if (kind === 'water') water.material.uniforms.paint.value = texture
    }, undefined, () => {})
  }
  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.94, ...options })
  for (const [kind, color] of Object.entries({ wood: '#d0a477', sand: '#fff1c8', grass: '#d0d58d', rock: '#cad1bd' })) {
    materials[kind] = mat(color, { map: textures[kind] })
  }
  const mesh = (geometry, material, parent = scene) => {
    const item = new THREE.Mesh(geometry, material)
    item.castShadow = true
    item.receiveShadow = true
    parent.add(item)
    return item
  }
  const sphere = (radius, material, parent = scene, detail = 10) => mesh(new THREE.SphereGeometry(radius, detail, 7), material, parent)
  const cylinder = (top, bottom, height, material, parent = scene, sides = 10) => mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material, parent)
  const box = (x, y, z, material, parent = scene) => mesh(new THREE.BoxGeometry(x, y, z), material, parent)
  const stick = (from, to, radius, material, parent) => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const length = a.distanceTo(b)
    const item = cylinder(radius, radius, length, material, parent, 7)
    item.position.copy(a.add(b).multiplyScalar(0.5))
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(new THREE.Vector3(...from)).normalize())
    return item
  }

  const sky = new THREE.Mesh(new THREE.SphereGeometry(650, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { night: { value: night } },
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vPosition; uniform float night; void main(){float h=smoothstep(-.03,.6,normalize(vPosition).y); vec3 day=mix(vec3(.83,.91,.85),vec3(.30,.66,.78),h); vec3 dark=mix(vec3(.12,.25,.35),vec3(.018,.045,.13),h); gl_FragColor=vec4(mix(day,dark,night),1.);}',
  }))
  scene.add(sky)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, night: { value: night }, paint: { value: textures.water } },
    vertexShader: 'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform float night; uniform sampler2D paint;
      void main(){vec2 p=vWorld.xz; float r=length(p/vec2(32.,24.)); float shallow=1.-smoothstep(.98,1.8,r);
      vec3 deep=mix(vec3(.09,.43,.51),vec3(.025,.10,.19),night); vec3 near=mix(vec3(.32,.76,.69),vec3(.10,.34,.39),night);
      vec3 col=mix(deep,near,shallow); vec3 tex=texture2D(paint,p*.023+vec2(time*.002,0.)).rgb; col*=.86+tex*.27;
      float ripple=pow(max(0.,sin(p.x*.42+sin(p.y*.3+time*.45)*1.5-time*.55)),18.)*pow(max(0.,sin(p.y*.27-time*.35)),4.);
      col+=ripple*mix(vec3(.12,.16,.13),vec3(.06,.11,.16),night);
      float moon=pow(max(0.,1.-abs(p.x+38.+sin(p.y*.3)*3.)/18.),3.)*(1.-smoothstep(-120.,10.,p.y)); col+=moon*night*.15;
      gl_FragColor=vec4(col,1.);}`,
  }))
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.02
  water.receiveShadow = true
  scene.add(water)
  const beach = mesh(groundGeometry(1, [[0, 1.3], [0.67, 1.6], [0.89, 0.6], [1, 0.14], [1.035, -0.15]]), materials.sand)
  const grass = mesh(groundGeometry(0.82, [[0, 2.7], [0.5, 2.7], [0.82, 2.15], [1, 0.7]]), materials.grass)
  beach.name = 'Sandy shoreline'
  grass.name = 'Island meadow'
  const surfMaterial = new THREE.MeshBasicMaterial({ color: '#ebfff0', transparent: true, opacity: 0.44, depthWrite: false })
  const surf = mesh(groundGeometry(1.022, [[0.98, 0.025], [1, 0.03], [1.015, 0.025]]), surfMaterial)
  surf.castShadow = false

  const leafMat = mat('#567a40', { side: THREE.DoubleSide })
  const trunkMat = mat('#ab8056', { map: textures.wood })
  function palm(x, z, height, rotation) {
    const group = new THREE.Group()
    group.position.set(x, 1.4, z)
    group.rotation.y = rotation
    scene.add(group)
    const lean = 1.1
    stick([0, 0, 0], [lean * 0.4, height * 0.5, 0], 0.29, trunkMat, group)
    stick([lean * 0.4, height * 0.5, 0], [lean, height, 0.25], 0.22, trunkMat, group)
    for (let l = 0; l < 7; l++) {
      const a = l / 7 * TAU
      const length = 3.2 + random(l + x) * 1.4
      const positions = []
      const indices = []
      for (let i = 0; i <= 6; i++) {
        const t = i / 6
        const width = Math.sin(t * Math.PI) * 0.7
        const px = lean + Math.cos(a) * t * length
        const pz = 0.25 + Math.sin(a) * t * length
        const py = height + Math.sin(t * Math.PI * 0.95) * 0.8 - t * t * 1.2
        positions.push(px + Math.sin(a) * width, py, pz - Math.cos(a) * width, px - Math.sin(a) * width, py, pz + Math.cos(a) * width)
        if (i < 6) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.setIndex(indices)
      g.computeVertexNormals()
      mesh(g, leafMat, group)
    }
    const coconutMat = mat('#80543a')
    for (let i = 0; i < 3; i++) { const c = sphere(0.32, coconutMat, group, 7); c.position.set(lean + Math.cos(i * 2) * 0.35, height - 0.3, Math.sin(i * 2) * 0.35) }
    return group
  }
  const palms = [[-13, -6, 8.5], [-18, -4, 7], [-8, -10, 9], [-20, 1, 7], [-12, 5, 8], [5, -7, 9], [10, 0, 8], [2, 6, 7], [-3, -4, 10], [18, 2, 7], [-15, -13, 6], [3, -14, 6.5]]
  palms.forEach(([x, z, h], i) => palm(x, z, h, random(i) * TAU))
  const shrubMat = mat('#78955b')
  const flowerMat = mat('#dfbd9e')
  for (let i = 0; i < 35; i++) {
    const a = random(i + 100) * TAU
    const radius = 6 + random(i + 60) * 13
    const shrub = sphere(1, shrubMat)
    shrub.scale.set(0.7 + random(i) * 1.5, 0.7, 0.8 + random(i + 2))
    shrub.position.set(Math.cos(a) * radius, 2.3, Math.sin(a) * radius * 0.65)
    if (i % 3 === 0) { const flower = sphere(0.22, flowerMat); flower.position.copy(shrub.position).add(new THREE.Vector3(0.4, 0.7, 0.1)) }
  }
  for (const [index, rock] of collisionRocks.entries()) {
    const r = mesh(new THREE.DodecahedronGeometry(rock.radius, 1), materials.rock)
    r.position.set(rock.x, rock.radius * 0.35, rock.z)
    r.scale.set(1, 0.67, 1)
    r.rotation.set(random(index) * 0.4, index, 0.1)
    for (let j = 0; j < 2; j++) {
      const pebble = mesh(new THREE.DodecahedronGeometry(0.4 + random(index + j) * 0.5), materials.rock)
      pebble.position.set(rock.x + (j ? 1 : -1) * rock.radius, 0.25, rock.z + 0.6)
    }
  }
  for (let i = 0; i < 14; i++) {
    const a = random(i + 400) * TAU
    const r = islandRadius(a) * (0.79 + random(i + 5) * 0.12)
    const stone = mesh(new THREE.DodecahedronGeometry(0.5 + random(i + 9) * 1.4), materials.rock)
    stone.position.set(Math.cos(a) * r, 0.7, Math.sin(a) * r)
    stone.scale.y = 0.65
  }
  // The little lighthouse is a fixed landmark on the north-east shore.
  const lighthouse = new THREE.Group()
  lighthouse.position.set(18, 1.5, -13)
  scene.add(lighthouse)
  const plaster = mat('#f3ecd1')
  const red = mat('#bd7760')
  cylinder(1.3, 1.7, 8.8, plaster, lighthouse, 16).position.y = 4.4
  cylinder(1.36, 1.44, 0.45, red, lighthouse, 16).position.y = 6.6
  cylinder(1.6, 1.6, 0.3, red, lighthouse, 16).position.y = 8.8
  const lampMaterial = mat('#ffdc8d', { emissive: '#ffd17b', emissiveIntensity: 0.3 })
  cylinder(0.94, 0.94, 1.7, lampMaterial, lighthouse, 10).position.y = 9.7
  const cap = mesh(new THREE.ConeGeometry(1.65, 1.3, 12), red, lighthouse)
  cap.position.y = 11.1
  const door = box(0.7, 1.4, 0.08, materials.wood, lighthouse)
  door.position.set(0, 0.7, 1.56)
  const lighthouseLight = new THREE.PointLight('#ffd79b', 0, 70, 1.2)
  lighthouseLight.position.set(18, 11.5, -13)
  scene.add(lighthouseLight)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { night: { value: night } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv; uniform float night; void main(){float fade=pow(vUv.y,1.7); gl_FragColor=vec4(1.,.82,.48,night*.075*fade);}',
  })
  const beam = mesh(new THREE.ConeGeometry(6, 42, 24, 1, true), beamMat, lighthouse)
  beam.rotation.z = Math.PI / 2
  beam.position.set(20, 9.7, 0)
  beam.castShadow = false

  // Open wooden hull, benches, and a seated helmsman with both hands on the tiller.
  const boat = new THREE.Group()
  boat.scale.setScalar(1.9)
  scene.add(boat)
  const hullShape = new THREE.Shape()
  hullShape.moveTo(0, -2.7)
  hullShape.bezierCurveTo(1.15, -2, 1.3, -0.3, 1.1, 1.8)
  hullShape.lineTo(0.8, 2.1)
  hullShape.lineTo(-0.8, 2.1)
  hullShape.bezierCurveTo(-1.3, 1.4, -1.3, -1.6, 0, -2.7)
  const hull = mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.62, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.13, bevelThickness: 0.18, curveSegments: 14 }), materials.wood, boat)
  hull.rotation.x = Math.PI / 2
  hull.position.y = 0.55
  const inside = mesh(new THREE.ShapeGeometry(hullShape, 16), mat('#b98952', { map: textures.wood }), boat)
  inside.rotation.x = -Math.PI / 2
  inside.rotation.z = Math.PI
  inside.scale.setScalar(0.87)
  inside.position.y = 0.64
  const rimPoints = hullShape.getPoints(48).map((p) => new THREE.Vector3(p.x, 0.85, p.y))
  const rimCurve = new THREE.CatmullRomCurve3(rimPoints, true)
  mesh(new THREE.TubeGeometry(rimCurve, 64, 0.095, 5, true), mat('#e9c897'), boat)
  for (const z of [-1, 0.75]) { const bench = box(1.85, 0.14, 0.48, materials.wood, boat); bench.position.set(0, 0.98, z) }
  const cream = mat('#f5e7bd')
  const trousers = mat('#496f76')
  const skin = mat('#c68a60')
  const hatMat = mat('#d9be7d')
  const torso = cylinder(0.29, 0.35, 0.8, cream, boat)
  torso.position.set(0, 1.75, 0.65)
  torso.rotation.x = -0.13
  const neck = cylinder(0.11, 0.12, 0.2, skin, boat)
  neck.position.set(0, 2.2, 0.58)
  const head = sphere(0.29, skin, boat, 12)
  head.position.set(0, 2.45, 0.55)
  const hat = cylinder(0.53, 0.53, 0.075, hatMat, boat, 16)
  hat.position.set(0, 2.64, 0.55)
  const crown = cylinder(0.3, 0.34, 0.26, hatMat, boat, 12)
  crown.position.set(0, 2.8, 0.55)
  for (const side of [-1, 1]) {
    stick([side * 0.19, 1.38, 0.65], [side * 0.24, 1.06, -0.02], 0.14, trousers, boat)
    stick([side * 0.24, 1.06, -0.02], [side * 0.24, 0.68, -0.06], 0.115, trousers, boat)
    stick([side * 0.27, 2.01, 0.62], [side * 0.43, 1.75, 0.16], 0.105, cream, boat)
    stick([side * 0.43, 1.75, 0.16], [side * 0.15, 1.67, -0.17], 0.075, skin, boat)
  }
  const steeringWheel = mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 18), mat('#694d36'), boat)
  steeringWheel.position.set(0, 1.63, -0.23)
  steeringWheel.rotation.x = -0.65
  stick([0, 0.7, -0.16], [0, 1.6, -0.23], 0.05, materials.wood, boat)
  const lanternMetal = mat('#715b3d')
  const lanternGlass = mat('#fff0b2', { emissive: '#ffcf6d', emissiveIntensity: 0.3 })
  const lantern = cylinder(0.13, 0.16, 0.35, lanternGlass, boat, 8)
  lantern.position.set(0.4, 1.15, -1.55)
  cylinder(0.2, 0.2, 0.07, lanternMetal, boat, 8).position.set(0.4, 0.94, -1.55)
  const lanternRoof = mesh(new THREE.ConeGeometry(0.22, 0.17, 8), lanternMetal, boat)
  lanternRoof.position.set(0.4, 1.4, -1.55)
  const boatLight = new THREE.PointLight('#ffc475', 0, 19, 1.25)
  boatLight.position.set(0.4, 1.65, -1.5)
  boat.add(boatLight)
  const lifeRing = mesh(new THREE.TorusGeometry(0.32, 0.09, 7, 16), mat('#e8a281'), boat)
  lifeRing.position.set(-1.11, 0.82, 0.6)
  lifeRing.rotation.y = Math.PI / 2

  const hemi = new THREE.HemisphereLight('#d6f1f0', '#8e8d60', 2.1)
  scene.add(hemi)
  const sunlight = new THREE.DirectionalLight('#ffe7ba', 2.7)
  sunlight.position.set(-45, 75, 30)
  sunlight.castShadow = true
  sunlight.shadow.mapSize.set(1024, 1024)
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -65
  sunlight.shadow.camera.right = sunlight.shadow.camera.top = 65
  sunlight.shadow.camera.far = 200
  sunlight.shadow.normalBias = 0.06
  sunlight.shadow.bias = -0.0005
  scene.add(sunlight)
  const moonMat = new THREE.MeshBasicMaterial({ color: '#fff7d9' })
  const moon = sphere(5, moonMat)
  moon.position.set(-70, 40, -180)
  moon.castShadow = false
  const sunMat = new THREE.MeshBasicMaterial({ color: '#fff1ca' })
  const sun = sphere(6, sunMat)
  sun.position.set(-95, 48, -220)
  sun.castShadow = false
  const starsGeometry = new THREE.BufferGeometry()
  const starPositions = []
  for (let i = 0; i < 230; i++) {
    const a = random(i + 1220) * TAU
    const elevation = 0.04 + random(i + 1600) * 0.42
    starPositions.push(Math.cos(a) * Math.cos(elevation) * 430, Math.sin(elevation) * 430, Math.sin(a) * Math.cos(elevation) * 430)
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({ color: '#fff3d2', size: 2.7, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false })
  const stars = new THREE.Points(starsGeometry, starMat)
  scene.add(stars)
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#fff8e7', roughness: 1, transparent: true, opacity: 0.82, depthWrite: false })
  cloudMat.map = textures.cloud
  materials.cloud = cloudMat
  const clouds = []
  for (let i = 0; i < 15; i++) {
    const cloud = new THREE.Group()
    const a = i / 15 * TAU
    cloud.position.set(Math.cos(a) * 210, 36 + random(i + 71) * 24, Math.sin(a) * 210)
    for (let j = 0; j < 5; j++) {
      const puff = sphere(4 + random(i * 7 + j) * 3, cloudMat, cloud)
      puff.scale.set(1.9, 0.6, 0.8)
      puff.position.set(j * 5 - 10, Math.sin(j) * 1.5, 0)
      puff.castShadow = false
    }
    scene.add(cloud)
    clouds.push(cloud)
  }

  const wakeMat = new THREE.MeshBasicMaterial({ color: '#ebfff1', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  const wake = []
  for (let i = 0; i < 48; i++) {
    const m = wakeMat.clone()
    const particle = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.69, 14, 1, 0, Math.PI), m)
    particle.rotation.x = -Math.PI / 2
    particle.visible = false
    particle.userData.age = 100
    scene.add(particle)
    wake.push(particle)
  }
  let wakeCursor = 0
  let wakeTime = 0
  const lookTarget = new THREE.Vector3(0, 0, 32)
  camera.position.set(0, 18, 82)
  camera.lookAt(lookTarget)
  const dayColors = { water: new THREE.Color('#73c5ba'), fog: new THREE.Color('#c5dacf'), grass: new THREE.Color('#d0d58d'), sand: new THREE.Color('#fff1c8') }
  const nightColors = { fog: new THREE.Color('#1b3547'), grass: new THREE.Color('#819989'), sand: new THREE.Color('#b3cfcb') }
  scene.fog = new THREE.Fog(dayColors.fog, 150, 420)
  const resize = () => {
    const { width, height } = container.getBoundingClientRect()
    renderer.setSize(Math.max(width, 1), Math.max(height, 1))
    camera.aspect = Math.max(width, 1) / Math.max(height, 1)
    camera.fov = width < 600 ? 66 : 58
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  let previous = performance.now()
  function animate(now) {
    if (destroyed) return
    frame = requestAnimationFrame(animate)
    const dt = Math.min((now - previous) / 1000, 0.05)
    previous = now
    if (active) elapsed += dt
    night = THREE.MathUtils.damp(night, targetNight, 3.6, dt)
    sky.material.uniforms.night.value = night
    water.material.uniforms.night.value = night
    water.material.uniforms.time.value = reducedMotion ? 0 : elapsed
    scene.fog.color.copy(dayColors.fog).lerp(nightColors.fog, night)
    hemi.intensity = THREE.MathUtils.lerp(2.1, 1.05, night)
    hemi.color.set('#d6f1f0').lerp(new THREE.Color('#9cbad5'), night)
    sunlight.intensity = THREE.MathUtils.lerp(2.7, 0.68, night)
    sunlight.color.set('#ffe7ba').lerp(new THREE.Color('#b0c9f4'), night)
    materials.grass.color.copy(dayColors.grass).lerp(nightColors.grass, night)
    materials.sand.color.copy(dayColors.sand).lerp(nightColors.sand, night)
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.94, night)
    starMat.opacity = night * 0.96
    moon.visible = night > 0.05
    moon.scale.setScalar(night)
    sun.visible = night < 0.95
    sun.scale.setScalar(1 - night)
    cloudMat.opacity = THREE.MathUtils.lerp(0.82, 0.19, night)
    cloudMat.color.set('#fff8e7').lerp(new THREE.Color('#7793a8'), night)
    lanternGlass.emissiveIntensity = 0.25 + night * 2.4
    lampMaterial.emissiveIntensity = 0.3 + night * 2.5
    lighthouseLight.intensity = night * 24
    boatLight.intensity = night * 20
    beamMat.uniforms.night.value = night
    // Keep the lighthouse architecture fixed while sweeping only its light beam.
    beam.rotation.y = reducedMotion ? 0 : elapsed * 0.12
    surfMaterial.opacity = THREE.MathUtils.lerp(0.42, 0.25, night)
    if (active) {
      state = stepBoat(state, input.current, dt)
      if (state.contact && elapsed - noticeAt > 5) { onNotice('Easy ashore. Reverse and turn to return to open water.'); noticeAt = elapsed }
      if (state.boundary && elapsed - noticeAt > 3) { onNotice('The open sea can wait. Your boat is facing back toward the island.'); noticeAt = elapsed }
    }
    boat.position.set(state.x, 0.42 + (reducedMotion ? 0 : Math.sin(elapsed * 1.6) * 0.07), state.z)
    // Three.js local bow points down -Z; clockwise steering increases world X.
    boat.rotation.y = -state.heading
    boat.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 1.3) * 0.018 - (input.current.right ? 0.025 : 0) + (input.current.left ? 0.025 : 0)
    if (active) {
      wakeTime += dt
      if (wakeTime > 0.13 && Math.abs(state.speed) > 0.55) {
        wakeTime = 0
        const p = wake[wakeCursor++ % wake.length]
        p.position.set(state.x - Math.sin(state.heading) * 4, 0.04, state.z + Math.cos(state.heading) * 4)
        p.rotation.z = state.heading
        p.userData.age = 0
        p.visible = true
      }
      for (const particle of wake) {
        particle.userData.age += dt
        const age = particle.userData.age
        particle.visible = age < 3.5
        if (particle.visible) { particle.scale.setScalar(1.7 + age * 0.65); particle.material.opacity = (1 - age / 3.5) * (0.21 - night * 0.07) }
      }
      if (!reducedMotion) clouds.forEach((cloud, i) => { cloud.position.x += (0.3 + i * 0.007) * dt; if (cloud.position.x > 260) cloud.position.x = -260 })
    }
    // A world-oriented elevated camera makes an entire coastal lap easy to read.
    const portrait = camera.aspect < 0.8
    const offset = portrait ? new THREE.Vector3(0, 23, 44) : new THREE.Vector3(0, 18, 44)
    const desired = new THREE.Vector3(state.x * 0.9, 0, state.z * 0.9).add(offset)
    camera.position.lerp(desired, 1 - Math.exp(-3 * dt))
    lookTarget.lerp(new THREE.Vector3(state.x * 0.9, 0.4, state.z * 0.9 - 6), 1 - Math.exp(-4 * dt))
    camera.lookAt(lookTarget)
    // Celestial bodies sit at optical infinity so they remain visible on a
    // narrow phone view while the camera travels around the coast.
    moon.position.set(camera.position.x - 18, camera.position.y + 20, camera.position.z - 210)
    sun.position.set(camera.position.x - 45, camera.position.y + 26, camera.position.z - 250)
    if (now - snapshotAt > 350) {
      onSnapshot({ ...state, sectors: [...state.sectors], elapsed, running: active, mode: targetNight > 0.5 ? 'night' : 'day' })
      snapshotAt = now
    }
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(animate)
  return {
    setActive(value) { active = value },
    setMode(value) { targetNight = value === 'night' ? 1 : 0 },
    setReducedMotion(value) { reducedMotion = value },
    reset({ preserveVoyage = false } = {}) { const previousState = state; state = createBoatState(); if (preserveVoyage) { state.distance = previousState.distance; state.sectors = previousState.sectors } else elapsed = 0; noticeAt = -8; wake.forEach((p) => { p.userData.age = 100; p.visible = false }); onSnapshot({ ...state, elapsed, running: active, mode: targetNight > 0.5 ? 'night' : 'day' }) },
    getState() { return { ...state, sectors: [...state.sectors], elapsed, running: active, mode: targetNight > 0.5 ? 'night' : 'day', boundary: WORLD_RADIUS, rocks: collisionRocks.map((r) => ({ ...r })) } },
    dispose() {
      destroyed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      const disposed = new Set()
      scene.traverse((object) => {
        if (object.geometry && !disposed.has(object.geometry)) { object.geometry.dispose(); disposed.add(object.geometry) }
        const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
        list.forEach((material) => { if (!disposed.has(material)) { material.dispose(); disposed.add(material) } })
      })
      resources.forEach((resource) => resource.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
