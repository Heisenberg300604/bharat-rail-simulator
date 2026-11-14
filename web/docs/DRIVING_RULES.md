# Driving rules: sources and how the game uses them

Researched 2026-11-14. Every rule in the game's signalling, Kavach, vigilance
and halt logic traces back to a source below. Where the game simplifies, it
says so. Primary sources were used where reachable; IRFCA (Indian Railways Fan
Club) transcriptions and loco-pilot training notes are labelled as secondary.

## 1. Colour-light signals (`simulation/signalling.js`, `components/Environment/Signals.jsx`)

| Rule | Source | In the game |
| --- | --- | --- |
| Red = Stop; yellow = Caution (proceed prepared to stop at the next signal); double yellow = Attention (proceed prepared to pass the next signal at restricted speed); green = Proceed | Signal Engineering Manual (IRSEM) ch. 7 §7.1.12–13; IRFCA signalling FAQ https://irfca.org/faq/faq-signal.html | Aspects chain from the next signal: next red → yellow, next yellow → double yellow (4-aspect, double lines), else green |
| Four-lamp head, top to bottom Y-G-Y-R (double yellow = two separated lamps) | RDSO Kavach Annexure B (driver display signal icon) | Signal posts and the HUD signal icon use this order |
| Distant signal at least 1 km before the first stop signal; carries a white "P" marker | IRSEM §7.1.13 | Auto-placed distants 1.4 km before the platform, with a "P" plate |
| Automatic signals ~1 km apart, white "A" marker | IRSEM §7.1.14(h) | Automatic signals every 1.1 km on double lines, with an "A" plate |
| At an automatic signal at "on": stop, wait 1 min (day) / 2 min (night), then proceed with great caution | GR 9.02, https://irfca.org/docs/rulebook/gr-automatic-block.html | **Not modelled yet** — our automatic signals are never at danger (no same-direction traffic) |
| Starter cleared only when the train is to be dispatched | GR 4.35 (driver needs authority to proceed, correct signals and the guard's starting signal) | The starter at a booked halt stays red until the guard's right-away; leaving early means passing it at danger |
| Home signal can be held at danger (platform occupied) | Normal practice; IRSEM station worked examples | 35 % chance per halt per run; it clears once you have waited at it |
| No national figure for the speed at double yellow (zone-specific) | Research found none in primary sources | Not enforced as a number |

## 2. SPAD (`SimulationDriver.jsx → handleSignalEvent`)
- Definition: "train running past a stop signal at danger without proper authority"; an *indicative accident*, class H (Western Railway Accident Manual 2009 §111, 114, 405, 415).
- Consequences for loco pilots (Railway Board letter 2017/Safety(A&R)/18/10, 08.01.2018, as reported by the press and unions): stopping within 120 m leads to demotion; beyond 120 m can lead to termination.
- In the game: an emergency brake application always follows, then by difficulty — **Trainee** warning, **Loco Pilot** −25 points, **Realistic** the run ends.

## 3. Departure (`journeyManager.js`)
- GR 4.35: the driver must not start without authority to proceed, the correct fixed signals, and the guard's starting signal (green flag/lamp).
- Engine whistle codes are set per zone (GR 4.50(2)); IRFCA lists "one long" as normal departure on a clear signal: https://irfca.org/faq/faq-signal5.html. Not enforced in the game.

## 4. Vigilance Control Device (`simulation/vcd.js`)
Source: loco-pilot training handbook for ABB-derived 3-phase locos, reproduced at https://locopilotguide.blogspot.com/2020/01/act-rs-abb-loco-english-25-vigilance.html (secondary); IRFCA confirms the VCD acts on the emergency brake (https://www.irfca.org/docs/wap5-wag9-brakes.doc).
- Act at least every 60 s: VCD button/foot switch, moving the throttle > 3 %, or sanding.
- Otherwise 8 s of buzzer + lamp, then emergency brake and zero tractive effort. Active only above 1.5 km/h.
- Reset after a penalty: throttle to 0, wait 160 s (WAP-7/WAG-9; 120 s on WAP-5), then reset.
- In the game: exactly this, on **Realistic** (key V; the throttle and sander also count).

## 5. Kavach (`simulation/kavach.js`)
Source: RDSO/SPN/196 v4.0 with Annexure A1 (modes), A2 (configurable parameters, Amdt-3 2024) and B (driver display) on rdso.indianrailways.gov.in.
- Defaults: warning at +2 km/h over the permitted speed; brake intervention margins 5 (normal service), 3 (full service) and 2 (emergency) km/h; 80 m overlap; Trip 30 m past the end of authority; warning 2 s before intervention plus 4 s reaction.
- Display: speed dial green (within limits) / orange (overspeed) / red (Kavach braking); target-distance bar up to 2 km; 4-lamp signal icon with distance and name; mode.
- In the game (simplified): Full Supervision mode only; targets are lower speed restrictions and the first signal at danger (end of authority) ahead; the brake margins are stacked as escalation steps (+5 service, +8 full, +10 emergency) because the annexure does not say whether they stack; brakes released at the permitted speed. On by default for **Trainee**, switchable in Settings.

## 6. Adhesion and wheel slip (`trainSimulation.js → adhesionMu`)
- No official dry/wet adhesion coefficients were found (RDSO/CLW). The WAG-9's 46 t starting TE on 123 t (IRFCA, https://irfca.org/faq/faq-loco2e.html) implies ≈ 0.37–0.38.
- Anti-spin protection starts the sanders, reduces effort and lights the slip lamp (training notes, https://locopilotguide.blogspot.com/2020/01/act-rs-abb-loco-english-29-anti-spin.html); manual sanding by foot switch (IRFCA https://irfca.org/docs/wheel-slip.html). GR 4.55: drivers must allow for "the state of the weather, the condition of the rails".
- **Game assumptions** (not sourced): µ dry 0.40, damp (fog) 0.33, wet (rain) 0.25, sand +0.08; when demand exceeds µ × loco weight the slip control cuts effort to 85 % of the limit and the SLIP lamp lights. On **Realistic**.

## 7. Brake tests (not yet in the game)
Continuity test: BP 5.0 → reduce to 4.0, isolate, guard vents to 0, driver confirms and recharges; leakage limits 0.6 kg/cm² in 3 min (coaches); IRIMEE notes https://rskr.irimee.in/sites/default/files/TESTING%20OF%20LOCO%20AND%20RAKE_0.pdf. Candidate for the Wave 2 pre-departure checklist (A4).

## 8. Speed boards (`components/Environment/SpeedBoards.jsx`)
- Speed indicator 30 m before a restriction; termination indicator ("T") where normal speed resumes; yellow triangle with the speed; caution indicator 800 m before for temporary restrictions (GR 15.09, https://irfca.org/docs/rulebook/gr-pway.html; IRFCA signalling FAQ part 5).
- In the game: a speed board 30 m before every lower permanent restriction and a "T" board where it ends. Temporary restrictions/caution orders (T/409) are not modelled yet.
