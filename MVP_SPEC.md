
# Bharat Rail Simulator — MVP Specification

**Project:** Bharat Rail Simulator  
**Document:** MVP Specification  
**Status:** Planned  
**Engine:** Unreal Engine 5  
**Primary Platform:** Windows PC  
**Development Approach:** Solo hobby project, beginner-friendly, Blueprint-first  
**Budget:** ₹0 — free tools and assets only  
**Version:** MVP v1.0

---

## 1. Project Overview

Bharat Rail Simulator is a hobby project focused on creating an immersive Indian Railways train-driving experience.

The long-term vision is to build a detailed railway simulator featuring Indian locomotives, passenger coaches, railway routes, stations, signalling, and realistic train operations.

However, the first version will be intentionally small.

The MVP should allow a player to:

1. Start a train at a station.
2. Enter the locomotive cab.
3. Operate the train using basic controls.
4. Accelerate, maintain speed, and brake.
5. Sound the horn.
6. Drive along a short railway route.
7. Stop at a destination station.
8. Complete the journey and receive a simple result.

The MVP must prioritize a **complete, playable driving experience** over the number of features or visual detail.

---

## 2. MVP Design Principles

All development decisions should follow these principles:

- Build a playable experience before adding advanced realism.
- Use free software, assets, and resources.
- Prefer Unreal Engine Blueprints for initial gameplay systems.
- Avoid unnecessary backend, networking, or account systems.
- Keep systems modular so they can be improved later.
- Do not add features merely because they sound interesting.
- Use placeholder assets when suitable free assets are unavailable.
- Keep the project achievable for a beginner working a few hours per week.
- Do not sacrifice basic functionality for graphics.

The MVP should be small enough to finish, but complete enough to demonstrate the core idea.

---

## 3. MVP Content

### 3.1 Locomotive

The MVP will feature one Indian electric locomotive.

**Target locomotive:** WAP-7

The WAP-7 is the preferred choice because it represents a recognizable Indian passenger electric locomotive.

#### Required features

- One locomotive model.
- Basic Indian Railways-inspired exterior appearance.
- A visible locomotive cab.
- Basic cab controls and instrumentation.
- Working headlight.
- Working horn.
- Moving wheels or wheel-related visual effects where feasible.
- Basic locomotive movement and braking.

#### Asset approach

The locomotive model may be:

- A suitable free 3D model.
- A modified free model, where its license permits modification.
- A simple custom model created in Blender.
- A placeholder model during early development.

A fully accurate WAP-7 model is not required for the first playable build.

The MVP must not depend on purchasing a model.

---

### 3.2 Passenger Coach

The train will initially use one passenger coach.

**Target coach:** LHB-style passenger coach

#### Required features

- One coach attached to the locomotive.
- Basic exterior appearance.
- Visible windows and doors.
- Basic bogie and wheel representation.
- Coach follows the locomotive along the track.
- Coach remains connected during normal movement and braking.

The first version does not require detailed passenger interiors, passengers, or working doors.

---

### 3.3 Train Formation

The initial train formation will be:

- 1 WAP-7 locomotive
- 1 LHB-style passenger coach

The formation should be configurable in the project so that more coaches can be added later without redesigning the entire system.

The MVP does not require a complete passenger rake.

---

## 4. Route and Environment

### 4.1 Route Scope

The MVP will contain one short, fictional Indian Railways-inspired route.

The route should be designed to demonstrate the train-driving experience rather than recreate a real railway line accurately.

#### Route requirements

- One starting station.
- One destination station.
- A short section of railway track connecting them.
- At least one straight section.
- At least one gentle curve, if practical.
- A visible station platform.
- Basic railway scenery.
- A clear destination stopping point.

The route should be short enough that a player can complete a journey in approximately 5–10 minutes.

This duration is a target, not a strict requirement.

### 4.2 Environment

The environment should include:

- Railway tracks.
- Sleepers and ballast, where practical.
- A starting station.
- A destination station.
- Platform surfaces.
- Basic buildings.
- Trees and vegetation.
- Ground terrain.
- Sky and lighting.
- Basic railway signage.

The environment may use free assets or simple custom assets.

Visual accuracy is secondary to performance and gameplay.

### 4.3 Track System

For the MVP, the track system should support:

- A defined route from the start station to the destination.
- Straight and curved track sections.
- Train movement along the route.
- A stable train position and orientation.
- A way to determine the train's progress along the route.

A simplified spline-based track system is acceptable.

The train does not need to support arbitrary track switching or a complex railway network in the MVP.

