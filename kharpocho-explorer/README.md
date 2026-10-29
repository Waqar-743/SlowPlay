# Kharpocho — The Ancient Guardian of Skardu

On Windows, open `Start-Viewer.cmd`, then visit the local address printed in its window. Keep the window open while exploring. The first launch installs the dependencies if needed. The files stay on your computer; this launcher does not publish the project.

A complete, interactive 3D interpretation of Kharpocho Fort, its rocky mountain and a restrained Skardu valley setting. The fort is integrated into an irregular eastern shoulder of the hill, with the higher ridge and watchtower beyond. The scene is actual three-dimensional geometry; its mountain, river and distant ranges can be examined from different directions.

**This is a historically informed interpretation, not a measured survey.** Terrain and architecture were built from photographic references, published descriptions and regional architectural research. No survey DEM, laser scan, measured site plan or photogrammetric reconstruction was used. Distances and elevations are approximate scene units. Read [research.md](research.md) before treating any part of the scene as historical evidence.

## Start the explorer

Install a current Node.js release supported by Vite, then open a terminal in this project folder:

```sh
npm install
npm run dev
```

Open the local address printed in the terminal. Use an HTTP server: opening `index.html` directly from disk will not load the module imports and textures correctly.

For a production build:

```sh
npm run build
npm run preview
```

The build is written to `dist/`. Deploy that directory through a static web host. The website expects its asset paths at the site root; configure Vite's base and asset URLs if embedding it beneath a subdirectory.

## Explore

The landscape fills the screen immediately. There is no website header, footer or hero copy. Open **Controls** at the top right for navigation modes, viewpoints and settings. The control panel starts closed and landmark labels start hidden.

| Control | What it does |
| --- | --- |
| Cinematic tour | Start the guided camera sequence from the complete mountain toward the fortress. |
| Orbit / Free flight | Switch between orbiting a point and moving independently through the landscape. |
| Drag / one-finger drag | Orbit the scene. |
| Mouse wheel / pinch | Move closer or farther away. |
| Four perspectives / keys 1–4 | Move to the mountain, fortress, entrance approach or Indus valley view. |
| Free flight: drag | Look around in any horizontal direction; pitch up or down. |
| Free flight: W / A / S / D | Move forward, left, backward and right with the canvas focused. |
| Free flight: Q / E / Shift | Descend, ascend, or move faster. |
| Free flight: scroll | Move forward or backward along the viewing direction. |
| Free flight: movement pad | Hold a direction button on touch devices; one finger looks, two fingers slide sideways or vertically. |
| Orbit button | Toggle slow automatic rotation. |
| Labels button | Show or hide landmark annotations. |
| Sun button | Change between warm golden-hour and daylight illumination. |
| Detail selector | Choose high or adaptive rendering quality. |
| Reset | Restore the overview camera. |
| Camera button | Save an image of the current 3D view. |
| Fullscreen button | Expand the explorer where supported by the browser. |
| Field notes / The reconstruction | Read sources, method and uncertainty notes. |
| Download 3D model | Save the complete GLB scene for reuse. |

Camera positions are convenient studies of the model, not authenticated historic viewpoints. Browser lighting, haze, dust and presentation effects belong to the interactive viewer; a GLB importer may render the same geometry differently.

The orbit has no horizontal rotation limit. Free flight is independent of an orbit target; terrain and perimeter-wall clearance prevent moving through the principal surfaces. Free flight uses drag-to-look without pointer lock, so it also works in embedded browsers. Movement pauses when a research dialog is open, and releasing input or leaving the page stops movement.

## Reusable assets

The export script builds three optimized GLB assets and two standard, uncompressed alternatives:

```sh
npm run assets
```

| File | Contents |
| --- | --- |
| `public/assets/kharpocho-complete.glb` | Complete hill, integrated fort, river, valley, simplified settlement and distant terrain. |
| `public/assets/kharpocho-fort.glb` | Fort architecture, masonry, timber and related summit features. |
| `public/assets/khardong-mountain.glb` | The complete mountain and its terrain details. |
| `../Kharpocho-Fort-Editable.glb` | Local standard glTF fort with expanded instances and preserved stone color variation. |
| `../Kharpocho-Complete-Editable.glb` | Local standard glTF complete scene with expanded instances. |
| `public/assets/manifest.json` | Export filenames, byte sizes, coordinate convention and licensing metadata. |

Exports preserve the common scene coordinates, making the separate fort and mountain align when imported together. **Y points up, X points east and Z points south.** The fort's approximate scene origin is `[500, 155, 0]`; units are treated as metres for visual consistency, without implying survey precision. To use a fort-only asset around a local origin, place its imported parent at `[-500, -155, 0]` or recenter it in your modelling software.

