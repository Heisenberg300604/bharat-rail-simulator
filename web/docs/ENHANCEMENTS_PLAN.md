# Future enhancements: product plan

Status: proposal (2026-11-14). Written from the product side, not the
engineering side: what would make this a game people keep opening, in what
order, and why.

**Ground rule for everything below: nothing here removes or rewrites a
feature or model that works today.** Every item is additive — a new option, a
new unit, a new mode, a new layer on top of the existing physics. The WAP-7 +
8 LHB coaches on the New Delhi → Ghaziabad segment stays the default
experience, and stays exactly as it is.

This plan sits *beside* [ROUTES_PLAN.md](ROUTES_PLAN.md), which covers new
routes and the engine work they need. Where an item here depends on that work,
it says so. Read the two together: routes give players somewhere new to go,
this gives them a reason to go there twice.

---

## 1. Where the product stands today

### Unusually strong for a hobby web sim
- **Physics with real numbers.** TE curves, Davis resistance, A9 → BP → BC
  with propagation delay, traction cut below 4.75 kg/cm². The 1 km stopping
  distance is *earned*, not scripted. This is the moat.
- **Per-axle audio.** 38 wheelsets triggering real joint impacts,
  sample-accurate, with turnouts and LWR stretches. Nobody else in a browser
  is doing this.
- **It actually runs.** 60 FPS with auto quality detection and adaptive
  resolution, down to old Intel UHD.
- **Atmosphere.** Crowds, IDM road traffic, manned level crossings, four times
  of day, fog and monsoon, six cameras including a coach interior.

### Thin spots (each is an opportunity below)
| Gap | Evidence in the code |
| --- | --- |
| Signals are scenery | `Road.jsx:651` picks red/yellow/green from `sig.s`. Nothing can ever change them, and nothing checks whether the driver obeyed. |
| One stop, one score | `journeyManager.js` has a single `stopMarker`. Score is three deductions. Nothing persists. |
| No reason for run #2 | No records, no progression, no variation between runs beyond the weather dropdown. |
| No adhesion model | `stepTrain` has no slip: full 322 kN is available on wet rail at a dead start. Sanders, wheel slip and notching back are the heart of ghat driving. |
| The train is one rigid body | No slack action, no coupler dynamics, no banker, no distributed power. |
| Onboarding is a wall | A new player meets a reverser, an A9 handle and a brake-pipe recharge in the first 20 seconds. The README teaches it; the game doesn't. |
| Fixed weather | Chosen once at the start, never changes mid-run. |
| English only | The audience is India. Name boards have regional scripts planned per route, but the UI is English-only. |
| Desktop keyboard only | A web game that phones can't play gives up most of its reach. |
| Nothing leaves the tab | No screenshot, no replay, no run card. Zero shareability. |

---

## 2. Who this is for

| Player | What they want | What makes them leave |
| --- | --- | --- |
| **The railfan** (core, Indian, knows what a WAP-7 is) | Accuracy, their favourite loco, the sounds being right, recognisable routes | "It's just one train on one line" |
| **The sim driver** (plays MSTS/Train Sim World, or wants to) | Procedures, signals, consequences, a hard stop to nail | "There's nothing to get good at" |
| **The curious visitor** (clicked a link, 5 minutes) | To be moving and looking at something beautiful within 30 seconds | A brake-pipe tutorial in paragraph form |

The curious visitor is how the other two arrive. Today the funnel leaks at
exactly that point — which is why onboarding is Wave 1, not Wave 3.

---

## 3. Product pillars

1. **Driving that rewards skill.** Every system added should create a decision
   the player can get right or wrong, with a visible consequence.
2. **A reason to come back tomorrow.** Records, variation, progression —
   without accounts or a server.
3. **Unmistakably Indian.** Not "a train sim with Indian paint". The horn, the
   announcements, the crowd, the script on the name board, the units of the
   fleet.
