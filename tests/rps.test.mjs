import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHOICES, WINS_NEEDED, createMatch, judge, resolveRound, nextRound,
  normalizeName, normalizeSaved, createSaved,
} from '../src/games/rock-paper-scissors/rules.js'

// This explicit matrix is deliberately independent of the production win map.
const outcomes = [
  ['rock', 'rock', 'tie'], ['rock', 'paper', 'loss'], ['rock', 'scissors', 'win'],
  ['paper', 'rock', 'win'], ['paper', 'paper', 'tie'], ['paper', 'scissors', 'loss'],
  ['scissors', 'rock', 'loss'], ['scissors', 'paper', 'win'], ['scissors', 'scissors', 'tie'],
]
for (const [player, computer, expected] of outcomes) {
  test(`${player} against ${computer} produces ${expected}`, () => {
    assert.equal(judge(player, computer), expected)
    const result = resolveRound(createMatch(), player, computer)
    assert.deepEqual(result.scores, { player: Number(expected === 'win'), computer: Number(expected === 'loss') })
    assert.equal(result.phase, 'reveal')
    assert.deepEqual(result.history, [{ player, computer, outcome: expected }])
  })
}

test('only the three supported choices are accepted', () => {
  assert.deepEqual(CHOICES, ['rock', 'paper', 'scissors'])
  for (const invalid of ['', 'Rock', 'lizard', null, undefined, 1, {}, []]) {
    assert.throws(() => judge(invalid, 'rock'), TypeError)
    assert.throws(() => judge('rock', invalid), TypeError)
  }
})

test('a best-of-five match ends at the third decisive win; ties do not consume rounds', () => {
  assert.equal(WINS_NEEDED, 3)
  const sequence = [
    ['rock', 'rock'], ['paper', 'paper'], ['paper', 'rock'],
    ['rock', 'paper'], ['rock', 'scissors'], ['scissors', 'rock'], ['scissors', 'paper'],
  ]
  let match = createMatch()
  for (const [index, [player, computer]] of sequence.entries()) {
    const previous = match
    const original = structuredClone(match)
    match = resolveRound(match, player, computer)
    assert.deepEqual(previous, original, 'rounds must not mutate earlier state')
    if (index < sequence.length - 1) {
      assert.equal(match.phase, 'reveal')
      match = nextRound(match)
    }
  }
  assert.equal(match.phase, 'complete')
  assert.deepEqual(match.scores, { player: 3, computer: 2 })
  assert.equal(match.history.filter((round) => round.outcome !== 'tie').length, 5)
  assert.equal(match.history.length, 7)
  assert.deepEqual(nextRound(match), match)
  assert.deepEqual(resolveRound(match, 'paper', 'rock'), match)
})

function resolveSequence(sequence) {
  let match = createMatch()
  for (const [player, computer] of sequence) match = resolveRound(nextRound(match), player, computer)
  return match
}

test('either side can win three straight rounds and a reveal locks rapid extra choices', () => {
  for (const [player, computer, winner] of [['paper', 'rock', 'player'], ['rock', 'paper', 'computer']]) {
    const match = resolveSequence(Array.from({ length: 3 }, () => [player, computer]))
    assert.equal(match.phase, 'complete')
    assert.equal(match.scores[winner], 3)
    assert.equal(match.history.length, 3)
  }
  const fresh = createMatch()
  const first = resolveRound(fresh, 'rock', 'scissors')
  assert.deepEqual(fresh, { phase: 'ready', scores: { player: 0, computer: 0 }, history: [] })
  assert.deepEqual(resolveRound(first, 'paper', 'rock'), first)
  const ready = nextRound(first)
  assert.equal(first.phase, 'reveal')
  assert.equal(ready.phase, 'ready')
  assert.equal(ready.history.length, 1)
})

test('optional names trim whitespace, remove control characters and cap their length', () => {
  assert.equal(normalizeName('  Waqar  '), 'Waqar')
  assert.equal(normalizeName(' \n\t '), '')
  assert.equal(normalizeName('Sail\u0000or\u007f'), 'Sailor')
  assert.equal(normalizeName('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnopqr')
  for (const value of [undefined, null, 42, {}, ['Name']]) assert.equal(normalizeName(value), '')
})

test('corrupt or unsupported storage safely returns defaults', () => {
  for (const value of [null, false, 5, 'garbage', [], {}, { version: 0 }, { version: 2 }]) {
    assert.deepEqual(normalizeSaved(value), createSaved())
  }
  const invalid = normalizeSaved({ version: 1, name: 5, sound: 'true', streak: -1, bestStreak: Infinity, match: 'bad' })
  assert.deepEqual(invalid, createSaved())
  for (const streak of [NaN, Infinity, -1, 1.2, '2', 1_000_000]) {
    assert.equal(normalizeSaved({ version: 1, streak }).streak, 0)
  }
  assert.equal(normalizeSaved({ version: 1, streak: 4, bestStreak: 1 }).bestStreak, 4)
})

test('saved ready, reveal and complete matches resume from verified choices', () => {
  const reveal = resolveRound(createMatch(), 'paper', 'rock')
  for (const match of [createMatch(), reveal, nextRound(reveal), resolveSequence([['paper', 'rock'], ['paper', 'rock'], ['paper', 'rock']])]) {
    const stored = { version: 1, name: '  Marina  ', sound: true, streak: 2, bestStreak: 5, match }
    const before = structuredClone(stored)
    const restored = normalizeSaved(stored)
    assert.deepEqual(restored.match, match)
    assert.equal(restored.name, 'Marina')
    assert.equal(restored.streak, 2)
    assert.equal(restored.bestStreak, 5)
    assert.equal(restored.sound, true)
    assert.deepEqual(stored, before)
  }
})

test('saved scores and outcomes are recomputed; impossible histories are discarded', () => {
  const forged = normalizeSaved({ version: 1, match: {
    phase: 'reveal', scores: { player: 999, computer: -4 }, history: [{ player: 'rock', computer: 'paper', outcome: 'win' }],
  } })
  assert.deepEqual(forged.match.scores, { player: 0, computer: 1 })
  assert.equal(forged.match.history[0].outcome, 'loss')
  const complete = resolveSequence([['paper', 'rock'], ['paper', 'rock'], ['paper', 'rock']])
  const invalidMatches = [
    { phase: 'mystery', history: [] }, { phase: 'reveal', history: [] },
    { phase: 'complete', history: [] }, { ...complete, phase: 'ready' },
    { phase: 'ready', history: [null] }, { phase: 'ready', history: [{ player: 'lizard', computer: 'rock' }] },
    { ...complete, history: [...complete.history, { player: 'rock', computer: 'rock' }] },
    { phase: 'ready', history: Array.from({ length: 1001 }, () => ({ player: 'rock', computer: 'rock' })) },
  ]
  for (const match of invalidMatches) assert.equal(normalizeSaved({ version: 1, match }).match, null)
})
