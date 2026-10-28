import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import Icon from './components/Icon'
import GameArtwork from './components/GameArtwork'
import PixelBackdrop from './components/PixelBackdrop'
import { categories, games } from './data/games'

const gameModules = {
  'island-drift': lazy(() => import('./games/island-drift/IslandDrift.jsx')),
  'rock-paper-scissors': lazy(() => import('./games/rock-paper-scissors/RockPaperScissors.jsx')),
}
const art = `${import.meta.env.BASE_URL}art/`
const readyCount = games.filter(game => game.ready).length
const plannedCount = games.length - readyCount
function readRoute() {
  const id = window.location.hash.slice(2)
  return Object.hasOwn(gameModules, id) && games.some(game => game.id === id && game.ready) ? id : 'library'
}

class GameBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="load-screen"><Icon name="anchor" size={42}/><h1>A small detour.</h1><p>The game could not load. Check your connection and try again.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload arcade</button><button className="text-button" onClick={this.props.onBack}>Back to games</button></main>
    return this.props.children
  }
}

function AboutDialog({ dialogRef }) {
  return <dialog className="about-dialog" ref={dialogRef} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
    <button className="icon-button dialog-close" aria-label="Close about" onClick={() => dialogRef.current.close()}><Icon name="close"/></button>
    <Icon name="compass" size={36}/><p className="eyebrow">A slower kind of arcade</p><h2>Make room<br/>for a little play.</h2>
    <p>Slowplay is a growing collection of small browser games. No accounts, no downloads. Just a little space to unwind.</p>
    <p>Sail the open sea in Island Drift or challenge the computer in Rock Paper Scissors. More games will arrive one at a time.</p>
    <p className="privacy-note">Your settings, supported progress and personal bests stay in this browser. Clearing browser data clears them too.</p>
    <button className="button button-primary" onClick={() => dialogRef.current.close()}>Sounds good <Icon name="check" size={18}/></button>
  </dialog>
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [category, setCategory] = useState('All games')
  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const restoreLibraryFocus = useRef(false)
  const routeRef = useRef(route)
  useEffect(() => { routeRef.current = route }, [route])
  useEffect(() => {
    const onHash = () => {
      const next = readRoute()
      if (next === 'library' && routeRef.current !== 'library') restoreLibraryFocus.current = true
      setRoute(next)
      if (window.location.hash === '#games') requestAnimationFrame(() => document.getElementById('games')?.scrollIntoView())
      else window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (route === 'library' && restoreLibraryFocus.current) {
      restoreLibraryFocus.current = false
      headingRef.current?.focus()
    }
  }, [route])
  useEffect(() => { document.title = route === 'library' ? 'Slowplay — A little play. A little escape.' : `${games.find(game => game.id === route)?.name} — Slowplay` }, [route])
  // Menu actions commit their screen during the click, without waiting behind
  // a rendered frame for the browser's later hashchange notification.
  const openGame = (id = 'island-drift') => { if (!Object.hasOwn(gameModules, id)) return; setRoute(id); window.location.hash = `/${id}` }
  const back = () => { restoreLibraryFocus.current = true; setRoute('library'); window.location.hash = '/' }
  const ActiveGame = gameModules[route]
  if (ActiveGame) return <GameBoundary key={route} onBack={back}><Suspense fallback={<main className="load-screen" aria-busy="true"><Icon name={route === 'island-drift' ? 'compass' : 'play'} size={42}/><h1>{route === 'island-drift' ? 'Finding your island…' : 'Opening the duel…'}</h1><p>{route === 'island-drift' ? 'Gathering the boat, the sea, and a little sunshine.' : 'Rock, paper, scissors. Your next match is almost ready.'}</p><div className="loading-paint"/></main>}><ActiveGame onBack={back}/></Suspense></GameBoundary>
  const visibleGames = games.filter(game => category === 'All games' || game.categories.includes(category))
  return <div className="arcade-site">
    <a className="skip-link" href="#games">Skip to games</a>
    <header className="site-header page-width">
      <a className="wordmark" href="#/" aria-label="Slowplay home"><span className="brand-mark"><Icon name="compass" size={24}/></span>slowplay<span className="brand-period">.</span></a>
      <nav aria-label="Main navigation"><a className="nav-link" href="#games">The games</a><button className="nav-link" onClick={() => dialogRef.current.showModal()}>Our little world <Icon name="arrow-right" size={15}/></button></nav>
      <span className="header-note"><span/> A good place to get lost.</span>
    </header>
    <main className="page-width">
      <section className="intro" aria-labelledby="library-heading">
        <PixelBackdrop/>
        <div className="intro-copy"><p className="eyebrow"><span className="availability-dot"/> Browser arcade · No downloads</p><h1 id="library-heading" tabIndex={-1} ref={headingRef}>A little play.<br/><span>A little escape.</span></h1><p className="intro-lede">Step out of the everyday.<br/>Small games. New worlds. Your own pace.</p><div className="intro-actions"><button className="button button-primary" onClick={() => openGame('island-drift')}><Icon name="play" size={18}/> Play Island Drift</button><button className="button button-secondary hero-duel" onClick={() => openGame('rock-paper-scissors')}><Icon name="play" size={18}/> Play Rock Paper Scissors</button><a href="#games" className="inline-link">Find your next game <Icon name="down" size={18}/></a></div></div>
        <div className="intro-aside"><span className="hero-status"><Icon name="compass" size={20}/> {String(readyCount).padStart(2, '0')} WORLDS ARE OPEN</span><p>Drift away. Or pick a hand.<br/>Find your kind of play.</p></div>
        <div className="hero-bottom"><span>PRESS PLAY. TAKE YOUR TIME.</span><span>{String(readyCount).padStart(2, '0')} READY / {String(plannedCount).padStart(2, '0')} IN THE WORKS <Icon name="down" size={14}/></span></div>
      </section>
      <section className="featured" aria-labelledby="featured-title">
        <div className="featured-copy"><p className="eyebrow"><span className="availability-dot"/> First escape · Now playing</p><span className="feature-number">01 / THE COLLECTION</span><h2 id="featured-title">Island<br/><em>Drift</em><span className="title-star"><Icon name="sun" size={36}/></span></h2><p>Leave the rush on shore. Take the helm of a wooden boat and find your own way around a sun-washed island.</p><div className="feature-tags"><span>Exploration</span><span>At your own pace</span></div><button className="button button-primary feature-play" onClick={() => openGame('island-drift')}><Icon name="play" size={18}/> Set course <Icon name="arrow-right" size={20}/></button><span className="feature-footnote">Free to wander. Nothing to win.</span></div>
        <button className="featured-art" onClick={() => openGame('island-drift')} aria-label="Play Island Drift from painting"><img src={`${art}island-day.webp`} alt="Watercolor painting of a man steering a wooden boat beside a palm-covered island" fetchPriority="high"/><span className="art-corner"><Icon name="sun" size={17}/> A change of scenery</span><span className="art-play"><Icon name="play" size={25}/></span><span className="art-caption">One island. Endless little discoveries.</span></button>
      </section>
      <section className="library-section" id="games" aria-labelledby="collection-title">
        <div className="section-heading"><div><p className="eyebrow">Pick your kind of pause</p><h2 id="collection-title">The collection<span> / {String(games.length).padStart(2, '0')}</span></h2></div><span className="collection-note">{readyCount} ready to play. {plannedCount} on the horizon.</span></div>
        <div className="filter-bar"><div role="group" aria-label="Filter games by category">{categories.map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={category === item ? 'filter active' : 'filter'}>{item}</button>)}</div><span className="filter-count" aria-live="polite">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'}</span></div>
        <div className="game-grid">{visibleGames.map(game => <article className={`game-card game-${game.id}`} key={game.id}>
          <div className="game-card-art">{game.id === 'island-drift' ? <img src={`${art}island-day.webp`} alt="Wooden boat sailing past a tropical island" loading="lazy"/> : <GameArtwork game={game.id}/>}<span className={`release-label ${game.ready ? 'ready' : ''}`}>{game.ready ? 'Ready to play' : 'On the horizon'}</span>{game.ready && <button className="round-play" onClick={() => openGame(game.id)} aria-label={`Play ${game.name} from collection`}><Icon name="play" size={22}/></button>}</div>
          <div className="card-meta"><span>{game.genre}</span><span>{game.players}</span></div><div className="card-title-row"><h3>{game.name}</h3>{game.ready ? <button className="card-play" onClick={() => openGame(game.id)} aria-label={`Play ${game.name} from card`}>Play <Icon name="arrow-right" size={17}/></button> : <span className="planned-label">Coming later</span>}</div><p>{game.description}</p>
        </article>)}</div>
      </section>
      <section className="closing-note"><span className="closing-icon"><Icon name="anchor" size={27}/></span><p>No leaderboard to chase.<br/><strong>Just a good place to spend a little time.</strong></p><span className="closing-flourish" aria-hidden="true">[ ESC ]</span></section>
    </main>
    <footer className="site-footer page-width"><a className="wordmark footer-brand" href="#/">slowplay.</a><span>A small collection. A slower pace.</span><button className="text-button" onClick={() => dialogRef.current.showModal()}>About this arcade <Icon name="arrow-right" size={14}/></button></footer>
    <AboutDialog dialogRef={dialogRef}/>
  </div>
}