The three optimized GLBs include material textures and use `EXT_meshopt_compression`, `EXT_mesh_gpu_instancing` and mesh quantization to keep delivery efficient. Positions use a 16-bit grid per mesh, preserving architectural detail independently of the distant landscape. A compatible Three.js `GLTFLoader` with a Meshopt decoder can load them. The two `Editable` files use standard glTF nodes with expanded instances and require neither of those extensions. Both variants are checked for matching triangle counts and component bounds. Use the editable version for Blender and other authoring tools.

## Project layout

```text
index.html                  Immersive viewer controls and research dialogs
src/main.js                 Renderer, camera journeys and viewer controls
src/free-explore.js          Keyboard, mouse and touch free-flight navigation
src/terrain.js              Complete hill, rock formations, scree and path
src/fort.js                 Summit architecture and masonry
src/environment.js          Indus, valley, modest town and distant ranges
src/materials.js            PBR texture loading and materials
src/style.css               Responsive interface styles
tools/export-assets.mjs     Reusable GLB export pipeline
public/textures/            CC0 rock/stone variants and original procedural maps
public/references/          Separately licensed original reference photographs
public/assets/              Exported GLBs and manifest
research.md                 Evidence, decisions and limits
LICENSE.md                  Asset, code and reference-image licences
```

The rock and stone material variants use the 2K **[Rock Face](https://polyhaven.com/a/rock_face)** photogrammetry PBR set from Poly Haven: processing by **Dario Barresi**, photography by **Greg Zaal**, released under [CC0](https://polyhaven.com/license). Its colour map is desaturated and brightened for this scene. Supplied maps include colour, OpenGL normal, roughness, ambient occlusion and height. These are reference rock surfaces, **not scans of Kharpocho**. The sand, plaster and timber maps are original procedural material studies.

The live materials use colour, normal, roughness and occlusion maps, plus subtle rock and stone displacement. The principal rock shape and major erosion are modeled in actual geometry. The standard glTF exports preserve modeled relief; glTF does not preserve the extra shader displacement. Desktop maps are 2K, with 512-pixel maps for adaptive rendering. The website's small source ZIP includes 512-pixel material copies; the full workspace retains the 2K maps. `public/textures/provenance.json` records the source and modifications.

## Offline presentation and verification

Four 1440 × 900 PNG studies are supplied in `public/presentation/`: the complete mountain, fort and ridge, timber gateway and river-facing view. They were rendered directly from the editable GLB in Blender 4.5 LTS. The separate `../Kharpocho-Fort.blend` contains the complete scene, packed material images, lighting and camera.

To repeat the offline renders after creating the editable GLB, run `blender --background --threads 2 --python tools/render-cinematic.py`. The script writes the four images and saves the Blender scene beside this project. These are rendered studies of interpreted geometry, not historical photographs.

`npm run check` verifies finite geometry, indices, mountain extents and shoulder siting. `npm run check:viewer` checks control bindings and free-flight behavior, including a complete horizontal revolution, camera-relative movement, touch strafing and input release. `node tools/validate-exports.mjs` decodes all five GLBs, verifies embedded textures and checks that compressed and editable geometry agree. The final export validation passed. Browser visual testing could not be completed because a saved browser permission blocks access to the local preview. Source-level camera, quality controls and guided-path checks were completed independently.

The website's source ZIP includes the working viewer, small material maps, references and these rendered studies. Run `npm run assets` to generate its downloadable GLB assets. The full local project retains the 2K textures and prebuilt models.

## Reuse and attribution

Original geometry, procedural textures and research documentation are released under **CC BY 4.0**. The Poly Haven rock/stone source maps retain **CC0** status and separate provenance. Original application and generation code is released under **MIT**. Use this attribution for original assets:

> Kharpocho — The Ancient Guardian of Skardu, digital reconstruction project, 2026. CC BY 4.0. Historically informed interpretation; not a measured survey. Changes: describe your modifications.

The two reference photographs retain their own licences and authorship. They are supplied as unchanged source photographs, separate from the original model and texture maps. Credit Hannan Balti's aerial photograph under CC BY-SA 4.0 and MBurch's entrance photograph under CC0. See [LICENSE.md](LICENSE.md) for exact links and terms.

For historical reuse, retain the uncertainty notice and cite the underlying sources. No part of this package represents an official conservation record or an endorsed reconstruction by the cited institutions or photographers.
