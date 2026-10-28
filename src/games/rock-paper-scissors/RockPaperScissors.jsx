import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import PixelBackdrop from '../../components/PixelBackdrop'
import ChoiceArtwork from './ChoiceArtwork'
import { CHOICES, STORAGE_KEY, createMatch, createSaved, nextRound, normalizeName, normalizeSaved, resolveRound } from './rules'
import './rps.css'

const ART = `${import.meta.env.BASE_URL}art/rps/`
const choiceLabels = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' }
const keyChoices = { '1': 'rock', r: 'rock', '2': 'paper', p: 'paper', '3': 'scissors', s: 'scissors' }
const rules = [ ['rock', 'scissors', 'Rock breaks scissors'], ['paper', 'rock', 'Paper covers rock'], ['scissors', 'paper', 'Scissors cut paper'] ]

function readSaved() {
  try { return normalizeSaved(JSON.parse(localStorage.getItem(STORAGE_KEY))) } catch { return createSaved() }
}

function Score({ name, score, side }) {
  return <div className={`rps-score rps-score-${side}`}>
    <span className="rps-score-name">{name}</span>
    <strong data-testid={`rps-${side}-score`} aria-label={`${name}: ${score} round wins`}>{score}<span> / 3</span></strong>
    <div className="rps-score-marks" aria-hidden="true">{[0, 1, 2].map(mark => <i key={mark} className={mark < score ? 'is-earned' : ''} />)}</div>
  </div>
}

function Streaks({ streak, bestStreak }) {
  return <div className="rps-streaks">
    <div><span>Match win streak</span><strong data-testid="rps-current-streak">{streak}</strong></div>
    <div><span>Personal best</span><strong data-testid="rps-best-streak">{bestStreak}</strong></div>
  </div>
}

function HowToPlay() {
  return <details className="rps-help">
    <summary><Icon name="help" size={18} /> How to play <Icon name="down" size={15} /></summary>
    <div className="rps-help-content">
      <p>Choose a hand. The computer chooses independently. First to 3 round wins takes the match. Ties replay without using a round.</p>
      <div className="rps-rule-list">{rules.map(([winner, loser, description]) => <div key={winner}>
        <ChoiceArtwork choice={winner} size={40} /><Icon name="right" size={16} /><ChoiceArtwork choice={loser} size={40} /><span>{description}</span>
      </div>)}</div>
      <p><strong>Keyboard:</strong> 1 or R = Rock · 2 or P = Paper · 3 or S = Scissors. Use Tab and Enter for every button.</p>
      <p>Choose <strong>Next round</strong> when you are ready. Streaks count completed matches. Preferences, streaks and your current match stay in this browser.</p>
    </div>
  </details>
}

