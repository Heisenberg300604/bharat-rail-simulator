import { CONTROLS } from './controlsList.js';

export default function ControlsTable() {
  return (
    <dl className="controls">
      {CONTROLS.map(([key, action]) => (
        <div key={key} className="controls__row">
          <dt>
            <kbd>{key}</kbd>
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}
