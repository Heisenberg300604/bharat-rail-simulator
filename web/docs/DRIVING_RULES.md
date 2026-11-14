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
| At an automatic signal at "on": stop, wait 1 min (day) / 2 min (night), then proceed with great caution | GR 9.02, https://irfca.org/docs/rulebook/gr-automatic-block.html | Modelled for a **failed** automatic signal (incidents, §9). There is still no same-direction traffic, so a working automatic signal is never at danger |
| Starter cleared only when the train is to be dispatched | GR 4.35 (driver needs authority to proceed, correct signals and the guard's starting signal) | The starter at a booked halt stays red until the guard's right-away; leaving early means passing it at danger |
| Home signal can be held at danger (platform occupied) | Normal practice; IRSEM station worked examples | 35 % chance per halt per run; it clears once you have waited at it |
| No national figure for the speed at double yellow (zone-specific) | Research found none in primary sources | Not enforced as a number |

## 2. SPAD (`SimulationDriver.jsx → handleSignalEvent`)
- Definition: "train running past a stop signal at danger without proper authority"; an *indicative accident*, class H (Western Railway Accident Manual 2009 §111, 114, 405, 415).
- Consequences for loco pilots (Railway Board letter 2017/Safety(A&R)/18/10, 08.01.2018, as reported by the press and unions): stopping within 120 m leads to demotion; beyond 120 m can lead to termination.
- In the game: an emergency brake application always follows, then by difficulty — **Trainee** warning, **Loco Pilot** −25 points, **Realistic** the run ends.

## 3. Departure (`journeyManager.js`)
- GR 4.35: the driver must not start without authority to proceed, the correct fixed signals, and the guard's starting signal (green flag/lamp).
- Engine whistle codes are set per zone (GR 4.50(2)). IRFCA's list (https://www.irfca.org/faq/faq-signal5.html) gives `--` (a comparatively long blast) as normal departure on a clear signal, "usually followed by another long blast about 10-20 seconds after the first one, after the guard's all-right signal is received".
- The guard shows a green flag (day) or green lamp (night) when the train is to start (IRFCA, same page).
- In the game (D1): after the guard's whistle a guard figure on platform 1, just beyond the rear of the train, waves a green flag (day) or green lamp (night) for about 14 s. A long blast (`--`, or `-----`) within that window counts as acknowledging the right-away and appears on the run card ("acknowledged 2/3"). It is advisory and not scored.

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

## 8. Speed boards (`components/Environment/SpeedBoards.jsx`, `IncidentBoards.jsx`)
- Speed indicator 30 m before a restriction; termination indicator ("T") where normal speed resumes; yellow triangle with the speed; caution indicator 800 m before for temporary restrictions (GR 15.09, https://irfca.org/docs/rulebook/gr-pway.html; IRFCA signalling FAQ part 5).
- In the game: a speed board 30 m before every lower permanent restriction and a "T" board where it ends. Temporary restrictions come with the incidents (§9).

## 9. Incidents (`simulation/incidents.js`, `hornCodes.js`; Settings → Incidents, default **Off**)

Primary text for GR 9.02 and GR 15.09 comes from the G&SR (1976) transcriptions on IRFCA (fetched 2026-11-14). The other rules come from the IRFCA signalling FAQ part 5. *Occasional* gives about one incident in two runs; *Every run* gives all of those that suit the route and train.

**Caution order (temporary speed restriction for permanent-way work)**
- GR 15.09(1)(d), a restriction lasting more than a day where the train need not stop: "a speed indicator shall be exhibited at a distance of 30 metres from the place of obstruction and again a caution indicator at a distance of at least 800 metres … In addition, termination indicators shall be provided at the place where a Driver may resume normal speed." GR 15.09(4) leaves board shapes to special instructions.
- Board designs follow IRFCA:
  - The caution indicator is an arrow-shaped reflective yellow board with black markings, pointing at the affected track, on a post banded black and white.
  - T/P and T/G are yellow discs, for passenger and goods trains respectively.
  - IRFCA describes the speed indicator as "rectangular boards with white and black bands and a number".
- The driver is told at the starting station on a caution order (form T/409). In the game this appears as a HUD card until the restriction is cleared.
- **Game assumptions:**
  - The speed is 30 km/h (the plan's figure).
  - The work site is 250–550 m long.
  - T/P stands 600 m beyond the end and T/G 700 m beyond. These stand for "the longest passenger / goods train": a 24-coach rake is about 600 m, and a 58-wagon BOXN rake with loco and van is about 700 m.
- As with every restriction in the game, it applies until the rear of the train has cleared it. Kavach supervises it too.

**Automatic signal failed at 'On' — GR 9.02 (double lines only)**
- GR 9.02(1): "bring his train to a stop in the rear of the signal … wait there for one minute by day and two minutes by night. If after waiting … the signal continues to remain at 'on', he shall give the prescribed code of whistle and exchange signals with the Guard and then proceed ahead … towards the next Stop signal in advance exercising great caution so as to stop short of any obstruction."
- GR 9.02(3): when the line ahead cannot be seen clearly (curvature, fog, rain, dust storm…), the speed "shall under no circumstances exceed 8 kilometres an hour".
- GR 9.02(5): proceed with great caution until the next stop signal, and act on that signal only after reaching it.
- Whistle code `-----` = "passing automatic 'stop' signal at 'On'" (IRFCA).
- **In the game:**
  - The signals in rear show the normal approach aspects (yellow, then double yellow).
  - Standing within 450 m in rear of the signal counts as the wait. Night = the *Night* time of day.
  - After the wait the signal may be passed without a SPAD, and Kavach no longer treats it as the end of authority.
  - The run card notes whether the `-----` code was given. Passing before the wait is a SPAD.
  - After passing, the limit is 8 km/h in fog or rain, and **15 km/h otherwise — a game assumption** (GR 9.02 gives no figure for a clear view). It lasts until the front reaches the next stop signal.

**Alarm chain pulling (ACP), passenger trains only**
- The chain opens a vent valve on the coach. Brake-pipe pressure falls (the loco pilot sees it on the BP gauge) and the brakes apply. The cab lamp and buzzer stay on until the device on that coach is reset by hand.
  - Sources: CAMTECH coaching-stock handbook on the passenger emergency alarm; indiarailinfo FAQ 1949 (secondary). Press reports describe crews walking to the coach to reset it.
- Whistle code `o o --` = "sudden loss of brake pressure or vacuum (perhaps by alarm chain being pulled)" (IRFCA).
- Misuse is an offence under Railways Act 1989 s.141 (for context only; the game never blames the driver).
- **In the game:**
  - Mid-section, BP falls to 0, the brakes apply and traction is cut (BP below 4.75).
  - An ACP lamp lights with the cab buzzer.
  - Once the train is at a stand, the guard and ALP take 120 s to reset the coach; then the driver releases the A9 and recharges.
- **Game assumptions:** the vent rate (0.5 kg/cm² per second, slower than an emergency application) and the 120 s reset time. No penalty is applied. The run card records the `o o --` code.

**Horn codes** (`hornCodes.js`): notation per IRFCA (`o` short, `--` long, `-----` longer). **Game assumption:** the rulebook gives no durations, so the game reads a blast under 0.8 s as short, 0.8–2.5 s as long and 2.5 s or more as longer. A code ends after 1.6 s of silence.

## 10. Station announcements (`audio/announcements.js`; Settings → Spoken station announcements, default **off**)
- Indian Railways announcements open with "यात्रीगण कृपया ध्यान दें" ("passengers, please pay attention"). They are assembled from pre-recorded pieces (train, stations, platform) and given in Hindi, English and often the regional language (press reports on the announcement system).
- **No official script was found.** The sentences follow the familiar spoken pattern ("… से चलकर … को जाने वाली गाड़ी प्लेटफ़ॉर्म संख्या … पर आ रही है") and are a game reconstruction.
- They are spoken by the browser's own voices (Web Speech API): Hindi if the system has a Hindi voice, then English. They play as the train runs in to each halt and to the destination. Our train always uses platform 1.