4. **Still 60 FPS on a cheap laptop.** Every item carries a performance budget
   or it doesn't ship.

---

## 4. Enhancement epics

Effort: **S** ≈ a day or two, **M** ≈ a week, **L** ≈ multi-week.
Impact is on retention and word-of-mouth, not on realism for its own sake.

### A. Driving depth — "something to get good at"

| # | Epic | Effort | Impact | Depends on |
| --- | --- | --- | --- | --- |
| A1 | **Live signalling + SPAD** | M | ★★★★★ | — |
| A2 | **Kavach / ATP cab display** | M | ★★★★★ | A1 |
| A3 | **Adhesion, wheel slip and sanders** | M | ★★★★ | — |
| A4 | **Pre-departure checklist and brake test** | S | ★★★ | — |
| A5 | **Vigilance control (VCD)** | S | ★★★ | — |
| A6 | **Slack action and coupler jerk** | L | ★★★ | — |
| A7 | **Banker and distributed power** | M | ★★★ | ROUTES_PLAN gradients |
| A8 | **Shunting mode** | M | ★★ | Track switching |

**A1 — Live signalling + SPAD.** The single highest-value feature in this
document. Make the posts in `Road.jsx` data-driven and state-driven: a
`signals` module owns aspect per signal, set by block occupancy (player + AI
trains) and by the route ahead. Red means stop before it; passing one at
danger is a **SPAD** — the run ends, logged as a failure, the way it ends a
real driver's day. Yellow means be ready to stop at the next one; double
yellow, attention. Suddenly the 110 km/h sectional speed is a *judgement*, not
a number to pin, and the existing AI trains become traffic you have to be held
behind. Everything else in this section is garnish compared with this.

**A2 — Kavach.** India's own ATP system, and a perfect fit: a cab display
showing the next signal's aspect, the target speed and the braking curve, with
automatic brake intervention if the driver ignores it. Mechanically it is the
tutorial for A1 — it *shows* the player the braking curve the game has been
asking them to estimate — and it is a feature no other train sim leads with.
Make it switchable: Kavach on (guided), Kavach off (purist).

**A3 — Adhesion.** Add `µ` to the physics: dry rail ≈ 0.33, wet ≈ 0.20, with
sand restoring it briefly. Available TE becomes `min(TE curve, µ × axle load)`.
Notch up too fast on a wet gradient and the wheels slip: speed signal flies
up, acceleration collapses, a slip light comes on, you notch back or sand.
This is where the monsoon weather and the planned ghat gradients become
*gameplay* rather than a backdrop. One new term in `stepTrain`, one new
control key, one new HUD lamp.

**A4 — Checklist.** Before "Start Journey" can be the only thing the player
does, give an optional procedure: reverser forward, flasher on, BP charged to
5.0, brake continuity test (apply, watch the BC rise, release), headlight,
horn. A "Loco Pilot" difficulty requires it; "Easy" skips it. It costs almost
nothing to build and it makes the first 30 seconds feel like a job.

**A5 — VCD.** A buzzer every 60 s that needs acknowledging, or a penalty
brake application. Trivial to build, instantly recognisable, and it keeps the
player's hands on the desk during long sections — which is what the longer
routes in ROUTES_PLAN will need.

**A6 — Slack action.** Model the train as a few lumped masses with spring
couplers instead of one rigid body. Earns its keep most on freight: start a
20-wagon BOXN rake too hard and you feel the snatch, brake hard and the slack
runs in with a bang. Changes `trainSimulation.js` structurally, so schedule it
when nothing else is mid-flight; keep the rigid model as the "Simple" physics
option so nothing regresses.

**A7 — Banker.** Needed by Bhor Ghat anyway, and it unlocks the most
distinctive driving in Indian railways: coordinating a pushing loco at the
rear. Generalises the consist to "vehicles with traction at positions n", which
is the same change EMU/Vande Bharat distributed power needs (E5, E6).

### B. A reason to come back — "progression without a server"

