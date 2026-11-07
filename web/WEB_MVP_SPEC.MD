Bharat Rail Simulator — Web MVP Specification
Document: WEB_MVP_SPEC.md
Project: Bharat Rail Simulator (Web Edition)
Status: Planned / MVP v1
Primary target: Desktop browser on macOS (Apple Silicon)
Secondary target: Windows desktop browser
Budget: ₹0 — free tools, no paid assets or services
Engine: Three.js through React Three Fiber
Build style: Beginner-friendly, incremental, AI-assisted
MVP route: New Delhi → Ghaziabad (shortened fictional test route, not a geographically accurate recreation)
1. Purpose of This Document
This document is the source of truth for the web MVP. An AI coding assistant should read this file and the repository README before making architectural or implementation decisions.

The goal is to create a browser-based Indian railway train-driving experience. The player should be able to drive an Indian-style electric passenger train from one station to another, see the train and track in 3D, operate basic controls, hear railway sounds, and complete a short journey.

This is a web game—not the Unreal Engine PC project. Keep its architecture suitable for a browser and for performance on Apple Silicon.
Project rule
Deliver a small, complete, playable journey before expanding the simulator.

Do not build a railway network, multiplayer, advanced signalling, or detailed locomotive systems in the MVP.
2. Product Vision and MVP Experience
The desired first impression:
- A 3D railway scene that feels recognizably Indian.
- An Indian electric locomotive and LHB or ICF-style passenger coaches.
- A cab view looking forward down the track.
- A simple exterior/follow camera.
- A train that accelerates gradually and brakes with some momentum.
- Track-running ambience, horn, and basic station atmosphere.
- A start station and destination station.
- A short drive that the player can complete in around 5–10 minutes.
The experience should feel like a small train simulator, not a train-shaped object moving through a static webpage.
MVP game loop
1. Open the game.
2. See a title/start screen with a brief controls hint.
3. Start the journey at New Delhi station.
4. The train is stationary with throttle at zero and brakes applied.
5. Enter/use the cab camera and begin driving.
6. Accelerate, coast, sound the horn, and brake.
7. Drive the short test route toward Ghaziabad.
8. Slow down and stop in the destination zone.
9. See a journey-completed panel with basic journey stats.
10. Restart the route.
3. Recommended Technology Stack
Use a straightforward React-based web stack.
Layer	Technology	Reason
App	React + Vite	Fast development and familiar web workflow
Language	JavaScript (ES modules)	Keep the learning curve manageable; TypeScript is optional later
3D	Three.js	Browser-native WebGL 3D rendering
React/3D integration	React Three Fiber (R3F)	Declarative React components for Three.js scenes
Helpers	@react-three/drei	Useful camera, environment, loading, and scene helpers
UI	HTML/CSS overlaid on canvas	Crisp HUD and menus without building all UI in 3D
Audio	Web Audio API / HTML audio	Basic playback, looping, and volume control
Controls	Keyboard events + optional pointer lock	Desktop driving controls
Asset format	GLB/glTF	Preferred web-ready format for 3D models
State	Small custom state/context or Zustand only if needed	Avoid overengineering
Testing	Manual browser checks + basic unit tests for train math	MVP-sized testing
Deployment	Static hosting (e.g. GitHub Pages / Vercel free tier, subject to current terms)	Easy sharing


