# AKI — A moment apart

A single cinematic Japanese autumn hero built with React and Vite. Original generated artwork shows a seated samurai beneath a crimson maple, Mount Fuji, atmospheric mountain layers and a grassy hillside. Typography and every control are real HTML.

Run `npm ci` and `npm run dev`. The deployment base is `/SlowPlay/` for [GitHub Pages](https://waqar-743.github.io/SlowPlay/).

## Controls

- **Enter the scenery / Scenery view:** hides the interface. **Exit scenery** or **Escape** returns, restoring keyboard focus.
- **Set the mood / wind control:** opens the native settings dialog. Adjust wind from calm to gusts, select daylight or dusk, and pause or resume.
- **Daylight / Dusk:** switches the complete painted lighting environment, with matching leaf and grass shading.
- **Pause / Resume:** freezes or resumes leaves, grass, haze and pointer parallax.
- Move a mouse nearby to brush leaves aside. Buttons have magnetic hover, underline and press feedback.
- Tab, Shift+Tab, Enter, Space and the range input's arrow/Home/End keys work with native controls.

Wind and time of day are saved locally. No accounts, remote APIs, audio, analytics or additional pages are included.

## Motion and performance

`src/motion.js` owns one imperative animation loop, outside React render cycles. Individual leaves have distinct depth, size, drift, rotation and flutter. Foreground grass and two haze layers move independently. Mouse parallax is smoothed; nearby leaves react to the pointer.

Desktop uses 52 leaves and 240 grass blades at up to 60 frames/second, with canvas pixel ratio capped at 1.6. Narrow/coarse-pointer layouts use 25 leaves, 110 blades, a 30-frame limit and ratio capped at 1.25. Portrait artwork is selected by aspect ratio rather than cropping the samurai from the wide scene.

Reduced-motion preferences start the scene paused and remove text/hover transitions and parallax. Explicit Play can enable ambient motion for the visit. Hidden documents cancel rendering and resume with a fresh time step. ResizeObserver preserves scene sizing, and cleanup cancels animation, observers and event listeners.

## Artwork and fonts

The four paintings and one transparent maple leaf were generated with the built-in image-generation tool, reviewed, then optimized to WebP. The wide and portrait daylight scenes each have a matching dusk companion. All runtime artwork is under `public/art/`; [generation prompts](public/art/GENERATION.md) describe the complete prompt set. The code and paintings are original; the [reference video](https://x.com/sucodeee/status/2111851097551782252) informed composition and mood.

Cormorant Garamond and DM Sans are self-hosted in `public/fonts/`, with their SIL Open Font License notices. Interface icons and the fallback leaf silhouettes are custom vector artwork; generated leaf sprites are cached once for efficient rendering.

## Verify

```sh
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Local browser checks default to installed Google Chrome; CI uses bundled Chromium. `HERO_QA_URL` can target a published URL, and `HERO_QA_DIR` selects the evidence directory. Tests check assets, HTML controls, actual canvas motion, pointer interaction, wind/daylight/pause, focus and immersive exit, six layouts, reduced motion and simulated document visibility.

The previous arcade source and assets have been removed from this project. Earlier versions remain recoverable through Git history.

## Kharpocho Fort · immersive 3D viewer

The separate [`kharpocho-explorer`](kharpocho-explorer/) project contains the full mountain, fort, valley, PBR textures, reusable GLB assets and research notes. It opens directly into a full-screen 360-degree landscape with orbit and free-flight controls.

```sh
cd kharpocho-explorer
npm ci
npm run dev
```

Run `npm run check:viewer`, `npm run check`, and `npm run build` inside that folder. This project has its own Vite build; the existing autumn scene and its deployment remain in the repository root. The reconstruction is historically informed and contains inferred terrain and architectural details.
