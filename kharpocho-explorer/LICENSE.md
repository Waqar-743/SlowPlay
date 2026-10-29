# Licences and credits

This package combines original project work with CC0 PBR maps, separately licensed reference photographs and software dependencies. The licences below apply to their identified parts; no single blanket licence overrides third-party rights.

## Original model, texture maps and documentation — CC BY 4.0

The original Kharpocho reconstruction geometry, original procedural sand/plaster/timber material maps in `public/textures/`, original contributions in exported model assets in `public/assets/`, and original research/documentation text are licensed under the **Creative Commons Attribution 4.0 International licence**. Poly Haven-derived rock and stone maps are excluded from this grant and retain their CC0 provenance as described below.

[CC BY 4.0 summary](https://creativecommons.org/licenses/by/4.0/) · [Full legal text](https://creativecommons.org/licenses/by/4.0/legalcode)

You may share and adapt these original assets, including for commercial purposes, subject to that licence. Give appropriate credit, link to the licence and indicate modifications. Do not imply endorsement by the project, reference authors or heritage institutions.

Suggested credit:

> Kharpocho — The Ancient Guardian of Skardu, digital reconstruction project, 2026. Licensed CC BY 4.0. Historically informed interpretation; not a measured survey. Changes: describe your modifications.

This licence grant does not include the reference photographs listed below, quoted or linked publications, trademarks, or dependencies. The model does not claim a precise measured record of the real monument.

## Rock Face PBR maps — CC0

- **Asset:** [Rock Face, Poly Haven](https://polyhaven.com/a/rock_face).
- **Processing:** Dario Barresi.
- **Photography:** Greg Zaal.
- **Licence:** CC0; [Poly Haven asset licence](https://polyhaven.com/license) and [CC0 1.0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).
- **Included variants:** `rock-*` and `stone-*` maps in `public/textures/`, with embedded counterparts in exported GLBs.
- **Specification:** 2K colour, OpenGL normal, roughness, ambient occlusion and height maps.
- **Adjustments:** Colour desaturated and brightened to form rock and stone variants. These surfaces were not captured at Kharpocho.

Suggested provenance credit: “Rock Face,” Poly Haven; Dario Barresi (processing), Greg Zaal (photography); CC0. Colour adjusted for Kharpocho rock/stone variants.

The underlying CC0 source and its modified map variants are not claimed as original scans or relicensed as project-owned material. Preserve this provenance in texture or asset metadata when redistributing the package. The project's original procedural maps and original geometry retain the separate CC BY 4.0 grant above.

## Original application and generation code — MIT

Copyright (c) 2026 Kharpocho Digital Reconstruction Project contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The MIT grant covers original application, interface and model-generation code, including `src/`, `tools/`, the HTML interface and original configuration. Third-party packages retain their own notices and licences.

## Reference photographs — separate licences

### Aerial view of Kharpocho Fort

- **Photographer:** Hannan Balti.
- **Source:** [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Kharpocho_Fort.jpg).
- **Licence:** [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- **Local file:** `public/references/aerial.jpg`.
- **Changes to supplied source file:** None; the original photograph is supplied separately. Website layout may display it within a cropped frame and apply a reversible display treatment.

Suggested credit: “Aerial view of Kharpocho Fort,” Hannan Balti, 2018, via Wikimedia Commons, CC BY-SA 4.0. Original source photograph unchanged.

Retain the author, source and licence when redistributing this image. Adaptations of this photograph are subject to its share-alike terms. The image is not licensed under the project's CC BY 4.0 or MIT grants.

### Skardu Fort Entrance 2024

- **Photographer:** MBurch.
- **Source:** [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Skardu_Fort_Entrance_2024.jpg).
- **Status:** [CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).
- **Local file:** `public/references/entrance.jpg`.
- **Changes to supplied source file:** None; the original photograph is supplied separately. Website layout may display it within a cropped frame and apply a reversible display treatment.

Credit is retained as a provenance record: “Skardu Fort Entrance 2024,” MBurch, 2024, via Wikimedia Commons, CC0 1.0.

## Research publications and dependencies

DOAM inventory entries and the Max Klimburg chapter are cited and linked as research references. Their contents are not relicensed by this project. They are not included as project-owned assets.

Three.js, Vite, glTF Transform, Meshoptimizer and other installed packages retain their own licences in their package directories. The web interface requests Cormorant Garamond and Manrope through Google Fonts; those font families retain their own font licences. Preserve applicable notices when redistributing dependencies or self-hosting fonts.

Photographers, publishers, DOAM, Archnet and Wikimedia Commons have not been represented as endorsing this reconstruction.