---

## 5. Core Train Gameplay

### 5.1 Driving System

The train should use a simplified but believable driving model.

The MVP does not require a fully accurate railway traction simulation.

The driving system should support:

- Acceleration.
- Coasting.
- Braking.
- Reverse direction.
- Speed display.
- Maximum speed limit.
- Train movement along the track.
- Basic speed reduction when braking.
- Basic stopping behavior.

The driving model should be structured so that more realistic traction and braking systems can be added later.

### 5.2 Throttle

The throttle controls how much acceleration is applied to the train.

Required behavior:

- Throttle has multiple levels or a continuous value.
- Increasing throttle increases acceleration.
- Reducing throttle stops applying additional acceleration.
- The train should not accelerate indefinitely.
- A configurable maximum speed should be enforced.

The throttle should not instantly change the train's speed.

### 5.3 Braking

The MVP will use a simplified train brake system.

Required behavior:

- Brake input reduces speed.
- Higher brake input results in stronger deceleration.
- The train should require distance to stop.
- Applying the brake should not instantly set speed to zero.
- The train should be able to remain stationary after stopping.

A realistic pneumatic brake simulation is out of scope for the MVP.

### 5.4 Direction Control

The player should be able to select:

- Forward
- Neutral
- Reverse

Direction changes should only take effect when the train is stationary or moving at a sufficiently low speed.

The train must not instantly reverse direction while moving at normal speed.

### 5.5 Speed Display

The player should see:

- Current speed in km/h.
- Selected throttle level.
- Brake level.
- Selected direction.

The speed display should update during gameplay.

---

## 6. Player Controls

The MVP will use keyboard and mouse controls.

The exact key mapping may be adjusted during development.

| Input | Action |
|---|---|
| W | Increase throttle |
| S | Decrease throttle |
| Space | Apply brake |
| X | Release brake |
| F | Toggle forward / neutral / reverse |
| H | Sound horn |
| L | Toggle headlight |
| C | Switch camera |
| Escape | Pause menu |

The control system should be implemented using Unreal Engine's input system.

Controls should be documented in the game UI or a simple controls screen.

---

## 7. Camera System

The MVP should include two camera modes.

### 7.1 Cab Camera

The cab camera is the primary gameplay view.

Requirements:

- Camera positioned inside the locomotive cab.
- Player can see the track ahead.
- Basic cab interior is visible.
- Essential speed and driving information is visible.
- Camera should not clip through the locomotive during normal gameplay.

The cab does not need fully interactive physical controls.

### 7.2 Exterior Camera

Requirements:

- Camera positioned outside the train.
- Player can see the locomotive and coach.
- Camera can follow the train.
- Player can switch between cab and exterior views.

A free-roaming cinematic camera is not required for the MVP.

---

## 8. Horn and Headlight

### Horn

The horn should:

- Be triggered by the assigned input.
- Play a suitable horn sound.
- Be audible from the player's current camera position.
- Use a free sound asset or a self-created sound.

The horn does not need multiple tones or a realistic air-pressure simulation.

### Headlight

The headlight should:

- Be visible on the locomotive.
- Be toggleable.
- Produce a basic light effect.
- Be functional at night or in low-light conditions.

---

## 9. Station and Journey System

The MVP should provide a basic journey from one station to another.

### Starting Station

At the beginning of the game:

- The train is positioned at the starting station.
- The train is stationary.
- The throttle is set to zero.
- The brake is applied.
- The player can enter the cab and begin driving.

### Destination Station

The destination station should have:

- A visible platform.
- A designated stopping zone.
- A destination marker or stopping reference.
- A way to determine whether the train has stopped in the correct area.

### Journey Completion

The journey is completed when:

- The train reaches the destination station.
- The train stops within the designated stopping zone.
- The train remains stopped for a short period.

The game should display a simple completion message.

### Basic Result Screen

The result screen may display:

- Journey completed.
- Total journey time.
- Maximum speed reached.
- Whether the train stopped within the target zone.

A detailed scoring system is not required.

---

## 10. Basic HUD

The MVP should include a minimal user interface.

### Required HUD Elements

- Current speed in km/h.
- Throttle level.
- Brake level.
- Direction indicator.
- Current camera mode.
- Destination station name.
- Basic journey progress.

The HUD should remain readable and unobtrusive.

The initial design may be simple. A polished railway-style instrument panel can be developed later.

---

## 11. Audio

The MVP requires basic audio only.

Required audio:

