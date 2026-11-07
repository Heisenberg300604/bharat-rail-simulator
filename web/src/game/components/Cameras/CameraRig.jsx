// Picks which camera behaviour controls the single scene camera.
import { useGameValue } from '../../state/gameStore.js';
import CabCamera from './CabCamera.jsx';
import FollowCamera from './FollowCamera.jsx';

export default function CameraRig() {
  const screen = useGameValue((s) => s.screen);
  const cameraMode = useGameValue((s) => s.cameraMode);
  if (screen === 'title' || screen === 'loading') return <FollowCamera key="orbit" orbit />;
  if (cameraMode === 'cab') return <CabCamera />;
  return <FollowCamera key="chase" />;
}
