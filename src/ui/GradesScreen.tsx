import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../app/store';
import type { Analysis } from '../domain/analyze';
import type { CourseStanding } from '../domain/grades';
import { fmtDate } from '../domain/time';
import type { Assessment, Course } from '../domain/types';
import { AssessmentSheet, CourseSheet } from './editors';
import { Button, Empty, Section } from './kit';
import { DIFFICULTY_LABEL, KIND_LABEL } from './labels';
import { TopThree } from './TopThree';

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

/** One sentence that says where the course stands, with the number that matters. */
function verdict(s: CourseStanding): { text: string; tone: string } {
  switch (s.status) {
    case 'no-assessments':
      return { text: 'Add the assessments and their weights to see what you need.', tone: 'text-muted' };
    case 'secured':
      return { text: 'Target secured, whatever happens on the rest.', tone: 'text-accent' };
    case 'on-track':
      return { text: `Needs ${pct(s.requiredAverage ?? 0)} on the remaining ${pct(s.remainingWeight)}.`, tone: '' };
    case 'stretch':
      return { text: `Needs ${pct(s.requiredAverage ?? 0)} on the remaining ${pct(s.remainingWeight)}, above your ${pct(s.currentAverage ?? 0)} so far.`, tone: 'text-warning' };
    case 'unreachable':
      return { text: `Target out of reach: the best final grade still possible is ${pct(s.maxFinal)}.`, tone: 'text-critical' };
    case 'final-met':
      return { text: `Final grade ${pct(s.earnedPoints)}. Target met.`, tone: 'text-accent' };
    case 'final-missed':
      return { text: `Final grade ${pct(s.earnedPoints)}. Target missed.`, tone: 'text-critical' };
  }
}

type Open = { sheet: 'course'; item?: Course } | { sheet: 'assessment'; course: Course; item?: Assessment };

export function GradesScreen({ analysis }: { analysis: Analysis }) {
  const { data } = useApp();
  const [open, setOpen] = useState<Open | null>(null);
  const { semester, standings } = analysis;

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <h1 className="text-3xl">Grades</h1>
      <p className="mt-1 text-muted">
        {semester.totalCredits === 0
          ? 'Enter each course with its assessments. The app works out what every remaining one must score.'
          : `${semester.totalCredits} credits. Target average ${pct(semester.targetAverage ?? 0)}`
            + (semester.currentAverage != null ? `, running at ${pct(semester.currentAverage)} on graded work.` : ', nothing graded yet.')}
      </p>
      <p className="mt-1 mb-4 text-sm text-muted">Everything is in percent with credit-weighted averages. No GPA scale is assumed.</p>

      <Section title="This week’s top 3" aside={<span className="text-sm text-muted">Grade impact per hour</span>}>
        <TopThree tasks={analysis.top3} hasCourses={data.courses.length > 0} />
      </Section>

      <Section title="Courses" aside={<button type="button" className="text-sm font-medium text-accent underline" onClick={() => setOpen({ sheet: 'course' })}>Add a course</button>}>
        {standings.length === 0 ? <Empty>No courses yet.</Empty> : null}
        <div className="flex flex-col gap-4">
          {standings.map((s) => {
            const v = verdict(s);
            const items = data.assessments.filter((a) => a.courseId === s.course.id)
              .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
            return (
              <article key={s.course.id} className="rounded-md border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl">{s.course.name}</h3>
                    <p className="num text-sm text-muted">{s.course.credits} credits, {DIFFICULTY_LABEL[s.course.difficulty].toLowerCase()} load, target {pct(s.course.targetPercent)}</p>
                  </div>
                  <button type="button" className="text-sm text-accent underline" onClick={() => setOpen({ sheet: 'course', item: s.course })}>Edit</button>
                </div>
                <p className={`num mt-2 font-medium ${v.tone}`}>{v.text}</p>
                {s.weightIssue !== 'ok' && items.length > 0 ? (
                  <p className="num mt-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                    Weights add up to {pct(s.weightSum)}, not 100%. {s.weightIssue === 'under'
                      ? `The missing ${pct(s.unassignedWeight)} is treated as ungraded work.`
                      : 'They are scaled to 100% here; correct them to trust the numbers.'}
                  </p>
                ) : null}

                <ul className="mt-2">
                  {items.map((a) => {
                    const need = s.needs.find((n) => n.assessment.id === a.id);
                    return (
                      <li key={a.id} className="border-t border-line">
                        <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setOpen({ sheet: 'assessment', course: s.course, item: a })}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{a.name}</span>
                            <span className="num block text-sm text-muted">{KIND_LABEL[a.kind]}, {pct(a.weightPercent)}{a.dueDate ? `, ${fmtDate(a.dueDate)}` : ', no date'}</span>
                          </span>
                          <span className="num text-right text-sm">
                            {a.scorePercent != null ? <span className="font-semibold">{pct(a.scorePercent)}</span>
                              : need && s.requiredAverage != null ? <span>needs <span className="font-semibold">{pct(Math.max(0, need.requiredScore))}</span></span>
                              : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <details className="mt-1 border-t border-line pt-2">
                  <summary className="cursor-pointer text-sm text-accent">Show the maths</summary>
                  <ol className="num mt-1 list-decimal pl-5 text-sm text-muted">
                    {s.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </details>
                <Button className="mt-3 w-full" onClick={() => setOpen({ sheet: 'assessment', course: s.course })}><Plus size={18} aria-hidden />Add an assessment</Button>
              </article>
            );
          })}
        </div>
      </Section>

      {open?.sheet === 'course' ? <CourseSheet item={open.item} onClose={() => setOpen(null)} /> : null}
      {open?.sheet === 'assessment' ? <AssessmentSheet item={open.item} course={open.course} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
