// The whole train: one locomotive followed by N coaches. Each vehicle reads
// the same simulated route distance and offsets itself backwards.
import { formation } from '../../state/gameStore.js';
import Locomotive from './Locomotive.jsx';
import Coach from './Coach.jsx';

export default function Train() {
  return (
    <group>
      {formation.vehicles.map((v) =>
        v.kind === 'locomotive' ? <Locomotive key="loco" vehicle={v} /> : <Coach key={`coach-${v.index}`} vehicle={v} />,
      )}
    </group>
  );
}
