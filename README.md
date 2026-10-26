# Slowplay arcade

A responsive React + Vite browser arcade. **Island Drift is the first playable release.** The catalogue includes the complete six-game roadmap; the other five games are deliberately marked as future releases. The original Rock Paper Scissors source is preserved verbatim in `src/games/rock-paper-scissors/` for its separately approved upgrade.

## Run locally

Use Node 22.12 or later (or Node 20.19+).

```sh
npm ci
npm run dev
```

Open the address printed by Vite, including `/rock-paper-scissors-game/`. Open `#/island-drift` to go directly to Island Drift. Hash navigation works on static GitHub Pages and survives refreshing a game URL.

## Island Drift

Free exploration around a complete hand-painted island. There is no timer or loss condition. Sail near all 16 coastline sectors to discover the whole coast, or simply wander. The wooden boat includes a seated helmsman, a lantern and a fading wake. Painted material maps are applied to the real 3D environment.

- **W / up arrow:** accelerate.
- **A / left arrow and D / right arrow:** steer.
- **S / down arrow:** brake, then hold to reverse.
- **P / Escape:** pause or resume.
- Touch controls support simultaneous steering and throttle/braking.
- Pause, help, restart, reset boat, day/night and sound controls are available in the game. Decorative motion follows the device reduced-motion preference.
- The game pauses and clears held inputs when the page loses focus or is hidden.
- The world boundary gently turns the boat back toward the island. Reset boat returns to safe water. Restart begins a fresh voyage.

Day/night changes the sky, clouds, stars, moon, water, terrain lighting, boat lantern and lighthouse together. Preferences and sailing personal bests are stored locally, with a safe fallback if storage is unavailable. There are no accounts or server-side saves. Clearing browser data removes local preferences and bests.

The game requires WebGL. An inline recovery message appears when the renderer cannot start. Sound uses browser-generated ambient audio and starts only following player interaction.

## Checks

```sh
npm run lint
npm run test:physics
npm run build
npx playwright install chromium
npm run test:e2e
```

The physics suite checks acceleration, coasting, braking, reverse, steering, shoreline and rock recovery, a continuous full coastline lap, world-boundary recovery and frame-spike handling. Browser tests run against the **production build** with the GitHub Pages base path. They cover session flow, keyboard/touch controls, focus, filters, asset requests, modes, persistence, cleanup, and representative desktop/tablet/phone viewports. These are simulated mobile checks; they do not certify performance or behavior on physical phones.

The legacy Rock Paper Scissors directory is excluded from current lint because it is preserved source, outside this stage's authorized implementation. All active application, game, and QA code remains checked.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/data/games.js` | Catalogue, descriptions, categories and release status |
| `src/App.jsx` | Library, hash navigation, lazy loading, error boundary and About dialog |
| `src/components/` | Shared custom SVG symbols and future-game illustrations |
| `src/games/island-drift/` | Isolated game UI, Three.js scene, physics and game styles |
| `src/games/rock-paper-scissors/` | Preserved original source; not loaded by the arcade |
| `public/art/` | Optimized original paintings, materials and art provenance |
| `tests/` | Independent physics and production browser checks |

Three.js is loaded only when Island Drift opens. Scene destruction cancels animation, detaches observers and listeners, stops audio, clears input, removes the canvas, and disposes GPU resources. Rendering limits pixel density to keep the scene lightweight.

## Artwork

All nine raster assets were generated with the built-in image tool in a consistent watercolor/gouache style and optimized to WebP. Day and night share the same composition. The instruction map follows the actual island's horizontal layout, southern cove, northeast lighthouse and central/western palms. Prompts and the asset manifest are in `public/art/ART-DIRECTION.md`. Interface icons use a consistent custom SVG stroke style.

## GitHub Pages

`vite.config.js` sets `base: '/rock-paper-scissors-game/'`. Every public game asset resolves through `import.meta.env.BASE_URL`; bundled module paths are handled by Vite. The existing Pages workflow builds `dist` and publishes it. The production environment currently permits the `main` branch only. A feature branch can be reviewed and run locally; live production publication requires merging the finished change to `main`.

## Roadmap and approval boundary

1. **Island Drift:** this release.
2. **Rock Paper Scissors:** best-of-five, streaks, optional names and accessible controls.
3. **Tic-Tac-Toe:** computer opponent, local two-player, turn indicators and restart.
4. **Memory Match:** difficulties, move counter, timer and personal bests.
5. **Snake:** speeds, scoring, pause, keyboard and mobile controls.
6. **2048:** keyboard, swipe, visible directional controls, score, saved progress and restart.

Present and review each completed game, then obtain the owner's explicit approval before implementing the next. Future catalogue illustrations do not enable or implement those games.
