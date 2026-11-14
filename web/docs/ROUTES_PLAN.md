# Multiple routes: plan

Status: proposal (2026-11-08). The game has one route today: a fictional
8 km New Delhi → Ghaziabad test segment.

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

## 2. Proposed routes

All fictional and condensed, each showing off something different.

| # | Route (inspired by) | Length | Traction / stock | What makes it different |
| --- | --- | --- | --- | --- |
| 1 | **New Delhi → Ghaziabad** (existing) | 8 km | WAP-7 / WAG-9, LHB/ICF | Busy double line, three level crossings, highway |
| 2 | **Karjat → Lonavala "Bhor Ghat"** (Western Ghats) | 14 km | WAG-9 banker at the rear + WAP-7 | Steep 1 in 37 climb with tunnels and viaducts. Braking downhill with regenerative brake; waterfalls in the monsoon. Needs gradients, tunnels, bridges. |
| 3 | **Ratnagiri → Madgaon "Konkan coast"** | 18 km | WAP-7, LHB | Long tunnels and tall viaducts over rivers, palm groves, sea views, single line with a crossing station |
| 4 | **Jodhpur → Luni "Thar desert"** | 16 km | WDP-4D diesel (when available), ICF | Single line in the desert: dunes, khejri trees, camels, heat haze, sandstorm weather, small halt stations |
| 5 | **Howrah → Bandel "Bengal suburban"** | 12 km | WAP-7, ICF/EMU | Many short halts (frequent stop and dwell), dense crowds, ponds and paddy fields, Bengali name boards |
| 6 | **Kanpur → Etawah "Rajdhani run"** | 25 km | WAP-5 (when available), LHB | High-speed 130 km/h line with automatic signals, fog-season variant; a test of braking distances |

## 3. Build order

1. **Route data model and loader.** Move today's route into `routes/ndls-gzb.js`,
   add the registry, route picker and validation tests. No visible change
   except the picker. Do this first: everything else plugs into it.
2. **Multi-stop journeys and timetable.** Add one intermediate halt to route 1
   (e.g. "Anand Vihar Halt") to prove it out.
3. **Station presets and regional name boards.**
4. **Route 5, Bengal suburban.** This needs only items 1–3, so it's the cheapest
   new route.
5. **Gradients, ground heightfield, bridges and tunnels.**
6. **Route 2, Bhor Ghat**, and **route 3, Konkan**.
7. **Single line and crossing loops, plus signalling.** Then **route 4, Thar**
   (diesel loco needed), and **route 6** (WAP-5 model needed).

## 4. Open decisions for the owner
- Which two routes to build first (my recommendation: Bengal suburban, then
  Bhor Ghat).
- Whether routes stay fictional and condensed (recommended) or follow real
  station sequences and names more closely.
- The diesel (WDP-4D) and WAP-5 models need a Sketchfab login to download;
  see the candidates in `ASSET_CREDITS.md`.
