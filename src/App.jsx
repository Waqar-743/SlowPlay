import { useEffect, useRef, useState } from 'react'
import { createGrottoMotion } from './motion'
import { createAudioEngine } from './audio'
import Icon from './Icon'

const ART = `${import.meta.env.BASE_URL}art/`
const PREFS_KEY = 'grotto-focus-preferences-v1'
const DURATIONS = [5, 15, 25, 50]
const SCENES = [
  { id: 'waterfall', title: 'Hidden waterfall', icon: 'waterfall', description: 'A soft, steady cascade. A little distance from the everyday.' },
  { id: 'rain', title: 'Rain on leaves', icon: 'rain', description: 'A gentle canopy of rainfall, with tiny drops close by.' },
  { id: 'ocean', title: 'Night ocean', icon: 'ocean', description: 'Slow waves finding the shore, then falling away again.' },
  { id: 'cave', title: 'Cave drips', icon: 'cave', description: 'Quiet water drops in a deep, open space.' },
]
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
function readPreferences() {
  const defaults = { scene: 'waterfall', volume: 0.65, duration: 25 * 60 }
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY))
    return {
      scene: SCENES.some(scene => scene.id === saved?.scene) ? saved.scene : defaults.scene,
      volume: Number.isFinite(saved?.volume) ? Math.max(0, Math.min(1, saved.volume)) : defaults.volume,
      duration: Number.isFinite(saved?.duration) && DURATIONS.includes(saved.duration / 60) ? saved.duration : defaults.duration,
    }
  } catch { return defaults }
}

