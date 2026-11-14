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

### WAP-4 locomotive 3D model
- **Title:** "WAP-4 | Indian Electric Engine Locomotive"
- **Source:** https://sketchfab.com/3d-models/wap-4-indian-electric-engine-locomotive-ed30919c961142c1a77c931dc13ad5bd
- **Creator:** Prabhu Ram (https://sketchfab.com/virtualmakes)
- **Licence:** CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/) — licence text in `public/assets/models/locomotive/wap4-LICENSE.txt`
- **Changes made (2026-11-14):** scaled to the real 18,794 mm length over buffers (×1.199), centred, wheels at rail level; decimated 441k → 149k triangles; 4096 px texture → 2048 px WebP; meshopt-compressed (1.8 MB). The creator's "VMAX / VIRTUAL MAKES" watermark on the body-side skirt (4 places) was painted over with the surrounding texture.
- **Used as:** `LOCOMOTIVES.wap4` (`public/assets/models/locomotive/wap4.glb`).

### WCAM-1 locomotive 3D model
- **Title:** "WAM-4 | Indian Electric Engine Locomotive" — the model is in fact a **WCAM-1** (its body reads WCAM-1), and is credited as such in the game.
- **Source:** https://sketchfab.com/3d-models/wam-4-indian-electric-engine-locomotive-37aa5b915f9a4e44825da1c8a498a850
- **Creator:** Prabhu Ram (https://sketchfab.com/virtualmakes)
- **Licence:** CC BY 4.0 — `public/assets/models/locomotive/wcam1-LICENSE.txt`
- **Changes made:** spec/gloss materials converted to metal/rough (three.js no longer reads KHR_materials_pbrSpecularGlossiness); scaled uniformly so the body is the real 3.055 m wide and the raised pantograph meets the contact wire — the artist's body is short for its width, so it is ~18.3 m long against the real 20.95 m over couplers; decimated 414k → 153k triangles; 2048 px WebP; meshopt (1.8 MB).
- **Specs used** (Wikipedia, "Indian locomotive class WCAM-1"): Co-Co, 112.8 t, AC mode 331.9 kN starting TE, 2,714 kW continuous, 120 km/h, no dynamic brakes; withdrawn 2015.
- **Used as:** `LOCOMOTIVES.wcam1`.

### BVZI brake van 3D model
- **Title:** "BVZI_ Brake_ Van_indian_train"
- **Source:** https://sketchfab.com/3d-models/bvzi--brake--van-indian-train-c077c09c16de4be28c7cfc7cb09c83ed
- **Creator:** GameChangz (https://sketchfab.com/krupesh2736)
- **Licence:** CC BY 4.0 — `public/assets/models/stock/bvzi-LICENSE.txt`
- **Changes made:** turned to the game's length axis, centred, wheels at rail level (already in metres: 10.34 m); light decimation 44.6k → 28.9k triangles; 1024 px WebP; meshopt (0.3 MB).
- **Used as:** the guard's van at the rear of goods trains (player freight consist, AI and parked goods trains). The LV board and tail lamp are drawn on it; the "X" is not.

### BCNA covered wagon 3D model
- **Title:** "Train Freight Compartment" (a BCNA-type covered wagon)
- **Source:** https://sketchfab.com/3d-models/train-freight-compartment-2cd8d1032b53426a92abb64a71743aa6
- **Creator:** Prabhu Ram (https://sketchfab.com/virtualmakes)
- **Licence:** CC BY 4.0 — `public/assets/models/stock/bcna-LICENSE.txt`
- **Real dimensions** (IRIMEE wagon notes, "Types Of Wagon", rskr.irimee.in): 14,450 mm over couplers, 3,200 mm wide, 4,017 mm high from rail, bogie centres 9,500 mm; tare 24.55 t, payload 56.73 t, gross 81.28 t.
- **Changes made (2026-11-14):** the model is long for its height and width, so no uniform scale matches all three; it is scaled to the real 4.02 m height (2.96 m wide, 16.9 m long — the formation uses 16.9 m so wagons never overlap). Decimated 150k → 25k triangles for 20-wagon rakes (the simplifier stops there: many small separate parts); flat colours kept (the model has no textures); meshopt (0.26 MB).
- **Used as:** the new "Freight: BCNA covered wagons + BVZI brake van" consist (81.28 t per loaded wagon).

### Locomotive & stock candidates — surveyed 2026-11-14

A full sweep of the Sketchfab catalogue (22 Indian-railway searches, filtered to
`downloadable=true`) returned 61 models; 22 were relevant. **Every model below is
CC BY 4.0 and marked downloadable**, verified through the public Sketchfab v3 API
(`/v3/models/<uid>`) on 2026-11-14, and each one's render was inspected before
being graded. None is mirrored on GitHub, so each needs a (free) Sketchfab
login to download — the assistant cannot do this step.

**Grade A — realistic, textured, ready to optimise and drop in.**

| Model | Source page | Creator | Tris | Notes |
| --- | --- | --- | --- | --- |
| **WAP-4** | https://sketchfab.com/3d-models/wap-4-indian-electric-engine-locomotive-ed30919c961142c1a77c931dc13ad5bd | virtualmakes | 224k | The best-looking candidate found. Correct IR orange/yellow livery, fleet number 39270, pantograph, roof gear, detailed Co-Co bogies, buffers and cowcatcher grille. ⚠ The body texture carries the creator's own "VMAX / VIRTUAL MAKES" watermark on the skirt — repaint or crop that region before shipping. |
| **WCAM-1** (listed as "WAM-4") | https://sketchfab.com/3d-models/wam-4-indian-electric-engine-locomotive-37aa5b915f9a4e44825da1c8a498a850 | virtualmakes | 210k | ⚠ Mislabelled: the body reads `WCAM-1 93727`, and the shape is a WCAM-1, not a WAM-4. Classic blue/teal Western Railway livery, louvred grilles, roof-mounted horns. Same quality as the WAP-4. Credit it as what it is. |
| **WAP-7 (new design)** | https://sketchfab.com/3d-models/wap-7-new-design-low-poly-6d533d73faf34a8a811fee1fcb9c8878 | knitro_vedant | 389k | White/orange refreshed WAP-7 livery, red pantograph, fleet no. 30622. **Same creator as the WAP-7 and WAG-9 already in the game**, so the art style matches exactly. The cheapest way to add visible variety. |
| **ICF coach (blue)** | https://sketchfab.com/3d-models/indian-express-train-passenger-compartment-1e5e4bd92b3b4da092af1ee3c802d3d8 | virtualmakes | 95k | A genuine ICF blue coach: correct two-tone blue, "A.C. TIER" lettering, IR crest, ICF all-coil bogies, and a last-vehicle "X" on the end panel. **This closes the long-standing gap recorded below — no licence-clear ICF model had been found before.** Would be added as a new consist option, not as a replacement for the procedural ICF. |

**Grade B — usable, but needs work before it matches the existing stock.**

| Model | Source page | Creator | Tris | Why it is not Grade A |
| --- | --- | --- | --- | --- |
| WAG-12 | https://sketchfab.com/3d-models/wag-12-3330081494cd436db99345ea7094caac | lakshyasharma11052002 | 90k | Correct twin-section shape and blue livery, but flat-shaded colour blocks with no PBR detail. Fine at distance, visibly stylised beside the WAP-7. |
| BCNA covered wagon | https://sketchfab.com/3d-models/train-freight-compartment-2cd8d1032b53426a92abb64a71743aa6 | virtualmakes | 76k | Good geometry and CASNUB bogies, but untextured flat materials. Needs a painted side texture (the project already does this for coaches). |
| Vande Bharat (4-car) | https://sketchfab.com/3d-models/vande-bharat-express-6f3ab314283a46259bbfadb20897c672 | rmihir560 | 36k | Textured white/blue and the right silhouette, but only 36k tris for four cars — low detail up close. The best Vande Bharat found, and still well short of Grade A. |
| LHB generator car (EOG) | https://sketchfab.com/3d-models/lhb-generator-car-29719827d9ae444b9d8effa04fc4802d | niladri867 | 60k | Useful rake-end detail; quality unverified beyond the render. |

**Grade C — rejected for a realistic look.** All are CC BY and downloadable, but
shipping them would look worse than what the game already draws procedurally:

| Model | Creator | Why rejected |
| --- | --- | --- |
| Indian Railways WAP 5 | idontknow23787 | **Untextured white clay.** 490k tris of geometry with no livery at all. Previously listed below as a wanted candidate — it is not usable without a full texturing pass. |
| WDP 4D Indian Locomotive | Dustycrate | **Untextured white clay**, and no bogies or wheels visible in the render — essentially a body shell. Also previously listed as wanted; not usable as-is. |
| Vande Bharat Express 3d model | hifrak958 | Crude untextured blob; no detail. |
| Indian High-Speed Train | parijatch81 | Untextured; 314k tris wasted. |
| Wap-4 (1) | murmuyash8 | 441k tris, superseded by the virtualmakes WAP-4 at half the count and better texturing. |
| Darjeeling Toy Train landscape | Barneysbaddayatschool | **CC BY-NC** — non-commercial, so outside this project's licence policy. |

**Conclusion.** The two models this project most wanted — WAP-5 and WDP-4D — are
both bare untextured geometry, so neither can be added without a texturing pass.
The realistic additions actually available today are the **WAP-4**, the
**WCAM-1**, the **new-design WAP-7** and the **ICF coach**.

### How to add a locomotive once the file is downloaded

1. Download the **glTF/GLB** flavour from the source page (free Sketchfab account).
2. Optimise it the same way as the existing two:
   `npx @gltf-transform/cli optimize in.glb out.glb --texture-size 1024 --texture-compress webp`
   Target under ~3 MB and ~130k triangles, matching `wap7.glb` (2.9 MB / 131k).
3. Put the result in `public/assets/models/locomotive/<id>.glb` with its licence
   text beside it as `<id>-LICENSE.txt`.
4. Add an entry to `LOCOMOTIVES` in `src/game/config/gameConfig.js`
   (`label`, `model`, `horn: null`, `physics: {}` to inherit the WAP-7 figures,
   or real figures for that class).
5. Add the attribution block to this file, above.
6. Check it in the game: the loco picker in the pause menu, then the cab, orbit
   and trackside cameras.

A `LOCOMOTIVES` entry whose GLB is not in the repo yet must carry
`standIn: true`: the pickers hide it until the model file loads (so the game
never offers a class that does not look like itself), unless the player ticks
"Show locos still waiting for their 3D model" in Settings. WAP-5 and WAP-4 are
wired this way. The WAP-4 model has since been added (2026-11-14); the WAP-5
remains a stand-in until a textured model exists.

### Fleet survey 2 — 2026-11-14 (specs, more models, sounds)

**Specs now in `LOCOMOTIVES`** (IRFCA https://www.irfca.org/faq/faq-loco2e.html and
Wikipedia class pages):
- **WAP-5**: Bo-Bo, 78 t, 19.5 t axle load, LOB 18,162 mm, 160 km/h, 4,474 kW,
  starting TE 258 kN (26.3 t-f), regenerative 160 kN. Livery: off-white body,
  red-orange bands (Ghaziabad shed) — https://commons.wikimedia.org/wiki/File:CLW_made_WAP-5.jpg
- **WAP-4**: Co-Co, 112.8 t, LOB 18,794 mm, 140 km/h, 3,766 kW, starting TE
  302 kN (30.8 t-f), **no regenerative brake** (DC, tap changer). Livery: deep
  red/maroon with a yellow-cream waist band —
  https://commons.wikimedia.org/wiki/File:(22625)_LGD_based_WAP-4_Series_locomotive_at_Secunderabad_Station.jpg
- Researched, not yet in the game (need a twin-section or diesel model):
  **WAG-12B** (2 × Bo-Bo, 180 t, 9,000 kW, 705 kN, regen 514 kN; max speed
  100 km/h per IRFCA vs 120 per Wikipedia), **WDP-4D** (Co-Co, 123 t, 4,500 hp,
  399 kN per IRFCA / 429 kN per Wikipedia), **3-phase MEMU** (basic unit
  1 DMC + 3 TC; 110–130 km/h; IRFCA https://irfca.org/faq/faq-mu.html).

**New model candidates** (Sketchfab, CC Attribution, download needs a free account; not downloaded):
| Model | Page | Creator | Triangles | Notes |
| --- | --- | --- | --- | --- |
| BVZI brake van | https://sketchfab.com/3d-models/bvzi--brake--van-indian-train-c077c09c16de4be28c7cfc7cb09c83ed | krupesh2736 | 44.6k | Textured; best new find — end of goods trains |
| Bombardier EMU train (5 cars) | https://sketchfab.com/3d-models/bombardier-emu-train-9912d0079f434480a2b152b091fb4e95 | rmihir560 | 23.6k | Low detail; distant AI traffic |
| Mumbai Local Train Coaches | https://sketchfab.com/3d-models/mumbai-local-train-coaches-08265ee100074880887cf80d7c60a48c | Bhaktraj | 183k | No cab end or pantograph |
| indian train (WDM-3A + ICF) | https://sketchfab.com/3d-models/indian-train-b24ba2e1d2a34d54b1c133c22c9cad8a | animationstudiomm | 76k | Stylised; the only ALCO found |
Rejected: "Indian Train Guard Coach" (CC BY-NC-ND), a WAP-7 re-upload, an AI-generated WAG-9, and models whose textures sit outside the licence.

**Sound candidates** (licence as shown on each page; Freesound downloads need a free account, Wikimedia Commons does not):
| Sound | Page | Licence | Length |
| --- | --- | --- | --- |
| Indian diesel idling (Bangalore) | https://freesound.org/people/nikitralala/sounds/239021/ | CC0 | 4:54 |
| EMD WDG-4 heading south, Dum Dum Jn | https://commons.wikimedia.org/wiki/File:A_WDG-4_spotted_heading_south_at_Dum_Dum_Junction.webm | CC0 | 0:19 |
| WAP-4 with train at Kochuveli | https://commons.wikimedia.org/wiki/File:WAP4_with_train_at_kochuveli.webm | CC BY 4.0 | 0:31 |
| Churchgate arrival, PA and wheels (EMU) | https://freesound.org/people/chhavi/sounds/566506/ | CC0 | 2:19 |
| Mumbai local starting, announcement | https://freesound.org/people/chhavi/sounds/471832/ | CC BY 4.0 | 1:33 |
| Howrah local, inside | https://freesound.org/people/AshruKumarsEye/sounds/737620/ | CC0 | 8:51 |
| Kerala platform announcement | https://freesound.org/people/egovind/sounds/684835/ | CC0 | 0:42 |
| Howrah station | https://freesound.org/people/TRP/sounds/576482/ | CC0 | 2:17 |

**Recommended next downloads**, in order: the diesel idle (CC0) → the EMU
recordings (for a MEMU set) → the BVZI brake van → the WAP-4 model (Grade A
above; the WAP-4 physics is already wired) → the WAG-12 model (twin-section
work needed).

### Earlier candidate list (superseded by the survey above)
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
| ICF (blue) coaches | various | — | — | **Superseded 2026-11-14:** no acceptable model had been found, but the survey above turned up a good CC BY ICF coach ("Indian Express Train \| Passenger Compartment" by virtualmakes, 95k tris). The earlier rejections stand: "icf blue" by kulvindertanwar36 is from an uploader with a suspected sim rip; the others are crude or not Indian. |

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
