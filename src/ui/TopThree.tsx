import type { RankedTask } from '../domain/priority';
import { fmtHours } from '../domain/time';
import { Empty } from './kit';

/** This week's top 3, ranked by grade impact per effective hour, each with its reasons. */
export function TopThree({ tasks, hasCourses }: { tasks: RankedTask[]; hasCourses: boolean }) {
  if (tasks.length === 0) {
    return (
      <Empty>
        {hasCourses
          ? 'No ungraded assessment needs hours right now. Add upcoming assessments with weights and due dates in Grades.'
          : 'Add your courses and their assessments in Grades to see which work moves your average most.'}
      </Empty>
    );
  }
  return (
    <ol className="flex flex-col">
      {tasks.map((task, i) => (
        <li key={task.assessment.id} className="flex gap-3 border-b border-line py-3 last:border-b-0">
          <span aria-hidden className="num font-display text-2xl font-semibold text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{task.course.name}: {task.assessment.name}</div>
            <div className="num text-sm text-muted">
              {task.daysLeft == null ? 'No due date' : task.daysLeft === 0 ? 'Due today' : `Due in ${task.daysLeft} day${task.daysLeft === 1 ? '' : 's'}`}
              {`, ${fmtHours(task.remainingMin)} h to go`}
            </div>
            <details className="mt-1">
              <summary className="num cursor-pointer text-sm text-accent">
                Why: {task.pointsPerHour.toFixed(2)} points per hour x {task.urgency} urgency x {task.pressure.toFixed(2)} pressure = {task.score.toFixed(2)}
              </summary>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                {task.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}