export default function RockPaperScissors({ onBack }) {
  const [saved, setSaved] = useState(readSaved)
  const [name, setName] = useState(saved.name)
  const [launched, setLaunched] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const firstChoice = useRef(null)
  const nextAction = useRef(null)
  const lock = useRef(false)
  const focusAfterRender = useRef(null)
  const audio = useRef(null)
  const match = saved.match
  const playerName = saved.name || 'You'
  const phase = launched ? match?.phase : 'title'
  const lastRound = phase === 'ready' || phase === 'title' ? null : match?.history.at(-1)
  const decisiveRounds = match ? match.scores.player + match.scores.computer : 0
  const ties = match ? match.history.length - decisiveRounds : 0
  const wonMatch = phase === 'complete' && match.scores.player === 3

  const commitSaved = useCallback(update => {
    const next = typeof update === 'function' ? update(saved) : update
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setStorageAvailable(true)
    } catch { setStorageAvailable(false) }
    setSaved(next)
  }, [saved])

  useEffect(() => {
    if (focusAfterRender.current === 'choice') firstChoice.current?.focus({ preventScroll: true })
    if (focusAfterRender.current === 'next') nextAction.current?.focus({ preventScroll: true })
    focusAfterRender.current = null
  }, [saved, launched])

  useEffect(() => () => {
    const context = audio.current
    audio.current = null
    context?.close().catch(() => {})
  }, [])

  const playTone = useCallback(outcome => {
    if (!saved.sound) return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      if (!audio.current || audio.current.state === 'closed') audio.current = new AudioContext()
      const context = audio.current
      context.resume().catch(() => {})
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(outcome === 'win' ? 523.25 : outcome === 'loss' ? 220 : 330, now)
      oscillator.frequency.setValueAtTime(outcome === 'win' ? 783.99 : outcome === 'loss' ? 164.81 : 330, now + 0.09)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.055, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.25)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    } catch { /* A blocked audio device never interrupts a match. */ }
  }, [saved.sound])

  const choose = useCallback(choice => {
    if (!launched || lock.current || match?.phase !== 'ready') return
    lock.current = true
    const computer = CHOICES[Math.floor(Math.random() * CHOICES.length)]
    const resolved = resolveRound(match, choice, computer)
    const streak = resolved.phase === 'complete' ? resolved.scores.player === 3 ? saved.streak + 1 : 0 : saved.streak
    focusAfterRender.current = 'next'
    commitSaved({ ...saved, match: resolved, streak, bestStreak: Math.max(saved.bestStreak, streak) })
    playTone(resolved.history.at(-1).outcome)
  }, [launched, match, saved, playTone, commitSaved])

  useEffect(() => {
    if (!launched) return undefined
    const handleKey = event => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], summary')) return
      const choice = keyChoices[event.key.toLowerCase()]
      if (choice && match?.phase === 'ready') { event.preventDefault(); choose(choice) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [launched, choose, match?.phase])

  const startMatch = (resume = false) => {
    lock.current = resume && match?.phase !== 'ready'
    focusAfterRender.current = resume && match?.phase !== 'ready' ? 'next' : 'choice'
    commitSaved(previous => ({ ...previous, name: normalizeName(name), match: resume ? previous.match : createMatch() }))
    setLaunched(true)
  }
  const advance = () => {
    lock.current = false
    focusAfterRender.current = 'choice'
    commitSaved(previous => ({ ...previous, match: nextRound(previous.match) }))
  }
  const restart = () => {
    lock.current = false
    focusAfterRender.current = 'choice'
    commitSaved(previous => ({ ...previous, match: createMatch() }))
  }
  const toggleSound = () => {
    if (saved.sound) { audio.current?.close().catch(() => {}); audio.current = null }
    commitSaved(previous => ({ ...previous, sound: !previous.sound }))
  }
  const saveName = event => {
    const value = event.target.value
    setName(value)
    commitSaved(previous => ({ ...previous, name: normalizeName(value) }))
  }
  const resultHeading = phase === 'complete' ? wonMatch ? `${playerName === 'You' ? 'You win' : `${playerName} wins`} the match!` : 'Computer wins the match' : lastRound?.outcome === 'tie' ? 'Same hand. Try again.' : lastRound?.outcome === 'win' ? 'Your point!' : 'Computer takes the point'
  const resultDescription = lastRound ? lastRound.outcome === 'tie' ? `${choiceLabels[lastRound.player]} meets ${choiceLabels[lastRound.computer]}. This round is replayed.` : `${choiceLabels[lastRound.outcome === 'win' ? lastRound.player : lastRound.computer]} beats ${choiceLabels[lastRound.outcome === 'win' ? lastRound.computer : lastRound.player]}. ${phase === 'complete' ? 'A good match. Fancy another?' : 'Choose Next round to keep playing.'}` : 'Pick your hand below. The computer is ready.'

  return <main className={`rps-game ${launched ? 'rps-launched' : ''}`} data-phase={phase}>
    <div className="rps-topline">
      <button className="rps-back" onClick={onBack}><Icon name="left" size={18} /> Back to games</button>
      <span className="rps-edition">SLOWPLAY / 02</span>
      <button className="rps-sound" aria-label="Sound" aria-pressed={saved.sound} onClick={toggleSound}><Icon name={saved.sound ? 'sound' : 'mute'} size={18} /><span>Sound: {saved.sound ? 'on' : 'off'}</span></button>
    </div>

    {!launched ? <>
      <section className="rps-intro" aria-labelledby="rps-title">
        <div className="rps-intro-copy">
          <p className="eyebrow"><span className="availability-dot" /> THE CLASSIC / A LITTLE RIVALRY</p>
          <h1 id="rps-title"><span>Rock.</span><span>Paper.</span><em>Scissors.</em></h1>
          <p className="rps-intro-lede">A quick duel of instinct.</p>
          <p className="rps-intro-description">Three familiar hands. One friendly opponent. Be first to win three rounds and build your match streak.</p>
          <label className="rps-name">Your name <span>(optional)</span><input aria-label="Your name (optional)" type="text" value={name} onChange={saveName} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); startMatch(Boolean(match)) } }} maxLength={18} autoComplete="nickname" placeholder="You" /><small>Up to 18 characters. Leave blank to play as You.</small></label>
          <div className="rps-start-actions">
            <button className="button button-primary" onClick={() => startMatch(Boolean(match))}><Icon name="play" size={18} />{match ? 'Resume match' : 'Start match'}</button>
            {match && <button className="rps-text-button" onClick={() => startMatch(false)}>Start new match <Icon name="right" size={16} /></button>}
          </div>
          {match && <p className="rps-resume-note">Saved match: {match.scores.player} – {match.scores.computer}{match.phase === 'complete' ? ' · final result' : ' · ready when you are'}</p>}
        </div>
        <div className="rps-intro-art"><PixelBackdrop /><img src={`${ART}duel-card.svg`} alt="Rock, paper and scissors hands facing off in a pixel forest arena" /><div className="rps-art-label"><i /> BEST OF FIVE · FIRST TO THREE</div></div>
      </section>
      <div className="rps-intro-bottom"><Streaks streak={saved.streak} bestStreak={saved.bestStreak} /><p>Just you vs. the computer.<br /><span>No clock. No rush.</span></p></div>
      <HowToPlay />
    </> : <>
      <header className="rps-heading"><div><p className="eyebrow">QUICK PLAY / FIRST TO THREE</p><h1>Rock Paper <em>Scissors</em></h1></div><button className="rps-restart" onClick={restart}><Icon name="restart" size={18} /> Restart match</button></header>
      <div className="rps-play-layout">
        <section className="rps-arena" aria-label="Rock Paper Scissors match">
          <div className="rps-scoreboard"><Score name={playerName} score={match.scores.player} side="player" /><div className="rps-round"><span>{phase === 'complete' ? 'MATCH OVER' : `ROUND ${Math.min(decisiveRounds + (phase === 'ready' ? 1 : lastRound?.outcome === 'tie' ? 1 : 0), 5)}`}</span><strong>VS</strong><small>{ties} {ties === 1 ? 'tie' : 'ties'} · replayed</small></div><Score name="Computer" score={match.scores.computer} side="computer" /></div>
          <div className={`rps-duel ${lastRound ? `rps-revealed rps-outcome-${lastRound.outcome}` : ''}`}>
            <PixelBackdrop />
            <div className="rps-arena-floor" aria-hidden="true" />
            <div className={`rps-contender rps-contender-player ${lastRound?.outcome === 'win' ? 'is-winner' : ''}`}><span>{playerName}</span><div className="rps-hand"><ChoiceArtwork choice={lastRound?.player || 'unknown'} /></div><strong>{lastRound ? choiceLabels[lastRound.player] : 'YOUR MOVE'}</strong></div>
            <div className="rps-duel-center" aria-hidden="true">{lastRound?.outcome === 'tie' ? '=' : lastRound ? 'VS' : '?'}</div>
            <div className={`rps-contender rps-contender-computer ${lastRound?.outcome === 'loss' ? 'is-winner' : ''}`}><span>Computer</span><div className="rps-hand"><ChoiceArtwork choice={lastRound?.computer || 'unknown'} /></div><strong>{lastRound ? choiceLabels[lastRound.computer] : 'READY'}</strong></div>
          </div>
          <div className={`rps-result ${phase === 'complete' ? 'rps-match-result' : ''}`} role="status" aria-live="polite" aria-atomic="true" data-testid="rps-result">
            <div><p className="rps-result-label">{phase === 'ready' ? 'MAKE YOUR MOVE' : phase === 'complete' ? 'FINAL RESULT' : lastRound?.outcome === 'tie' ? 'TIE / ROUND REPLAYS' : 'ROUND RESULT'}</p><h2>{phase === 'ready' ? 'Trust your instincts.' : resultHeading}</h2><p>{resultDescription}</p></div>
            {phase !== 'ready' && <button ref={nextAction} className="button button-primary" onClick={phase === 'complete' ? restart : advance}>{phase === 'complete' ? <Icon name="restart" size={18} /> : <Icon name="right" size={18} />}{phase === 'complete' ? 'Play again' : 'Next round'}</button>}
          </div>
          <div className="rps-choices" role="group" aria-label="Choose your hand">{CHOICES.map((choice, index) => <button ref={index === 0 ? firstChoice : null} key={choice} className="rps-choice" aria-label={choiceLabels[choice]} disabled={phase !== 'ready'} onClick={() => choose(choice)}><ChoiceArtwork choice={choice} size={70} /><span>{choiceLabels[choice]}<small><kbd>{index + 1}</kbd> or <kbd>{choice[0].toUpperCase()}</kbd></small></span><Icon name="right" size={18} /></button>)}</div>
        </section>
        <aside className="rps-ledger" aria-label="Match record">
          <Streaks streak={saved.streak} bestStreak={saved.bestStreak} />
          <div className="rps-history"><div className="rps-history-heading"><h2>This match</h2><span data-testid="rps-history-count">{match.history.length} {match.history.length === 1 ? 'throw' : 'throws'}</span></div>{match.history.length ? <ol aria-label="Round history">{match.history.slice(-12).map((round, index) => <li key={match.history.length - Math.min(12, match.history.length) + index}><span className="rps-history-index">{match.history.length - Math.min(12, match.history.length) + index + 1}</span><ChoiceArtwork choice={round.player} size={30} /><span className="rps-history-vs">vs</span><ChoiceArtwork choice={round.computer} size={30} /><strong className={`rps-history-${round.outcome}`}>{round.outcome === 'tie' ? 'Tie' : round.outcome === 'win' ? 'You +1' : 'CPU +1'}</strong></li>)}</ol> : <div className="rps-history-empty"><Icon name="play" size={23} /><p>Your first throw<br />starts the story.</p></div>}{match.history.length > 12 && <p className="rps-history-note">Showing the latest 12 throws.</p>}</div>
          <p className="rps-ledger-note"><Icon name="check" size={15} />{storageAvailable ? 'Progress saved in this browser.' : 'Progress is kept for this visit.'}</p>
        </aside>
      </div>
      <HowToPlay />
    </>}
    {!storageAvailable && <p className="rps-storage-note" role="status">Browser storage is unavailable. You can keep playing; progress will reset after leaving.</p>}
    <footer className="rps-footer"><span>ONE HAND AT A TIME.</span><span>Touch or keyboard <Icon name="check" size={15} /></span></footer>
  </main>
}
