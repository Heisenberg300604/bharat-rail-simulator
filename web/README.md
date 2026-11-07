# Bharat Rail Simulator — Web MVP

Drive an Indian-style electric passenger train from **New Delhi** to **Ghaziabad**
in the browser. Built with React, Vite, Three.js and React Three Fiber.
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

1. Click **Start Journey** (this also unlocks audio — browsers block sound until you click).
2. The train starts at New Delhi with the brake fully applied.
3. Hold **X** to release the brake, hold **W** to raise the throttle.
4. Drive about 7.3 km. The HUD shows the distance to the stop marker.
5. Slow down early (a heavy train needs hundreds of metres to stop) and stop with
   the locomotive front inside the **green stop zone** next to the **STOP** board.
6. Stay stopped for 3 seconds → journey complete.

| Key | Action |
| --- | --- |
| W / ↑ | Increase throttle (hold) |
| S / ↓ | Decrease throttle (hold) |
| Space | Apply brake (hold) |
| X | Release brake (hold) |
| F | Direction Forward / Neutral / Reverse (only when stopped) |
| H | Horn (hold) |
| L | Headlight |
| C | Cab / exterior camera |
| Esc | Pause menu (volume, mute, graphics quality, FPS counter) |
| R | Restart journey (asks to confirm) |

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
| 5 Real GLB locomotive/coach models | Not started — placeholders are original blockouts |
| 6 Audio & polish | Partial — synthesized placeholder sounds, volume/mute, pause menu |
| 7 Performance & release | Partial — tested in Chrome on Apple Silicon (M4) |

Known limitations:
- The horn and other sounds are synthesized placeholders, not real Indian
  locomotive recordings.
- No station ambience yet.
- Tested in Chrome only so far; Safari and Firefox still need a manual check.