Dependencies (starting point)
Use compatible stable versions and let the package manager resolve versions:
- react
- react-dom
- vite
- three
- @react-three/fiber
- @react-three/drei
Do not add a large physics engine, backend, database, authentication, or multiplayer framework unless a concrete MVP requirement needs it.
Architecture guidance
Keep the game simulation independent of React render cycles. Use a simulation update function or refs for frame-by-frame train movement. Do not call React state setters on every frame for speed, position, or throttle. Update HUD state at a modest rate or read from a small game-state store.
4. Platform and Performance Requirements
Primary target: recent MacBook with Apple Silicon running a modern Chrome, Safari, or Firefox browser.
Performance goals
- Target a stable 50–60 FPS on a reasonable quality setting, but prioritize stable frame pacing over an absolute number.
- Provide a lower-quality setting targeting 30 FPS on weaker devices.
- Keep the initial route compact.
- Use GLB assets and compressed textures when possible.
- Avoid excessive real-time shadows, expensive post-processing, and high-poly models.
- Use instancing for repeated objects such as sleepers, poles, trees, and trackside props.
- Avoid rendering distant scenery at full detail.
- Use level-of-detail (LOD) or simplified models where practical.
- Load large assets asynchronously and show a loading screen/progress indicator.
- Do not load all optional assets before the player can start.
- Make the train and track performant before decorating the environment.
Suggested initial quality settings
- Pixel ratio capped at 1.5 initially; allow lower values in performance mode.
- One primary directional light.
- Limited shadow-casting objects.
- Fog to reduce visible distance and conceal the compact route boundary.
- No heavy screen-space effects in the first build.
- Use simple materials for distant scenery.
- Test in a real browser on the target Mac, not only in a development preview.
These are starting values, not immutable requirements. Measure performance and adjust.
5. Train and Coach Content
Train formation
For the MVP, use:
- One Indian electric locomotive (WAP-7-inspired appearance preferred; a generic Indian electric locomotive is acceptable).
- Two or three passenger coaches, ideally LHB-style.
- A fixed train formation; no coupling/uncoupling feature.
- Coach positions follow the locomotive along the route.
A single coach can be used during the first prototype. Do not wait for final assets to implement train movement.
Asset sourcing requirements
The AI assistant may search for suitable models and sounds, but it must:
1. Provide the exact asset page and creator.
2. Verify the license from the asset page, not from a search-result title alone.
3. Confirm that downloading is permitted.
4. Prefer GLB/glTF; FBX/OBJ may be converted using Blender.
5. Check polygon count, texture sizes, materials, scale, and model orientation.
6. Never assume “free download” means unrestricted use.
7. Never purchase an asset or use a paid trial.
8. Never use an asset with unclear license terms.
9. Track credits and source URLs in ASSET_CREDITS.md.
10. Keep original source files and a web-optimized export separately where feasible.
Candidate Indian train models to inspect
These are candidates only. Inspect the downloaded file and license before integrating; a Sketchfab viewer model may be too heavy or may need cleanup.
- Indian Train — Interior & Exterior (Sketchfab): https://sketchfab.com/3d-models/indian-train-interior-exterior-851bcf9b30bc4727acb888ba37fef8fb
  Described as game-ready and includes interior/exterior details. Confirm the current license and download availability. It may be a coach rather than a full locomotive.
- Exquisite 3D Indian LHB Train Model (Sketchfab): https://sketchfab.com/3d-models/exquisite-3d-indian-lhb-train-model-606e200f28c448c289f42c10738c3995
  Listed with a Creative Commons Attribution license. Verify attribution conditions and inspect model topology/texture quality.
- Indian Railway LHB Coach (Sketchfab): https://sketchfab.com/3d-models/indian-railway-lhb-coach-c6c3d4313425487d91f6174a64dd96d9
  Listed as Free Standard. It is reported as very high-poly (around 1.7 million triangles), so do not use directly in the game without substantial optimization.
- Indian Railways LHB Double Decker Coach (CGTrader free listing): https://www.cgtrader.com/free-3d-models/vehicle/train/indian-railways-lhb-double-deker-coach
  Inspect its download format and license terms before use.
- Indian LHB Coach made in Blender (CGTrader free listing): https://www.cgtrader.com/free-3d-models/vehicle/train/indian-lhb-coach-made-in-blender-3d-software
  Reported as FBX with textures/materials; inspect its geometry and license before use.
Asset fallback plan
If there is no suitable free locomotive:
- Use a generic free electric locomotive for the first playable version.
- Use a simple custom blockout made in Blender.
- Keep the locomotive mesh swappable so a better model can be integrated later.
Do not block core gameplay on finding a perfect WAP-7 model.
Coach optimization workflow
For any downloaded coach:
1. Import it into Blender.
2. Check scale, orientation, origin, and whether the coach is one mesh or multiple parts.
3. Remove hidden or unnecessary geometry.
4. Reduce polygon count only where visual quality remains acceptable.
5. Resize textures to sensible web resolutions (usually 1K or 2K for a coach, depending on need).
6. Bake or simplify materials if the model contains too many materials.
7. Export to GLB.
8. Test the exported model in the actual browser scene.
9. Confirm that license attribution is recorded.
A high-detail coach should be visually convincing at gameplay distance, not needlessly expensive.
6. Train Movement and Simulation
The MVP uses a simplified train simulation. It should have inertia and gradual speed changes, but it is not a railway engineering simulator.
Route-following model
Use a spline/polyline route representation.

The train is represented by a route-distance value s (distance along the route). The locomotive position and orientation are obtained from the route at s.

Each coach follows a delayed route-distance position based on its distance behind the locomotive. This is preferable to independently steering each coach.

