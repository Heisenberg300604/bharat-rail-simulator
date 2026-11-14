# CLAUDE.md — Bharat Rail Simulator (web)

Read this first and you should not need to explore the repo to start work.
Everything here is current as of 2026-11-14 (refreshed after Wave 1). **If you change something this
file describes, update this file in the same turn** — see §9.

---

## 1. What this is

A browser Indian-railways driving sim: drive a WAP-7, WAG-9, WAP-4 or WCAM-1
with LHB/ICF coaches or BOXN/BCNA freight over six condensed, fictional routes inspired by famous lines (Delhi
mainline, Bhor Ghat, Konkan, Pamban Bridge, Gatimaan corridor, Bengal
suburban). Real physics numbers, gradients, multi-stop timetables, per-axle
recorded rail audio, live signalling, Kavach, VCD, wheel slip, a driver school,
run cards and local records, photo mode. 60 FPS on cheap laptops.

Stack: **JavaScript (no TypeScript), React 19, Vite 8, Three.js 0.187,
React Three Fiber 9.** No other dependencies, no backend, no paid services.

```bash
npm run dev      # http://localhost:5173
npm test         # node --test — 96 tests, all passing; run before claiming done
npm run build    # static dist/  (vite base: './' so it works in a sub-folder)
```

## 2. Hard rules

1. **Work only in `web/`.** The repo root holds `MVP_SPEC.md` / `README.md`
   from an abandoned **Unreal Engine** version. Ignore them completely. The
   spec that governs this project is `web/WEB_MVP_SPEC.MD`.
2. **JavaScript, not TypeScript.** Owner is a beginner in game dev: explain
   plainly, implement in small verifiable steps.
3. **Additive only.** Do not change or remove a working feature, model, sound
   or default to add a new one. New systems go behind a setting that defaults
   to today's behaviour.
4. **Licence discipline.** Before using any asset, record page URL, creator,
   licence, format and triangle count in `docs/ASSET_CREDITS.md`. Never invent
   a download URL or a licence. No paid assets or services. Procedural
   originals (see `world/models/`) are the always-safe fallback.
5. **Performance is a constraint, not a goal.** Low preset must stay 58+ FPS;
   the whole train is ~15 draw calls, the scene 46–88. State the draw-call
   cost of anything new.
6. **Background ambience must come and go**, never loop for the whole journey
   (`ambience: 'occasional'` is the default and the intended feel).
7. Keep simulation logic pure and unit-tested, separate from rendering (§4).
8. Don't claim a feature works unless it was implemented and verified.
9. **Ask before each feature.** When working through `docs/ENHANCEMENTS_PLAN.md`,
   go easiest first, then medium. Before building each item, describe what you
   plan to implement and wait for the owner's yes/no. "No" means skip it and
   propose the next one. Never start the next feature without approval.
10. Work goes on a feature branch (currently `wave1-driving-realism`), not
   straight onto `main`.

## 3. Architecture in ten lines

- The track is a list of straights and arcs plus a vertical profile. **Any
  position in the world is one number: `s`, metres along the route.**
  `route.sample(s)` → x/z/y + heading. Scenery uses route coordinates
  `(s, lat)`; `terrain.groundY(s, lat)` is the exact rendered ground height.
- `game` (in `state/gameStore.js`) is a **plain mutable object** — the single
  source of truth. The frame loop writes it directly.
- `SimulationDriver.jsx` runs first every frame (priority −3): fixed-timestep
  physics → journey rules → smoothed render distance → audio → HUD snapshot.
- Physics advances in **fixed 1/60 s steps** regardless of frame rate; frame
  deltas over 0.1 s are discarded, so the train never teleports. Drawing
  interpolates between the last two steps.
- **React never re-renders per frame.** `publish()` pushes a snapshot ~10×/s;
  the HUD subscribes via `useGameSnapshot()` / `useGameValue(selector)`.
- Each vehicle sits at `s − offset`, its body chorded between its two bogie
  points, so it leans into curves like a real coach.
- Repeated objects (≈11k sleepers, trees, OHE masts, crowds) are **instanced**
  — one draw call per type, chunked and distance-culled.
- Crowds animate entirely in GPU shaders: one draw call per crowd.
- Audio is a hand-built Web Audio graph; every rail joint under all 38
  wheelsets is scheduled sample-accurately.
- Quality is auto-detected from the GPU, then render resolution adapts if FPS
  drops below ~48.

## 4. File map

Simulation modules are **pure JS — no Three.js, no React imports** — so they
can be unit-tested with `node --test`. Keep it that way.

