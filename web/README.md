# Bharat Rail Simulator — Web MVP

Drive a WAP-7 electric locomotive with 8 LHB coaches from **New Delhi** to
**Ghaziabad** in the browser. Built with React, Vite, Three.js and React Three
Fiber. Runs on macOS and Windows (Chrome, Edge, Safari, Firefox), including
laptops with Intel integrated graphics.
The specification lives in [WEB_MVP_SPEC.MD](WEB_MVP_SPEC.MD).

> The route is a short, **fictional** test segment (8 km), not a geographic
> recreation. Independent hobby project — not affiliated with Indian Railways.

## Run it

Requires Node.js 20+.

```bash
cd web
npm install
npm run dev        # open the printed http://localhost:5173 URL in Chrome/Safari/Firefox
npm test           # unit tests for the train physics, route maths and journey rules
npm run build      # production build in dist/
npm run preview    # serve the production build locally
```

## How to play

1. Click **Start Journey**. This also unlocks audio; browsers block sound until
   you click.
2. You're at New Delhi with the A9 brake applied (brake pipe 3.4 kg/cm²).
3. Hold **X** to release the brake. Wait for the brake pipe to recharge to
   5.0; traction is cut below 4.75, just as on the real loco.
4. Hold **W** to notch up the TE/BE lever. Obey the speed limits: **30** km/h
   through the yard until the whole train has cleared it, then **110**.
5. Plan your stop. A full-service stop from 110 km/h needs about **1 km**, and
   the HUD shows your current stopping distance.
6. Stop with the loco front inside the **green zone** by the **STOP** board and
   hold for 3 s. You get a score out of 100.

| Key | Action |
| --- | --- |
| W / ↑ | TE/BE lever up: more traction (hold) |
| S / ↓ | TE/BE lever down: less traction, then regenerative braking (hold) |
| Space | A9 automatic brake: apply (hold) |
| X | A9 automatic brake: release (hold) |
| E / Backspace | Emergency brake |
| F | Reverser Forward / Neutral / Reverse (only when stopped, lever at 0) |
| H | Horn (hold) |
| L | Headlight |
| C or 1–6 | Camera: cab, coach interior, door, last coach, orbit, trackside |
| Mouse | Drag to look around (cab) or orbit; wheel to zoom; double-click resets |
| Esc | Pause menu: time of day, weather, volume, background sounds, people, graphics, coaches, field of view, FPS |
| R | Restart journey (asks to confirm) |

The physics, with real WAP-7 and LHB numbers, is explained in
[docs/SIMULATION.md](docs/SIMULATION.md).

## World and atmosphere

- **Time of day and weather** (title screen or pause menu): Morning, Afternoon,
  Evening or Night; Clear, Dense fog or Monsoon rain. At night the coach windows,
  building windows, station tube lights, sodium streetlights, signals and
  vehicle headlights all light up, with stars and a moon overhead. Fog shrinks
  visibility to about 200 m. Rain falls as GPU streaks that slant with the
  train's speed, with lightning and thunder.
- **People**: waiting passengers, walkers, porters with head-loads, people on
  benches, chai-stall customers, gatemen and level-crossing bystanders, plus
  village children who wave and shout as you pass. They are animated entirely on
  the GPU, so each crowd costs one draw call.
- **Road traffic**: hatchbacks, SUVs, CNG autos, motorbikes, state buses,
  painted trucks and tractor-trolleys, driven by the Intelligent Driver Model.
  They keep their distance and queue at closed level-crossing gates.
- **Three manned level crossings** (LC-41 near New Delhi, LC-42, LC-43 on the
  Ghaziabad approach) with booms, flashers, a gumti, whistle boards, check
  rails and a bell.
- **Cameras**: driver's cab; seated in the coach by the window (LHB AC 3-tier
  or ICF sleeper, full-length interior with passengers); standing in the
  open door; the back of the last coach (turn round to see the "X", the LV
  board and the flashing tail lamp); orbit; trackside.

## Sound

- The wheel-on-rail sound is built per axle. Every one of the train's 38
  wheelsets triggers a real recorded wheel-over-joint impact at every rail
  joint, scheduled sample-accurately. That gives the WAP-7 Co-Co bogie its
  "da-da-dak" and each coach bogie its "da-dak". Turnouts at the station
  throats clank, and the long-welded stretch goes quiet.
- Rolling-noise recordings are crossfaded by speed band, with separate sets
  for inside and outside the train. The AC LHB coach is sealed and muffled; the
  ICF has open windows, so it is louder and brighter.
- Loco: transformer hum, blowers, compressor cycle, and the three-phase
  converter's stepping "song" as you notch up.