For the first prototype, a custom sampled path or Three.js curve is acceptable. Make the route system deterministic and easy to debug.
Core variables
At minimum:
- speedMps — current speed in metres per second.
- speedKmh — display value derived from speed.
- throttle — normalized value from 0 to 1.
- brake — normalized value from 0 to 1.
- direction — forward, neutral, or reverse.
- routeDistance — locomotive distance along route.
- maxSpeedKmh — configurable speed cap.
- journeyState — ready, running, approaching, stopped, completed.
- isHornPlaying
- headlightEnabled
Simplified motion model
Use a fixed or clamped simulation timestep. Do not let a large browser frame delay cause the train to jump forward.

A simplified model can use:
- Throttle-driven acceleration.
- Passive drag/coasting deceleration.
- Brake-driven deceleration.
- A configurable speed cap.
- Smooth acceleration/deceleration.
- A low-speed stopping threshold.
For example, conceptually:

acceleration = throttleAcceleration - drag - brakeDeceleration

The final implementation should clamp speed to valid limits and prevent negative speed during forward movement. This is a gameplay approximation; do not claim it is physically accurate.
Braking
- Brakes must reduce speed gradually.
- A higher brake input should decelerate more strongly.
- The train must need distance to stop.
- A brake application should not instantly set speed to zero.
- The train should remain stationary when the brake is applied and speed reaches zero.
- Direction must not reverse while the train is moving.
- The player should be able to coast by setting throttle to zero without applying the brake.
Direction
For MVP, direction changes are only allowed when the train is stationary or nearly stationary. If the player requests a direction change at speed, show a short instruction or ignore the request safely.
7. Player Controls
Keyboard-first controls. Display them in the start/pause UI.
Key	Action
W	Increase throttle
S	Decrease throttle
Space	Apply brake
X	Release brake
F	Cycle direction (forward / neutral / reverse)
H	Horn
L	Toggle headlight
C	Switch cab / exterior camera
Escape	Pause / resume
R	Restart journey (confirm before reset)


Controls should support keydown/keyup where needed. The horn should play while the key is held, if the selected audio supports that behavior. Ensure keys do not scroll the page while the game is active.

Optional: add on-screen buttons for accessibility, but desktop keyboard support is the MVP baseline.
8. Camera and Player View
Cab view (primary)
- Camera placed in a simplified locomotive cab.
- Forward view shows track ahead.
- Basic dashboard/HUD overlays current speed, throttle, brake, direction, and destination.
- The cab interior may be simplified if no usable model is available.
- Camera must not clip through the cab or locomotive.
Exterior/follow view (secondary)
- Camera follows the locomotive from a slightly elevated trailing or side angle.
- Player can switch to it using C.
- The camera should smoothly follow without jitter.
- Do not implement free-fly cinematic controls in the MVP.
Optional later
- Look-around with mouse.
- More cab camera positions.
- Passenger coach interior.
- Cinematic replay.
9. Stations and Route
MVP route
Use New Delhi as the starting station and Ghaziabad as the destination label for the prototype.

Important: the MVP route is a shortened, fictional test segment. It must not be presented as a geographically accurate New Delhi–Ghaziabad route or as an official Indian Railways route recreation.
Station requirements
Each station has:
- Name.
- Basic platform/building environment.
- Arrival/stop zone.
- A clear destination marker or HUD instruction.
- Simple ambience where available.
The route should have:
- Track between stations.
- At least one gentle curve if feasible.
- A few trackside props.
- A stopping zone at the destination.
- A simple distance/progress display.
Stop validation
The player completes the journey when:
- The locomotive reaches the destination stopping zone.
- Speed falls below a small stopping threshold.
- The train remains stopped for a short time.
Do not require timetable accuracy, platform-side selection, signalling, or route switching in MVP.
Station assets
Prefer simple original or permissively licensed buildings. Do not use unlicensed official station logos, signage, or copied photographs as textures. Station names may be displayed as text for the prototype, with a disclaimer that the route is fictional.
10. Audio Design
Audio is important for immersion but must remain lightweight.
Required sounds
- Indian-style locomotive horn (or a clearly marked placeholder).
- Looping train-running/track ambience.
- Basic wind/rolling sound.
- Station ambience, optional.
- Basic brake sound, optional.
Audio behavior
- Train-running ambience loops while moving.
- Sound intensity may increase with speed, but this can be a simple volume mapping.
- Horn is triggered by H.
- Brake sound may play when braking is applied.
- Station ambience is quieter than locomotive sounds.
- Provide master volume and mute controls.
- Audio must not start until the user interacts with the page, to comply with browser autoplay restrictions.
- Avoid sudden loud audio. Start at a moderate volume.
Sound asset candidates
- Pixabay Indian railway sound search: https://pixabay.com/sound-effects/search/indian%20railway/
  Search for Indian train ambience, horn, platform sounds, and coach noise. Review each individual asset’s license and restrictions.
