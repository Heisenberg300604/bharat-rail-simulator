# Asset Credits

Every third-party asset must be listed here **before** it is committed. Each entry
needs its source page, creator, licence (checked on the asset page itself) and
the date it was checked.

## Third-party assets

### WAP-7 locomotive 3D model
- **File(s):** `public/assets/models/locomotive/wap7.glb`, with the licence copy
  `wap7-LICENSE.txt` next to it.
- **Title:** "WAP 7 Indian Locomotive Low Poly model"
- **Source page:** https://sketchfab.com/3d-models/wap-7-indian-locomotive-low-poly-model-1935cec9ac9446e3b2524ad73f0902a4
- **Creator:** knitro_builds / knitro_vedant (https://sketchfab.com/knitro_builds)
- **Licence:** CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). "Author
  must be credited. Commercial use is allowed." Verified via the Sketchfab API
  (`/v3/models/1935cec9…`) on 2026-11-07: license `CC Attribution`,
  `isDownloadable: true`.
- **Downloaded from:** the identical files mirrored at
  https://github.com/madhavchaturvedi005/indian-raiilway-3D (`public/assets/wap_7_indian_locomotive_low_poly_model/`).
  CC BY permits redistribution. The credit goes to the original author, not the
  mirror.
- **Attribution text (required, shown on the title screen):**
  This work is based on "WAP 7 Indian Locomotive Low Poly model"
  (https://sketchfab.com/3d-models/wap-7-indian-locomotive-low-poly-model-1935cec9ac9446e3b2524ad73f0902a4)
  by knitro_builds (https://sketchfab.com/knitro_builds), licensed under CC-BY-4.0
  (http://creativecommons.org/licenses/by/4.0/).
- **Modifications** (with `@gltf-transform/cli optimize`): meshes joined and
  simplified, meshopt-compressed, textures resized to 1024 px and converted to
  WebP.
  - Before: 35 MB, 225k triangles, 31 meshes.
  - After: 2.9 MB, about 131k triangles, 9 materials.
  - At runtime, meshes are merged per material.
- **Original source file:** not kept in the repo (35 MB). Re-download it from
  the source page.
- **⚠ Open question for the project owner:** the body texture appears to be made
  from photographs of real locomotives. It shows real fleet numbers (30622,
  39436), "INDIAN RAILWAYS" / "भारतीय रेल" lettering and an Indian flag decal.
  The CC BY licence covers the model as published, but the origin of the
  photographs can't be verified. Before sharing publicly, decide whether to
  keep it or repaint the livery texture.

### Sounds (Freesound; licence read on each sound's own page on 2026-11-07)
All files are in `public/assets/audio/`. Each was trimmed or looped, made mono,
and re-encoded to MP3.

| File | Sound | Creator | Licence | Notes |
| --- | --- | --- | --- | --- |
| `horn-india.mp3` | "Train Horn", https://freesound.org/people/CouleurCasquette/sounds/248229/ | CouleurCasquette | **CC BY 3.0** | Recorded at Haridwar, India. First 8.2 s used; the steady part loops while H is held. |
| `rolling-coach-india.mp3` | "Moving Train AC Compartment India", https://freesound.org/people/prospekt42/sounds/712292/ | prospekt42 | CC0 | 30 s section with a 2 s crossfade for a seamless loop |
| `brake-release.mp3` | "Train Air Brake 01.wav", https://freesound.org/people/totalcult/sounds/388568/ | totalcult | CC0 | Generic, not specifically Indian |
| `station-new-delhi.mp3` | "delhi station", https://freesound.org/people/thma/sounds/797578/ | thma | CC0 | 60 s loop with crowd and announcements |

Required attribution (CC BY 3.0): "Train Horn" by CouleurCasquette,
https://freesound.org/s/248229/, licensed under CC BY 3.0
(https://creativecommons.org/licenses/by/3.0/). Trimmed, looped and re-encoded.

None of the freely licensed recordings found name the locomotive class.
Recordings explicitly labelled WAP-7 exist only as Wikimedia Commons videos,
which would need manual extraction. The WAP-7 traction-motor whine and blowers
are therefore still synthesized.

## Original assets (this project)

| Asset | Type | Source | Licence |
| --- | --- | --- | --- |
| LHB coaches (red-grey and blue-grey), built to real dimensions from reference photos | 3D, procedural + canvas-drawn side texture | `src/game/world/models/lhbCoach.js`, `src/game/world/textures.js` | Original |
| Bogies, wheelsets, coach underframe, gangways | 3D, procedural | `src/game/world/models/trainModels.js` | Original |
| Fallback WAP-7-style locomotive (shown while the GLB loads) | 3D, procedural | `src/game/world/models/trainModels.js` | Original |
| Cab interior | 3D, procedural | `src/game/components/Train/CabInterior.jsx` | Original |
| Track, OHE, stations, scenery | 3D, procedural | `src/game/components/**` | Original |
| Ground, ballast, platform, facade textures; station boards | Canvas-drawn | `src/game/world/textures.js` | Original |
| Traction-motor whine, blowers/compressor, wind, rail-joint clacks; fallbacks for every recording | Synthesized audio (Web Audio API) | `src/game/audio/audioEngine.js` | Original |

## Candidates found but not used (owner can download them manually)

| Model | Source page | Creator | Licence / triangles | Notes |
| --- | --- | --- | --- | --- |
| "Indian Railway LHB Coach" | https://sketchfab.com/3d-models/indian-railway-lhb-coach-c6c3d4313425487d91f6174a64dd96d9 | shubham jha 3d | Free Standard, 1.67M tris | Tried and removed. It is a shortened (~13 m) stylised coach, so stretching it to 23.54 m distorted the windows. Replaced by an original coach built to real dimensions. |
| "Exquisite 3D Indian LHB Train Model" | https://sketchfab.com/3d-models/exquisite-3d-indian-lhb-train-model-606e200f28c448c289f42c10738c3995 | lakshya11x | CC BY, 25k tris | Less detailed than the one used; Sketchfab login needed |
| "LHB Coach (Red)" | https://sketchfab.com/3d-models/lhb-coach-red-6f69c29eedec4f45b5890ce2a39728d8 | niladri867 | CC BY, 56k tris | Untextured; Sketchfab login needed |
| ICF (blue) coaches | various | — | — | No free model of acceptable accuracy and clear licence found. "icf blue" by kulvindertanwar36 is from an uploader with a suspected sim rip; the others are crude or not Indian. |

## Template for new assets

```
### <Asset name>
- File(s): public/assets/...
- Source page: <exact URL>
- Creator: <name / handle>
- Licence: <e.g. CC BY 4.0> — verified on the asset page on <YYYY-MM-DD>
- Attribution text required: <exact text, if any>
- Modifications: <e.g. decimated to 40k tris, textures resized to 2K, exported to GLB>
- Original source file kept at: <path or "not kept">
```
