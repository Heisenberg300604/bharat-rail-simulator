# Multiple routes: plan

Status: **implemented (2026-11-14)** — six famous routes, see §5 for what was
built and how. (Original proposal: 2026-11-08.)

Non-route enhancements (signalling, progression, onboarding, new rolling
stock) are planned separately in [ENHANCEMENTS_PLAN.md](ENHANCEMENTS_PLAN.md).

All routes stay **fictional, condensed segments inspired by real lines**, not
geographic recreations. That keeps the existing disclaimer valid, keeps
routes short enough for the browser (8–25 km, 6–15 minutes), and avoids
needing survey data.

## 1. What has to change in the engine

Today about 20 modules import route data straight from `config/gameConfig.js`
and build their geometry once, at module load: `ROUTE_SEGMENTS`, `STATIONS`,
`PLATFORMS`, `JOURNEY`, `SPEED_LIMITS`, `AI_TRAINS`, `PARKED_TRAINS`, `ROAD`,
`LEVEL_CROSSINGS`, and the turnouts in `audio/railAcoustics.js`. Some route
facts are also hard-coded elsewhere:
- signal positions in `Road.jsx`;
- the "a terminus at each end" assumption in `trackLayout.js`;
- `'ndls'` checks in the crowds and audio code;
- flat terrain everywhere.

### 1.1 Route definition (data, one file per route)
```
src/game/routes/
  index.js                 registry: [{ id, name, region, length, thumbnail… }]
  ndls-gzb.js              today's route, moved out of gameConfig.js
  <new-route>.js
  validateRoute.js         sanity checks (also run as a unit test per route)
```
A route file exports one object:

| Field | Contents |
| --- | --- |
| `meta` | name, Hindi/regional name, region, description, difficulty, recommended loco/coaches, default time and weather |
| `alignment` | straights and arcs (as today) **plus a vertical profile**: `[{ s, elevation }]` with gradients (e.g. 1 in 37 on a ghat) |
| `tracks` | single or double line, and passing loops `{ from, to, side }` |
| `stations` | id, names (English, Hindi, regional script), platform layout preset, building style, halt type (terminus / halt / pass-through), dwell time |
| `timetable` | scheduled departure and arrival per stop |
| `speedLimits` | permanent restrictions, plus optional temporary caution orders |
| `signals` | position, type (home/starter/automatic/gate), aspects |
| `levelCrossings`, `roads` | as today, per route |
| `structures` | bridges `{ from, to, type: 'girder' / 'arch', river }`, tunnels `{ from, to, portalStyle }`, cuttings and embankments |
| `scenery` | biome (Gangetic plain / Western Ghats / Konkan coast / Thar desert / Bengal delta), density, landmark list |
| `traffic` | AI trains (now per route), parked rakes |
| `ambience` | which background beds the route uses (e.g. sea and gulls on the Konkan, temple bells near towns) |

### 1.2 Loading a route
- `state/activeRoute.js` holds the active route. `setRoute(id)` rebuilds the
  derived world (route geometry, `lines`, joints, stop zones).
- The existing `export const route` / `mainLine` exports become `export let`
  live bindings. ES-module live bindings mean importers see the new value
  without being rewritten.
- `GameCanvas` is keyed by route id, so every `useMemo` world builder reruns
  and disposes the old route cleanly. There's no partial hot-swap to get wrong.
- The title screen gets a **route picker** (card per route: map strip,
  length, stops, difficulty, best score).
- Save `route` in settings; best scores are keyed by route id.

### 1.3 Engine features the new routes need
| Feature | Why | Notes |
| --- | --- | --- |
| **Multi-stop journeys** | Real runs have halts | `journeyManager` gets a stop list: stop zone per halt, dwell timer, doors and guard whistle, departure order. Score = punctuality + stopping accuracy at every halt. |
| **Gradients** | Ghats and bridges | Physics adds a gradient force, `m·g·sinθ` (with 1 in 37 a 900 t train needs about 240 kN just to hold). The vertical profile drives the track mesh, OHE and train y; the ground becomes a heightfield built from the profile plus noise. |
| **Bridges and tunnels** | Rivers and hills | Procedural girder bridges (instanced spans), tunnel portals plus a dark tube. Audio: hollow drum on bridges, pressure "boom" and reverb in tunnels. |
| **Single line and crossings** | Most Indian branch lines | The AI train waits in a loop at a crossing station; signals hold the player until it clears. Builds on the signalling work already planned. |
| **Station presets** | Variety | Terminus (bay platforms, concourse), wayside halt (one low platform, tin shed), junction (island platforms, FOB). Name boards in regional scripts. |
| **Biome kits** | Each route looks different | Tree, building, field and colour sets per biome: palms and paddy (Konkan, Bengal), khejri and sand (Thar), Western Ghats rock and waterfalls in the monsoon. |
| **Streaming** | 25 km routes | Already chunked; geometry is built for the whole route but drawn by distance. Above about 20 km, build chunks lazily as the train approaches. |