Everything here is `localStorage`. No accounts, no backend, no cost.

| # | Epic | Effort | Impact | Depends on |
| --- | --- | --- | --- | --- |
| B1 | **Run card and personal records** | S | ★★★★ | — |
| B2 | **Daily Working** | S | ★★★★ | — |
| B3 | **Loco Link (career-lite)** | M | ★★★★ | A1, multi-stop |
| B4 | **Late running and recovery** | S | ★★★ | multi-stop timetable |
| B5 | **Incidents** | M | ★★★ | A1, A3 |
| B6 | **Driving log / stats book** | S | ★★ | B1 |
| B7 | **Ghost of your best run** | M | ★★ | B1 |

**B1 — Run card.** Replace the single score with a post-run card that reads
like a driver's memo: punctuality at each halt, stopping accuracy in cm,
maximum speed, overspeed seconds, SPADs, emergency applications, passenger
comfort (peak jerk), energy used and regenerated in kWh. Store a personal best
per route + loco + consist. **This is the cheapest retention feature on the
list**: the score already exists, it just needs to be remembered and compared.

**B2 — Daily Working.** One generated roster per calendar day, seeded by the
date: route, loco, consist, time of day, weather, and a caution order or two.
Everybody driving on 14 November gets the same run. It gives the game a reason
to be opened today specifically, and it costs a seeded RNG and a UI card.

**B3 — Loco Link.** Light progression: start passed for shunting and local
passenger work, then goods, then mail/express, then Rajdhani-class and ghat
banking. Each tier unlocks locos, routes and the next rung — *unlocks, never
locks*: everything already in the game today stays available from the first
launch, and the Link is an optional overlay the player can ignore entirely.
This is the frame that makes new locos and new routes feel like rewards rather
than a longer dropdown.

**B4 — Late running.** Start 12 minutes down and try to recover it inside the
sectional speed and the signals. The best driving tension in the genre, and
with a timetable in place it is almost free.

**B5 — Incidents.** Occasional, announced-as-possible events: a temporary
caution order at 30 km/h for track work, a signal failure requiring
authority-to-pass procedure, a chain pulling, cattle on the line, a gate
closed against you. Keep them rare and never unfair — the player should always
have had the information needed to handle it.

### C. Onboarding, reach and access — "the funnel"

| # | Epic | Effort | Impact | Depends on |
| --- | --- | --- | --- | --- |
| C1 | **Driver school (interactive tutorial)** | M | ★★★★★ | — |
| C2 | **Difficulty presets** | S | ★★★★ | — |
| C3 | **Hindi UI, then regional languages** | M | ★★★★ | — |
| C4 | **Touch and mobile layout** | L | ★★★★ | — |
| C5 | **Accessibility pass** | S | ★★★ | — |
| C6 | **Gamepad support** | S | ★★ | — |

**C1 — Driver school.** Four short guided lessons on the existing 8 km
segment, each with on-screen prompts tied to the actual control: release the
brake and watch the pipe charge; notch up and feel the TE curve; stop from
110 km/h at a marker; read the signals. Five minutes total. The README already
contains the script for this — it just needs to be *in* the game, pointing at
the right lever at the right moment. Every other feature in this plan is worth
more once this exists, because more players get past minute one.

