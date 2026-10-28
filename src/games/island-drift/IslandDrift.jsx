import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { createIslandScene } from './scene'
import { createBoatState, SECTOR_COUNT } from './physics'
import './island-drift.css'
import './pixel-shell.css'

const ART = `${import.meta.env.BASE_URL}art/`
const PREFS_KEY = 'slow-arcade-island-preferences'
const BEST_KEY = 'slow-arcade-island-best'
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private browsing can disable storage. */ } }
const freshInputs = () => ({ left: false, right: false, throttle: false, brake: false })
const keyActions = { ArrowUp: 'throttle', w: 'throttle', W: 'throttle', ArrowDown: 'brake', s: 'brake', S: 'brake', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }

function useOceanSound(enabled, playing) {
  useEffect(() => {
    if (!enabled || !playing) return undefined
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return undefined
    const context = new AudioContext()
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
    const samples = buffer.getChannelData(0)
    let previous = 0
    for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.035; samples[i] = previous * 3.5 }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 550
    const gain = context.createGain()
    gain.gain.value = 0.14
    source.connect(filter).connect(gain).connect(context.destination)
    source.start()
    context.resume().catch(() => {})
    return () => { source.stop(); context.close().catch(() => {}) }
  }, [enabled, playing])
}

export default function IslandDrift({ onBack }) {
  const [preferences, setPreferences] = useState(() => readSaved(PREFS_KEY, { mode: 'day', sound: false }))
  const [status, setStatus] = useState('title')
  const [launched, setLaunched] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [snapshot, setSnapshot] = useState(() => ({ ...createBoatState(), elapsed: 0 }))
  const [best, setBest] = useState(() => Number(readSaved(BEST_KEY, 0)) || 0)
  const [notice, setNotice] = useState('')
  const [pressed, setPressed] = useState(freshInputs)
  const [error, setError] = useState('')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const canvasRef = useRef(null)
  const controllerRef = useRef(null)
  const inputRef = useRef(freshInputs())
  const statusRef = useRef(status)
  const modeRef = useRef(preferences.mode)
  const motionRef = useRef(reducedMotion)
  const bestRef = useRef(best)
  const keyHeld = useRef(new Set())
  const pointerHeld = useRef(new Map())
  const noticeTimer = useRef(null)
  const dialogRef = useRef(null)
  const pauseRef = useRef(null)
  const previousFocus = useRef(null)
  const mode = preferences.mode === 'night' ? 'night' : 'day'
  const playing = status === 'playing'
  const explored = Math.round(snapshot.sectors.length / SECTOR_COUNT * 100)
  useOceanSound(Boolean(preferences.sound), playing)

  function clearInputs() {
    keyHeld.current.clear()
    pointerHeld.current.clear()
    inputRef.current = freshInputs()
    setPressed(freshInputs())
  }
  function refreshInputs() {
    const next = freshInputs()
    keyHeld.current.forEach((key) => { if (keyActions[key]) next[keyActions[key]] = true })
    pointerHeld.current.forEach((action) => { next[action] = true })
    inputRef.current = next
    setPressed(next)
  }
  function flashNotice(message) {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 5500)
  }
  function pause() { clearInputs(); setStatus('paused') }
  function start() { clearInputs(); setLaunched(true); setStatus('playing') }
  function resume() { clearInputs(); setDialog(null); setStatus('playing') }
  function restart() { clearInputs(); controllerRef.current?.reset(); setDialog(null); setStatus('playing'); flashNotice('A fresh voyage. The island is yours to explore.') }
  function resetBoat() { clearInputs(); controllerRef.current?.reset({ preserveVoyage: true }); flashNotice('Boat returned to the south cove. Your voyage continues.') }
  function openDialog(name) {
    previousFocus.current = document.activeElement
    clearInputs()
    if (statusRef.current === 'playing') setStatus('paused')
    setDialog(name)
  }
  function closeDialog() { setDialog(null); previousFocus.current?.focus() }
  function returnToLibrary() { clearInputs(); onBack() }
  function updatePreferences(change) { setPreferences((current) => ({ ...current, ...change })) }

  useEffect(() => { save(PREFS_KEY, preferences); modeRef.current = preferences.mode; controllerRef.current?.setMode(preferences.mode) }, [preferences])
  useEffect(() => { statusRef.current = status; controllerRef.current?.setActive(status === 'playing') }, [status])
  useEffect(() => { motionRef.current = reducedMotion; controllerRef.current?.setReducedMotion(reducedMotion) }, [reducedMotion])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReducedMotion(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    if (!launched || !canvasRef.current) return undefined
    let controller
    try {
      controller = createIslandScene(canvasRef.current, {
        input: inputRef, reducedMotion: motionRef.current, mode: modeRef.current,
        onNotice: (message) => {
          setNotice(message)
          window.clearTimeout(noticeTimer.current)
          noticeTimer.current = window.setTimeout(() => setNotice(''), 5500)
        },
        onSnapshot: (state) => {
          setSnapshot(state)
          if (state.distance > bestRef.current + 1) {
            bestRef.current = Math.floor(state.distance)
            setBest(bestRef.current)
            save(BEST_KEY, bestRef.current)
          }
        },
      })
      controllerRef.current = controller
      controller.setActive(statusRef.current === 'playing')
      // Read-only state helps verify controls, recovery, and lighting in browser tests.
      Object.defineProperty(window, '__islandDrift', { configurable: true, value: { getState: () => controller.getState() } })
    } catch {
      requestAnimationFrame(() => setError('This browser could not start the 3D scene. Try a browser with WebGL enabled.'))
    }
    return () => {
      controller?.dispose()
      controllerRef.current = null
      Reflect.deleteProperty(window, '__islandDrift')
      window.clearTimeout(noticeTimer.current)
    }
  }, [launched])

  useEffect(() => {
    const clear = () => {
      keyHeld.current.clear()
      pointerHeld.current.clear()
      inputRef.current = freshInputs()
      setPressed(freshInputs())
    }
    const keyDown = (event) => {
      if ((event.key === 'Escape' || event.key.toLowerCase() === 'p') && !event.repeat) {
        event.preventDefault()
        clear()
        if (dialogRef.current) { setDialog(null); previousFocus.current?.focus(); return }
        setStatus((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
        return
      }
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      if (keyActions[event.key] && statusRef.current === 'playing') {
        event.preventDefault()
        keyHeld.current.add(event.key)
        const next = { ...inputRef.current, [keyActions[event.key]]: true }
        inputRef.current = next
        setPressed(next)
      }
    }
    const keyUp = (event) => {
      if (!keyActions[event.key]) return
      keyHeld.current.delete(event.key)
      const next = freshInputs()
      keyHeld.current.forEach((key) => { if (keyActions[key]) next[keyActions[key]] = true })
      pointerHeld.current.forEach((action) => { next[action] = true })
      inputRef.current = next
      setPressed(next)
    }
    const blur = () => { clear(); if (statusRef.current === 'playing') setStatus('paused') }
    const visibility = () => { if (document.hidden) blur() }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
      clear()
    }
  }, [])

  useEffect(() => {
    if (!dialog) return undefined
    const panel = dialogRef.current
    const elements = () => [...panel.querySelectorAll('button, input, [tabindex="0"]')]
    elements()[0]?.focus()
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const focusable = elements()
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => panel.removeEventListener('keydown', trap)
  }, [dialog])

  useEffect(() => {
    if (status !== 'paused' || dialog || error || !pauseRef.current) return undefined
    const panel = pauseRef.current
    const focusedBeforePause = document.activeElement
    const buttons = [...panel.querySelectorAll('button')]
    buttons[0]?.focus()
    const trap = (event) => {
      if (event.key !== 'Tab') return
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => { panel.removeEventListener('keydown', trap); if (focusedBeforePause?.isConnected) focusedBeforePause.focus() }
  }, [status, dialog, error])

  function pointerHandlers(action) {
    const release = (event) => { pointerHeld.current.delete(event.pointerId); refreshInputs() }
    return {
      onPointerDown: (event) => {
        event.preventDefault()
        if (!playing) return
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerHeld.current.set(event.pointerId, action)
        refreshInputs()
      },
      onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release,
      onKeyDown: (event) => { if ([' ', 'Enter'].includes(event.key) && playing) { event.preventDefault(); pointerHeld.current.set(`key-${action}`, action); refreshInputs() } },
      onKeyUp: (event) => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); pointerHeld.current.delete(`key-${action}`); refreshInputs() } },
      onBlur: () => { pointerHeld.current.delete(`key-${action}`); refreshInputs() },
    }
  }

  return (
    <section className={`id-game id-${mode}${launched ? ' id-launched' : ''}`} aria-label="Island Drift">
      <div className="id-topline">
        <button className="id-back" onClick={returnToLibrary}><Icon name="arrow-left" size={17} /> Back to games</button>
        <span className="id-edition">A LITTLE ESCAPE / NO. 01</span>
        <button className="id-help-link" onClick={() => openDialog('help')}><Icon name="help" size={17} /><span>How to sail</span></button>
      </div>
      {!launched ? (
        <div className="id-intro">
          <div className="id-intro-art">
            <img src={`${ART}island-${mode}.webp`} alt={mode === 'day' ? 'A painted tropical island with a man steering a wooden boat over turquoise water.' : 'The same island under moonlight, with a glowing lighthouse and a lantern on the wooden boat.'} />
            <span className="id-art-caption"><span className="id-live-dot" /> ONE ISLAND. YOUR OWN PACE.</span>
            <div className="id-intro-mode" role="group" aria-label="Time of day">
              <button className={mode === 'day' ? 'is-selected' : ''} aria-pressed={mode === 'day'} onClick={() => updatePreferences({ mode: 'day' })}><Icon name="sun" size={17} /> Day</button>
              <button className={mode === 'night' ? 'is-selected' : ''} aria-pressed={mode === 'night'} onClick={() => updatePreferences({ mode: 'night' })}><Icon name="moon" size={17} /> Night</button>
            </div>
          </div>
          <div className="id-intro-copy">
            <span className="eyebrow">EXPLORATION · A MOMENT TO YOURSELF</span>
            <h1>Island <em>Drift</em><span className="id-title-mark">✦</span></h1>
            <p className="id-lede">Nothing to chase. <br />Somewhere to wander.</p>
            <p className="id-intro-description">Take the helm of a little wooden boat. Follow the shoreline, find the lighthouse, and let the world slow down.</p>
            <div className="id-start-row"><button className="button button-primary id-start" onClick={start}><Icon name="play" size={19} /> Set sail <Icon name="arrow-right" size={18} /></button><span>FREE TO EXPLORE<br />NO TIMER. NO RUSH.</span></div>
            <div className="id-intro-features"><span><Icon name="compass" size={18} /> A whole island to discover</span><span><Icon name="sun" size={18} /> Day & moonlit nights</span><span><Icon name="left" size={18} /> Keyboard & touch controls</span></div>
          </div>
        </div>
      ) : (
        <>
          <div className="id-game-heading"><div><span className="eyebrow">YOUR LITTLE ESCAPE</span><h1>Island <em>Drift</em></h1></div><div className="id-voyage-label"><Icon name="compass" size={20} /><span>FREE SAILING<small>{mode === 'day' ? 'Sunlit waters' : 'Moonlit waters'}</small></span></div></div>
          <div className="id-stage" data-testid="sailing-stage">
            <div ref={canvasRef} className="id-canvas" />
            <div className="id-scene-grain" aria-hidden="true" />
            <div className="id-hud id-hud-left"><span className="id-hud-label"><Icon name="compass" size={17} /> COASTLINE DISCOVERED</span><div className="id-progress-row"><div className="id-progress-track"><span style={{ width: `${explored}%` }} /></div><strong>{explored}%</strong></div><span className="id-lap-note">{explored === 100 ? 'Every shore, a little memory. Keep wandering.' : 'Follow the coast. Discover all 16 stretches.'}</span></div>
            <div className="id-hud-actions">
              <button className="id-tool id-mode-tool" aria-label={`Switch to ${mode === 'day' ? 'night' : 'day'} mode`} onClick={() => updatePreferences({ mode: mode === 'day' ? 'night' : 'day' })}><Icon name={mode === 'day' ? 'moon' : 'sun'} size={20} /><span>{mode === 'day' ? 'Night' : 'Day'}</span></button>
              <button className="id-tool" aria-label={playing ? 'Pause sailing' : 'Resume sailing'} onClick={playing ? pause : resume}><Icon name={playing ? 'pause' : 'play'} size={20} /></button>
              <button className="id-tool" aria-label="Sailing settings" onClick={() => openDialog('settings')}><Icon name="settings" size={20} /></button>
            </div>
            <div className="id-compass" aria-hidden="true"><span>N</span><Icon name="compass" size={40} /></div>
            <div className="id-speed"><strong>{(Math.abs(snapshot.speed) * 0.65).toFixed(1)}</strong><span>KNOTS{snapshot.speed < -0.1 ? ' · REVERSE' : ''}</span></div>
            {notice && <div className="id-notice" role="status"><Icon name="anchor" size={18} />{notice}</div>}
            {status === 'paused' && !dialog && !error && <div className="id-pause-scrim"><div ref={pauseRef} className="id-pause-card" role="dialog" aria-modal="true" aria-labelledby="id-pause-title"><span className="eyebrow">THE SEA CAN WAIT</span><h2 id="id-pause-title">A quiet moment.</h2><p>Your boat is safely paused.</p><button className="button button-primary" onClick={resume}><Icon name="play" size={18} /> Resume sailing</button><button className="id-text-button" onClick={restart}><Icon name="restart" size={17} /> Restart voyage</button><button className="id-text-button" onClick={returnToLibrary}><Icon name="home" size={17} /> Back to games</button></div></div>}
            {error && <div className="id-pause-scrim"><div className="id-pause-card" role="alert"><h2>A little technical tide.</h2><p>{error}</p><button className="button button-primary" onClick={returnToLibrary}>Back to games</button></div></div>}
          </div>
          <div className="id-control-deck">
            <div className="id-steer-group"><span className="id-control-label">STEER</span><div className="id-control-pair"><button className={`id-control ${pressed.left ? 'is-held' : ''}`} aria-label="Steer left" aria-pressed={pressed.left} disabled={!playing} {...pointerHandlers('left')}><Icon name="left" size={24} /><kbd>A / ←</kbd></button><button className={`id-control ${pressed.right ? 'is-held' : ''}`} aria-label="Steer right" aria-pressed={pressed.right} disabled={!playing} {...pointerHandlers('right')}><Icon name="right" size={24} /><kbd>D / →</kbd></button></div></div>
            <div className="id-deck-message"><Icon name="wind" size={22} /><p>Take the long way around.<span>Hold to sail · P or Esc to pause</span></p></div>
            <div className="id-throttle-group"><span className="id-control-label">FIND YOUR PACE</span><div className="id-control-pair"><button className={`id-control id-brake ${pressed.brake ? 'is-held' : ''}`} aria-label="Brake or reverse" aria-pressed={pressed.brake} disabled={!playing} {...pointerHandlers('brake')}><Icon name="down" size={23} /><span>Brake<kbd>S / ↓</kbd></span></button><button className={`id-control id-throttle ${pressed.throttle ? 'is-held' : ''}`} aria-label="Sail forward" aria-pressed={pressed.throttle} disabled={!playing} {...pointerHandlers('throttle')}><Icon name="up" size={23} /><span>Sail<kbd>W / ↑</kbd></span></button></div></div>
          </div>
          <div className="id-voyage-footer"><div><span>THIS VOYAGE <strong>{Math.floor(snapshot.distance)} m</strong></span><span>LONGEST WANDER <strong>{Math.floor(best)} m</strong></span></div><button onClick={resetBoat}><Icon name="restart" size={15} /> Reset boat</button></div>
        </>
      )}
      <div className="id-bottom-note"><span>MADE FOR TAKING IT SLOW</span><span><Icon name="anchor" size={14} /> A peaceful place to play.</span></div>
      {dialog && <div className="id-dialog-scrim" onClick={(event) => { if (event.target === event.currentTarget) closeDialog() }}><div ref={dialogRef} className={`id-dialog ${dialog === 'help' ? 'id-help-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="id-dialog-title"><button className="id-dialog-close id-tool" onClick={closeDialog} aria-label="Close dialog"><Icon name="close" size={20} /></button>{dialog === 'help' ? <><span className="eyebrow">A FEW THINGS BEFORE YOU WANDER</span><h2 id="id-dialog-title">Find your sea legs.</h2><div className="id-help-body"><img src={`${ART}island-map.webp`} alt="Painted map of the sailing island: south cove, palms in the west and center, lighthouse on the north-east coast, and rocks around the shore." /><div><p>There is no finish line. Sail around the whole island and watch your coastline discovery grow.</p><dl><div><dt>W / ↑</dt><dd>Hold to sail forward</dd></div><div><dt>A D / ← →</dt><dd>Steer left and right</dd></div><div><dt>S / ↓</dt><dd>Brake, then reverse</dd></div><div><dt>P / Esc</dt><dd>Pause or resume</dd></div></dl><p className="id-help-tip">On a phone, hold a steering button and Sail together. If you meet the shore, reverse and turn. Reset boat returns you to the cove.</p></div></div><button className="button button-primary" onClick={closeDialog}>Ready to wander <Icon name="arrow-right" size={18} /></button></> : <><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="id-dialog-title">Sailing settings</h2><div className="id-setting"><div><strong>Time of day</strong><span>Changes the whole island together.</span></div><div className="id-setting-modes"><button className={mode === 'day' ? 'is-selected' : ''} aria-label="Day mode" aria-pressed={mode === 'day'} onClick={() => updatePreferences({ mode: 'day' })}><Icon name="sun" size={20} /></button><button className={mode === 'night' ? 'is-selected' : ''} aria-label="Night mode" aria-pressed={mode === 'night'} onClick={() => updatePreferences({ mode: 'night' })}><Icon name="moon" size={20} /></button></div></div><label className="id-setting"><div><strong>Ocean sounds</strong><span>A soft, restful wash of waves.</span></div><input type="checkbox" checked={Boolean(preferences.sound)} onChange={(event) => updatePreferences({ sound: event.target.checked })} /></label><div className="id-setting id-motion-note"><Icon name="check" size={18} /><p>{reducedMotion ? 'Reduced motion is on, following your device preference.' : 'Decorative movement follows your device’s reduced-motion preference.'}</p></div><p className="id-saved-note">Your time of day, sound preference, and longest wander are saved in this browser.</p><button className="button button-primary" onClick={closeDialog}>All set <Icon name="check" size={18} /></button></>}</div></div>}
    </section>
  )
}
