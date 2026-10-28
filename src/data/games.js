export const categories = ['All games', 'Relaxed', 'Strategy', 'Quick play']

// A single catalogue is the release boundary: only ready games have a playable module.
export const games = [
  { id: 'island-drift', name: 'Island Drift', genre: 'Exploration', players: '1 player', categories: ['Relaxed'], ready: true, description: 'A wooden boat, a quiet island, and nowhere you need to be.' },
  { id: 'rock-paper-scissors', name: 'Rock Paper Scissors', genre: 'Hand duel', players: '1 player', categories: ['Quick play'], ready: true, description: 'Pick your hand. First to three wins. Build a match streak, one good guess at a time.' },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', genre: 'Strategy', players: '1–2 players', categories: ['Strategy', 'Quick play'], ready: false, description: 'Three in a row. A small grid with room for a clever move.', roadmap: 'Computer opponent, local two-player, turn indicators and restart.' },
  { id: 'memory-match', name: 'Memory Match', genre: 'A little focus', players: '1 player', categories: ['Relaxed'], ready: false, description: 'Turn a card, find a pair, and give your memory a moment to shine.', roadmap: 'Difficulties, move counter, timer and personal bests.' },
  { id: 'snake', name: 'Snake', genre: 'Arcade', players: '1 player', categories: ['Quick play'], ready: false, description: 'One more turn. The winding, growing arcade favourite.', roadmap: 'Speed levels, score, pause, keyboard and touch controls.' },
  { id: '2048', name: '2048', genre: 'Numbers & strategy', players: '1 player', categories: ['Strategy', 'Relaxed'], ready: false, description: 'Slide, combine, repeat. Find a little order in the numbers.', roadmap: 'Keyboard, swipe and directional controls, saved progress and score.' },
]
