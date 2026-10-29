import { useEffect, useRef, useState } from 'react'
import { createLandscape } from './motion'
import Icon from './Icon'
import MountainScene from './MountainScene'
import BrandMark from './BrandMark'

const KEY = 'skardu-mountain-scene-preferences-v1'
function readPreferences() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY))
    return { mode: data?.mode === 'dusk' ? 'dusk' : 'daylight', wind: Number.isFinite(data?.wind) ? Math.max(0, Math.min(1, data.wind)) : 0.35 }
  } catch { return { mode: 'daylight', wind: 0.35 } }
}

export default function App() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [immersive, setImmersive] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [artError, setArtError] = useState(false)
  const root = useRef(null), canvas = useRef(null), controller = useRef(null)
  const dialog = useRef(null), enterButton = useRef(null), exitButton = useRef(null)
  const settingsOpener = useRef(null), wasImmersive = useRef(false)
  const initial = useRef({ ...preferences, paused })
  const windName = preferences.wind < 0.15 ? 'Calm' : preferences.wind < 0.6 ? 'Gentle breeze' : 'Mountain gusts'
  const update = change => setPreferences(previous => ({ ...previous, ...change }))

  useEffect(() => {
    controller.current = createLandscape(root.current, canvas.current, initial.current)
    return () => { controller.current?.destroy(); controller.current = null }
  }, [])
  useEffect(() => {
    controller.current?.update({ ...preferences, paused })
    try { localStorage.setItem(KEY, JSON.stringify(preferences)) } catch { /* The scene also works without storage. */ }
  }, [preferences, paused])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => { setReduced(media.matches); if (media.matches) setPaused(true) }
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
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
  useEffect(() => {
    if (settingsOpen && !dialog.current.open) dialog.current.showModal()
    if (!settingsOpen && dialog.current.open) dialog.current.close()
  }, [settingsOpen])
  const openSettings = event => { settingsOpener.current = event.currentTarget; setSettingsOpen(true) }
  const closeSettings = () => {
    if (dialog.current.open) dialog.current.close()
    setSettingsOpen(false)
    settingsOpener.current?.focus({ preventScroll: true })
  }

  return <main className={`hero ${immersive ? 'is-immersive' : ''}`} id="hero" ref={root} data-mode={preferences.mode}>
    <MountainScene canvasRef={canvas} onError={() => setArtError(true)} />
    <p className="sr-only">A warm mountain landscape with a golden peak, a timber chalet and a green meadow, framed by large pink and crimson trees. Leaves drift with the breeze and foreground grass responds to the pointer.</p>
    <div className="interface" aria-hidden={immersive} inert={immersive}>
      <a className="skip-link" href="#moment">Skip to the moment</a>
      <header className="masthead">
        <a className="wordmark" href="#hero" aria-label="Skardu Spring home"><span className="brand-seal" aria-hidden="true"><BrandMark /></span><span>Skardu Spring<span className="brand-subtitle">PURE MOUNTAIN WATER</span></span></a>
        <span className="masthead-note"><span /> A place above the ordinary</span>
        <button className="top-scenery underlined" onClick={() => setImmersive(true)}>Scenery view <Icon name="expand" size={16}/></button>
      </header>
      <section className="hero-copy" id="moment" tabIndex={-1} aria-labelledby="hero-title">
        <p className="eyebrow reveal"><span className="eyebrow-rule" /> A PLACE ABOVE THE ORDINARY</p>
        <h1 id="hero-title" className="reveal">Some places<br /><em>stay with you.</em></h1>
        <p className="supporting-copy reveal">Beyond the city, the Karakoram opens into a world of stone, snow and quiet. This is the landscape that inspires Skardu Spring.</p>
        <div className="hero-actions reveal">
          <button ref={enterButton} className="button-primary magnetic" onClick={() => setImmersive(true)}>Enter the scenery <Icon name="arrow" size={19}/></button>
          <button className="button-text magnetic underlined" onClick={openSettings}>Set the mood <Icon name="sliders" size={17}/></button>
        </div>
      </section>
      <footer className="scene-footer">
        <div className="scene-coordinate"><span className="tiny-maple"><Icon name="leaf" size={24}/></span><span>FOLLOW THE MOUNTAIN BREEZE<span className="footer-subline">Move across the grass</span></span></div>
        <div className="scene-controls" role="group" aria-label="Scene controls">
          <button className="control wind-control" onClick={openSettings} aria-label="Adjust wind strength"><Icon name="wind" size={19}/><span>{windName}</span></button>
          <span className="control-divider" />
          <button className="control mode-control" aria-label={`Switch to ${preferences.mode === 'daylight' ? 'dusk' : 'daylight'}`} onClick={() => update({ mode: preferences.mode === 'daylight' ? 'dusk' : 'daylight' })}><Icon name={preferences.mode === 'daylight' ? 'sun' : 'moon'} size={19}/><span>{preferences.mode === 'daylight' ? 'Daylight' : 'Dusk'}</span></button>
          <span className="control-divider" />
          <button className="control pause-control" aria-label={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(value => !value)}><Icon name={paused ? 'play' : 'pause'} size={19}/><span>{paused ? 'Resume' : 'Pause'}</span></button>
        </div>
      </footer>
      {reduced && <p className="motion-note">{paused ? 'Motion reduced for your preference. Play to animate.' : 'Motion enabled for this visit.'}</p>}
      {artError && <p className="asset-note" role="alert">The landscape could not load. Please refresh to try again.</p>}
    </div>
    <button className="immersive-exit magnetic" hidden={!immersive} ref={exitButton} onClick={() => setImmersive(false)}><Icon name="close" size={18}/> Exit scenery <kbd>Esc</kbd></button>
    <button className="immersive-pause" hidden={!immersive} aria-label={paused ? 'Resume motion in scenery' : 'Pause motion in scenery'} onClick={() => setPaused(value => !value)}><Icon name={paused ? 'play' : 'pause'} size={18}/>{paused ? 'Resume' : 'Pause'}</button>
    <dialog className="mood-dialog" ref={dialog} aria-labelledby="mood-title" onCancel={closeSettings} onClose={() => setSettingsOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeSettings() }}>
      <div className="mood-panel">
        <div className="mood-heading"><span className="eyebrow">YOUR MOMENT, YOUR PACE</span><button className="dialog-close" aria-label="Close scene settings" onClick={closeSettings}><Icon name="close"/></button></div>
        <h2 id="mood-title">A change in<br /><em>the atmosphere.</em></h2>
        <label className="wind-label" htmlFor="wind-strength"><span>Wind strength</span><output htmlFor="wind-strength">{Math.round(preferences.wind * 100)}%</output></label>
        <input id="wind-strength" type="range" min="0" max="100" step="1" value={Math.round(preferences.wind * 100)} onChange={event => update({ wind: Number(event.target.value) / 100 })}/>
        <div className="range-ends"><span>Calm</span><span>Mountain gusts</span></div>
        <fieldset className="time-settings"><legend>Time of day</legend><div>{['daylight', 'dusk'].map(mode => <button key={mode} className={preferences.mode === mode ? 'selected' : ''} aria-pressed={preferences.mode === mode} onClick={() => update({ mode })}><Icon name={mode === 'daylight' ? 'sun' : 'moon'} size={19}/>{mode === 'daylight' ? 'Daylight' : 'Dusk'}</button>)}</div></fieldset>
        <button className="dialog-motion" aria-label={paused ? 'Resume scene motion' : 'Pause scene motion'} onClick={() => setPaused(value => !value)}><span><Icon name={paused ? 'play' : 'pause'}/>{paused ? 'Resume the moment' : 'Pause the moment'}</span><span>{paused ? 'Paused' : 'Playing'}</span></button>
        <p className="settings-note">The leaves, grass and mountain haze follow your pace. Wind and daylight are remembered in this browser.{reduced ? ' Your device prefers reduced motion; animation starts paused.' : ''}</p>
        <button className="mood-done underlined" onClick={closeSettings}>Back to the moment <Icon name="arrow" size={18}/></button>
      </div>
    </dialog>
  </main>
}
