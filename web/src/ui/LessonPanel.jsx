// Driver school guide: the current lesson step, shown under the route bar.
import { LESSONS, lessonById } from '../game/simulation/driverSchool.js';
import { startLesson, endLesson, returnToTitle } from '../game/state/gameStore.js';

export default function LessonPanel({ lesson }) {
  const def = lessonById(lesson.id);
  if (!def) return null;
  const idx = LESSONS.indexOf(def);
  const next = LESSONS[idx + 1];
  return (
    <div className="lesson" role="status" aria-live="polite">
      <div className="lesson__head">
        <span className="eyebrow">Driver school</span>
        <strong>{def.title}</strong>
        <span className="lesson__count num">{lesson.done ? 'done' : `step ${lesson.step + 1} / ${def.steps.length}`}</span>
      </div>
      <div className="lesson__bar">
        <div style={{ width: `${((lesson.done ? def.steps.length : lesson.step) / def.steps.length) * 100}%` }} />
      </div>
      {lesson.done ? (
        <>
          <p>Well done — lesson complete.</p>
          <div className="lesson__buttons">
            {next && (
              <button className="btn btn--primary" onClick={() => startLesson(next.id)}>
                Next: {next.title}
              </button>
            )}
            <button className="btn" onClick={endLesson}>
              Keep driving
            </button>
            <button className="btn" onClick={returnToTitle}>
              Title screen
            </button>
          </div>
        </>
      ) : (
        <p>{def.steps[lesson.step].text}</p>
      )}
    </div>
  );
}
