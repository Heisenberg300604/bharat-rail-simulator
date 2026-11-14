# CLAUDE.md — Bharat Rail Simulator (web)

Read this first and you should not need to explore the repo to start work.
Everything here is current as of 2026-11-14. **If you change something this
file describes, update this file in the same turn** — see §9.

---

## 1. What this is

A browser Indian-railways driving sim: drive a WAP-7 (or WAG-9) with 8 LHB
coaches over a fictional 8 km New Delhi → Ghaziabad segment. Real physics
numbers, per-axle recorded rail audio, 60 FPS on cheap laptops.

Stack: **JavaScript (no TypeScript), React 19, Vite 8, Three.js 0.187,
React Three Fiber 9.** No other dependencies, no backend, no paid services.

```bash
npm run dev      # http://localhost:5173
npm test         # node --test — 39 tests, all passing; run before claiming done
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

## 3. Architecture in ten lines

- The track is a list of straights and arcs. **Any position in the world is
  one number: `s`, metres along the route.** `route.sample(s)` → x/z + heading.
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
| `src/game/config/gameConfig.js` | **ALL tunable numbers**: route segments, stations, platforms, journey, physics, `LOCOMOTIVES`, `CONSISTS`, `COACH_TYPES`, speed limits, AI trains, road, level crossings, liveries, quality presets |
| `simulation/trainSimulation.js` | `stepTrain` — TE curve, Davis resistance, A9→BP→BC air brake, reverser, stopping-distance estimate |
| `simulation/routeMath.js` | `createRoute`, `sample(s)`, curve radius |
| `simulation/journeyManager.js` | Journey state machine, stop zone, hold timer, score, HUD hint |
| `simulation/aiTraffic.js` | AI trains on the down line |
| `simulation/roadTraffic.js` | Intelligent Driver Model for road vehicles |
| `simulation/simulation.test.js` | Physics / route / journey tests |
| `state/gameStore.js` | `game` object, settings load/save, snapshot store, all actions (start, pause, restart, camera, settings) |
| `state/detectQuality.js` | GPU string → `high` / `medium` / `low` |
| `state/sceneRefs.js` | Escape hatch for Three.js objects the frame loop needs |
| `audio/audioEngine.js` | The Web Audio graph: rolling beds, joints, horn, loco, ambience, mixing |
| `audio/railAcoustics.js` | Pure: axle positions, rail-joint schedule, turnouts, inverter tone (tested) |
| `audio/audioManifest.js` | File URLs + mix levels; rail recordings are **discovered at runtime** from `rail/sounds.json` |
| `world/` | `modelBuilder`, `geometry`, `textures` (canvas-drawn), `trackLayout`, `roadLayout`, `environment` (time/weather state), `glow`, `ChunkedInstances.jsx` |
| `world/models/` | `trainModels` (bogies, wheelsets, fallback loco), `coaches` (original ICF/LHB bodies), `loadGlbModel`, `roadVehicles`, `people` |
| `components/Train/` | `Train.jsx` (the rake), `CabInterior`, `CoachInterior` |
| `components/Track/TrackRoute.jsx` | Rails, sleepers, ballast, OHE |
| `components/Stations/Station.jsx` | Platforms, buildings, boards, lighting |
| `components/Environment/` | `Atmosphere` (sky/sun/moon/lighting), `Weather` (rain/fog/lightning), `Scenery`, `Road.jsx` (road, traffic, level crossings, **signal posts**) |
| `components/People/Crowds.jsx` | GPU-animated crowds; exports `KID_SPOTS` |
| `components/Cameras/CameraRig.jsx` | Six camera modes + mouse look/orbit |
| `src/ui/` | `StartScreen`, `HUD`, `PauseMenu`, `LoadingScreen`, `JourneyComplete`, `RestartConfirm`, `ControlsTable`, `EnvironmentPicker` |
| `public/assets/` | `models/locomotive/*.glb` (+ per-model LICENSE), `audio/rail/`, `audio/ambience/` (each with `CREDITS.md`) |

## 5. Invariants — breaking these breaks the game

- **Never call React state per frame.** Mutate `game`, let `publish()` batch.
- **Route constants are read at module load.** ~20 modules import
  `ROUTE_SEGMENTS`, `STATIONS`, `JOURNEY`, `SPEED_LIMITS`, `AI_TRAINS`, `ROAD`,
  `LEVEL_CROSSINGS` straight from `gameConfig.js` and build geometry once. This
  is precisely why multiple routes need the loader refactor in
  `docs/ROUTES_PLAN.md` §1.2 — don't try to hot-swap route data without it.
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
- Settings live in `localStorage` under **`brs-settings`**, validated on load so
  retired values (e.g. the old blue LHB consist) fall back safely.
- Tested modules must stay import-clean of Three.js/React.

## 6. Current state

Milestones 0–6 done; milestone 7 (performance & release) partial. 39 tests
pass. Measured on an M4: 46–88 draw calls, steady 60 FPS; 58–60 FPS on Low
with the CPU throttled 4×.

**Known limitations and quirks** (don't "fix" these by surprise):
- Only tested in Chrome on macOS. Windows, Safari and Firefox unverified.
- Signals are **decorative**: `Road.jsx:651` picks the aspect from the signal's
  position `sig.s`. Nothing can change an aspect and nothing checks obedience.
- `settings.kavach` exists in `gameStore.js:74` but **nothing reads it** — a
  placeholder for the planned ATP feature.
- `public/assets/audio/horns/` does not exist, so `horns.json` 404s and the
  single `horn-india.mp3` is used. Dropping that folder in enables the horn
  picker with no code change.
- No licence-clear ICF model was found; the ICF and LHB coaches are **original
  procedural** bodies built to real dimensions. The parked blue rake is a
  recoloured LHB.
- The WAP-7 traction-motor sound is synthesized; no licence-clean recording of
  an Indian three-phase loco exists.
- The WAP-7 body texture carries real fleet numbers — see the open question in
  `docs/ASSET_CREDITS.md`.
- One route, one stop, no persistence beyond settings.

## 7. Which doc to read, and when

Don't read these speculatively — each costs real context. Read on demand:

| Doc | Read it when |
| --- | --- |
| `README.md` | You need the player-facing controls table or feature list |
| `WEB_MVP_SPEC.MD` | A scope question: is this feature in or out of the MVP |
| `docs/SIMULATION.md` | Touching physics, braking or the force model |
| `docs/ROUTES_PLAN.md` | Anything about new routes, the route data model, gradients, multi-stop |
| `docs/ENHANCEMENTS_PLAN.md` | Anything about new features, new locos/stock, priorities, roadmap |
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