export default function App() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [status, setStatus] = useState('idle')
  const [remaining, setRemaining] = useState(preferences.duration)
  const [starting, setStarting] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [artError, setArtError] = useState(false)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [immersive, setImmersive] = useState(false)
  const [modal, setModal] = useState(null)
  const root = useRef(null), canvas = useRef(null), motion = useRef(null), audio = useRef(null)
  const dialog = useRef(null), opener = useRef(null), playButton = useRef(null), enterButton = useRef(null), exitButton = useRef(null)
  const deadline = useRef(null), remainingRef = useRef(remaining), statusRef = useRef(status)
  const transition = useRef(0), pendingStart = useRef(false), mounted = useRef(false), wasImmersive = useRef(false)
  const initial = useRef({ ...preferences, paused, playing: false })
  const stateRef = useRef(null)
  const { scene, volume, duration } = preferences
  const currentScene = SCENES.find(item => item.id === scene)
  const playing = status === 'playing'
  const playLabel = starting ? 'Starting soundscape' : playing ? 'Pause focus session' : status === 'paused' ? 'Resume focus session' : status === 'complete' ? 'Start another session' : 'Start focus session'
  const setPreference = change => setPreferences(previous => ({ ...previous, ...change }))

  useEffect(() => {
    mounted.current = true
    motion.current = createGrottoMotion(root.current, canvas.current, initial.current)
    audio.current = createAudioEngine()
    audio.current.setVolume(initial.current.volume)
    Object.defineProperty(window, '__grotto', { configurable: true, value: {
      getState: () => ({ ...stateRef.current, motion: motion.current?.getState?.(), audio: audio.current?.getState?.() }),
    } })
    return () => {
      mounted.current = false
      transition.current += 1
      motion.current?.destroy()
      audio.current?.destroy()
      motion.current = null
      audio.current = null
      Reflect.deleteProperty(window, '__grotto')
    }
  }, [])

  useEffect(() => {
    statusRef.current = status
    remainingRef.current = remaining
    stateRef.current = { scene, playing, status, remaining, duration, volume, paused, reduced, immersive, starting }
  }, [scene, playing, status, remaining, duration, volume, paused, reduced, immersive, starting])
  useEffect(() => { motion.current?.setState({ scene, playing, volume, paused }) }, [scene, playing, volume, paused])
  useEffect(() => { audio.current?.setScene(scene) }, [scene])
  useEffect(() => { audio.current?.setVolume(volume) }, [volume])
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)) } catch { /* Preferences remain available for this visit. */ }
  }, [preferences])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { setReduced(media.matches); if (media.matches) setPaused(true) }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])

  useEffect(() => {
    if (!playing) return undefined
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      remainingRef.current = left
      setRemaining(left)
      if (left === 0) {
        deadline.current = null
        statusRef.current = 'complete'
        setStatus('complete')
        audio.current?.stop()
      }
    }
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [playing])

  useEffect(() => {
    if (modal && !dialog.current.open) dialog.current.showModal()
    if (!modal && dialog.current.open) dialog.current.close()
  }, [modal])
  useEffect(() => {
    if (immersive) exitButton.current?.focus({ preventScroll: true })
    else if (wasImmersive.current) enterButton.current?.focus({ preventScroll: true })
    wasImmersive.current = immersive
    const escape = event => {
      if (event.key === 'Escape' && immersive) { event.preventDefault(); setImmersive(false) }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [immersive])

  function openModal(name, event) {
    opener.current = event?.currentTarget || document.activeElement
    setModal(name)
  }
  function closeModal() {
    if (dialog.current?.open) dialog.current.close()
    setModal(null)
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
  }
  function changeScene(id) { setPreference({ scene: id }); setAudioError('') }
  function resetTimer(minutes = duration / 60) {
    pendingStart.current = false
    transition.current += 1
    audio.current?.stop()
    deadline.current = null
    const length = minutes * 60
    remainingRef.current = length
    statusRef.current = 'idle'
    setStarting(false)
    setStatus('idle')
    setRemaining(length)
    setAudioError('')
    if (length !== duration) setPreference({ duration: length })
  }
  async function togglePlayback() {
    if (pendingStart.current) return
    if (statusRef.current === 'playing') {
      transition.current += 1
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      remainingRef.current = left
      deadline.current = null
      statusRef.current = left === 0 ? 'complete' : 'paused'
      setRemaining(left)
      setStatus(statusRef.current)
      audio.current?.stop()
      return
    }
    pendingStart.current = true
    const request = ++transition.current
    const engine = audio.current
    setStarting(true)
    setAudioError('')
    try {
      await engine.start(scene)
      if (!mounted.current || request !== transition.current) return
      const left = remainingRef.current > 0 ? remainingRef.current : duration
      remainingRef.current = left
      deadline.current = Date.now() + left * 1000
      statusRef.current = 'playing'
      setRemaining(left)
      setStatus('playing')
    } catch {
      if (mounted.current && request === transition.current) setAudioError('Sound could not start. Please try Play again.')
    } finally {
      if (mounted.current && request === transition.current) { pendingStart.current = false; setStarting(false) }
    }
  }
  function openPlayer() {
    closeModal()
    playButton.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
    playButton.current?.focus({ preventScroll: true })
  }

  const modalTitle = modal === 'settings' ? 'Make room for focus.' : modal === 'soundscapes' ? 'Find your quiet.' : modal === 'science' ? 'A gentler working rhythm.' : modal === 'teams' ? 'A moment, together.' : modal === 'pricing' ? 'A little quiet. Freely.' : modal === 'menu' ? 'A little wayfinding.' : 'Your quiet place is here.'
  const announcement = status === 'complete' ? 'Your focus session is complete. Take a moment before your next one.' : playing ? `${currentScene.title} playing. Your focus timer has started.` : status === 'paused' ? 'Focus session paused. Your remaining time is saved for this visit.' : ''

  return <main ref={root} className={`grotto-root ${immersive ? 'is-immersive' : ''}`} data-scene={scene} data-playing={playing}>
    <div className="grotto-landscape" aria-hidden="true">
      <div className="grotto-plane"><img className="grotto-image" src={`${ART}grotto.webp`} alt="" fetchPriority="high" onError={() => setArtError(true)} /></div>
      <canvas ref={canvas} className="grotto-canvas" />
      <div className="grotto-mist" />
      <div className="grotto-shade" />
    </div>
    <p className="sr-only">A secluded turquoise cenote inside a dark limestone cavern. A waterfall falls from a sunlit opening in the forest above.</p>
    <div className="grotto-interface" aria-hidden={immersive} inert={immersive}>
      <a className="skip-link" href="#focus-player">Skip to focus player</a>
      <header className="grotto-header reveal">
        <a className="grotto-logo" href="#" aria-label="Cenote home">cenote</a>
        <nav className="grotto-links" aria-label="Main navigation">{['Soundscapes', 'Science', 'Teams', 'Pricing'].map(item => <button key={item} onClick={event => openModal(item.toLowerCase(), event)}>{item}</button>)}</nav>
        <div className="header-actions"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={event => openModal('menu', event)}><Icon name="menu" size={21}/></button><button className="get-app" onClick={event => openModal('app', event)}>Get the app</button></div>
      </header>
      <h1 className="grotto-title reveal">Sink into <em>deep</em> focus.</h1>
      <p className="grotto-subtitle reveal"><span className="subtitle-full">Nature-inspired soundscapes, tuned to quiet your mind and make room for focus. Hit play, start the timer, disappear.</span><span className="subtitle-compact">Hit play. Find your focus.</span></p>
      <div className="focus-dock reveal">
        <section className="focus-player" id="focus-player" aria-label="Focus player" tabIndex={-1}>
          <div className="player-top">
            <button className="timer-ring" aria-label="Change focus duration" onClick={event => openModal('settings', event)}>
              <svg viewBox="0 0 90 90" aria-hidden="true"><circle className="ring-background" cx="45" cy="45" r="40"/><circle className="ring-progress" cx="45" cy="45" r="40" strokeDasharray="251.327" strokeDashoffset={251.327 * (1 - remaining / duration)}/></svg>
              <time role="timer" aria-live="off" aria-label={`${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`} data-testid="focus-timer">{formatTime(remaining)}</time>
            </button>
            <div className="player-info"><small>{status === 'complete' ? 'A MOMENT WELL SPENT' : 'NOW PLAYING'}</small><h2>{currentScene.title}</h2></div>
            <button ref={playButton} className="player-toggle" aria-label={playLabel} aria-pressed={playing} disabled={starting} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={22}/></button>
          </div>
          <div className="soundscape-pills" role="group" aria-label="Choose a soundscape">{SCENES.map(item => <button key={item.id} aria-pressed={scene === item.id} onClick={() => changeScene(item.id)}>{item.title}</button>)}</div>
          {audioError && <p className="player-error" role="alert">{audioError}</p>}
          {status === 'complete' && <p className="completion-note">Your focus session is complete. A little breath, then begin again.</p>}
        </section>
        <div className="player-utilities" role="group" aria-label="Focus controls">
          <button aria-label={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(value => !value)}><Icon name={paused ? 'play' : 'pause'} size={13}/><span>{paused ? 'Resume motion' : 'Pause motion'}</span></button>
          <span className="utility-divider" aria-hidden="true"/>
          <button aria-label="Focus settings" onClick={event => openModal('settings', event)}><Icon name="sliders" size={14}/><span>Settings</span></button>
          <span className="utility-divider" aria-hidden="true"/>
          <button ref={enterButton} aria-label="Enter immersive view" onClick={() => setImmersive(true)}><Icon name="expand" size={13}/><span>Immersive</span></button>
        </div>
      </div>
      {reduced && <span className="preference-note">{paused ? 'Motion paused for your device preference.' : 'Motion enabled for this visit.'}</span>}
      {artError && <p className="asset-note" role="alert">The grotto could not load. Please refresh to try again.</p>}
    </div>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    <div className="immersive-controls" hidden={!immersive}>
      <button ref={exitButton} className="immersive-exit" aria-label="Exit immersive view" onClick={() => setImmersive(false)}><Icon name="collapse" size={17}/> Exit immersive <kbd>Esc</kbd></button>
      <div className="immersive-bottom"><button aria-label={paused ? 'Resume motion' : 'Pause motion'} onClick={() => setPaused(value => !value)}><Icon name={paused ? 'play' : 'pause'} size={15}/>{paused ? 'Resume motion' : 'Pause motion'}</button><button aria-label={playLabel} disabled={starting} onClick={togglePlayback}><Icon name={playing ? 'pause' : 'play'} size={16}/><span>{formatTime(remaining)}</span><span>{playing ? 'Pause session' : 'Play session'}</span></button></div>
    </div>
    <dialog ref={dialog} className="focus-dialog" aria-labelledby="grotto-dialog-title" onCancel={event => { event.preventDefault(); closeModal() }} onClose={() => setModal(null)} onClick={event => { if (event.target === event.currentTarget) closeModal() }}>
      <div className="dialog-panel">
        <div className="dialog-heading"><span className="dialog-eyebrow">CENOTE / A SPACE TO RETURN TO</span><button className="dialog-close icon-button" aria-label={modal === 'settings' ? 'Close focus settings' : 'Close dialog'} onClick={closeModal}><Icon name="close" size={20}/></button></div>
        <h2 id="grotto-dialog-title">{modalTitle}</h2>
        {modal === 'settings' ? <>
          <label className="volume-label" htmlFor="ambient-volume"><span><Icon name={volume === 0 ? 'mute' : 'volume'} size={18}/>Ambient volume</span><output htmlFor="ambient-volume">{Math.round(volume * 100)}%</output></label>
          <input id="ambient-volume" aria-label="Ambient volume" type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={event => setPreference({ volume: Number(event.target.value) / 100 })}/>
          <fieldset className="duration-settings"><legend>How long would you like?</legend><div>{DURATIONS.map(minutes => <button key={minutes} aria-label={`${minutes} minutes`} aria-pressed={duration === minutes * 60} onClick={() => resetTimer(minutes)}>{minutes}<span>min</span></button>)}</div><p>Changing the length starts a fresh timer.</p></fieldset>
          <button className="reset-timer" onClick={() => resetTimer()}><Icon name="restart" size={17}/>Reset timer<span>{formatTime(duration)}</span></button>
          <p className="dialog-note">Your soundscape, volume and session length are remembered in this browser.{reduced ? ' Your device prefers reduced motion; the scenery begins paused.' : ''}</p>
          <button className="dialog-primary" onClick={closeModal}>Back to the quiet <Icon name="arrow" size={17}/></button>
        </> : modal === 'soundscapes' ? <>
          <p className="dialog-copy">Four ways to leave the everyday a little further away.</p>
          <div className="scene-list">{SCENES.map(item => <button key={item.id} aria-pressed={scene === item.id} onClick={() => { changeScene(item.id); closeModal() }}><Icon name={item.icon} size={23}/><span><strong>{item.title}</strong><small>{item.description}</small></span>{scene === item.id && <Icon name="check" size={18}/>}</button>)}</div>
          <p className="dialog-note">These nature-inspired soundscapes are synthesized in your browser. They are not field recordings.</p>
        </> : modal === 'menu' ? <div className="dialog-menu">{['Soundscapes', 'Science', 'Teams', 'Pricing'].map(item => <button key={item} onClick={() => setModal(item.toLowerCase())}>{item}<Icon name="arrow" size={19}/></button>)}</div> : modal === 'science' ? <>
          <p className="dialog-copy">One soundscape. One small stretch of time. A little less to think about before you begin.</p><div className="ritual-steps"><p><span>01</span>Choose a sound that feels comfortable.</p><p><span>02</span>Set a session length and a gentle volume.</p><p><span>03</span>Give one thing your attention. Take a break when the timer ends.</p></div><p className="dialog-note">The soundscapes in this experience are generated in your browser, inspired by water, weather and wide-open spaces.</p><button className="dialog-primary" onClick={openPlayer}>Find your focus <Icon name="arrow" size={17}/></button>
        </> : modal === 'teams' ? <>
          <p className="dialog-copy">Make a little space for shared focus. Choose a time, share this page, and begin a quiet working session together.</p><p className="dialog-note">Each person controls their own sound and timer. This browser experience does not include team accounts or synchronized sessions.</p><button className="dialog-primary" onClick={openPlayer}>Open the focus player <Icon name="arrow" size={17}/></button>
        </> : modal === 'pricing' ? <>
          <p className="dialog-copy">All four soundscapes and the focus timer are free to use in this browser. No account, subscription or download is needed.</p><p className="dialog-note">Your preferences stay on this device. This experience has no paid plan.</p><button className="dialog-primary" onClick={openPlayer}>Make a little room <Icon name="arrow" size={17}/></button>
        </> : <>
          <p className="dialog-copy">You already have everything you need. Choose a soundscape, set your timer, and settle in.</p><p className="dialog-note">Cenote runs right here in your browser. Bookmark this page to return to your quiet place. No installation or account is required.</p><button className="dialog-primary" onClick={openPlayer}>Open the focus player <Icon name="arrow" size={17}/></button>
        </>}
      </div>
    </dialog>
  </main>
}