## 2. Routes (as built)

All fictional and condensed, each inspired by a famous line and showing off
something different. Defined in `src/game/routes/<id>.js`.

| Route | Length | Line | What makes it different |
| --- | --- | --- | --- |
| **Delhi Mainline** — New Delhi → Ghaziabad (`ndls-gzb`) | 8 km | double | The original route, unchanged: highway, three level crossings |
| **Bhor Ghat** — Karjat → Lonavala (`bhor-ghat`) | 14 km | double | ~200 m climb at 1 in 37, 5 tunnels, 3 tall viaducts, Khandala halt, waterfalls, rock spire; two WAG-9 bankers for heavy freight |
| **Konkan Railway** — Thivim → Karmali → Madgaon (`konkan`) | 16 km | single | Laterite cuttings, 3 tunnels, Mandovi (girder) and Zuari (truss) estuary bridges, crossing at Karmali with the opposing train in the loop, Goan churches |
| **Pamban Bridge** — Mandapam → Pamban → Rameswaram (`pamban`) | 12 km | single | 2.1 km sea bridge with the vertical-lift span, the old Scherzer bridge and the road bridge alongside, island, gopuram, lighthouse, boats |
| **Gatimaan Corridor** — Mathura → Agra Cantt (`gatimaan`) | 22 km | double | 130 km/h, automatic signals, NH-19 alongside, Yamuna truss bridge, Taj and Agra Fort on the horizon |
| **Bengal Suburban** — Howrah → Belur → Shrirampur → Chandannagar → Bandel (`howrah-bandel`) | 13 km | double | Three halts with dwell and punctuality, level crossings, ponds and paddy, the Hooghly alongside, Bengali boards |

## 3. Decisions taken
- Routes stay **fictional and condensed**, using real station names.
- Built the engine features once (data model, gradients, terrain, bridges,
  tunnels, multi-stop, presets, biomes) and all five new routes on top.
- Diesel (WDP-4D) and WAP-5 models are still missing (Sketchfab login), so all
  routes are driven with WAP-7/WAG-9; single-line routes have no running
  opposing trains yet (the crossing train waits in the loop).

## 4. Still open
- Live signalling (aspects that change, SPAD checks) — see ENHANCEMENTS_PLAN.
- Opposing trains on single lines (needs signalling + loop routing).
- Diesel/WAP-5 traction, EMU stock for the Bengal suburban run.

## 5. How it was implemented
- **Data → built route.** `routes/<id>.js` is plain data. `buildRoute.js`
  fills defaults (station layout presets, stop markers, timetable, auto
  signals, turnouts for the joint sounds) and `validateRoute.js` checks it
  (unit-tested per route; an auto-driver must complete every route).
- **Switching.** `activeRoute.js` holds live `export let` bindings that
  `gameConfig.js` re-exports; derived modules (track layout, terrain, rail
  joints, coach boards) subscribe with `onRouteChange`. `selectRoute()` shows
  the loading screen while `<RouteWorld key={routeId}>` rebuilds; the old
  route's GPU buffers are disposed. No page reload.
- **Gradients.** Vertical profile = grade points with parabolic vertical
  curves (`createProfile`). Physics adds `m·g·grade` (no roll-back); the HUD
  shows "1 in N".
- **Terrain.** Height is a function of route coordinates (`world/terrain.js`):
  zones of hills/valleys, noise, tunnel hills, ravines under viaducts, river
  channels, sea and beaches, flat ground at stations/roads, then clamped to
  the formation (cuttings 1:0.7, embankments 1:1.5). The mesh is a ~38-column
  corridor (dense near the line), chunked every ~480 m for culling, with
  holes at tunnel portals, plus a far plane and water planes.
- **Cost (draw calls):** terrain ≈ 4–8 visible chunks + far plane + water;
  all tunnels 3; bridges 3–6; landmarks 1–3. Everything is built once at
  route load.
