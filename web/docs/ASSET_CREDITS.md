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

### WAG-9 locomotive 3D model
- **File(s):** `public/assets/models/locomotive/wag9.glb`, licence copy `wag9-LICENSE.txt`.
- **Title:** "Wag 9 Indian Locomotive Lowpoly count"
- **Source page:** https://sketchfab.com/3d-models/wag-9-indian-locomotive-lowpoly-count-665150d63c6146e0b361c1020a87074e
- **Creator:** knitro_vedant (https://sketchfab.com/knitro_vedant), the same creator as the WAP-7.
- **Licence:** CC BY 4.0. Verified via the Sketchfab API on 2026-11-08: license
  `CC Attribution`, `isDownloadable: true`.
- **Downloaded from:** the identical file mirrored at
  https://github.com/madhavchaturvedi005/indian-raiilway-3D (`public/assets/wag_9_indian_locomotive_lowpoly_count.glb`).
- **Attribution text (shown on the title screen):** This work is based on "Wag 9
  Indian Locomotive Lowpoly count" by knitro_vedant, licensed under CC-BY-4.0.
- **Modifications:** `@gltf-transform/cli optimize` (simplify, meshopt, 1024 px
  WebP). Before: 23.8 MB, 290k triangles. After: 1.74 MB, about 105k triangles.
- Used as a selectable player loco and on the AI goods train.

### Other locomotive candidates (CC BY 4.0, need a Sketchfab login to download)
| Model | Source page | Creator | Triangles |
| --- | --- | --- | --- |
| WDP 4D Indian Locomotive (diesel) | https://sketchfab.com/3d-models/wdp-4d-indian-locomotive-bbfe229747864a7e87d2a5645e3a599f | Dustycrate | 67k |
| Indian Railways WAP 5 | https://sketchfab.com/3d-models/indian-railways-wap-5-46a321bb787541518b86eb634ce63cbe | idontknow23787 | 490k |
| WAG-12 | https://sketchfab.com/models/3330081494cd436db99345ea7094caac | lakshyasharma1 | 90k |
| WAP-4 | https://sketchfab.com/models/1fb7277488924e51b378090e229576a5 | murmuyash8 | 441k |

### Sounds
Three groups, each with its own detailed credits file (source page, creator,
licence checked on the asset page, excerpt, processing, and quality-check
measurements in the matching `sounds.json`):

- **Rail sounds**: `public/assets/audio/rail/` (35 files: rolling beds per speed
  band, single wheel-over-joint impacts, turnout, flange and brake squeal,
  passbys, loco machinery, onboard horn). Full list:
  [`public/assets/audio/rail/CREDITS.md`](../public/assets/audio/rail/CREDITS.md).
  Licences checked 2026-11-08.
- **Ambience**: `public/assets/audio/ambience/` (26 files: birds, night
  insects, rain, thunder, Indian road traffic and horns, level-crossing bell,
  guard whistle, station crowds, cab clicks, buzzer, wind, children). Full
  list: [`public/assets/audio/ambience/CREDITS.md`](../public/assets/audio/ambience/CREDITS.md).
  Licences checked 2026-11-08.
- **Original files** in `public/assets/audio/`:

| File | Sound | Creator | Licence |
| --- | --- | --- | --- |
| `horn-india.mp3` | "Train Horn", https://freesound.org/people/CouleurCasquette/sounds/248229/ (recorded at Haridwar) | CouleurCasquette | **CC BY 3.0** |
| `brake-release.mp3` | "Train Air Brake 01.wav", https://freesound.org/people/totalcult/sounds/388568/ | totalcult | CC0 |
| `station-new-delhi.mp3` | "delhi station", https://freesound.org/people/thma/sounds/797578/ | thma | CC0 |
| `announcement-india.mp3` | "Indian Railway Train Arriving Announcement", https://freesound.org/people/chhavi/sounds/566505/ | chhavi | CC0 |
| `train-passby-india.mp3` | "Sound of passing train", https://freesound.org/people/arundasstp/sounds/413629/ | arundasstp | CC0 |

Removed on 2026-11-08 (no longer used): `rolling-coach-india.mp3` and
`track-clacks-india.mp3` (byte-identical copies of kyles 451342),
`icf-track-sound.wav`, `lhb-track-sound.wav` and `clack-0…3.wav`. The
soundbible.com source of the last three had no licence that could be
verified.

**Required attributions (CC BY / CC BY-SA), also shown on the title screen:**
- "Train Horn" by CouleurCasquette, https://freesound.org/s/248229/, CC BY 3.0.
- "Tropical Orchard in Spring" by Calcuttan, https://freesound.org/people/Calcuttan/sounds/184798/, CC BY 4.0 (`ambience/day-birds.mp3`).
- "High Speed Train, Samsung C9 - Non Stop Train" by Village Regional (Wikimedia Commons), CC BY 3.0 (`rail/roll-ext-fast.mp3`).
- "12479 Suryanagari Express … passing Basni railway station" by My Family by Vijay Singh Choudhary (Wikimedia Commons), CC BY 3.0 (`rail/roll-ext-fast-b.mp3`, `rail/passby-1.mp3`).
- "passengerWagonColdTambour.flac" by Zabuhailo (Freesound 194164), CC BY 4.0 (`rail/roll-ext-vestibule.mp3`).
- "switch_turnout_and_its_crossing.wav" by KrystofJakobe (Freesound 499128), CC BY 3.0 (`rail/turnout-*.mp3`).
- "train_breaking_outside.WAV" by Anton (Freesound 23641), CC BY 4.0 (`rail/brake-squeal-2.mp3`).
- "electric train engine sound effect" by Garuda1982 (Freesound 559381), CC BY 4.0 (`rail/loco-aux-hum.mp3`).
All were excerpted, mixed to mono, filtered, loudness-normalised and re-encoded.
The exact wording for each is in the two CREDITS.md files.

**Caveat:** the two Wikimedia Commons sources are re-uploads of YouTube videos
marked CC BY 3.0. The licence is shown on Commons, but whether the uploader
owns the footage can't be verified further.

No licence-clean recording of an Indian three-phase loco (WAP-7/WAP-5/WAG-9)
exists, so the converter "singing" is synthesized from the real pulse-mode
behaviour (`src/game/audio/railAcoustics.js`).

## Original assets (this project)

| Asset | Type | Source | Licence |
| --- | --- | --- | --- |
| Classic Blue ICF coaches (sleeper & general), built to real dimensions | 3D, procedural + canvas-drawn side texture | `src/game/world/models/coaches.js`, `src/game/world/textures.js` | Original |
| LHB coaches (red-grey and blue-grey), built to real dimensions | 3D, procedural + canvas-drawn side texture | `src/game/world/models/coaches.js`, `src/game/world/textures.js` | Original |
| Passenger coach interior (ICF Sleeper compartment with berths, fans, luggage racks) | 3D, procedural | `src/game/components/Train/CoachInterior.jsx` | Original |
| Road, traffic vehicles (Auto, Bus, Truck, Car), level crossing gates and MACLS signals | 3D, procedural | `src/game/components/Environment/Road.jsx` | Original |
| Bogies (ICF all-coil & LHB FIAT), wheelsets, coach underframe, gangways | 3D, procedural | `src/game/world/models/trainModels.js` | Original |
| Fallback WAP-7-style locomotive (shown while the GLB loads) | 3D, procedural | `src/game/world/models/trainModels.js` | Original |
| Cab interior | 3D, procedural | `src/game/components/Train/CabInterior.jsx` | Original |
| Track, OHE, stations, scenery | 3D, procedural | `src/game/components/**` | Original |
| Ground, ballast, platform, facade textures; station boards | Canvas-drawn | `src/game/world/textures.js` | Original |
| Three-phase converter tone, transformer hum, fallbacks for every recording | Synthesized audio (Web Audio API) | `src/game/audio/audioEngine.js`, `railAcoustics.js` | Original |
| People (platform crowds, passengers), road vehicles, streetlights, coach interiors, door view, last-vehicle "X" and LV board | 3D, procedural | `src/game/world/models/people.js`, `roadVehicles.js`, `src/game/components/**` | Original |

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
