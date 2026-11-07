# How the train simulation works

The physics lives in `src/game/simulation/trainSimulation.js` (pure JavaScript,
unit-tested in `simulation.test.js`). All tuning numbers are in
`src/game/config/gameConfig.js` → `TRAIN`. The numbers come from published
Indian Railways / RDSO documents. They are **approximate**: a game model, not
an engineering tool.

## The train

| Item | Value | Source |
| --- | --- | --- |
| WAP-7 mass | 123 t (Co-Co, 20.5 t axle load) | Wikipedia, RDSO PUB0002 |
| WAP-7 starting tractive effort (TE) | 322 kN | Wikipedia, RDSO |
| WAP-7 power at the wheel | ≈ 4,500 kW | RDSO TE table |
| Regenerative brake | up to 260 kN, fading out below 10 km/h | IR 3-phase loco handbook |
| LHB coach | ≈ 50 t loaded (≈ 45 t tare + passengers) | MCF certificate, Wikipedia |
| Formation | WAP-7 + 8 LHB ≈ 523 t, ≈ 213 m long | — |

## Each simulation step (60 per second)

1. **TE/BE lever (W/S).** This is one lever, as on the real WAP-7.
   - Above 0 it asks for traction: `TE = lever × min(322 kN, 4500 kW / v)`. That
     gives full force at low speed and constant power above about 50 km/h.
   - Below 0 it is the regenerative (electric) brake.
   - The actual force ramps at about 50 kN/s and pauses briefly at 0 (the detent).
2. **A9 automatic air brake (Space/X).**
   - The handle sets a target **brake pipe (BP)** pressure: 5.0 kg/cm² at
     Release, 4.4 at Minimum reduction, 3.4 at Full service, 0 in Emergency.
   - BP moves toward the target at realistic rates (charging 1.5, service
     0.7 kg/cm²/s).
   - **Brake cylinder (BC)** pressure ≈ 2.14 × (5.0 − BP − 0.1), at most
     3.0 kg/cm² (3.8 in emergency). It follows BP after a propagation delay, then
     applies in about 1.5 s and releases slowly (about 5 s time constant). That is
     why you must **plan your braking**.
3. **Interlocks.** Traction is cut while BP is below 4.75 kg/cm² (so you can't
   power against the brakes), and in emergency. The reverser only moves when
   the train is stopped and the lever is at 0.
4. **Resistance (RDSO formulas, kgf per tonne, V in km/h).**
   - Coaches: `0.6855 + 0.02112·V + 0.000082·V²`.
   - Loco: `0.647 + 13.17/20.5 + 0.00933·V + 0.057·V²/123`.
   - Extra starting resistance below 8 km/h (4 and 6 kg/t).
   - Curves add `700 / radius` kgf/t.
5. **Acceleration.**
   `a = (traction − regen − resistance − air brake) / effective mass`.
   The effective mass includes rotating wheels and motors: loco × 1.15,
   coaches × 1.04.

## What it feels like (checked by unit tests)

| Situation | Result |
| --- | --- |
| 0 → 100 km/h at full power | about 60–75 s |
| Coasting at 110 km/h | loses only about 1 km/h every 10 s |
| Full-service stop from 110 km/h | about 1 km |
| Emergency stop from 110 km/h | about 750 m |
| Automatic driver, whole route obeying limits | about 8 minutes |

For comparison, IR's official emergency stopping distance for a 24-coach LHB
rake at 130 km/h on a falling 1-in-80 gradient is 1,191 m.

## Speed limits

Speed limits are in `SPEED_LIMITS`:

| Section | Limit |
| --- | --- |
| New Delhi yard | 30 km/h |
| Sectional speed | 110 km/h |
| Ghaziabad approach | 60 km/h |
| Ghaziabad platform | 30 km/h |

As on the real railway, a restriction applies until the **rear** of the train has
passed it. The HUD shows the current limit, the next restriction, and the
full-service stopping distance from your current speed.

## Score

Out of 100, built from:
- stop accuracy at the marker;
- time spent overspeeding, and the worst overspeed;
- a 15-point penalty for using the emergency brake.

## Sources

- Wikipedia, WAP-7: https://en.wikipedia.org/wiki/Indian_locomotive_class_WAP-7
- RDSO PUB0002 (haulage capacity, resistance formulas, WAP-7 TE table): https://rdso.indianrailways.gov.in/uploads/files/PUB0002%20Rev_0%20for%20Haulage%20Capacity%20of%20Electric%20Locomotives.pdf
- IRAB-1, loco braking system (A9/SA9 positions and pressures): https://rskr.irimee.in/sites/default/files/IRAB-1%2C%20Loco%20Braking%20system_0.pdf
- WAP-5/WAG-9 brake notes (regen behaviour, BP interlock): https://www.irfca.org/docs/wap5-wag9-brakes.doc
- SCR GM sanction, LHB stopping distances: https://digitalscr.in/bzadiv/circulars/misc_circulars/uploads/GM_Sanction_LHBcoaches.pdf
- Open Rails physics manual (how a serious open-source sim models this): https://open-rails.readthedocs.io/en/latest/physics.html

## Not simulated (post-MVP)

- SA9 independent loco brake
- wheel slip and adhesion
- gradients
- slack between coaches
- signals and Kavach (train protection)
- vigilance control device
