# Rock Paper Scissors artwork

Original SVG artwork for the Slowplay forest arcade. The three recognisable hand gestures use stepped silhouettes and square joins to follow the main site's pixel typography and frames. No emoji, external image service, font dependency or copied template asset is used in these illustrations.

- Outline: `#0a2417`, 5 units on the shared 160 × 160 gesture canvas.
- Hand: `#f2ffe0`, with `#fffef0` highlights and `#a3c580` lower-edge shade.
- Cuff and small accent pixels: `#c8ff4d`, shaded with `#719b50`.
- Forest stage: `#102a1c`, `#183a25`, `#20452a`.

`src/games/rock-paper-scissors/ChoiceArtwork.jsx` supplies rock, paper, scissors and a concealed mystery hand. Button text supplies the accessible name; the decorative SVG defaults to `aria-hidden="true"`.

`duel-card.svg` combines the same shapes on a 680 × 400 forest grid for the library and title screen. A central open hand anchors the composition; the fist and scissors lean in from either side. All artwork remains sharp when resized. No animation is embedded in the SVG.