- Pixabay rural Indian train ambience: https://pixabay.com/sound-effects/film-special-effects-rural-indian-train-ambience-horn-wind-and-light-coach-noise-328069/
  Candidate for ambience; verify terms before bundling.
- SoundBible Indian Railways recording: https://soundbible.com/1812-Train-Sound-Indian-Railways.html/free-sound-effects-1.html
  Listed as Public Domain on its page; confirm source details and retain attribution information if available.
- Mixkit train sounds: https://mixkit.co/free-sound-effects/train/
  General train effects; some may not sound Indian. Check the Mixkit license and suitability.
- Pixabay Indian railway announcement search: https://pixabay.com/sound-effects/search/india%20railways/
  Use only if a relevant sound is found and license is confirmed.
Do not assume a sound’s title or “free” label proves permission. Keep an asset-credit record and, where practical, a copy of the license/terms checked at download time.
11. UI and UX
The interface should look like a clean simulator, not a generic admin dashboard.
Start screen
- Game title.
- Start Journey button.
- Brief controls overview.
- Loading state while assets load.
- Audio consent/unlock via the Start button.
In-game HUD
Show:
- Speed in km/h.
- Throttle.
- Brake.
- Direction.
- Current station / destination.
- Journey progress or remaining distance.
- Camera mode indicator.
- Horn/headlight state if useful.
Pause menu
- Resume.
- Restart journey.
- Audio volume.
- Quality setting.
- Controls.
- Return to title.
Completion panel
- Journey completed.
- Elapsed time.
- Maximum speed reached.
- Destination stop status.
- Restart button.
HUD values should be legible and avoid covering the track view.
12. Suggested Project Structure
Use a clear structure and avoid putting all game logic in one component.
src/
  app/
    App.jsx
  game/
    GameCanvas.jsx
    config/
      gameConfig.js
    simulation/
      trainSimulation.js
      routeMath.js
      journeyManager.js
    components/
      Train/
        Train.jsx
        Locomotive.jsx
        Coach.jsx
      Track/
        TrackRoute.jsx
        TrackSegment.jsx
      Stations/
        Station.jsx
      Environment/
        Scenery.jsx
      Cameras/
        CabCamera.jsx
        FollowCamera.jsx
    hooks/
      useKeyboardControls.js
      useAudio.js
    state/
      gameStore.js
    audio/
      audioManifest.js
  ui/
    StartScreen.jsx
    HUD.jsx
    PauseMenu.jsx
    JourneyComplete.jsx
    LoadingScreen.jsx
  styles/
    global.css
    hud.css
public/
  assets/
    models/
      locomotive/
      coaches/
      stations/
      track/
      environment/
    audio/
    textures/
docs/
  ASSET_CREDITS.md
This is a suggested layout. Adjust if the repository already has a sensible structure.
13. Development Plan — Build in This Order
The AI assistant must implement one milestone at a time. After each milestone, run the app and verify it before continuing.
Milestone 0 — Repository inspection and setup
- Read README and this specification.
- Inspect the existing project before changing files.
- Confirm whether Vite/React is already set up.
- Create the minimum app if needed.
- Start the development server.
- Confirm the app opens in the browser.
Done when: The empty game shell runs locally.
Milestone 1 — 3D scene and track blockout
- Create the R3F canvas.
- Add camera, lighting, ground, and sky/fog.
- Create a simple spline track using basic geometry.
- Add a placeholder train made of boxes.
- Add a start screen and loading state.
Done when: The scene is visible and the placeholder train sits on the track.
Milestone 2 — Train movement
- Implement route-distance movement.
- Add throttle, coasting, braking, speed cap, and direction.
- Add keyboard controls.
- Add a simple speed HUD.
- Keep simulation math separate from rendering.
Done when: The player can drive the placeholder train, accelerate, coast, brake, and stop reliably.
Milestone 3 — Coach following and cameras
- Add one coach.
- Make it follow the locomotive at a fixed distance.
- Add cab camera and exterior follow camera.
- Add camera switching.
Done when: Train formation moves smoothly and camera switching works.
Milestone 4 — Stations and journey state
- Add New Delhi and Ghaziabad station environments.
- Add route progress.
- Add destination stopping zone.
- Add journey completion and restart.
Done when: A complete journey can be completed from start to destination.
Milestone 5 — Model integration
- Search for suitable free locomotive/coach models.
- Verify licenses.
- Import and optimize assets.
- Replace placeholders while retaining the same movement system.
- Add asset credits.
Done when: The train looks recognizably Indian and remains performant.

