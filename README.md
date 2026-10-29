# Skardu Spring — Mountain hero

This branch contains only the new mountain hero from Skardu Spring, adapted into an independent React/Vite demo. It does not import the Skardu repository, Next.js, the storefront, shopping APIs, cart, scroll chapters, environment secrets or files elsewhere on the computer. SlowPlay's main branch retains its existing AKI hero.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5175
```

Open the printed URL with `/SlowPlay/` at the end. The existing deployment base is preserved in vite.config.js; all images, SVGs and fonts work beneath that prefix.

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Included hero

- The centered “Some places stay with you” headline and mountain-inspired supporting text.
- The redesigned golden mountain, timber chalet and green meadow, framed by large pink and crimson trees.
- A clean landscape background and a separate transparent tree layer, so swaying foliage does not shift the mountains or sky.
- SVG wind trails and rose-coloured leaves drifting in the same direction.
- Grass aligned to the sloping meadow, bending locally near the pointer and settling back into the breeze.
- Self-hosted Cormorant and Manrope fonts with their license notices.

src/MountainScene.jsx owns the visual layers, src/motion.js owns the animation loop, and src/App.jsx contains the real HTML interface. All runtime mountain art is in public/hero/. The original generated composite and generation prompts are included there as well. Unused artwork inherited from SlowPlay's main branch remains untouched.

## Controls

Enter the scenery or Scenery view hides the interface; Exit scenery or Escape restores it and keyboard focus. Set the mood opens wind, lighting and pause controls. Daylight and dusk use the same landscape with a continuous lighting tint. Preferences are saved only in this browser, under a separate mountain-hero storage key.

Reduced-motion preferences start paused. Explicit Play enables canvas animation for the visit. Hidden documents stop rendering. Pointer movement never updates React state. ResizeObserver, event listeners and animation frames are cleaned up on unmount.

## Verify

```sh
npm run lint
npm run build
npm run test:e2e
```

Local browser checks use installed Google Chrome. CI uses Chromium (`npx playwright install --with-deps chromium`). Checks cover six screen sizes, centered text, assets, canvas motion, grass hover, wind, lighting, pause, preferences, keyboard/focus behavior, touch controls and reduced motion.

The original Skardu project is restored to its previous hero independently; neither project needs the other checkout to build or run.
