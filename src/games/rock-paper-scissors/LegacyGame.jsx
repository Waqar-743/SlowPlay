import { useState, useEffect } from 'react'
import SplashCursor from './SplashCursor'

const CHOICES = [
  { name: 'Rock', icon: '🪨', beats: 'Scissors' },
  { name: 'Paper', icon: '📄', beats: 'Rock' },
  { name: 'Scissors', icon: '✂️', beats: 'Paper' }
]

function App() {
  const [playerName, setPlayerName] = useState('')
  const [gamePhase, setGamePhase] = useState('welcome') // welcome, playing, result
  const [playerChoice, setPlayerChoice] = useState(null)
  const [computerChoice, setComputerChoice] = useState(null)
  const [result, setResult] = useState(null) // win, lose, tie
  const [score, setScore] = useState({ player: 0, computer: 0 })
  const [inputValue, setInputValue] = useState('')

  const handleStartGame = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setPlayerName(inputValue)
      setGamePhase('playing')
    }
  }

  const handleChoice = (choice) => {
    setPlayerChoice(choice)

    // Random computer choice
    const randomChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)]
    setComputerChoice(randomChoice)

    // Determine winner
    if (choice.name === randomChoice.name) {
      setResult('tie')
    } else if (choice.beats === randomChoice.name) {
      setResult('win')
      setScore(prev => ({ ...prev, player: prev.player + 1 }))
    } else {
      setResult('lose')
      setScore(prev => ({ ...prev, computer: prev.computer + 1 }))
    }

    setGamePhase('result')
  }

  const resetRound = () => {
    setGamePhase('playing')
    setPlayerChoice(null)
    setComputerChoice(null)
    setResult(null)
  }

  const resetGame = () => {
    setGamePhase('welcome')
    setPlayerName('')
    setInputValue('')
    setScore({ player: 0, computer: 0 })
    setPlayerChoice(null)
    setComputerChoice(null)
    setResult(null)
  }

  return (
    <>
      <SplashCursor />
      <div className="container">
        <h1>Rock Paper Scissors</h1>

        {gamePhase === 'welcome' && (
          <div className="input-group">
            <p className="subtitle">Enter your name to begin the challenge</p>
            <form onSubmit={handleStartGame} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Your Name"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                maxLength={15}
              />
              <button type="submit" className="btn" disabled={!inputValue.trim()}>
                Start Game
              </button>
            </form>
          </div>
        )}

        {gamePhase !== 'welcome' && (
          <>
            <div className="scoreboard">
              <div className="score-item">
                <span className="score-label">{playerName}</span>
                <span className="score-value">{score.player}</span>
              </div>
              <div className="score-item">
                <span className="score-label">Computer</span>
                <span className="score-value">{score.computer}</span>
              </div>
            </div>

            {gamePhase === 'playing' && (
              <div className="game-area">
                <p className="subtitle">Choose your weapon</p>
                <div className="choices-grid">
                  {CHOICES.map((choice) => (
                    <div
                      key={choice.name}
                      className="choice-card"
                      onClick={() => handleChoice(choice)}
                    >
                      <div className="choice-icon">{choice.icon}</div>
                      <div className="choice-name">{choice.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gamePhase === 'result' && (
              <div className="result-container">
                <h2 className={`result-title result-${result}`}>
                  {result === 'win' && 'You Win! 🎉'}
                  {result === 'lose' && 'You Lose 😔'}
                  {result === 'tie' && "It's a Tie 🤝"}
                </h2>

                <div className="matchup">
                  <div className="score-item matchup-card">
                    <span className="score-label">You</span>
                    <div className="choice-icon" style={{ fontSize: '3rem' }}>{playerChoice?.icon}</div>
                    <div className="choice-name">{playerChoice?.name}</div>
                  </div>

                  <div className="vs">VS</div>

                  <div className="score-item matchup-card">
                    <span className="score-label">Computer</span>
                    <div className="choice-icon" style={{ fontSize: '3rem' }}>{computerChoice?.icon}</div>
                    <div className="choice-name">{computerChoice?.name}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button className="btn" onClick={resetRound}>
                    Play Again
                  </button>
                  <button className="btn btn-secondary" onClick={resetGame}>
                    Quit Game
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default App
