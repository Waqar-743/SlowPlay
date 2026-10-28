export const CHOICES = ['rock', 'paper', 'scissors']
export const WINS_NEEDED = 3
export const STORAGE_KEY = 'slow-arcade-rps-v1'

export function judge(player, computer) {
  if (!CHOICES.includes(player) || !CHOICES.includes(computer)) throw new TypeError('Choose rock, paper or scissors.')
  if (player === computer) return 'tie'
  return { rock: 'scissors', paper: 'rock', scissors: 'paper' }[player] === computer ? 'win' : 'loss'
}

export function createMatch() {
  return { phase: 'ready', scores: { player: 0, computer: 0 }, history: [] }
}

export function resolveRound(match, player, computer) {
  if (match.phase !== 'ready') return match
  const outcome = judge(player, computer)
  const scores = {
    player: match.scores.player + Number(outcome === 'win'),
    computer: match.scores.computer + Number(outcome === 'loss'),
  }
  return {
    phase: Math.max(scores.player, scores.computer) === WINS_NEEDED ? 'complete' : 'reveal',
    scores,
    history: [...match.history, { player, computer, outcome }],
  }
}

export function nextRound(match) {
  return match.phase === 'reveal' ? { ...match, phase: 'ready' } : match
}

export function normalizeName(value) {
  return typeof value === 'string' ? value.replace(/\p{Cc}/gu, '').trim().slice(0, 18) : ''
}

export function createSaved() {
  return { version: 1, name: '', sound: false, streak: 0, bestStreak: 0, match: null }
}

// Reconstruct a saved match from its choices. Stored scores/results are never
// authoritative, and a completed match cannot accept more rounds.
export function normalizeSaved(value) {
  const fresh = createSaved()
  if (!value || typeof value !== 'object' || value.version !== 1) return fresh
  const count = number => Number.isSafeInteger(number) && number >= 0 && number <= 999999 ? number : 0
  const streak = count(value.streak)
  const saved = { ...fresh, name: normalizeName(value.name), sound: value.sound === true, streak, bestStreak: Math.max(streak, count(value.bestStreak)) }
  if (!value.match || !Array.isArray(value.match.history) || value.match.history.length > 1000) return saved
  if (!['ready', 'reveal', 'complete'].includes(value.match.phase)) return saved
  let match = createMatch()
  for (const round of value.match.history) {
    if (!round || !CHOICES.includes(round.player) || !CHOICES.includes(round.computer) || match.phase === 'complete') return saved
    match = resolveRound(nextRound(match), round.player, round.computer)
  }
  if (match.phase === 'complete' && value.match.phase !== 'complete') return saved
  if (match.phase !== 'complete' && value.match.phase === 'complete') return saved
  if (value.match.phase === 'reveal' && match.history.length === 0) return saved
  saved.match = value.match.phase === 'ready' ? nextRound(match) : match
  return saved
}
