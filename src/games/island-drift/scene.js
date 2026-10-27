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
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping
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
      const contour = radius > 0.1 ? Math.sin(a * 5 + radius * 4) * 0.12 + Math.cos(a * 3 - radius) * 0.1 : 0
      vertices.push(x, height + contour, z)
      uvs.push(x / 17, z / 17)
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
  const camera = new THREE.PerspectiveCamera(57, 1, 0.15, 850)
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
  let modeTransitionFrom = night
  let modeTransitionAt = performance.now()
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
      texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
      resources.push(texture)
      if (materials[kind]) { materials[kind].map = texture; materials[kind].needsUpdate = true }
      scene.traverse((object) => {
        const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : []
        for (const material of list) if (material.map === textures[kind]) { material.map = texture; material.needsUpdate = true }
      })
      if (kind === 'water') water.material.uniforms.paint.value = texture
      if (kind === 'cloud') cloudMat.uniforms.paint.value = texture
    }, undefined, () => {})
  }
  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...options })
  for (const [kind, color] of Object.entries({ wood: '#f0ba7b', sand: '#ffe3b0', grass: '#78ba64', rock: '#b6b6a0' })) {
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
    fragmentShader: 'varying vec3 vPosition; uniform float night; void main(){float h=smoothstep(-.06,.65,normalize(vPosition).y); vec3 day=mix(vec3(.76,.90,.88),vec3(.18,.52,.79),h); vec3 dark=mix(vec3(.115,.24,.34),vec3(.018,.043,.13),h); float haze=pow(1.-abs(normalize(vPosition).y),12.); gl_FragColor=vec4(mix(day,dark,night)+haze*vec3(.035,.025,.009)*(1.-night),1.);}',
  }))
  scene.add(sky)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, night: { value: night }, paint: { value: textures.water }, eye: { value: new THREE.Vector3() }, boatPose: { value: new THREE.Vector3(state.x, state.z, state.heading) }, lightDirection: { value: new THREE.Vector3(-0.4, 0.48, -0.75).normalize() } },
    vertexShader: 'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform float night; uniform sampler2D paint; uniform vec3 eye; uniform vec3 boatPose; uniform vec3 lightDirection;
      float shoreRadius(float a) { float ellipse=1./sqrt(pow(cos(a)/32.,2.)+pow(sin(a)/24.,2.)); float diff=atan(sin(a-1.570796),cos(a-1.570796)); float cove=exp(-pow(diff/.4,2.))*.14; return ellipse*(1.+.055*sin(3.*a+.5)+.035*cos(5.*a)-cove); }
      void main(){
        vec2 p=vWorld.xz; float coast=length(p)-shoreRadius(atan(p.y,p.x));
        float shallows=1.-smoothstep(1.2,27.,coast); float turquoise=1.-smoothstep(2.,11.,coast);
        vec3 deep=mix(vec3(.025,.30,.47),vec3(.027,.105,.23),night);
        vec3 lagoon=mix(vec3(.045,.66,.67),vec3(.055,.29,.38),night);
        vec3 beach=mix(vec3(.30,.81,.72),vec3(.12,.40,.44),night);
        vec3 col=mix(mix(deep,lagoon,shallows),beach,turquoise*.73);
        vec2 flow=vec2(time*.0022,-time*.0011);
        vec3 brushA=texture2D(paint,p*.011+flow).rgb;
        vec3 brushB=texture2D(paint,vec2(p.y,-p.x)*.027-flow*.6+vec2(.31,.67)).rgb;
        float pigment=dot(mix(brushA,brushB,.5),vec3(.22,.56,.22)); col*=.91+pigment*.19;
        float a=p.x*.46+p.y*.21-time*1.05; float b=p.y*.71-p.x*.16+time*.72;
        vec3 normal=normalize(vec3(-.085*cos(a)-.025*cos(b),1.,-.04*cos(a)-.09*cos(b)));
        vec3 view=normalize(eye-vWorld); float fresnel=pow(1.-max(0.,dot(normal,view)),3.);
        vec3 reflected=mix(vec3(.36,.67,.77),vec3(.15,.26,.43),night);
        col=mix(col,reflected,fresnel*.25);
        vec3 halfLight=normalize(view+lightDirection); float spec=pow(max(0.,dot(normal,halfLight)),95.);
        float glint=pow(max(0.,sin(p.x*2.8+sin(p.y*.9)*2.-time*.65)),18.);
        float glintBreakup=.45+.55*pow(max(0.,sin(p.y*1.9+p.x*.72-time*.38)),3.);
        col+=spec*(.045+glint*.24)*glintBreakup*mix(vec3(1.,.82,.46),vec3(.52,.71,1.),night);
        float ripples=pow(max(0.,sin(a+sin(b)*.7)),22.)*pow(max(0.,sin(b)),5.);
        col+=ripples*mix(vec3(.06,.12,.105),vec3(.028,.065,.105),night);
        float foam=(1.-smoothstep(.15,1.05,abs(coast-.5+sin(atan(p.y,p.x)*30.+time)*.12)))*.27;
        col=mix(col,mix(vec3(.85,.96,.82),vec3(.46,.72,.72),night),foam);
        vec2 hullDelta=p-boatPose.xy;
        vec2 hullLocal=vec2(hullDelta.x*cos(boatPose.z)+hullDelta.y*sin(boatPose.z),hullDelta.x*sin(boatPose.z)-hullDelta.y*cos(boatPose.z));
        float hullContact=exp(-1.65*(pow(hullLocal.x/2.8,2.)+pow(hullLocal.y/5.3,2.)));
        col*=1.-hullContact*.16;
        float distanceHaze=smoothstep(130.,510.,length(eye.xz-p));
        col=mix(col,mix(vec3(.54,.75,.77),vec3(.11,.22,.33),night),distanceHaze*.72);
        gl_FragColor=vec4(col,1.);
      }`,
  }))
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.02
  water.receiveShadow = true
  scene.add(water)
  const beach = mesh(groundGeometry(1, [[0, 2], [0.6, 2.2], [0.8, 1.25], [0.9, 0.65], [1, 0.13], [1.035, -0.18]]), materials.sand)
  const grass = mesh(groundGeometry(0.82, [[0, 4.3], [0.25, 4.1], [0.48, 3.45], [0.7, 2.9], [0.86, 2.0], [1, 0.76]]), materials.grass)
  beach.name = 'Sandy shoreline'
  grass.name = 'Island meadow'
  const cameraOccluders = [beach, grass]
  const surfMaterial = new THREE.MeshBasicMaterial({ color: '#ebfff0', transparent: true, opacity: 0.44, depthWrite: false })
  const surf = mesh(groundGeometry(1.022, [[0.98, 0.025], [1, 0.03], [1.015, 0.025]]), surfMaterial)
  surf.castShadow = false

  const leafMat = mat('#ffffff', { side: THREE.DoubleSide, vertexColors: true, roughness: 0.91 })
  const trunkMat = mat('#ba925d', { map: textures.wood })
  const coconutMat = mat('#805438')
  function palm(x, z, height, rotation) {
    const group = new THREE.Group()
    group.position.set(x, Math.hypot(x / 32, z / 24) < 0.58 ? 2.8 : 1.4, z)
    group.rotation.y = rotation
    scene.add(group)
    const lean = 1.3
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, height * 0.35, 0.04), new THREE.Vector3(0.65, height * 0.7, 0.12), new THREE.Vector3(lean, height, 0.25)])
    mesh(new THREE.TubeGeometry(curve, 12, 0.25, 7, false), trunkMat, group)
    const positions = []
    const colors = []
    const indices = []
    const leafColors = ['#379957', '#70b65f', '#25835b', '#98c673'].map((color) => new THREE.Color(color))
    for (let l = 0; l < 10; l++) {
      const a = l / 10 * TAU + 0.1
      const length = 4.0 + random(l + x) * 1.9
      const start = positions.length / 3
      const tint = leafColors[l % leafColors.length]
      for (let i = 0; i <= 9; i++) {
        const t = i / 9
        const width = Math.pow(Math.sin(t * Math.PI), 0.8) * (l % 2 ? 0.57 : 0.74)
        const px = lean + Math.cos(a) * t * length
        const pz = 0.25 + Math.sin(a) * t * length
        const py = height + Math.sin(t * Math.PI) * 1.25 - t * t * (l % 3 ? 2 : 1.2)
        const serration = i % 2 ? 0.88 : 1
        positions.push(px + Math.sin(a) * width * serration, py - width * 0.24, pz - Math.cos(a) * width * serration, px, py + width * 0.12, pz, px - Math.sin(a) * width * serration, py - width * 0.24, pz + Math.cos(a) * width * serration)
        for (let edge = 0; edge < 3; edge++) { const shade = edge === 1 ? 1.12 : edge === 0 ? 0.83 : 1; colors.push(tint.r * shade, tint.g * shade, tint.b * shade) }
        if (i < 9) { const k = start + i * 3; indices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4) }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    mesh(g, leafMat, group)
    for (let i = 0; i < 3; i++) { const c = sphere(0.32, coconutMat, group, 7); c.position.set(lean + Math.cos(i * 2) * 0.35, height - 0.3, Math.sin(i * 2) * 0.35) }
    group.traverse((object) => { if (object.isMesh) cameraOccluders.push(object) })
    return group
  }
  const palms = [[-13, -6, 8.5], [-18, -4, 7], [-8, -10, 9], [-20, 1, 7], [-12, 5, 8], [5, -7, 9], [10, 0, 8], [2, 6, 7], [-3, -4, 10], [18, 2, 7], [-15, -13, 6], [3, -14, 6.5]]
  palms.forEach(([x, z, h], i) => palm(x, z, h, random(i) * TAU))
  const shrubMaterials = [mat('#3e985a'), mat('#75b964'), mat('#2f8663')]
  const flowerMaterials = [mat('#f4a48b'), mat('#f4d079'), mat('#edbdab')]
  for (let i = 0; i < 42; i++) {
    const a = random(i + 100) * TAU
    const radius = 6 + random(i + 60) * 13
    const shrub = sphere(1, shrubMaterials[i % 3], scene, 8)
    shrub.scale.set(0.7 + random(i) * 1.6, 0.8 + random(i + 4) * 0.7, 0.8 + random(i + 2))
    shrub.position.set(Math.cos(a) * radius, 2.1 + (1 - radius / 23) * 2, Math.sin(a) * radius * 0.65)
    if (i % 3 === 0) { const flower = sphere(0.25, flowerMaterials[i % 3], scene, 6); flower.position.copy(shrub.position).add(new THREE.Vector3(0.4, shrub.scale.y * 0.9, 0.1)); flower.castShadow = false }
  }
  // Low sculpted outcrops sit well inside the beach collider, forming a
  // recognizable island silhouette without adding hidden sailing obstacles.
  for (let i = 0; i < 6; i++) {
    const outcrop = mesh(new THREE.DodecahedronGeometry(2.6 + random(i + 310) * 1.7, 1), materials.rock)
    outcrop.position.set(-2 + Math.cos(i * 1.7) * 5, 3 + random(i + 290) * 1.6, -5 + Math.sin(i * 1.7) * 3)
    outcrop.scale.set(1.4, 1.05 + random(i + 90) * 0.8, 0.9)
    outcrop.rotation.set(i * 0.15, i, 0.1)
    cameraOccluders.push(outcrop)
  }
  for (const [index, rock] of collisionRocks.entries()) {
    const r = mesh(new THREE.DodecahedronGeometry(rock.radius, 1), materials.rock)
    r.position.set(rock.x, rock.radius * 0.35, rock.z)
    r.scale.set(1, 0.67, 1)
    r.rotation.set(random(index) * 0.4, index, 0.1)
    cameraOccluders.push(r)
    for (let j = 0; j < 2; j++) {
      const pebble = mesh(new THREE.DodecahedronGeometry(0.4 + random(index + j) * 0.5), materials.rock)
      pebble.position.set(rock.x + (j ? 1 : -1) * rock.radius * 0.42, 0.25, rock.z + 0.25)
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
  lighthouse.traverse((object) => { if (object.isMesh) cameraOccluders.push(object) })
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

  // A true open hull reveals planked decking, curved ribs and warm cream trim.
  // Its silhouette and world scale preserve the original collision envelope.
  const boat = new THREE.Group()
  boat.scale.setScalar(1.9)
  scene.add(boat)
  const hullShape = new THREE.Shape()
  hullShape.moveTo(0, -2.7)
  hullShape.bezierCurveTo(1.15, -2, 1.3, -0.3, 1.1, 1.8)
  hullShape.lineTo(0.8, 2.1)
  hullShape.lineTo(-0.8, 2.1)
  hullShape.bezierCurveTo(-1.3, 1.4, -1.3, -1.6, 0, -2.7)
  const trim = mat('#f5dba4', { map: textures.wood })
  const darkWood = mat('#885235', { map: textures.wood })
  const hullPoints = hullShape.getPoints(48)
  const hullVertices = []
  const hullUvs = []
  const hullIndices = []
  const crossSections = [[0.72, -0.22, 0.83], [1, 0.85, 1], [0.84, 0.8, 0.96], [0.61, 0.24, 0.81]]
  crossSections.forEach(([wide, y, long]) => {
    hullPoints.forEach((p, i) => { hullVertices.push(p.x * wide, y, p.y * long); hullUvs.push(i / (hullPoints.length - 1) * 3, y) })
  })
  for (let row = 0; row < crossSections.length - 1; row++) {
    for (let i = 0; i < hullPoints.length - 1; i++) {
      const a = row * hullPoints.length + i
      const b = a + hullPoints.length
      hullIndices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const hullGeometry = new THREE.BufferGeometry()
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hullVertices, 3))
  hullGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(hullUvs, 2))
  hullGeometry.setIndex(hullIndices)
  hullGeometry.computeVertexNormals()
  const hullMaterial = mat('#d99b58', { map: textures.wood, side: THREE.DoubleSide })
  mesh(hullGeometry, hullMaterial, boat)
  const floor = mesh(new THREE.ShapeGeometry(hullShape, 28), darkWood, boat)
  floor.rotation.x = -Math.PI / 2
  floor.rotation.z = Math.PI
  floor.scale.set(0.65, 0.82, 1)
  floor.position.y = 0.23
  const planks = ['#deaf72', '#c99055', '#e0b77e', '#d6a16b'].map((color) => mat(color, { map: textures.wood }))
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.195
    const length = 3.62 - Math.pow(Math.abs(x), 1.5) * 1.2
    box(0.178, 0.07, length, planks[i % planks.length], boat).position.set(x, 0.29, -0.08)
  }
  for (const [wide, y, long, radius] of [[1, 0.86, 1, 0.075], [0.91, 0.59, 0.95, 0.025], [0.82, 0.35, 0.9, 0.018]]) {
    const points = hullPoints.map((p) => new THREE.Vector3(p.x * wide, y, p.y * long))
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, radius, 5, true), y > 0.8 ? trim : darkWood, boat)
  }
  for (const z of [-1.55, -0.9, 0, 0.85, 1.55]) {
    const halfBeam = z < -1.4 ? 0.75 : z > 1.4 ? 0.92 : 1.04
    for (const side of [-1, 1]) stick([side * halfBeam * 0.59, 0.27, z * 0.86], [side * halfBeam * 0.84, 0.77, z], 0.032, trim, boat)
  }
  for (const z of [-1, 0.78]) {
    box(1.76, 0.15, 0.45, planks[2], boat).position.set(0, 0.94, z)
    box(1.77, 0.035, 0.035, trim, boat).position.set(0, 1.03, z - 0.18)
  }
  const bowDeck = mesh(new THREE.CylinderGeometry(0.61, 0.67, 0.13, 3), materials.wood, boat)
  bowDeck.position.set(0, 0.86, -1.99)
  bowDeck.rotation.y = Math.PI
  box(1.42, 0.12, 0.18, trim, boat).position.set(0, 0.78, 1.93)
  for (const side of [-1, 1]) {
    box(0.26, 0.08, 0.09, darkWood, boat).position.set(side * 0.75, 0.94, 1.43)
    stick([side * 0.75, 0.86, 1.43], [side * 0.75, 1.04, 1.43], 0.035, darkWood, boat)
  }
  const ropeMat = mat('#d3b381')
  for (let i = 0; i < 4; i++) {
    const coil = mesh(new THREE.TorusGeometry(0.15 + i * 0.045, 0.024, 5, 18), ropeMat, boat)
    coil.rotation.x = Math.PI / 2
    coil.scale.y = 0.78
    coil.position.set(-0.36, 0.37 + i * 0.004, 1.27)
    coil.castShadow = false
  }
  const crate = box(0.5, 0.37, 0.53, darkWood, boat)
  crate.position.set(0.39, 0.5, 1.3)
  for (const z of [1.1, 1.32, 1.53]) box(0.54, 0.05, 0.07, trim, boat).position.set(0.39, 0.705, z)

  const cream = mat('#fff1cf')
  const shirt = mat('#dc8059')
  const trousers = mat('#385b72')
  const skin = mat('#ce9369', { roughness: 0.78 })
  const hatMat = mat('#e7c479', { map: textures.wood })
  const hairMat = mat('#674b36')
  const shoeMat = mat('#69503d')
  const sailorTorso = new THREE.Group()
  sailorTorso.position.set(0, 1.39, 0.73)
  boat.add(sailorTorso)
  const torso = cylinder(0.3, 0.32, 0.72, shirt, sailorTorso, 14)
  torso.position.set(0, 0.36, 0)
  torso.scale.z = 0.78
  const collar = cylinder(0.19, 0.25, 0.13, cream, sailorTorso, 12)
  collar.position.set(0, 0.76, -0.02)
  const neck = cylinder(0.115, 0.12, 0.18, skin, sailorTorso, 10)
  neck.position.set(0, 0.85, -0.04)
  const head = sphere(0.27, skin, sailorTorso, 16)
  head.scale.set(0.91, 1.08, 0.94)
  head.position.set(0, 1.08, -0.07)
  const hair = sphere(0.275, hairMat, sailorTorso, 12)
  hair.scale.set(0.91, 0.65, 0.94)
  hair.position.set(0, 1.21, -0.042)
  const nose = sphere(0.07, skin, sailorTorso, 8)
  nose.scale.set(0.8, 1.05, 1.2)
  nose.position.set(0, 1.09, -0.315)
  for (const side of [-1, 1]) {
    const ear = sphere(0.065, skin, sailorTorso, 8)
    ear.scale.set(0.7, 1.1, 0.8)
    ear.position.set(side * 0.245, 1.07, -0.04)
    const eye = sphere(0.019, hairMat, sailorTorso, 6)
    eye.position.set(side * 0.085, 1.14, -0.301)
    const sleeve = sphere(0.16, cream, sailorTorso, 10)
    sleeve.position.set(side * 0.28, 0.56, -0.005)
    sleeve.scale.set(0.8, 1.03, 1)
    stick([side * 0.18, 1.38, 0.72], [side * 0.25, 1.08, 0.1], 0.145, trousers, boat)
    stick([side * 0.25, 1.08, 0.1], [side * 0.25, 0.52, 0.05], 0.12, trousers, boat)
    const shoe = sphere(0.14, shoeMat, boat, 10)
    shoe.scale.set(0.85, 0.5, 1.55)
    shoe.position.set(side * 0.25, 0.44, -0.04)
  }
  const hat = cylinder(0.5, 0.49, 0.065, hatMat, sailorTorso, 24)
  hat.position.set(0, 1.3, -0.05)
  hat.rotation.z = 0.025
  const crown = cylinder(0.285, 0.32, 0.27, hatMat, sailorTorso, 18)
  crown.position.set(0, 1.46, -0.05)
  cylinder(0.32, 0.325, 0.065, trousers, sailorTorso, 18).position.set(0, 1.355, -0.05)
  const steeringWheel = new THREE.Group()
  steeringWheel.position.set(0, 1.65, -0.2)
  steeringWheel.rotation.x = -0.6
  boat.add(steeringWheel)
  mesh(new THREE.TorusGeometry(0.31, 0.036, 7, 24), darkWood, steeringWheel)
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU
    stick([0, 0, 0], [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0], 0.018, trim, steeringWheel)
  }
  sphere(0.07, trim, steeringWheel, 8)
  stick([0, 0.48, -0.11], [0, 1.65, -0.2], 0.055, darkWood, boat)
  const arms = [-1, 1].map((side) => ({ side, upper: cylinder(0.085, 0.1, 1, cream, boat, 10), fore: cylinder(0.07, 0.08, 1, skin, boat, 10), hand: sphere(0.087, skin, boat, 10) }))
  const armAxis = new THREE.Vector3(0, 1, 0)
  const armFrom = new THREE.Vector3()
  const armTo = new THREE.Vector3()
  const shoulder = new THREE.Vector3()
  const elbow = new THREE.Vector3()
  const hand = new THREE.Vector3()
  const poseLimb = (limb, from, to) => {
    armFrom.copy(from)
    armTo.copy(to).sub(from)
    limb.scale.y = armTo.length()
    limb.position.copy(armFrom).addScaledVector(armTo, 0.5)
    limb.quaternion.setFromUnitVectors(armAxis, armTo.normalize())
  }
  let steeringPose = 0
  const updateSailor = () => {
    sailorTorso.rotation.z = -steeringPose * 0.065
    sailorTorso.rotation.x = -0.045 + (reducedMotion ? 0 : Math.sin(elapsed * 1.45) * 0.009)
    sailorTorso.rotation.y = -steeringPose * 0.055
    steeringWheel.rotation.z = -steeringPose * 0.8
    sailorTorso.updateMatrix()
    steeringWheel.updateMatrix()
    for (const arm of arms) {
      shoulder.set(arm.side * 0.28, 0.55, -0.025).applyMatrix4(sailorTorso.matrix)
      hand.set(arm.side * 0.24, 0.15, 0.005).applyMatrix4(steeringWheel.matrix)
      elbow.set(arm.side * 0.44 - steeringPose * 0.035, 1.73, 0.22)
      poseLimb(arm.upper, shoulder, elbow)
      poseLimb(arm.fore, elbow, hand)
      arm.hand.position.copy(hand)
    }
  }
  updateSailor()
  const lanternMetal = mat('#6c5739', { metalness: 0.2 })
  const lanternGlass = mat('#ffe0a0', { emissive: '#ffb74c', emissiveIntensity: 0.3 })
  const lantern = cylinder(0.14, 0.16, 0.36, lanternGlass, boat, 10)
  lantern.position.set(0.39, 1.13, -1.57)
  cylinder(0.2, 0.2, 0.07, lanternMetal, boat, 10).position.set(0.39, 0.925, -1.57)
  const lanternRoof = mesh(new THREE.ConeGeometry(0.22, 0.17, 10), lanternMetal, boat)
  lanternRoof.position.set(0.39, 1.395, -1.57)
  for (const side of [-1, 1]) stick([0.39 + side * 0.12, 0.94, -1.57], [0.39 + side * 0.12, 1.34, -1.57], 0.015, lanternMetal, boat)
  const handle = mesh(new THREE.TorusGeometry(0.12, 0.018, 5, 14, Math.PI), lanternMetal, boat)
  handle.position.set(0.39, 1.47, -1.57)
  const boatLight = new THREE.PointLight('#ffbf67', 0, 20, 1.5)
  boatLight.position.set(0.39, 1.62, -1.57)
  boat.add(boatLight)
  const lifeRing = new THREE.Group()
  lifeRing.position.set(-1.075, 0.68, 0.85)
  lifeRing.rotation.y = Math.PI / 2
  boat.add(lifeRing)
  const ringRed = mat('#de7555')
  mesh(new THREE.TorusGeometry(0.29, 0.085, 8, 24), cream, lifeRing)
  for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.29, 0.088, 8, 5, 0.43), ringRed, lifeRing).rotation.z = i * Math.PI / 2

  const hemi = new THREE.HemisphereLight('#ccecff', '#638568', 1.5)
  scene.add(hemi)
  const sunlight = new THREE.DirectionalLight('#ffe0a3', 2.65)
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
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { night: { value: night }, paint: { value: textures.cloud } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vNormal; varying vec2 vUv; void main(){vNormal=normal;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 vNormal;varying vec2 vUv;uniform float night;uniform sampler2D paint;void main(){float shade=smoothstep(-.5,.75,vNormal.y);vec3 day=mix(vec3(.75,.85,.86),vec3(1.,.975,.90),shade);vec3 dark=mix(vec3(.14,.23,.34),vec3(.31,.40,.52),shade);vec3 grain=texture2D(paint,vUv*1.7).rgb;gl_FragColor=vec4(mix(day,dark,night)*(.97+grain*.03),mix(.94,.70,night));}',
  })
  const clouds = []
  for (let i = 0; i < 15; i++) {
    const cloud = new THREE.Group()
    const a = i / 15 * TAU
    cloud.position.set(Math.cos(a) * 210, 36 + random(i + 71) * 24, Math.sin(a) * 210)
    for (let j = 0; j < 5; j++) {
      const puff = sphere(4 + random(i * 7 + j) * 3, cloudMat, cloud)
      puff.scale.set(1.45, 0.9 + random(i + j) * 0.3, 0.92)
      puff.position.set(j * 5.5 - 11, Math.sin(j * 1.8) * 2.3, Math.sin(j + i) * 2)
      puff.castShadow = false
      puff.receiveShadow = false
    }
    scene.add(cloud)
    clouds.push(cloud)
  }

  const foamCanvas = document.createElement('canvas')
  foamCanvas.width = foamCanvas.height = 128
  const foamContext = foamCanvas.getContext('2d')
  const foamGradient = foamContext.createRadialGradient(64, 64, 7, 64, 64, 61)
  foamGradient.addColorStop(0, 'rgba(250,255,244,.72)')
  foamGradient.addColorStop(0.4, 'rgba(250,255,244,.43)')
  foamGradient.addColorStop(1, 'rgba(250,255,244,0)')
  foamContext.fillStyle = foamGradient
  foamContext.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 150; i++) {
    const x = random(i + 710) * 128
    const y = random(i + 810) * 128
    const fade = Math.max(0, 1 - Math.hypot(x - 64, y - 64) / 63)
    foamContext.fillStyle = `rgba(255,255,248,${fade * 0.48})`
    foamContext.beginPath()
    foamContext.ellipse(x, y, 1 + random(i + 51) * 4, 0.5 + random(i + 98) * 1.7, random(i) * 2, 0, TAU)
    foamContext.fill()
  }
  const foamTexture = new THREE.CanvasTexture(foamCanvas)
  resources.push(foamTexture)
  const wakeMat = new THREE.MeshBasicMaterial({ map: foamTexture, color: '#e2fff0', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  resources.push(wakeMat)
  const wakeGeometry = new THREE.PlaneGeometry(1, 1)
  const wake = []
  for (let i = 0; i < 64; i++) {
    const m = wakeMat.clone()
    const particle = new THREE.Mesh(wakeGeometry, m)
    particle.rotation.x = -Math.PI / 2
    particle.visible = false
    particle.userData.age = 100
    scene.add(particle)
    wake.push(particle)
  }
  let wakeCursor = 0
  let wakeTime = 0
  const spray = []
  for (let i = 0; i < 12; i++) {
    const particle = new THREE.Sprite(new THREE.SpriteMaterial({ map: foamTexture, color: '#ecfff7', transparent: true, opacity: 0, depthWrite: false }))
    particle.visible = false
    particle.userData = { age: 100, velocity: new THREE.Vector3() }
    scene.add(particle)
    spray.push(particle)
  }
  let sprayCursor = 0
  let sprayTime = 0
  let cameraHeading = state.heading
  const lookTarget = new THREE.Vector3()
  const cameraDestination = new THREE.Vector3()
  const lookDestination = new THREE.Vector3()
  const cameraForward = new THREE.Vector3()
  const cameraRay = new THREE.Raycaster()
  const cameraRayOrigin = new THREE.Vector3()
  const cameraRayDirection = new THREE.Vector3()
  let cameraCheckTime = -1
  let cameraLift = 0
  const setCameraDestinations = () => {
    const portrait = camera.aspect < 0.8
    // The close trailing view is the default on every screen. Framing is based
    // on the live game canvas aspect, including a short phone landscape stage.
    const distance = 16.2
    const height = portrait ? 8.7 : 8.4
    cameraForward.set(Math.sin(cameraHeading), 0, -Math.cos(cameraHeading))
    cameraDestination.set(state.x, height, state.z).addScaledVector(cameraForward, -distance)
    lookDestination.set(state.x, 1.75, state.z).addScaledVector(cameraForward, 6.2)
    const radius = Math.hypot(cameraDestination.x, cameraDestination.z)
    const inland = radius < islandRadius(Math.atan2(cameraDestination.z, cameraDestination.x)) + 2
    if (!inland) cameraLift = 0
    else if (elapsed - cameraCheckTime > 0.14 || cameraCheckTime < 0) {
      cameraCheckTime = elapsed
      cameraLift = 0
      cameraRayOrigin.set(state.x, 3.4, state.z)
      for (let attempt = 0; attempt < 6; attempt++) {
        cameraDestination.y = height + cameraLift
        cameraRayDirection.copy(cameraDestination).sub(cameraRayOrigin)
        cameraRay.far = cameraRayDirection.length() - 0.4
        cameraRay.set(cameraRayOrigin, cameraRayDirection.normalize())
        if (!cameraRay.intersectObjects(cameraOccluders, false).length) break
        cameraLift += 2.8
      }
    }
    cameraDestination.y = height + cameraLift
  }
  const snapCamera = () => {
    cameraHeading = state.heading
    setCameraDestinations()
    camera.position.copy(cameraDestination)
    lookTarget.copy(lookDestination)
    camera.lookAt(lookTarget)
    camera.updateMatrixWorld(true)
  }
  const dayColors = { fog: new THREE.Color('#a7d5dc'), grass: new THREE.Color('#78ba64'), sand: new THREE.Color('#ffe3b0'), leaf: new THREE.Color('#ffffff'), shrub: shrubMaterials.map((material) => material.color.clone()) }
  const nightColors = { fog: new THREE.Color('#1d3a55'), grass: new THREE.Color('#6fbdad'), sand: new THREE.Color('#b4d4cd'), leaf: new THREE.Color('#a8d6d5'), shrub: ['#398f83', '#72ac9a', '#357e87'].map((color) => new THREE.Color(color)) }
  const dayHemi = new THREE.Color('#ccecff')
  const nightHemi = new THREE.Color('#a0c6ed')
  const daySunlight = new THREE.Color('#ffe0a3')
  const nightSunlight = new THREE.Color('#a9d0ff')
  scene.fog = new THREE.Fog(dayColors.fog, 170, 460)
  const resize = () => {
    const { width, height } = container.getBoundingClientRect()
    renderer.setSize(Math.max(width, 1), Math.max(height, 1))
    camera.aspect = Math.max(width, 1) / Math.max(height, 1)
    camera.fov = camera.aspect < 0.8 ? 61 : 57
    camera.updateProjectionMatrix()
    snapCamera()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  boat.position.set(state.x, 0.27, state.z)
  boat.rotation.y = -state.heading
  scene.updateMatrixWorld(true)
  // Observational diagnostics use the model's actual mesh vertices, including
  // the current articulated pose. A single encompassing box invents phantom
  // corners between the hat and stern and exaggerates this close perspective.
  // These buffers are allocated once; projection runs only when getState is read.
  const boatProjectionParts = []
  boat.traverse((object) => {
    if (!object.isMesh) return
    const positions = object.geometry.getAttribute('position')
    boatProjectionParts.push({ object, positions, indices: object.geometry.index?.array, world: new Float32Array(positions.count * 3) })
  })
  const projected = new THREE.Vector3()
  const framing = () => {
    boat.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    let left = 1
    let right = 0
    let top = 1
    let bottom = 0
    const waterline = water.position.y
    const includePoint = (x, y, z) => {
      projected.set(x, y, z).project(camera)
      const px = (projected.x + 1) / 2
      const py = (1 - projected.y) / 2
      left = Math.min(left, px)
      right = Math.max(right, px)
      top = Math.min(top, py)
      bottom = Math.max(bottom, py)
    }
    for (const part of boatProjectionParts) {
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < part.positions.count; i++) {
        projected.fromBufferAttribute(part.positions, i).applyMatrix4(part.object.matrixWorld)
        const offset = i * 3
        part.world[offset] = projected.x
        part.world[offset + 1] = projected.y
        part.world[offset + 2] = projected.z
        minY = Math.min(minY, projected.y)
        maxY = Math.max(maxY, projected.y)
        if (projected.y >= waterline) includePoint(projected.x, projected.y, projected.z)
      }
      if (minY < waterline && maxY >= waterline) {
        const count = part.indices?.length ?? part.positions.count
        for (let i = 0; i < count; i += 3) {
          for (let edge = 0; edge < 3; edge++) {
            const a = (part.indices ? part.indices[i + edge] : i + edge) * 3
            const b = (part.indices ? part.indices[i + (edge + 1) % 3] : i + (edge + 1) % 3) * 3
            const ay = part.world[a + 1]
            const by = part.world[b + 1]
            if ((ay >= waterline) !== (by >= waterline)) {
              const t = (waterline - ay) / (by - ay)
              includePoint(THREE.MathUtils.lerp(part.world[a], part.world[b], t), waterline, THREE.MathUtils.lerp(part.world[a + 2], part.world[b + 2], t))
            }
          }
        }
      }
    }
    return { boat: { left, right, top, bottom, width: right - left, height: bottom - top }, canvas: { width: container.clientWidth, height: container.clientHeight }, measurement: 'projected mesh vertices clipped at the waterline' }
  }
  let previous = performance.now()
  function animate(now) {
    if (destroyed) return
    frame = requestAnimationFrame(animate)
    const dt = Math.min((now - previous) / 1000, 0.05)
    previous = now
    if (active) elapsed += dt
    // Lighting follows wall time so a slow frame cannot stretch a short mode
    // transition. Boat physics still uses the separately clamped safe step.
    const modeProgress = reducedMotion ? 1 : THREE.MathUtils.clamp((now - modeTransitionAt) / 1000, 0, 1)
    night = THREE.MathUtils.lerp(modeTransitionFrom, targetNight, modeProgress * modeProgress * (3 - 2 * modeProgress))
    sky.material.uniforms.night.value = night
    water.material.uniforms.night.value = night
    water.material.uniforms.time.value = reducedMotion ? 0 : elapsed
    scene.fog.color.copy(dayColors.fog).lerp(nightColors.fog, night)
    hemi.intensity = THREE.MathUtils.lerp(1.5, 1.14, night)
    hemi.color.copy(dayHemi).lerp(nightHemi, night)
    sunlight.intensity = THREE.MathUtils.lerp(2.65, 0.9, night)
    sunlight.color.copy(daySunlight).lerp(nightSunlight, night)
    materials.grass.color.copy(dayColors.grass).lerp(nightColors.grass, night)
    materials.sand.color.copy(dayColors.sand).lerp(nightColors.sand, night)
    leafMat.color.copy(dayColors.leaf).lerp(nightColors.leaf, night)
    shrubMaterials.forEach((material, i) => material.color.copy(dayColors.shrub[i]).lerp(nightColors.shrub[i], night))
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.88, 0.9, night)
    starMat.opacity = night * 0.96
    moon.visible = night > 0.05
    moon.scale.setScalar(night)
    sun.visible = night < 0.95
    sun.scale.setScalar(1 - night)
    cloudMat.uniforms.night.value = night
    lanternGlass.emissiveIntensity = 0.25 + night * 2.6
    lampMaterial.emissiveIntensity = 0.3 + night * 2.5
    lighthouseLight.intensity = night * 34
    boatLight.intensity = night * 11
    beamMat.uniforms.night.value = night
    // Keep the lighthouse architecture fixed while sweeping only its light beam.
    beam.rotation.y = reducedMotion ? 0 : elapsed * 0.12
    surfMaterial.opacity = THREE.MathUtils.lerp(0.42, 0.25, night)
    if (active) {
      state = stepBoat(state, input.current, dt)
      if (state.contact && elapsed - noticeAt > 5) { onNotice('Easy ashore. Reverse and turn to return to open water.'); noticeAt = elapsed }
      if (state.boundary && elapsed - noticeAt > 3) { onNotice('The open sea can wait. Your boat is facing back toward the island.'); noticeAt = elapsed }
    }
    const speedRatio = Math.min(Math.abs(state.speed) / 10, 1)
    water.material.uniforms.boatPose.value.set(state.x, state.z, state.heading)
    const turn = active ? (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0) : 0
    steeringPose = THREE.MathUtils.damp(steeringPose, turn, 5.5, dt)
    boat.position.set(state.x, 0.27 + (reducedMotion ? 0 : Math.sin(elapsed * 1.65) * (0.035 + speedRatio * 0.025)), state.z)
    // Three.js local bow points down -Z; clockwise steering increases world X.
    boat.rotation.y = -state.heading
    boat.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 1.3) * 0.012 - steeringPose * speedRatio * 0.035
    boat.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 1.65 + 0.65) * (0.006 + speedRatio * 0.007) - Math.max(state.speed, 0) * 0.0012
    updateSailor()
    if (active) {
      wakeTime += dt
      if (wakeTime > 0.15 && Math.abs(state.speed) > 0.65) {
        wakeTime = 0
        const direction = state.speed < 0 ? -1 : 1
        for (const side of [-1, 1]) {
          const p = wake[wakeCursor++ % wake.length]
          const spread = 0.9 + random(wakeCursor + 950) * 0.6
          const behind = direction * (3.5 + random(wakeCursor + 401) * 0.7)
          p.position.set(state.x - Math.sin(state.heading) * behind + Math.cos(state.heading) * side * spread, 0.045 + random(wakeCursor) * 0.01, state.z + Math.cos(state.heading) * behind + Math.sin(state.heading) * side * spread)
          p.rotation.z = state.heading + side * 0.2
          p.userData.age = 0
          p.userData.strength = 0.15 + speedRatio * 0.18
          p.visible = true
        }
      }
      for (const particle of wake) {
        particle.userData.age += dt
        const age = particle.userData.age
        particle.visible = age < 4.5
        if (particle.visible) { particle.scale.set(1.9 + age * 0.9, 2.1 + age * 1.25, 1); particle.material.opacity = Math.pow(1 - age / 4.5, 1.5) * particle.userData.strength * (1 - night * 0.2) }
      }
      sprayTime += dt
      if (!reducedMotion && state.speed > 3.5 && sprayTime > 0.12) {
        sprayTime = 0
        for (const side of [-1, 1]) {
          const particle = spray[sprayCursor++ % spray.length]
          const lateral = side * 1.1
          particle.position.set(state.x + Math.sin(state.heading) * 4.05 + Math.cos(state.heading) * lateral, 0.22, state.z - Math.cos(state.heading) * 4.05 + Math.sin(state.heading) * lateral)
          particle.userData.velocity.set(Math.sin(state.heading) * 0.7 + Math.cos(state.heading) * side * 1.2, 1.1 + speedRatio * 0.6, -Math.cos(state.heading) * 0.7 + Math.sin(state.heading) * side * 1.2)
          particle.userData.age = 0
          particle.visible = true
        }
      }
      for (const particle of spray) {
        particle.userData.age += dt
        const age = particle.userData.age
        particle.visible = age < 0.7 && !reducedMotion
        if (particle.visible) {
          particle.position.addScaledVector(particle.userData.velocity, dt)
          particle.userData.velocity.y -= 3.7 * dt
          particle.scale.setScalar(0.16 + age * 0.5)
          particle.material.opacity = (1 - age / 0.7) * 0.38
        }
      }
      if (!reducedMotion) clouds.forEach((cloud, i) => { cloud.position.x += (0.3 + i * 0.007) * dt; if (cloud.position.x > 260) cloud.position.x = -260 })
    }
    const headingDelta = Math.atan2(Math.sin(state.heading - cameraHeading), Math.cos(state.heading - cameraHeading))
    cameraHeading += headingDelta * (1 - Math.exp(-5.1 * dt))
    setCameraDestinations()
    camera.position.lerp(cameraDestination, 1 - Math.exp(-6 * dt))
    lookTarget.lerp(lookDestination, 1 - Math.exp(-7 * dt))
    camera.lookAt(lookTarget)
    water.material.uniforms.eye.value.copy(camera.position)
    water.material.uniforms.lightDirection.value.set(cameraForward.x * 0.94 - Math.cos(cameraHeading) * 0.23, 0.22, cameraForward.z * 0.94 - Math.sin(cameraHeading) * 0.23).normalize()
    // Celestial bodies sit at optical infinity so they remain visible on a
    // narrow phone view while the camera travels around the coast.
    // Tablets also need the clear space to the right of the progress panel.
    const narrowSky = camera.aspect < 1.3
    const tallSky = camera.aspect < 0.8
    const compactSky = narrowSky && container.clientWidth < 340
    const moonLateral = narrowSky ? (compactSky ? 20 : 26) : -40
    const sunLateral = narrowSky ? (compactSky ? 24 : 30) : -60
    moon.position.copy(camera.position).addScaledVector(cameraForward, 210)
    moon.position.x += Math.cos(cameraHeading) * moonLateral
    moon.position.z += Math.sin(cameraHeading) * moonLateral
    moon.position.y += tallSky ? 17 : 24
    sun.position.copy(camera.position).addScaledVector(cameraForward, 250)
    sun.position.x += Math.cos(cameraHeading) * sunLateral
    sun.position.z += Math.sin(cameraHeading) * sunLateral
    sun.position.y += tallSky ? 20 : 28
    if (now - snapshotAt > 350) {
      onSnapshot({ ...state, sectors: [...state.sectors], elapsed, running: active, mode: targetNight > 0.5 ? 'night' : 'day' })
      snapshotAt = now
    }
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(animate)
  return {
    setActive(value) { active = value },
    setMode(value) {
      const nextNight = value === 'night' ? 1 : 0
      if (nextNight === targetNight) return
      modeTransitionFrom = night
      modeTransitionAt = performance.now()
      targetNight = nextNight
    },
    setReducedMotion(value) { reducedMotion = value },
    reset({ preserveVoyage = false } = {}) { const previousState = state; state = createBoatState(); if (preserveVoyage) { state.distance = previousState.distance; state.sectors = previousState.sectors } else elapsed = 0; noticeAt = -8; steeringPose = 0; cameraCheckTime = -1; cameraLift = 0; boat.position.set(state.x, 0.27, state.z); boat.rotation.set(0, -state.heading, 0); updateSailor(); snapCamera(); wake.forEach((p) => { p.userData.age = 100; p.visible = false }); spray.forEach((p) => { p.userData.age = 100; p.visible = false }); onSnapshot({ ...state, elapsed, running: active, mode: targetNight > 0.5 ? 'night' : 'day' }) },
    getState() {
      return {
        ...state, sectors: [...state.sectors], elapsed, running: active,
        mode: targetNight > 0.5 ? 'night' : 'day',
        lighting: { nightBlend: night, lantern: boatLight.intensity, lighthouse: lighthouseLight.intensity },
        boundary: WORLD_RADIUS, rocks: collisionRocks.map((r) => ({ ...r })),
        camera: { heading: cameraHeading, position: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, distance: camera.position.distanceTo(boat.position), fov: camera.fov, headingLag: Math.atan2(Math.sin(state.heading - cameraHeading), Math.cos(state.heading - cameraHeading)) },
        framing: framing(),
      }
    },
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