- Locomotive horn.
- Basic locomotive running sound.
- Basic braking sound, if available.
- Optional track sound.
- Optional station ambience.

Audio assets must be free to use under their applicable licenses.

The project does not require a full sound simulation system.

---

## 12. Game Flow

The MVP should follow this basic flow:

1. Launch the game.
2. Load the route.
3. Display the train at the starting station.
4. Allow the player to enter the cab.
5. Player releases the brake and applies throttle.
6. Train begins moving.
7. Player drives along the route.
8. Player approaches the destination station.
9. Player reduces speed and applies the brake.
10. Train stops within the destination zone.
11. Journey completion screen is displayed.
12. Player can restart the journey.

A main menu is optional for the earliest prototype.

---

## 13. Technical Architecture

The project should use a modular structure.

Suggested Unreal Engine Blueprint classes:

### `BP_Train`

Main train actor.

Responsibilities:

- Train movement.
- Speed tracking.
- Direction.
- Throttle.
- Brake.
- Train state.

### `BP_Locomotive`

Locomotive visual actor.

Responsibilities:

- Locomotive mesh.
- Headlight.
- Horn.
- Cab camera.
- Exterior camera.

### `BP_PassengerCoach`

Passenger coach actor.

Responsibilities:

- Coach mesh.
- Wheel and bogie visuals.
- Positioning behind the locomotive.

### `BP_TrackSpline`

Track route actor.

Responsibilities:

- Track spline.
- Route length.
- Train position along the route.
- Track direction and orientation.

### `BP_Station`

Station actor.

Responsibilities:

- Station visuals.
- Station name.
- Stop zone.
- Destination information.

### `BP_TrainHUD`

HUD widget.

Responsibilities:

- Speed.
- Throttle.
- Brake.
- Direction.
- Journey progress.

### `BP_JourneyManager`

Journey management actor.

Responsibilities:

- Starting the journey.
- Tracking destination progress.
- Checking the stopping zone.
- Completing the journey.
- Restarting the journey.

These are suggested responsibilities, not mandatory class names. The architecture may be adjusted if a simpler approach is better for the MVP.

---

## 14. Development Milestones

Development should proceed in the following order.

### Milestone 1 — Unreal Engine Setup

- Install Unreal Engine.
- Create the project.
- Configure the project for Windows.
- Create a basic level.
- Understand the Unreal Editor.
- Set up version control.

**Completion criteria:** The project opens and runs successfully.

### Milestone 2 — Train Movement Prototype

- Create a simple train actor using placeholder shapes.
- Create a basic track spline.
- Implement train movement.
- Implement throttle.
- Implement braking.
- Display speed.
- Add direction control.

**Completion criteria:** A placeholder train can move along a track, accelerate, and stop.

### Milestone 3 — Camera and Controls

- Add cab camera.
- Add exterior camera.
- Add camera switching.
- Implement keyboard controls.
- Add a basic HUD.

**Completion criteria:** The player can drive the train and monitor its speed.

### Milestone 4 — Train Formation

- Add a locomotive visual model.
- Add one passenger coach.
- Connect the coach to the train formation.
- Ensure the coach follows the route.

**Completion criteria:** The locomotive and coach move together.

### Milestone 5 — Route and Stations

- Create the starting station.
- Create the destination station.
- Connect them with track.
- Add basic environment assets.
- Add the destination stopping zone.

**Completion criteria:** The train can travel between two stations.

### Milestone 6 — Driving Features

- Add horn.
- Add headlight.
- Add basic train audio.
- Improve braking behavior.
- Add maximum speed.
- Add basic driving feedback.

**Completion criteria:** The train feels like a simple railway vehicle rather than a freely moving object.

### Milestone 7 — Journey Completion

- Add journey start.
- Add journey progress.
- Add destination detection.
- Add stopping-zone validation.
- Add journey completion screen.
- Add restart functionality.

**Completion criteria:** A complete journey can be started, driven, completed, and restarted.

### Milestone 8 — MVP Polish

- Improve lighting.
- Improve cab visuals.
- Improve HUD layout.
- Fix major bugs.
- Optimize performance.
- Test on the target Windows PC.

**Completion criteria:** The MVP is stable and playable from beginning to end.

---

## 15. MVP Acceptance Criteria

The MVP is considered complete when all of the following are true:

