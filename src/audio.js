/** Locally synthesized ambience. No recordings, requests, or autoplay. */
export function createAudioEngine() {
  let context, master, analyser, voice, suspendTimer, disposed = false
  let scene = 'waterfall', volume = 0.65, playing = false, generation = 0
  const aliases = { 'Hidden waterfall': 'waterfall', 'Rain on leaves': 'rain', 'Night ocean': 'ocean', 'Cave drips': 'cave' }
  const normalize = value => aliases[value] || value
  const init = () => {
    if (context) return
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) throw new Error('Audio is unavailable in this browser.')
    context = new Audio()
    master = context.createGain()
    master.gain.value = 0
    analyser = context.createAnalyser()
    analyser.fftSize = 256
    master.connect(analyser).connect(context.destination)
  }
  const build = () => {
    const nodes = [], sources = [], timers = []
    const output = context.createGain()
    output.gain.setValueAtTime(0, context.currentTime)
    output.gain.linearRampToValueAtTime(1, context.currentTime + 0.8)
    output.connect(master)
    nodes.push(output)
    const noise = context.createBuffer(2, context.sampleRate * 4, context.sampleRate)
    let seed = 81731
    for (let channel = 0; channel < 2; channel++) {
      const data = noise.getChannelData(channel)
      let pink = 0
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const white = seed / 2147483648 - 1
        pink = (pink + white * 0.035) / 1.035
        data[i] = scene === 'rain' ? white * 0.32 : pink * 3.8
      }
    }
    const source = context.createBufferSource()
    source.buffer = noise
    source.loop = true
    const filter = context.createBiquadFilter()
    filter.type = scene === 'rain' ? 'highpass' : 'lowpass'
    filter.frequency.value = { waterfall: 1450, rain: 480, ocean: 480, cave: 240 }[scene] || 1000
    const gain = context.createGain()
    gain.gain.value = { waterfall: 0.62, rain: 0.4, ocean: 0.5, cave: 0.1 }[scene] || 0.5
    source.connect(filter).connect(gain).connect(output)
    source.start()
    nodes.push(filter, gain)
    sources.push(source)
    const lfo = context.createOscillator()
    const depth = context.createGain()
    lfo.frequency.value = scene === 'ocean' ? 0.095 : 0.18
    depth.gain.value = scene === 'ocean' ? 0.32 : 0.06
    lfo.connect(depth).connect(gain.gain)
    lfo.start()
    sources.push(lfo)
    nodes.push(depth)
    const drip = () => {
      if (!playing || disposed || context.state !== 'running') return
      const now = context.currentTime
      const tone = context.createOscillator()
      const envelope = context.createGain()
      tone.type = 'sine'
      tone.frequency.setValueAtTime(scene === 'cave' ? 1500 : 2200, now)
      tone.frequency.exponentialRampToValueAtTime(410, now + 0.09)
      envelope.gain.setValueAtTime(0, now)
      envelope.gain.linearRampToValueAtTime(scene === 'cave' ? 0.16 : 0.025, now + 0.004)
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)
      const delay = context.createDelay(1)
      delay.delayTime.value = 0.22
      const echo = context.createGain()
      echo.gain.value = 0.35
      tone.connect(envelope).connect(output)
      envelope.connect(delay).connect(echo).connect(output)
      tone.start(now)
      tone.stop(now + 0.65)
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); delay.disconnect(); echo.disconnect() }
    }
    if (scene === 'cave' || scene === 'rain') {
      drip()
      timers.push(setInterval(drip, scene === 'cave' ? 1480 : 360))
    }
    return {
      stop(immediate = false) {
        timers.forEach(clearInterval)
        const end = context.currentTime + (immediate ? 0 : 0.15)
        output.gain.cancelScheduledValues(context.currentTime)
        output.gain.setTargetAtTime(0, context.currentTime, 0.035)
        for (const item of sources) { try { item.stop(end) } catch { /* Already ended. */ } }
        const disconnect = () => { sources.forEach(item => item.disconnect()); nodes.forEach(item => item.disconnect()) }
        if (immediate) disconnect()
        else setTimeout(disconnect, 200)
      },
    }
  }
  const api = {
    async start(nextScene = scene) {
      if (disposed) return
      const token = ++generation
      scene = normalize(nextScene)
      init()
      clearTimeout(suspendTimer)
      await context.resume()
      if (disposed || token !== generation) return
      playing = true
      voice?.stop()
      voice = build()
      master.gain.setTargetAtTime(volume * 0.5, context.currentTime, 0.15)
    },
    stop() {
      generation++
      playing = false
      voice?.stop()
      voice = null
      if (!context) return
      master.gain.setTargetAtTime(0, context.currentTime, 0.04)
      clearTimeout(suspendTimer)
      suspendTimer = setTimeout(() => { if (!playing && context.state === 'running') context.suspend().catch(() => {}) }, 230)
    },
    setScene(value) {
      scene = normalize(value)
      if (playing && context?.state === 'running') { voice?.stop(); voice = build() }
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, Number(value)))
      if (context && playing) master.gain.setTargetAtTime(volume * 0.5, context.currentTime, 0.07)
    },
    getState() {
      let energy = 0
      if (analyser && playing) {
        const samples = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(samples)
        energy = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
      }
      return { scene, volume, playing, state: context?.state || 'uninitialized', energy }
    },
    destroy() {
      disposed = true
      generation++
      playing = false
      clearTimeout(suspendTimer)
      voice?.stop(true)
      context?.close().catch(() => {})
      if (window.__grottoAudio === diagnostic) delete window.__grottoAudio
    },
  }
  const diagnostic = Object.freeze({ getState: api.getState })
  window.__grottoAudio = diagnostic
  return api
}
