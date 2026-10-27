import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import Icon from './components/Icon'
import GameArtwork from './components/GameArtwork'
import { categories, games } from './data/games'

const IslandDrift = lazy(() => import('./games/island-drift/IslandDrift.jsx'))
const art = `${import.meta.env.BASE_URL}art/`

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
    <p>Our first escape is Island Drift: one island, an open sea, and no finish line. The other five games will arrive one at a time.</p>
    <p className="privacy-note">Your settings and sailing bests stay in this browser. Clearing browser data clears them too.</p>
    <button className="button button-primary" onClick={() => dialogRef.current.close()}>Sounds good <Icon name="check" size={18}/></button>
  </dialog>
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash === '#/island-drift' ? 'island-drift' : 'library')
  const [category, setCategory] = useState('All games')
  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const restoreLibraryFocus = useRef(false)
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash === '#/island-drift' ? 'island-drift' : 'library')
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
  useEffect(() => { document.title = route === 'library' ? 'Slowplay — A little play. A little escape.' : 'Island Drift — Slowplay' }, [route])
  // Menu actions commit their screen during the click, without waiting behind
  // a rendered frame for the browser's later hashchange notification.
  const openGame = () => { setRoute('island-drift'); window.location.hash = '/island-drift' }
  const back = () => { restoreLibraryFocus.current = true; setRoute('library'); window.location.hash = '/' }
  if (route === 'island-drift') return <GameBoundary onBack={back}><Suspense fallback={<main className="load-screen" aria-busy="true"><Icon name="compass" size={42}/><h1>Finding your island…</h1><p>Gathering the boat, the sea, and a little sunshine.</p><div className="loading-paint"/></main>}><IslandDrift onBack={back}/></Suspense></GameBoundary>
  const visibleGames = games.filter(game => category === 'All games' || game.categories.includes(category))
  return <>
    <a className="skip-link" href="#games">Skip to games</a>
    <header className="site-header page-width">
      <a className="wordmark" href="#/" aria-label="Slowplay home"><span className="brand-mark"><Icon name="compass" size={24}/></span>slowplay<span className="brand-period">.</span></a>
      <nav aria-label="Main navigation"><a className="nav-link" href="#games">The games</a><button className="nav-link" onClick={() => dialogRef.current.showModal()}>Our little world <Icon name="arrow-right" size={15}/></button></nav>
      <span className="header-note"><span/> Made for a moment off.</span>
    </header>
    <main className="page-width">
      <section className="intro" aria-labelledby="library-heading">
        <div><p className="eyebrow"><span className="small-line"/> Your pocket-sized escape</p><h1 id="library-heading" tabIndex={-1} ref={headingRef}>A little play.<br/><span>A little escape.</span></h1></div>
        <div className="intro-aside"><Icon name="wind" size={34}/><p>Small games. Slow moments. <br/>Find something you love, <br/>and stay a little while.</p><a href="#games" className="inline-link">Find your next game <Icon name="down" size={17}/></a></div>
      </section>
      <section className="featured" aria-labelledby="featured-title">
        <div className="featured-copy"><p className="eyebrow"><span className="availability-dot"/> First escape · Now playing</p><span className="feature-number">01 / THE COLLECTION</span><h2 id="featured-title">Island<br/><em>Drift</em><span className="title-star"><Icon name="sun" size={44}/></span></h2><p>Leave the rush on shore. Take the helm of a wooden boat and find your own way around a sun-washed island.</p><div className="feature-tags"><span>Exploration</span><span>At your own pace</span></div><button className="button button-primary feature-play" onClick={openGame}><Icon name="play" size={18}/> Play Island Drift <Icon name="arrow-right" size={20}/></button><span className="feature-footnote">Free to wander. Nothing to win.</span></div>
        <button className="featured-art" onClick={openGame} aria-label="Play Island Drift from painting"><img src={`${art}island-day.webp`} alt="Watercolor painting of a man steering a wooden boat beside a palm-covered island" fetchPriority="high"/><span className="art-corner"><Icon name="sun" size={17}/> A change of scenery</span><span className="art-play"><Icon name="play" size={25}/></span><span className="art-caption">One island. Endless little discoveries.</span></button>
      </section>
      <section className="library-section" id="games" aria-labelledby="collection-title">
        <div className="section-heading"><div><p className="eyebrow">Pick your kind of pause</p><h2 id="collection-title">The collection<span> / 06</span></h2></div><span className="collection-note">One ready to explore. Five on the horizon.</span></div>
        <div className="filter-bar"><div role="group" aria-label="Filter games by category">{categories.map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={category === item ? 'filter active' : 'filter'}>{item}</button>)}</div><span className="filter-count" aria-live="polite">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'}</span></div>
        <div className="game-grid">{visibleGames.map(game => <article className={`game-card game-${game.id}`} key={game.id}>
          <div className="game-card-art">{game.id === 'island-drift' ? <img src={`${art}island-day.webp`} alt="Wooden boat sailing past a tropical island" loading="lazy"/> : <GameArtwork game={game.id}/>}<span className={`release-label ${game.ready ? 'ready' : ''}`}>{game.ready ? 'Ready to play' : 'On the horizon'}</span>{game.ready && <button className="round-play" onClick={openGame} aria-label="Play Island Drift from collection"><Icon name="play" size={22}/></button>}</div>
          <div className="card-meta"><span>{game.genre}</span><span>{game.players}</span></div><div className="card-title-row"><h3>{game.name}</h3>{game.ready ? <button className="card-play" onClick={openGame}>Play <Icon name="arrow-right" size={17}/></button> : <span className="planned-label">Coming later</span>}</div><p>{game.description}</p>
        </article>)}</div>
      </section>
      <section className="closing-note"><Icon name="anchor" size={27}/><p>No leaderboard to chase.<br/><strong>Just a good place to spend a little time.</strong></p><span className="closing-flourish" aria-hidden="true">~</span></section>
    </main>
    <footer className="site-footer page-width"><a className="wordmark footer-brand" href="#/">slowplay.</a><span>A small collection. A slower pace.</span><button className="text-button" onClick={() => dialogRef.current.showModal()}>About this arcade <Icon name="arrow-right" size={14}/></button></footer>
    <AboutDialog dialogRef={dialogRef}/>
  </>
}
