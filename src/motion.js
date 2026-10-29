const VERTEX = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D img;   // the scene image
uniform sampler2D maps;  // per-template maps (R = depth, white = near)
uniform sampler2D sky;   // optional clean background plate
uniform vec2 r;          // canvas size, px
uniform float t;         // seconds
uniform vec2 m;          // pointer 0..1, smoothed
uniform vec2 o;          // focus point in the image 0..1
uniform float mood;
uniform float ia;        // image aspect (w/h)
out vec4 fragColor;

// screen uv (0..1, y up) â†’ image uv, cover-fit around focus o. zoom > 1 crops in a little,
// leaving margin so displacement/parallax never reveals an edge.
vec2 cover(vec2 uv,float zoom){
  float sa=r.x/r.y;
  vec2 s=sa>ia?vec2(1.,ia/sa):vec2(sa/ia,1.);
  s/=zoom;
  vec2 c=clamp(o,s*.5,1.-s*.5);
  return c+(uv-.5)*s;
}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
// Liquid drift for soft gradient photos: the image's own pixels flow along a slow, smooth field.
float dn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
// curl of a noise potential â†’ divergence-free flow (no pinching, looks like liquid)
vec2 curl(vec2 p){
  float e=.05;
  float n1=dn(p+vec2(0.,e)),n2=dn(p-vec2(0.,e)),n3=dn(p+vec2(e,0.)),n4=dn(p-vec2(e,0.));
  return vec2(n1-n2,-(n3-n4))/(2.*e);
}
// iu: image uv. amp ~ .02â€“.06, speed ~ .02â€“.06
vec2 drift(vec2 iu,float amp,float speed){
  float T=t*speed;
  vec2 q=iu*1.6;
  vec2 f=curl(q+vec2(T,T*.6))*.6+curl(q*2.1-vec2(T*.8,-T*1.1))*.4;
  iu+=f*amp*.18;
  // a second, slower sway of the whole field
  iu+=vec2(sin(T*1.3+iu.y*3.),cos(T*1.1+iu.x*2.5))*amp*.25;
  // pointer gently pushes the colour away
  vec2 mp=m; vec2 d=(gl_FragCoord.xy/r-mp)*vec2(r.x/r.y,1.);
  iu+=d*exp(-dot(d,d)*7.)*amp*.9;
  return iu;
}
// sample with optional blur (mip bias) â€” gradients with baked grain read cleaner blurred, then fresh grain on top
vec3 soft(vec2 iu,float lod){return textureLod(img,iu,lod*.2).rgb;}   // near-full detail: the image is the hero
vec3 grain(vec3 c,float amt){return c+(hash(gl_FragCoord.xy+fract(t*7.)*91.)-.5)*amt*.55;}   // light dither only
// Flow-map advection: the texture streams along \`dir\` forever without sliding off the image.
// Two copies offset half a cycle apart crossfade, so the reset of each is never visible.
// iu: image uv, dir: flow direction (image uv units / cycle), period: seconds per cycle, lod: blur
vec3 flowSample(vec2 iu,vec2 dir,float period,float lod){
  float ph=fract(t/period);
  float ph2=fract(t/period+.5);
  float w=abs(ph-.5)*2.;                                 // weight of copy 2 (0 when copy 1 is mid-cycle)
  vec3 a=textureLod(img,iu-dir*(ph-.5),lod*.4).rgb;
  vec3 b=textureLod(img,iu-dir*(ph2-.5),lod*.4).rgb;
  return mix(a,b,w);
}
// Depth parallax from maps.r (white = near). The screen point s shows image point i where
// s = i + cam*(depth(i) - focal). Solve for i with a few fixed-point steps: near layers slide
// over far ones with no tearing, the way a real camera move would.
float depthAt(vec2 iu){return textureLod(maps,iu,1.).r;}
vec2 parallax(vec2 iu,vec2 cam,float focal){
  vec2 i=iu;
  for(int k=0;k<5;k++){ i=iu-cam*(depthAt(i)-focal); }
  return i;
}
// a slow, looping camera drift plus the pointer
vec2 camMove(float amp,float speed){
  vec2 auto_=vec2(sin(t*speed),sin(t*speed*.71+1.3)*.6)*amp;
  return auto_+(m-.5)*vec2(2.,1.4)*amp;
}
// mist: soft drifting banks. dir = drift direction, scale = bank size
float mist(vec2 p,vec2 dir,float scale){
  vec2 q=p*scale+dir*t;
  float n=dn(q)*.55+dn(q*2.1+vec2(3.1,1.7)-dir*t*.6)*.3+dn(q*4.3-dir*t*.3)*.15;
  return smoothstep(.35,.85,n);
}
// light shafts: soft streaks along \`dir\` (unit, image space), shimmering slowly
float shafts(vec2 p,vec2 dir,float freq){
  vec2 nrm=vec2(-dir.y,dir.x);
  float x=dot(p,nrm)*freq;
  float a=dn(vec2(x,t*.08))*.6+dn(vec2(x*2.3+5.,t*.11))*.4;
  return smoothstep(.45,.9,a);
}
// measured on the photo (uv, y up)
const vec2 FALL_X=vec2(.455,.605);
const float POOL=.30, FALL_TOP=.80;
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  // slow breathing push-in toward the falls + gentle drift
  float push=1.06+.035*(.5-.5*cos(t*.08));
  vec2 iu=cover(uv,push);
  iu=parallax(iu,camMove(.01,.09),.15);
  float d=depthAt(iu);

  vec3 c=textureLod(img,iu,0.).rgb;
  // waterfall: stream the bright strands downward
  float fx=smoothstep(FALL_X.x,FALL_X.x+.015,iu.x)*(1.-smoothstep(FALL_X.y-.015,FALL_X.y,iu.x));
  float fy=smoothstep(POOL-.01,POOL+.03,iu.y)*(1.-smoothstep(FALL_TOP-.05,FALL_TOP,iu.y));
  float bright=smoothstep(.35,.6,dot(c,vec3(.33)));
  float fall=fx*fy;
  if(fall>0.){
    vec2 wob=vec2((dn(vec2(iu.x*90.,t*.6))-.5)*.002,0.);
    vec3 f=flowSample(iu+wob,vec2(0.,-.06),1.6,.15);
    c=mix(c,f,fall*(.35+.65*bright));
  }
  // pool: ripples ring out from the base of the falls + specular shimmer
  if(iu.y<POOL){
    float k=(POOL-iu.y)/POOL;
    vec2 q=(iu-vec2(.53,POOL))*vec2(ia,3.);
    float ring=sin(length(q)*60.-t*2.2);
    vec2 w=vec2(sin(iu.y*260.*(1.-k*.5)+t*1.3+sin(iu.x*40.)*1.2),ring*.6)*.0016*(.4+k);
    c=textureLod(img,iu+w,0.).rgb;
    float spec=smoothstep(.55,.8,dot(c,vec3(.2,.5,.3)));
    c*=1.+spec*.5*(dn(vec2(iu.x*160.,iu.y*80.-t*1.5))-.4);
  }
  // spray mist rising where the falls hit the pool
  vec2 mp=(iu-vec2(.53,POOL+.02))*vec2(ia*1.6,3.5);
  float spray=exp(-dot(mp,mp)*4.)*mist(iu*vec2(ia,1.)+vec2(0.,-t*.03),vec2(0.,.05),5.);
  c=mix(c,vec3(.75,.95,.92),spray*.55);
  // light shafts from the opening, only in the far, open part of the cave
  float far=1.-smoothstep(.15,.4,d);
  float sh=shafts(iu,normalize(vec2(.18,-1.)),14.)*far*smoothstep(POOL,.7,iu.y);
  c+=vec3(.55,1.,.9)*sh*.13;
  c=mix(c,c*vec3(.42,.65,.87),mood*.55);
  fragColor=vec4(grain(c,.02),1.);
}
`

/**
 * Grotto atmosphere, adapted from the supplied DVK Lab reference.
 * The locally saved depth map drives parallax; flowing falls and pool use
 * two-phase texture advection. Resource ownership stays outside React.
 */
export function createGrottoMotion(root, canvas, initial = {}) {
  const state = { paused: false, scene: 'waterfall', playing: false, ...initial }
  const abort = new AbortController()
  const signal = abort.signal
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = matchMedia('(pointer: coarse)')
  let gl, program, buffer, shaderObjects = [], textures = []
  let frameId = 0, disposed = false, ready = false, lost = false, frames = 0
  let time = 0, last = 0, drawCost = 0, ratio = 1, width = 1, height = 1
  let x = 0.5, y = 0.5, targetX = 0.5, targetY = 0.5, sceneBlend = 0
  let imageAspect = 16 / 9, error = '', drawSnapshot = null
  const uniforms = {}
  const diagnostic = Object.freeze({ getState: () => ({
    frames, time, running: Boolean(frameId), paused: state.paused,
    hidden: document.hidden, webgl: Boolean(gl && ready && !lost),
    renderer: gl?.getParameter(gl.RENDERER) || 'still image', ready, error,
    width, height, ratio, canvasWidth: canvas.width, canvasHeight: canvas.height,
    scene: state.scene, playing: state.playing, pointer: [x, y],
    averageDrawMs: drawCost, resources: textures.length,
  }) })
  window.__grottoScene = diagnostic
  const canAnimate = () => !disposed && ready && !lost && !state.paused && !document.hidden
  const modeValue = () => state.scene === 'ocean' || state.scene === 'Night ocean' ? 1 : state.scene === 'rain' || state.scene === 'Rain on leaves' ? 0.35 : 0
  const draw = () => {
    if (!gl || !ready || lost || disposed) return
    const start = performance.now()
    gl.uniform2f(uniforms.r, canvas.width, canvas.height)
    gl.uniform1f(uniforms.t, time)
    gl.uniform2f(uniforms.m, x, y)
    gl.uniform1f(uniforms.mood, sceneBlend)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    frames++
    drawCost = drawCost * 0.9 + (performance.now() - start) * 0.1
  }
  const tick = now => {
    frameId = 0
    if (!canAnimate()) { last = 0; return }
    const fps = coarse.matches || width < 768 ? 30 : 60
    const elapsed = last ? now - last : 1000 / fps
    if (elapsed >= 1000 / fps - 1) {
      const dt = Math.min(elapsed / 1000, 0.06)
      time += dt
      const follow = 1 - Math.exp(-3.1 * dt)
      x += (targetX - x) * follow
      y += (targetY - y) * follow
      sceneBlend += (modeValue() - sceneBlend) * (1 - Math.exp(-2 * dt))
      draw()
      last = now
    }
    frameId = requestAnimationFrame(tick)
  }
  const sync = () => {
    if (frameId) cancelAnimationFrame(frameId)
    frameId = 0
    last = 0
    if (canAnimate()) frameId = requestAnimationFrame(tick)
  }
  const resize = () => {
    const box = root.getBoundingClientRect()
    width = Math.max(1, Math.round(box.width))
    height = Math.max(1, Math.round(box.height))
    const cap = coarse.matches || width < 768 ? 1.25 : 1.6
    // Keep the expensive full-screen pass within a 2.8-megapixel budget.
    ratio = Math.min(devicePixelRatio || 1, cap, Math.sqrt(2_800_000 / (width * height)))
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    if (gl && ready && !lost) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      draw()
    }
  }
  const observer = new ResizeObserver(resize)
  observer.observe(root)
  resize()
  root.addEventListener('pointermove', event => {
    if (state.paused || reduced.matches || event.pointerType === 'touch') return
    const box = root.getBoundingClientRect()
    targetX = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    targetY = 1 - Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
  }, { signal, passive: true })
  root.addEventListener('pointerleave', () => { targetX = targetY = 0.5 }, { signal })
  document.addEventListener('visibilitychange', () => { targetX = targetY = 0.5; sync() }, { signal })
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    lost = true
    canvas.style.opacity = '0'
    error = 'Graphics context interrupted; showing the still scene.'
    sync()
  }, { signal })
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false
    ready = false
    textures = []
    shaderObjects = []
    setup()
  }, { signal })
  const texture = (source, unit) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (disposed || lost) { resolve(null); return }
      const tex = gl.createTexture()
      textures.push(tex)
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT)
      resolve(image)
    }
    image.onerror = () => reject(new Error('Background texture could not load.'))
    image.src = import.meta.env.BASE_URL + source
  })
  const setup = async () => {
    try {
      gl ||= canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false })
      if (!gl) { error = 'WebGL2 unavailable; showing the still scene.'; return }
      const compile = (type, source) => {
        const shader = gl.createShader(type)
        shaderObjects.push(shader)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
        return shader
      }
      program = gl.createProgram()
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
      gl.bindAttribLocation(program, 0, 'p')
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
      gl.useProgram(program)
      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      for (const name of ['r', 't', 'm', 'o', 'ia', 'mood']) uniforms[name] = gl.getUniformLocation(program, name)
      gl.uniform1i(gl.getUniformLocation(program, 'img'), 0)
      gl.uniform1i(gl.getUniformLocation(program, 'maps'), 1)
      const [image] = await Promise.all([texture('art/grotto.webp', 0), texture('art/grotto-depth.png', 1)])
      if (disposed || lost || !image) return
      imageAspect = image.width / image.height
      gl.uniform1f(uniforms.ia, imageAspect)
      gl.uniform2f(uniforms.o, 0.5, 0.5)
      ready = true
      error = ''
      sceneBlend = modeValue()
      canvas.style.opacity = '1'
      resize()
      draw()
      sync()
    } catch (failure) {
      error = failure.message || 'Background motion unavailable.'
      canvas.style.opacity = '0'
      ready = false
      sync()
    }
  }
  setup()
  const onReducedMotion = event => { if (event.matches) { state.paused = true; sync() } }
  reduced.addEventListener('change', onReducedMotion, { signal })
  return {
    setState(next) {
      Object.assign(state, next)
      if (state.paused && ready) { sceneBlend = modeValue(); draw() }
      sync()
    },
    getState: diagnostic.getState,
    capture() {
      if (!gl || !ready) return null
      draw()
      drawSnapshot = canvas.toDataURL('image/png')
      return drawSnapshot
    },
    destroy() {
      disposed = true
      sync()
      abort.abort()
      observer.disconnect()
      if (gl && !lost) {
        textures.forEach(item => gl.deleteTexture(item))
        shaderObjects.forEach(item => gl.deleteShader(item))
        if (buffer) gl.deleteBuffer(buffer)
        if (program) gl.deleteProgram(program)
      }
      if (window.__grottoScene === diagnostic) delete window.__grottoScene
    },
  }
}