- [ ] The game launches on Windows.
- [ ] The player can start a journey at a station.
- [ ] The train can move along the track.
- [ ] Throttle affects acceleration.
- [ ] Brake affects deceleration.
- [ ] The train can stop and remain stationary.
- [ ] The player can select direction.
- [ ] Current speed is displayed.
- [ ] The player can switch between cab and exterior cameras.
- [ ] The locomotive and one coach move together.
- [ ] The horn works.
- [ ] The headlight works.
- [ ] The route has a starting and destination station.
- [ ] The destination stopping zone is detected.
- [ ] The player can complete a journey.
- [ ] The player can restart the journey.
- [ ] The game does not require paid assets or services.
- [ ] The project can be opened and continued in Unreal Engine.

---

## 16. Explicitly Out of Scope for MVP

The following features are not part of the first version.

Do not implement them unless the MVP is already complete and the project owner explicitly approves the expansion.

### Advanced Railway Simulation

- Fully realistic traction physics.
- Detailed pneumatic brake simulation.
- Advanced locomotive electrical systems.
- Realistic wheel-slip simulation.
- Detailed pantograph simulation.
- Accurate locomotive-specific control logic.

### Railway Network

- Multiple routes.
- Multiple stations beyond the MVP route.
- Track switching.
- Complex junctions.
- Multiple simultaneous trains.
- Railway dispatching.

### Advanced Gameplay

- Timetable simulation.
- AI trains.
- Passenger simulation.
- Freight operations.
- Career mode.
- Economy or progression systems.
- Multiplayer.
- Online accounts.
- Cloud saves.

### Advanced Visuals

- Photorealistic environment.
- Full locomotive interior.
- Detailed passenger interiors.
- Dynamic weather simulation.
- Advanced day/night simulation.
- Extensive animations.

### Platform Expansion

- Android.
- iOS.
- Console.
- VR.

These features may be considered after the first playable version is stable.

---

## 17. Free Tools and Asset Policy

The project must remain free to develop.

Preferred tools:

- Unreal Engine 5 — game engine.
- Blender — 3D modeling.
- Git — version control.
- GitHub — repository hosting.
- Krita — texture and image editing.
- Audacity — audio editing.

Asset rules:

1. Do not purchase assets.
2. Check the license before using any downloaded asset.
3. Prefer CC0 or clearly permissive assets.
4. Record asset source and license information.
5. Do not assume that a free download allows commercial use or redistribution.
6. Do not use copyrighted Indian Railways branding or assets without appropriate permission.
7. Use placeholders when a suitable free asset cannot be found.

Suggested asset tracking file:

`ASSET_CREDITS.md`

Each asset entry should include:

- Asset name.
- Creator.
- Source URL.
- License.
- Modifications made.
- Where it is used in the project.

---

## 18. Performance Goals

The initial target is the project's development PC.

The game should:

- Run at a stable, playable frame rate.
- Avoid unnecessary high-resolution textures.
- Avoid excessive environment detail.
- Use simple collision where possible.
- Use low-cost lighting and materials.
- Avoid unnecessary physics simulation.
- Remain manageable on a system with 16 GB RAM and an RTX 3050.

Performance should be tested early, not only after the environment is complete.

The first goal is stable gameplay, not maximum graphics quality.

---

## 19. Instructions for Future ChatGPT Sessions

When continuing this project in a new ChatGPT conversation:

1. Read `README.md` for the project overview.
2. Read `MVP_SPEC.md` for the agreed MVP requirements.
3. Ask for the current development status only if it is not already provided.
4. Continue from the current milestone.
5. Do not redesign the project from scratch without a clear reason.
6. Do not introduce paid tools, assets, or services.
7. Prefer Unreal Engine Blueprints for beginner-level implementation.
8. Explain concepts before asking the project owner to implement them.
9. Provide implementation steps in manageable chunks.
10. Avoid dumping large amounts of code or Blueprint logic at once.
11. Explain where each Blueprint, component, variable, and function should be created.
12. Help debug errors using the actual error messages or screenshots.
13. Do not mark a milestone complete until the project owner confirms that it works.
14. Do not add out-of-scope features without explicit approval.
15. If a feature is too ambitious for the current milestone, recommend a simpler implementation.

The role of ChatGPT is to act as a technical mentor, Unreal Engine guide, and project development partner.

The goal is to help the project owner learn game development while building the game—not merely to generate instructions that cannot be understood or maintained.

---

## 20. Definition of Success

The MVP is successful when a player can sit inside an Indian locomotive cab, drive a short route with one passenger coach, operate basic train controls, approach a station, stop correctly, and complete the journey.

The first milestone is not a complete Indian Railways simulator.

**The first milestone is a small, working railway simulator that can be expanded over time.**
