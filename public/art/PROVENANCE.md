# Grotto reference assets

This branch recreates the hero explicitly requested from [DVK Lab's Grotto reference](https://dvklab.vercel.app/templates/grotto/).

- `grotto.webp`: the reference's publicly served [`scene.jpg`](https://dvklab.vercel.app/templates/grotto/scene.jpg), saved locally and converted to WebP at quality 92. Original dimensions: 2560 × 1463. The scene is reused from the reference, not newly generated.
- `grotto-depth.png`: the reference's publicly served [`maps.png`](https://dvklab.vercel.app/templates/grotto/maps.png), saved locally without changing pixel values. Its red channel supplies scene depth for parallax and light masking.
- The flowing waterfall, pool ripples, rising spray, shafts and depth-parallax shader in `src/motion.js` are adapted from the reference's [`bg.js`](https://dvklab.vercel.app/templates/grotto/bg.js). The host adds owned resource cleanup, visibility suspension, resolution limits, motion controls, context recovery and a still-image fallback.

Retrieved 2026-10-28. The original artwork and reference code remain attributable to their respective owners. This document records provenance; it does not assert a new license for third-party assets.

The interface icons and favicon are SVG source in this project. Audio is synthesized locally through Web Audio; no field recordings are included. Fraunces and Inter are self-hosted Google Fonts with their OFL license notices in `public/fonts/`. The Latin WOFF2 files were retrieved from the official Google Fonts CSS endpoints on 2026-10-29. Fraunces retains its optical-size and weight axes; Inter retains its weight axis.
