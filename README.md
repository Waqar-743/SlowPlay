# Cenote — Grotto hero

A responsive, single-screen focus experience on branch `codex/grotto-hero`. It closely recreates the composition, typography, cavern background and flowing-water motion of [DVK Lab’s Grotto reference](https://dvklab.vercel.app/templates/grotto/). The existing AKI experience remains on `main`.

## Run

```sh
npm ci
npm run dev
```

The Vite base is `/SlowPlay/`. For the production preview, run `npm run build` then `npm run preview` and open the `/SlowPlay/` path.

## Experience

- Depth-based pointer parallax and a slow camera push; flowing waterfall strands, pool ripples, light shafts, rising mist and subtle film grain.
- A real focus timer with start, pause, resume, duration selection and reset.
- Four locally synthesized ambiences: Hidden waterfall, Rain on leaves, Night ocean and Cave drips. Audio begins only after a user action; volume and mute are available. These are procedural soundscapes, not field recordings.
- Keyboard-accessible dialogs, visible focus, reduced-motion support, motion pause and an immersive scenery view with a visible exit and Escape support.
- Responsive portrait, landscape, tablet and desktop layouts; a still poster appears immediately and remains available if WebGL2 is unavailable.

## Implementation

React + Vite. The WebGL2 renderer and Web Audio engine own their resources outside React’s render cycle. Background rendering stops in hidden tabs, and owned animation frames, listeners, observers, timers, shaders, buffers and audio nodes are cleaned up. Rendering is capped at 30fps on narrow/coarse-pointer screens and 60fps on desktop. Canvas DPR is capped at 1.25 on mobile and 1.6 on desktop, with a 2.8-megapixel ceiling.

Assets and fonts are self-hosted. See [asset provenance](public/art/PROVENANCE.md) and the font licenses in `public/fonts/`. SVG controls live in `src/Icon.jsx`; the favicon is `public/favicon.svg`.

## Check

```sh
npm run lint
npm run build
npm run test:e2e
```

The browser checks run against the production build using installed Chrome locally and Playwright Chromium in CI. They cover meaningful timer/audio behavior, motion state, scene selection, settings, dialogs, keyboard navigation, responsive dimensions, touch emulation, reduced motion and simulated visibility interruption.

CI verifies branch pushes and pull requests, and saves a downloadable production build. GitHub Pages deployment is restricted to `main`; pushing this branch does not replace the current live site.

Phone, tablet, touch and high-DPR checks are browser simulations. No physical-device, Safari or Firefox coverage is claimed. Audio signal activity can be checked automatically; listening quality still depends on the playback device. Reference background rights remain with the original owners; provenance does not assert a new third-party license.

Verified on 2026-10-29: production build, ESLint and all 11 browser tests passed in local Chrome. These include actual changing canvas pixels, pointer parallax, real graphics-context loss and restoration, audio signal activity, real countdown/pause/resume, all navigation and immersive controls, and eight viewport sizes, including a 280px panel and short portrait. Timer completion uses a controlled wall-clock advance; fallback and hidden-tab tests are explicitly simulated. Fraunces uses its optical-size variable WOFF2 files to preserve the reference typography.
