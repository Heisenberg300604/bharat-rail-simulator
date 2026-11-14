// Photo mode bar: the run is frozen, the HUD hidden; a free camera orbits a
// pivot (see CameraRig). Pick the light and weather, then take a PNG.
import { useState } from 'react';
import { exitPhotoMode, updateSettings } from '../game/state/gameStore.js';
import { sceneRefs } from '../game/state/sceneRefs.js';
import { ROUTE } from '../game/config/gameConfig.js';
import EnvironmentPicker from './EnvironmentPicker.jsx';

function takePhoto() {
  const gl = sceneRefs.gl;
  if (!gl || !sceneRefs.scene || !sceneRefs.camera) return;
  gl.render(sceneRefs.scene, sceneRefs.camera); // the drawing buffer is cleared after each frame, so draw one now
  const a = document.createElement('a');
  a.download = `bharat-rail-${ROUTE.id}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  a.href = gl.domElement.toDataURL('image/png');
  a.click();
}

export default function PhotoMode({ settings }) {
  const [hidden, setHidden] = useState(false);
  if (hidden)
    return (
      <button className="photo-show btn btn--ghost" onClick={() => setHidden(false)}>
        Show controls
      </button>
    );
  return (
    <div className="photo-bar" role="toolbar" aria-label="Photo mode">
      <div className="photo-bar__row">
        <strong>Photo mode</strong>
        <span className="photo-bar__keys">Drag: orbit · Wheel: zoom · W A S D: move · Q / E: down / up · Shift: faster · Esc: back to driving</span>
      </div>
      <div className="photo-bar__row">
        <EnvironmentPicker settings={settings} />
        <label className="photo-bar__fov">
          <span>Lens</span>
          <input type="range" min="20" max="90" step="1" value={settings.fov} onChange={(e) => updateSettings({ fov: Number(e.target.value) })} />
          <span className="num">{settings.fov}°</span>
        </label>
        <div className="photo-bar__buttons">
          <button className="btn btn--primary" onClick={takePhoto}>
            📷 Take photo
          </button>
          <button className="btn" onClick={() => setHidden(true)}>
            Hide bar
          </button>
          <button className="btn" onClick={exitPhotoMode}>
            Back to driving
          </button>
        </div>
      </div>
    </div>
  );
}