Do not delay the movement prototype while looking for models.
Milestone 6 — Audio and polish
- Add horn.
- Add train-running loop.
- Add brake and optional station ambience.
- Add volume/mute.
- Improve lighting, materials, HUD, loading, and pause state.
Done when: The journey has basic audiovisual immersion and is stable.
Milestone 7 — Performance and release
- Test on target Mac browser.
- Reduce heavy models and textures.
- Check loading time.
- Check console errors.
- Test restart and repeated journeys.
- Add deployment instructions.
Done when: The web MVP can be shared and played in a modern desktop browser.
14. MVP Acceptance Checklist
The MVP is complete only when:
- [ ] App runs in a modern desktop browser.
- [ ] 3D scene loads without fatal console errors.
- [ ] A train is visible on a track.
- [ ] Train follows the route rather than moving freely through the world.
- [ ] Throttle controls acceleration.
- [ ] Brake causes gradual deceleration.
- [ ] Train can stop and remain stopped.
- [ ] Direction change is safely restricted at speed.
- [ ] Speed is shown in km/h.
- [ ] Cab and exterior camera modes work.
- [ ] At least one coach follows the locomotive.
- [ ] Horn works after user interaction.
- [ ] Running ambience loops while moving.
- [ ] Start and destination stations are present.
- [ ] The destination stop zone is detected.
- [ ] Journey completion panel works.
- [ ] Journey can be restarted.
- [ ] Assets are free to use under verified terms.
- [ ] Asset sources and licenses are recorded.
- [ ] Performance is acceptable on the target Apple Silicon Mac.
- [ ] No paid API, server, asset, or subscription is required.
15. Explicitly Out of Scope
Do not implement these in the MVP:
- Multiplayer.
- User accounts or cloud saves.
- Mobile support.
- VR.
- Multiple selectable routes.
- Accurate geographic route recreation.
- Track switching, junctions, and railway network dispatching.
- AI trains.
- Timetable simulation.
- Advanced signal logic.
- Detailed traction/electrical systems.
- Realistic pneumatic brake simulation.
- Dynamic weather.
- Passenger simulation.
- Freight operations.
- Career mode/economy.
- Coach interiors that can be explored.
- Free-roam walking.
- Real-time passenger announcements unless a suitable asset is found.
- Full photo-realism at the cost of performance.
These can be revisited after the MVP is playable and stable.
16. Instructions for Claude / AI Coding Assistant
You are acting as a senior web game developer and a patient technical mentor.

The project owner is a beginner in game development. Explain unfamiliar concepts plainly and implement in small, verifiable steps.
Before coding
1. Read README.md.
2. Read WEB_MVP_SPEC.md.
3. Inspect the repository and current implementation.
4. Identify the current milestone.
5. Briefly state the next small implementation task and which files you intend to touch.
6. Do not overwrite existing working code without inspecting it.
While coding
- Use React, Vite, Three.js, and React Three Fiber as specified unless the existing project has a strong reason to differ.
- Prefer JavaScript over TypeScript for this MVP.
- Keep simulation logic testable and separate from the rendering layer.
- Use clear component/function names.
- Explain how the train movement logic works.
- Avoid overengineering and unnecessary dependencies.
- Do not add paid assets or services.
- Do not invent asset download URLs or licenses.
- When sourcing models, provide page URL, creator, license, format, approximate geometry size, and why it is suitable.
- Keep placeholders until an asset is verified.
- Do not claim a feature is complete unless it has been implemented and tested.
- Do not make the entire app in one enormous response.
- Do not introduce future-scope features without approval.
At the end of each implementation step
Report:
- What was implemented.
- Files changed.
- How to run/test it.
- What should be visible or happen.
- Any known limitation.
- The next milestone, but do not begin it automatically if user confirmation is needed.
Debugging
When something fails:
1. Ask for or inspect the exact error and relevant files.
2. Identify the likely root cause.
3. Make the smallest correction.
4. Explain why it happened.
5. Re-test the relevant behavior.
Non-negotiable scope guard
If a proposed feature is not required for the MVP, label it “post-MVP” and do not implement it unless the project owner explicitly requests it.
17. Definition of Success
The web MVP succeeds when a player can launch it in a browser, see an Indian-style locomotive and passenger coach on a railway track, drive from the New Delhi test station to the Ghaziabad test station using throttle and brake, hear basic train sounds, stop in the destination zone, complete the journey, and restart.

It does not need to be a complete Indian Train Simulator yet.

First make the train move convincingly. Then make the journey complete. Then make it beautiful.