| Path | What lives there |
| --- | --- |
| `src/app/App.jsx` | Screen switch (loading/title/playing/paused/complete) + `window.__BRS__` dev helper |
| `src/game/GameCanvas.jsx` | The `<Canvas>` and the whole scene graph; quality → GL settings |
| `src/game/SimulationDriver.jsx` | **The heartbeat.** Per-frame order of operations |
| `src/game/config/gameConfig.js` | Physics, `LOCOMOTIVES`, `CONSISTS`, `COACH_TYPES`, liveries, quality presets; **re-exports the active route's data as live bindings** (`ROUTE`, `STATIONS`, `JOURNEY`, `SPEED_LIMITS`, `SIGNALS`, `BRIDGES`, `TUNNELS`…) |
| `src/game/routes/` | One plain-data file per route (`ndls-gzb`, `bhor-ghat`, `konkan`, `pamban`, `gatimaan`, `howrah-bandel`), `index.js` registry, `buildRoute.js` (defaults, stops, signals, rail joints), `stationLayouts.js` (station presets + regional styles), `timetable.js`, `validateRoute.js`, `activeRoute.js` (live bindings + `onRouteChange`), `routes.test.js` |
| `simulation/trainSimulation.js` | `stepTrain` — TE curve, Davis resistance, A9→BP→BC air brake, reverser, stopping-distance estimate |
| `simulation/routeMath.js` | `createRoute`, `sample(s)`, curve radius |
| `simulation/journeyManager.js` | Multi-stop journey: stop zones, hold, dwell + guard's right-away, missed/early stops, punctuality, score, HUD hint |
| `simulation/aiTraffic.js` | AI trains on the down line |
| `simulation/signalling.js` | Live MACLS aspects (chain, starters held until right-away, held homes, AI occupancy on the down line), SPAD + passed events, `nextSignal` |
| `simulation/kavach.js` | Simplified Kavach ATP: permitted speed, braking curve to EoA/PSR, warn/service/full/emergency/trip (RDSO defaults) |
| `simulation/vcd.js` | Vigilance control device (60 s / 8 s / penalty / 160 s reset) |
| `simulation/runStats.js` | Run-card stats: energy, regen, comfort (peak accel/jerk), safety counters |
| `simulation/driverSchool.js` | Lessons (steps with checks) for the driver school |
| `state/records.js` | Personal records + driving log (localStorage `brs-records`) |
| `simulation/roadTraffic.js` | Intelligent Driver Model for road vehicles |
| `simulation/simulation.test.js` | Physics / route / journey tests |
| `state/gameStore.js` | `game` object, settings load/save, snapshot store, all actions (start, pause, restart, camera, settings) |
| `state/detectQuality.js` | GPU string → `high` / `medium` / `low` |
| `state/sceneRefs.js` | Escape hatch for Three.js objects the frame loop needs |
| `audio/audioEngine.js` | The Web Audio graph: rolling beds, joints, horn, loco, ambience, mixing |
| `audio/railAcoustics.js` | Pure: axle positions, rail-joint schedule, turnouts, inverter tone (tested) |
| `audio/audioManifest.js` | File URLs + mix levels; rail recordings are **discovered at runtime** from `rail/sounds.json` |
| `world/` | `modelBuilder`, `geometry`, `textures` (canvas-drawn), `trackLayout` (rebuilt per route), `roadLayout`, `terrain` (height in route coords: zones, cuttings, tunnels hills, rivers, sea), `biomes` (per-route scenery kits), `environment`, `glow`, `ChunkedInstances.jsx` |
| `world/models/` | `trainModels` (bogies, wheelsets, fallback loco), `coaches` (original ICF/LHB bodies; destination boards follow the route), `loadGlbModel` (+ `measureLampAnchors`: lamps sit on the model's real nose), `roadVehicles`, `people` |
| `components/Train/` | `Train.jsx` (the rake), `CabInterior`, `CoachInterior` |
| `components/Track/TrackRoute.jsx` | Rails, sleepers, ballast, OHE |
| `components/Stations/Station.jsx` | Platforms, buildings, boards, lighting |
| `components/Environment/` | `Atmosphere` (sky/sun/moon/lighting, tunnel darkness), `Weather`, `Terrain` (chunked corridor mesh, far plane, water), `Structures` (bridges, tunnels), `Landmarks`, `Scenery` (biome-driven), `Road.jsx` (road, traffic, level crossings), `Signals` (instanced posts + live lamps, A/P plates), `SpeedBoards` |
| `components/People/Crowds.jsx` | GPU-animated crowds; exports `KID_SPOTS` |
| `components/Cameras/CameraRig.jsx` | Six camera modes + mouse look/orbit |
| `src/ui/` | `StartScreen` (route list + detail, difficulty, Driver school/How-to-play/Settings/Records/About modals), `JourneyComplete` (run card + PNG), `PhotoMode`, `LessonPanel`, `RoutePicker` (`RouteList`, `RouteDetail`, `Profile`), `HUD`, `PauseMenu`, `LoadingScreen`, `JourneyComplete`, `RestartConfirm`, `ControlsTable`, `EnvironmentPicker` |
| `public/assets/` | `models/locomotive/*.glb` (WAP-7, WAG-9, WAP-4, WCAM-1; + per-model LICENSE), `models/stock/` (`bvzi.glb` brake van, `bcna.glb` covered wagon — any `COACH_TYPES` entry with `model` is drawn from its GLB), `audio/rail/`, `audio/ambience/` (each with `CREDITS.md`) |

## 5. Invariants — breaking these breaks the game

- **Never call React state per frame.** Mutate `game`, let `publish()` batch.
- **Route data are live bindings.** Change routes only via `selectRoute(id)`
  (gameStore): it calls `setActiveRoute`, modules that derive data subscribe
  with `onRouteChange`, and `<RouteWorld key={routeId}>` in `GameCanvas`
  remounts (and disposes) every route-built component. Never cache route data
  in a module-level `const`.
- **Terrain winding:** terrain triangles must be counter-clockwise seen from
  above (`Terrain.jsx`), or the ground is back-face culled and everything
  appears to float above the far plane.
- **Scenery height = `terrain.groundY`** (the rendered surface incl. edge
  fade); never place objects with the raw formation/natural height.
- Platforms, level crossings and the road must be on level track
  (`validateRoute` enforces it; the road group sits at `terrain.roadBase`).
- Gradient force: `stepTrain(..., { grade, bankerTE_kN })`; no roll-back — a
  stopped train on a rising grade is held.
- Protection inputs to `stepTrain`: `mu` (adhesion, Realistic), `extraBrake`
  (Kavach/VCD brake demand), `cutTraction`. Kavach/VCD/adhesion are computed in
  `SimulationDriver.protection()` each physics step, per `DIFFICULTY`.
- Starters clear only on the guard's right-away (`journey.rightAway`); leaving
  early means passing a red. SPAD handling follows `DIFFICULTY[x].spad`.
- Locos with `standIn: true` (no GLB in the repo) are hidden from the pickers
  until their model loads, unless `settings.showStandIns`.
- **A speed restriction applies until the REAR of the train clears it**
  (`speedLimitFor(limits, rear, front)`), as on the real railway.
- **Traction is cut below BP 4.75 kg/cm²**, and above the loco's max speed.
  This is intentional realism, not a bug.
- **Speed can never go negative**; `direction` (the reverser) decides which way
  `s` moves. Brakes must not push the train backwards.
- **Audio needs a user gesture.** Recordings load after the Start click;
  everything missing falls back to a synthesized version, so the game is never
  silent. Don't add an asset that is required for sound to work at all.
- **Adding a rail recording needs no code change** — drop the file in
  `public/assets/audio/rail/`, follow the name prefix (`roll-ext-*`,
  `roll-int-*`, `joint-ext-*`, `joint-int-*`, `turnout-*`, `squeal-*`,
  `brake-squeal-*`, `loco-*`), register it in `sounds.json` with its
  `recordedSpeedKmh`, and credit it.
- **Changing antialias recreates the WebGL context** (the `<Canvas key>` flips).
  Expected, not a leak.
- When paused, `frameloop` becomes `'demand'` to save battery.
- Settings live in `localStorage` under **`brs-settings`** (incl. `route`),
  validated on load so retired values fall back safely (incl. `difficulty`:
  trainee|pilot|realistic, default pilot; `kavach`: auto|on|off). Best scores
  per route: **`brs-best`**; records + driving log: **`brs-records`**; driver
  school progress: **`brs-school`**.
- `SimulationDriver` calls `gl.compile(scene, camera)` on its first frame so
  far-away/culled objects don't hitch when first seen; `ChunkedInstances`
  re-culls immediately after a camera jump > 150 m.
- Tested modules must stay import-clean of Three.js/React.

## 6. Current state

Milestones 0–6 done; milestone 7 (performance & release) partial. Six
routes (routes plan steps 1–7 implemented). Wave 1 of ENHANCEMENTS_PLAN done,
plus A1/A2/A3/A5 and the WAP-4/WCAM-1/BVZI/BCNA models. 96 tests pass. Measured on an M4: 46–88 draw calls, steady 60 FPS; 58–60 FPS on Low
with the CPU throttled 4×.

**Known limitations and quirks** (don't "fix" these by surprise):
- Only tested in Chrome on macOS. Windows, Safari and Firefox unverified.
- Signals are live but there is no same-direction traffic, so automatic
  signals never go to danger; GR 9.02 (pass an automatic red after waiting) is
  not modelled. Kavach is Full Supervision only.
- WAP-5 has physics but no model yet (stand-in body, hidden by default). The
  WCAM-1 model is ~18.3 m (artist's proportions) vs the real 20.95 m.
- Locos may set `length` (formation uses it) and `ownRunningGear` (procedural
  bogies hidden). New GLBs are processed to the WAP-7 convention: metres, length
  along z, centred, wheels at y=0, meshopt + WebP (see ASSET_CREDITS).
- Adhesion coefficients are game assumptions (no official figures exist).
- Single-line routes have no running opposing trains (they wait parked in
  crossing loops). Bankers on Bhor Ghat are physics + HUD only (not drawn).
- No diesel, EMU or WAP-5 models yet (electric locos only: WAP-7, WAG-9,
  WAP-4, WCAM-1). The BCNA wagon is ~16.9 m (artist's proportions) vs 14.45 m.
- `public/assets/audio/horns/` does not exist, so `horns.json` 404s and the
  single `horn-india.mp3` is used. Dropping that folder in enables the horn
  picker with no code change.
- The ICF and LHB coaches are **original procedural** bodies built to real
  dimensions (a CC BY ICF model is catalogued in ASSET_CREDITS but not yet
  downloaded).
- The WAP-7 traction-motor sound is synthesized; no licence-clean recording of
  an Indian three-phase loco exists.
- The WAP-7 body texture carries real fleet numbers — see the open question in
  `docs/ASSET_CREDITS.md`.
- Persistence is localStorage only (settings, bests, records, school); no server yet.
- `docs/ROUTES_PLAN.md` is deleted in the owner's working copy (still in git
  history); the routes are documented in `src/game/routes/` and §3–§5 here.

## 7. Which doc to read, and when

Don't read these speculatively — each costs real context. Read on demand:

| Doc | Read it when |
| --- | --- |
| `README.md` | You need the player-facing controls table or feature list |
| `WEB_MVP_SPEC.MD` | A scope question: is this feature in or out of the MVP |
| `docs/SIMULATION.md` | Touching physics, braking or the force model |
| `docs/ROUTES_PLAN.md` | Anything about new routes, the route data model, gradients, multi-stop |
| `docs/ENHANCEMENTS_PLAN.md` | Anything about new features, new locos/stock, priorities, roadmap |
| `docs/DRIVING_RULES.md` | Signals, SPAD, Kavach, VCD, adhesion, speed boards: the sourced rules and how the game implements them |
| `docs/ASSET_CREDITS.md` | Sourcing, adding or crediting any asset; the loco candidate list |
| `public/assets/audio/*/CREDITS.md` | Adding or checking a sound file |

## 8. Working agreement

- State which file(s) you intend to touch before a non-trivial change.
- Small, verifiable steps; don't produce the whole feature in one giant edit.
- `npm test` must pass. Add tests for anything in `simulation/` or `audio/
  railAcoustics.js`.
- Prefer extending `gameConfig.js` over hard-coding a number in a component.
- Prefer instancing and procedural geometry over new assets.
- Don't add a dependency without asking.

## 9. Keeping this file current

**This file is the project's context cache. A stale cache is worse than none.**
Update it in the same turn as the change — never as a follow-up — whenever:

| Change | Update |
| --- | --- |
| New or renamed file/directory in `src/` | §4 file map |
| New config export, setting, or `localStorage` key | §4 (`gameConfig` row), §5 |
| New invariant, interlock, or per-frame ordering rule | §5 |
| A known limitation fixed, or a new one introduced | §6 |
| Milestone status, test count, or measured performance changes | §1, §6 |
| New doc added under `docs/` | §7 |
| New dependency or script in `package.json` | §1 |
| A rule the owner states ("always…", "never…", "I prefer…") | §2 |

Keep the edit proportional: usually one table row or one line. Don't let this
file grow into a second README — it is an index and a rulebook, not a manual.
If a section gets long, move the detail into a `docs/` file and link it in §7.

When the owner says **"update CLAUDE.md"** or **"refresh the context doc"**,
re-verify §1, §4, §6 against the actual tree (`git log` since the date at the
top, `npm test`, `find src -type f`) and restamp the date.