- World: birds by day and crickets at night (they come and go; see *Background
  sounds* in the pause menu), rain, road traffic and horns, crossing bells,
  stations, thunder, the guard's whistle.
- Sources and licences: `docs/ASSET_CREDITS.md`.

## Performance (Mac and Windows laptops)

- **Graphics preset is chosen automatically** from the GPU: Apple Silicon or
  NVIDIA/AMD → High, Intel Iris Xe → Medium, older Intel UHD → Low. You can
  change it in the pause menu.
- **Adaptive resolution:** if the frame rate drops below about 48 FPS, render
  resolution steps down automatically, and climbs back when there's headroom.
- Models are merged and instanced. The whole train is about 15 draw calls, the
  whole railway a handful, and the scenery is chunked with distance culling.
  Measured on an M4: 46–88 draw calls, a steady 60 FPS. With the CPU throttled
  4× on Low: 58–60 FPS.

## How it works (short version)

- **Route** (`simulation/routeMath.js`) — the track is a list of straights and
  circular curves. Any point on it is addressed by one number: the distance
  along the track, `s`. Calling `route.sample(s)` returns the x/z position and
  heading at that point.
- **Train physics** (`simulation/trainSimulation.js`) — the train is just a
  speed and a route distance. Every 1/60 s:
  `acceleration = traction − (rolling + air resistance) − braking`.
  Speed never goes below zero, so brakes can't push the train backwards. Speed
  is capped at 100 km/h. The brakes take about a second to build up (air
  brakes), which is why you need distance to stop.
- **Fixed timestep** — physics always advances in equal 1/60 s steps,
  regardless of the screen's frame rate. Long hiccups are capped at 0.1 s, so
  the train never "teleports". Drawing blends between the last two physics
  steps, so motion stays smooth on 120 Hz screens too.
- **Coaches** — each vehicle is placed at `s − offset` behind the locomotive
  front. Its body sits between its two bogie points, so on curves it forms a
  chord, like a real coach.
- **React vs. the frame loop** — the 3D loop reads and writes a plain `game`
  object every frame. React (the HUD) only gets a snapshot 10 times per second,
  so React never re-renders every frame.
- **Performance** — repeated objects (≈11k sleepers, trees, buildings, OHE
  masts) use *instancing*: one draw call per object type. Fog hides the edge
  of the world. Only the train casts shadows, and the shadow box follows the
  train.

## Project layout

```
src/
  app/App.jsx                    screens + dev test helper (window.__BRS__)
  game/
    GameCanvas.jsx               the <Canvas> and scene composition
    SimulationDriver.jsx         per-frame loop: physics → journey → audio → HUD
    config/gameConfig.js         ALL tunable numbers (route, physics, stations…)
    simulation/                  pure JS, unit-tested (no Three.js / React)
    state/gameStore.js           game object + snapshot store + actions
    hooks/useKeyboardControls.js
    audio/                       synthesized placeholder sounds
    world/                       geometry + procedural texture helpers
    components/                  Train, Track, Stations, Environment, Cameras
  ui/                            StartScreen, HUD, PauseMenu, JourneyComplete…
  styles/
docs/ASSET_CREDITS.md
```

## Deploying (free static hosting)

`npm run build` produces a static `dist/` folder (`base: './'` in
`vite.config.js`, so it works from a sub-folder). Upload `dist/` to any free
static host, e.g. GitHub Pages or Vercel's free tier (check their current terms).

## Status

| Milestone | Status |
| --- | --- |
| 0 Setup | Done |
| 1 Scene, track, placeholder train | Done |
| 2 Train movement + controls + HUD | Done |
| 3 Coach following + cab/exterior cameras | Done (3 coaches) |
| 4 Stations, stop zone, completion, restart | Done |
| 5 Real GLB locomotive/coach models | Done: WAP-7 (CC BY) and LHB coach (Free Standard), optimised; see docs/ASSET_CREDITS.md |
| 6 Audio & polish | Done: real Indian horn, coach rolling and station recordings, plus synthesized traction sounds |
| 7 Performance & release | Partial: tested in headless Chrome on Apple Silicon with CPU throttling; still needs a real Windows laptop test |

Known limitations:
- No free, licence-clear **ICF** coach model of good accuracy was found. The
  parked blue rake is a blue-grey repaint of the LHB model.
- The WAP-7 body texture shows real fleet numbers and "Indian Railways"
  lettering; see the open question in docs/ASSET_CREDITS.md.
- The WAP-7 traction-motor sound is synthesized; no licence-clean recording exists.
- Tested in Chrome on macOS. Windows, Safari and Firefox still need a manual check.
