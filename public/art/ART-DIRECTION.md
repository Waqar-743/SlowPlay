# Island Drift artwork

Generated with the built-in image generation tool, October 26, 2026. No API/CLI fallback was used. All final artwork is stored in this folder; source PNGs remain in the local generated-image library.

## Style and consistency

Traditional watercolor and opaque gouache, visible dry brush strokes and paper granulation, expressive natural shapes, warm cream and ochre sand, olive greens, sea-glass turquoise, ink navy, warm timber and small amber lights. The night painting is an edit of the day painting so the camera, helmsman, boat, palms, lighthouse, rocks and coastline agree.

The map represents a horizontally oval island, a south-facing cove, a lighthouse at the northeast edge, and palms at the center and west. It corresponds to the game geometry contract: island roughly x radius 32 / z radius 24, lighthouse (18,-13), starting boat south of island. The illustration is a navigational vignette, not a collision map.

## Asset manifest

| File | Size | Use |
| --- | --- | --- |
| island-day.webp | 1536 × 1024 | Library and day title artwork |
| island-night.webp | 1536 × 1024 | Night title artwork |
| island-map.webp | 900 × 900 | Instructions vignette |
| texture-wood.webp | 512 × 512 | Weathered boat and timber |
| texture-sand.webp | 512 × 512 | Sandy shore |
| texture-grass.webp | 512 × 512 | Island interior |
| texture-rock.webp | 512 × 512 | Coastal boulders |
| texture-water.webp | 512 × 512 | Painted sea surface |
| texture-cloud.webp | 512 × 512 | Cloud/sky material |

Material tiles are cropped from one generated 3 × 2 atlas. Image conversion used WebP quality 86 for paintings and 88 for material tiles; the map alone was proportionally reduced to 900 px. No generated imagery was altered beyond these format/size optimizations and atlas extraction.

## Final prompt set

1. **Day scene:** Wide landscape hero and library cover for peaceful sailing. Clearly visible seated adult man in cream shirt, navy trousers and straw hat, steering a weathered wooden dinghy by its tiller at foreground left. Entire tropical island to right with sandy shores, palms center/west, rounded gray rocks and a small white northeast lighthouse with ochre roof. South cove faces viewer; turquoise shallow lagoon blends into deep teal sea beneath blue sky, ivory clouds and a visible horizon. Low elevated third-person view. Watercolor and gouache, visible drybrush paper texture, soft late-morning sunlight from upper left, restrained coastal palette. No text, frame, watermark or interface.
2. **Night companion:** Edit supplied day painting, changing only time and lighting. Preserve exact composition, camera, boat, man, island and geography. Navy sky, moon upper right, natural stars and soft clouds; silver-blue moonlight on cool teal sea, readable shoreline and obstacles. Warm amber boat lantern illuminates cream shirt and wooden hull; lighthouse glows with subtle beam. Same watercolor/gouache texture. No new objects, text, frame or watermark.
3. **Island vignette:** New straight-down painted map, day artwork as style reference. Horizontally oval gently irregular island width:height 64:48; north up, sandy perimeter, green interior, lighthouse northeast at normalized (+.56,-.54), palms center/west, shallow south concave cove, rounded coastal rocks. Whole coastline and generous navigable turquoise water; tiny wooden boat south of cove; simple unlettered compass in upper-left water. Square composition with cream paper edge fade, no labels or UI.
4. **Material atlas:** Six equal square tiles in a precise 3-column × 2-row landscape sheet, no gutters or labels. Same painted style and coastal palette, evenly lit flat overhead textures. Top row: vertical weathered honey-brown wood planks; granular cream/ochre sand; olive/sage grass. Bottom row: muted warm-gray/beige rock; turquoise/teal painted seawater ripples; ivory/blue-gray clouds on pale blue. No perspective, object shadows, text, borders or symbols.