**C2 — Difficulty presets.** *Trainee* (generous stop zone, no SPAD penalty,
Kavach on, hints always), *Loco Pilot* (today's behaviour), *Realistic*
(checklist required, no HUD stopping-distance readout, tight stop zone,
incidents on). One object of flags; it makes the same content serve the
curious visitor and the sim driver without compromise.

**C3 — Localisation.** Hindi first: UI strings, HUD, hints, and the station
announcements. Then Bengali / Marathi / Tamil as the matching routes land.
Extract strings to a `locales/` module as step one — the longer this waits the
more expensive it gets.

**C4 — Mobile.** Explicitly out of scope for the MVP, and correctly so, but
this is a *browser* game about Indian railways: phones are the audience.
Needs a touch control layout (lever as a vertical slider, brake as a second
slider, big horn button), a portrait HUD, and a Very Low quality preset. Scope
it as "watch the cab view and drive", not "every camera and every menu". Treat
as its own project once Wave 2 lands; validate with the existing adaptive
resolution work before committing.

**C5 — Accessibility.** Colourblind-safe signal and HUD palettes (critical
once A1 makes aspects matter), a reduced-motion option, remappable keys,
subtitles for announcements, and a larger-HUD scale.

### D. World and atmosphere — "unmistakably Indian"

| # | Epic | Effort | Impact | Depends on |
| --- | --- | --- | --- | --- |
| D1 | **Station announcements and the guard** | S | ★★★★ | multi-stop |
| D2 | **Dynamic weather** | M | ★★★ | — |
| D3 | **Door cycle and passenger boarding** | M | ★★★ | multi-stop |
| D4 | **Close-pass effects** | S | ★★★ | — |
| D5 | **Cab life** | S | ★★★ | — |
| D6 | **Dust, heat haze, monsoon extras** | M | ★★ | biome kits |
| D7 | **Named-train dressing** | S | ★★ | — |

**D1 — Announcements and the guard.** A CC0 Indian announcement recording is
already in the project. Wire it to the halt sequence: arrival announcement,
platform crowd reacting, the guard's whistle, the "right away" signal, and the
driver's acknowledging short horn before departure. Cheap, and it is the sound
every Indian player is waiting to hear.

**D2 — Dynamic weather.** Let the chosen weather *evolve*: clear → building
cloud → rain → clearing, with fog burning off through the morning. Pair it
with A3 and the rail gets slippery while you're driving, not before you start.
The weather systems all exist; this is a state machine and some crossfades.

**D4 — Close-pass effects.** When an AI train passes at speed on the down
line: the pressure thump, the Doppler on its rolling noise, a camera shake, a
lateral nudge in the cab view, and dust lifting. Twenty seconds of work per
effect for one of the most memorable moments in railfanning.

**D5 — Cab life.** Wipers in the rain, a cab light for night runs, the
flasher, a working speedometer needle with lag, the MFD screens showing real
values, a swinging lanyard, the loco pilot's flask on the desk. Pure
atmosphere, very cheap, very high in screenshots.

**D7 — Named-train dressing.** Headboards and destination boards for
recognisable services on the matching routes — so a run *is* "the Rajdhani",
not "LHB rake, 9 coaches". Keep names generic-but-evocative where the real
name would overstep the fictional-route disclaimer.

### E. Rolling stock — new models, nothing replaced

The existing WAP-7, WAG-9, LHB and ICF stock stays as the default. Everything
here is a new entry in `LOCOMOTIVES` / `CONSISTS`.

Two sourcing routes, and the project has already proven both:
- **Licensed GLB**, like today's WAP-7/WAG-9 (CC BY, credited, optimised).
  Candidates are already catalogued in `ASSET_CREDITS.md`.
- **Original procedural**, like today's ICF and LHB coaches — built to real
  dimensions with canvas-drawn liveries. Zero licence risk, and the right
  answer for any unit where no clean model exists.

| # | Unit | Why players want it | Sourcing | Physics delta | Effort |
| --- | --- | --- | --- | --- | --- |
| E1 | **WAP-5** | 160 km/h, the Gatimaan/Rajdhani loco; needed by route 6 | Candidate listed (490k tris — needs decimation) | Lower TE (258 kN), higher speed | S |
| E2 | **WDP-4D** | The first *diesel*. Needed by the Thar route. Unlocks an entirely new sound layer — EMD 710 notches, and licence-clean diesel recordings are far easier to find than three-phase | Candidate listed (67k tris) | Notch-based power, no regen, idle/rev dynamics | M |
| E3 | **WAG-12B** | 12,000 hp, twin-section, 6,000 t trains. The "feel the mass" showcase | Candidate listed (90k tris) | Twin-section consist, huge TE | M |
| E4 | **WDM-3A (ALCO)** | The classic thrash. Enormous nostalgia value | Procedural or a new search | ALCO notching, smoke | M |
| E5 | **EMU / MEMU** | Suburban locals are how most Indians actually meet a train. Needed by the Bengal route | Procedural (as the coaches were) | Distributed power, fast acceleration, no loco | M |
| E6 | **Vande Bharat** | The highest-recognition train in India today, 0–100 in under a minute | Procedural — no licence-clear model exists | Train-set, distributed power, 160 km/h | L |
| E7 | **WAP-4** | The DC workhorse everyone grew up watching | Candidate listed (441k tris) | Older TE curve, 130 km/h | S |
| E8 | **Coach and wagon variants** | Rake realism | Procedural, extending `coaches.js` | Mass per vehicle only | S each |
| E9 | **Liveries** | Cheapest variety in the game | Canvas textures, extending `textures.js` | None | S each |

**E8 detail** — SLR brake van (so rakes have correct ends), EOG power car,
pantry car, double-decker, parcel van (VPU), container flat (BLC) with
containers, tank wagon (BTPN), covered wagon (BCNA). Each is a new
`COACH_TYPES` entry plus a procedural body; each makes a rake look *composed*
rather than repeated.

**E9 detail** — Rajdhani, Shatabdi, Tejas, Humsafar, Garib Rath, Antyodaya and
freight liveries over the existing coach geometry. Hours of work each, and
visibly a different train.

**Deliberately not planned yet:** narrow gauge (Darjeeling, Kalka–Shimla).
Beloved, and a tempting change of pace, but 2 ft gauge means gauge support
through `trackLayout.js`, new track geometry, new stock and a steam physics
model. It is a sequel, not an enhancement.

### F. Shareability — "nothing leaves the tab"

| # | Epic | Effort | Impact |
| --- | --- | --- | --- |
| F1 | **Photo mode** | S | ★★★★ |
| F2 | **Shareable run card image** | S | ★★★ |
| F3 | **Replay** | L | ★★ |

**F1 — Photo mode.** Pause, free the camera, hide the HUD, time-of-day
scrubber, depth of field, a few framing guides, and a PNG download. The world
is already beautiful; right now there is no way to show anybody. Best
effort-to-reach ratio in this document after onboarding.

**F2 — Run card image.** Render B1's card to a canvas with the route, loco,
score and a screenshot, and offer it as a download. People post scores.

---

## 5. Roadmap

Sequenced so each wave is independently shippable and each one is a reason to
post an update. Route work from ROUTES_PLAN is interleaved, not duplicated.

### Wave 1 — "a reason to finish, and a reason to start" (~3–4 weeks)
Fix the funnel and the retention loop before adding content to it.
1. **C1 Driver school** + **C2 difficulty presets**
2. **B1 Run card and personal records**
3. **F1 Photo mode**
4. **E9 two new liveries** + **E8 SLR brake van** (cheap, visible variety)
5. **D5 Cab life**, **D4 close-pass effects**

Why first: these multiply the value of everything that follows, and none of
them touch the physics or the existing models.

### Wave 2 — "something to get good at" (~4–6 weeks)
1. **A1 Live signalling + SPAD** — the keystone
2. **A2 Kavach display**
3. **A4 checklist** + **A5 VCD**
4. **B2 Daily Working**
5. ROUTES_PLAN steps 1–2: route data model, loader, picker, multi-stop journeys
6. **D1 announcements and the guard** (lands with multi-stop)

### Wave 3 — "the fleet and the first new route" (~4–6 weeks)
1. **E1 WAP-5**, **E7 WAP-4** (both are near-drop-in)
2. **A3 adhesion, slip and sanders** + **D2 dynamic weather**
3. ROUTES_PLAN steps 3–4: station presets, regional name boards, **route 5
   Bengal suburban**
4. **E5 EMU/MEMU** (route 5 wants it)
5. **C3 Hindi UI**
6. **B4 late running**, **B6 driving log**

### Wave 4 — "the mountain" (~6–8 weeks)
1. ROUTES_PLAN step 5: gradients, heightfield, bridges, tunnels
2. **A7 banker and distributed power**
3. ROUTES_PLAN step 6: **route 2 Bhor Ghat**, **route 3 Konkan**
4. **E2 WDP-4D** + the diesel sound layer
5. **B3 Loco Link**

### Wave 5 and beyond
**E6 Vande Bharat**, **E3 WAG-12B**, **A6 slack action**, **A8 shunting**,
**B5 incidents**, **C4 mobile**, **F3 replay**, ROUTES_PLAN step 7 (single
line, crossing loops) and routes 4 and 6.

### If there is only time for five things
C1 driver school · A1 signalling · B1 run card · F1 photo mode · E1 WAP-5.
Onboarding, depth, retention, reach, and one new loco.

---

## 6. How we know it worked

No backend, so no analytics — measure locally and by what people say.

| Signal | Today | Target after Wave 2 |
| --- | --- | --- |
| Players who reach the destination at least once | unknown | most first sessions |
| Runs per player | ~1 | 3+ |
| Frame rate on the Low preset | 58–60 FPS | unchanged — this is a hard constraint |
| Time from page load to moving | ~60 s with the README open | under 30 s with no reading |
| Screenshots and clips posted by players | 0 | the point of F1/F2 |

Add an opt-in local counter (`localStorage`, never transmitted) for runs
started, runs completed and SPADs, surfaced in the driving log (B6). It tells
the owner where players stall without collecting anything about anybody.

---

## 7. Guardrails

- **Additive only.** No existing feature, control, model, sound or default is
  changed or removed by anything in this plan. New systems ship behind a
  setting or a difficulty preset, defaulting to today's behaviour.
- **Performance budget per item.** Low preset must stay at 58+ FPS and the
  train at roughly 15 draw calls. Any new instanced set declares its draw-call
  cost before it is merged.
- **Licence discipline unchanged.** Page URL, creator, licence, triangle count
  and attribution recorded in `ASSET_CREDITS.md` before an asset is used. No
  invented URLs, no paid assets, no services. Procedural originals are always
  the safe fallback.
- **Simulation stays testable.** Signalling, adhesion, timetable and scoring
  are pure modules under `simulation/` with unit tests, as the physics is now.
- **The disclaimer stays true.** Routes remain fictional condensed segments;
  real train names and markings only where the existing asset questions are
  already settled.

---

## 8. Open decisions for the owner

1. **Wave 1 order.** My recommendation is driver school first — it is worth
   more than any single feature because it decides how many players see the
   rest. Agree, or go straight to signalling (A1) because that is the feature
   *you* most want to drive?
2. **Kavach on by default?** On makes the game teachable; off makes it
   purist. Recommendation: on for Trainee, off for Loco Pilot and Realistic.
3. **Progression framing.** Loco Link (B3) as an opt-in overlay with
   everything unlocked from day one, or a genuine unlock ladder? Recommendation:
   overlay — never gate content a player can already see.
4. **Mobile.** A real commitment (C4 is an **L**, and the control scheme is a
   design problem, not a port) or explicitly out of scope for another year?
5. **Model downloads.** E1/E2/E3/E7 all need a Sketchfab login the assistant
   cannot use. Which do you want to download, and in what order? E1 (WAP-5) is
   the cheapest win; E2 (WDP-4D) unlocks the most new ground.
6. **Vande Bharat.** It is the biggest recognition win available and it has to
   be built from scratch. Worth a dedicated multi-week push, or deferred until
   the procedural coach toolchain has been extended by E5 and E8 anyway?
