# Asset Credits

Every third-party asset must be listed here **before** it is committed, with its
source page, creator, licence (checked on the asset page itself) and date checked.

## Current status

The game currently ships **no third-party assets**. Everything is original and
generated in code:

| Asset | Type | Source | Licence |
| --- | --- | --- | --- |
| Locomotive (WAP-7-inspired blockout) | 3D, procedural boxes | `src/game/components/Train/Locomotive.jsx` | Original (this project) |
| LHB-style coach | 3D, procedural boxes | `src/game/components/Train/Coach.jsx` | Original (this project) |
| Track, OHE masts, stations, scenery | 3D, procedural | `src/game/components/**` | Original (this project) |
| Ground / ballast / platform textures, station boards, window strip | Canvas-drawn textures | `src/game/world/textures.js` | Original (this project) |
| Horn, rolling, wind, motor, brake hiss, rail clacks | **Placeholder** synthesized audio (Web Audio API) | `src/game/audio/audioEngine.js` | Original (this project) |

## Template for new assets

```
### <Asset name>
- File(s): public/assets/...
- Source page: <exact URL>
- Creator: <name / handle>
- Licence: <e.g. CC BY 4.0> — verified on the asset page on <YYYY-MM-DD>
- Attribution text required: <exact text, if any>
- Modifications: <e.g. decimated to 40k tris, textures resized to 2K, exported to GLB>
- Original source file kept at: <path or "not kept">
```
