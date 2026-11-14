# Horn credits

All files are in `public/assets/audio/horns/` and are listed in `horns.json`. Each licence was read through the Freesound API on 2026-11-14.
Every file was cut from the source's HQ preview (128 kbps MP3), mixed to mono, high-passed at 110 Hz and normalised (about −11 LUFS, peaks ≤ −0.7 dBFS).
The player horns are 16-bit WAV, so the loop points stay sample-accurate (MP3 encoder padding would shift them). Loop points sit on upward zero crossings, chosen for the best waveform match.

| File | Sound | Creator | Licence | Recorded in | Excerpt and use |
| --- | --- | --- | --- | --- | --- |
| `horn-kerala.wav` | "Sound of passing train.wav", https://freesound.org/people/arundasstp/sounds/403930/ | arundasstp | **CC BY 4.0** | Near Thalassery/Kannur, Kerala, India (geotag 11.699, 75.547), 2017 | 12.85–17.30 s: the second blast, a clean single tone (~287 Hz). Default player horn; loop 2.50–3.22 s, 1.0 s natural release. |
| `horn-rajasthan.wav` | "train-station-Rajasthan.wav", https://freesound.org/people/xserra/sounds/94012/ | xserra | **CC BY 4.0** | A station near Ajmer, Rajasthan, India (geotag 26.589, 74.856), night, 2010 | 9.85–13.85 s: a two-tone horn (~330 + 430 Hz) before departure. Second player horn (pause menu); loop 0.75–2.80 s. |
| `horn-passing-kerala.mp3` | "Sound of passing train.wav", https://freesound.org/people/arundasstp/sounds/403930/ | arundasstp | **CC BY 4.0** | As above | 21.75–28.25 s: horn of a train passing the microphone, with its natural Doppler drop. Used for opposing trains (`kind: distant`, `bakedDoppler`: the game adds no Doppler of its own). |

Each entry in `horns.json` has a `gain` (a playback trim: 2.0 / 1.7 / 1.5, i.e. +6 / +4.6 / +3.5 dB). The files themselves are near full scale, and the master limiter catches peaks.

The locomotive classes are not stated by the recordists. Required attribution text: "Train horn recordings by arundasstp and xserra (freesound.org), CC BY 4.0."
