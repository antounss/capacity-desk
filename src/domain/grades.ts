// Grade maths. Everything is in percent and credit-weighted averages. No GPA scale is
// assumed, because universities differ; the percentage is the number the scale is built on.
//
//   earned   = sum of weight x score / 100 over graded assessments   (points out of 100)
//   required = (target - earned) / remaining weight x 100            (average still needed)

import type { Assessment, Config, Course } from './types';

export type CourseStatus =
  | 'no-assessments' // nothing entered yet
  | 'secured' // target already reached whatever happens next
  | 'on-track' // required average is at or below the running average
  | 'stretch' // reachable, but above the running average
  | 'unreachable' // needs more than 100% on what is left
  | 'final-met'
  | 'final-missed';

export interface AssessmentNeed {
  assessment: Assessment;
  /** Weight after any scaling, in percent of the course. */
  weight: number;
  /** Score needed on this assessment if all remaining work scores the same. */
  requiredScore: number;
}

export interface CourseStanding {
  course: Course;
  weightSum: number;
  /** 'under' and 'over' mean the weights do not add up to 100. */
  weightIssue: 'ok' | 'under' | 'over';
  /** Share of the grade with no assessment entered (only when weights are under 100). */
  unassignedWeight: number;
  gradedWeight: number;
  earnedPoints: number;
  remainingWeight: number;
  /** Average over graded work, or null when nothing is graded. */
  currentAverage: number | null;
  /** Average needed on everything ungraded, or null when nothing is left. */
  requiredAverage: number | null;
  /** Best final grade still possible. */
  maxFinal: number;
  status: CourseStatus;
  needs: AssessmentNeed[];
  /** The calculation written out line by line, for display. */
  steps: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Tolerance for sums of decimal weights such as 33.3 + 33.3 + 33.4. */
const EPS = 0.01;

export function courseStanding(course: Course, all: Assessment[]): CourseStanding {
  const items = all.filter((a) => a.courseId === course.id && a.weightPercent > 0);
  const weightSum = items.reduce((s, a) => s + a.weightPercent, 0);
  const steps: string[] = [];

  // Weights that do not sum to 100 are never silently "fixed":
  //  - under 100: the missing share is real coursework that has not been entered yet,
  //    so it is treated as ungraded work.
  //  - over 100: there is no honest reading, so weights are scaled to 100 and flagged.
  const weightIssue = weightSum > 100 + EPS ? 'over' : weightSum < 100 - EPS ? 'under' : 'ok';
  const scale = weightIssue === 'over' ? 100 / weightSum : 1;
  const unassignedWeight = weightIssue === 'under' ? 100 - weightSum : 0;
  if (weightIssue === 'over') {
    steps.push(`Weights add up to ${round1(weightSum)}%. Scaled down to 100% for this calculation; fix the weights to trust it.`);
  }
  if (weightIssue === 'under' && items.length > 0) {
    steps.push(`Weights add up to ${round1(weightSum)}%. The missing ${round1(unassignedWeight)}% is treated as ungraded work.`);
  }

  const graded = items.filter((a) => a.scorePercent != null);
  const ungraded = items.filter((a) => a.scorePercent == null);
  const gradedWeight = graded.reduce((s, a) => s + a.weightPercent * scale, 0);
  const earnedPoints = graded.reduce((s, a) => s + (a.weightPercent * scale * (a.scorePercent ?? 0)) / 100, 0);
  const remainingWeight = ungraded.reduce((s, a) => s + a.weightPercent * scale, 0) + unassignedWeight;
  const currentAverage = gradedWeight > EPS ? (earnedPoints / gradedWeight) * 100 : null;
  const maxFinal = earnedPoints + remainingWeight;
  const target = course.targetPercent;

  if (graded.length > 0) {
    const terms = graded.map((a) => `${round1(a.weightPercent * scale)}% x ${round1(a.scorePercent ?? 0)}`).join(' + ');
    steps.push(`Earned so far: ${terms} = ${round1(earnedPoints)} points (from ${round1(gradedWeight)}% graded).`);
  } else {
    steps.push('Earned so far: 0 points (nothing graded yet).');
  }

  let requiredAverage: number | null = null;
  let status: CourseStatus;
  if (remainingWeight <= EPS) {
    status = earnedPoints >= target - EPS ? 'final-met' : 'final-missed';
    steps.push(`Nothing left to grade. Final grade ${round1(earnedPoints)}% against a target of ${round1(target)}%.`);
  } else {
    requiredAverage = ((target - earnedPoints) / remainingWeight) * 100;
    steps.push(`Remaining: ${round1(remainingWeight)}% of the grade.`);
    steps.push(
      `Required average: (${round1(target)} - ${round1(earnedPoints)}) / ${round1(remainingWeight)}% = ${round1(requiredAverage)}%.`,
    );
    if (items.length === 0) status = 'no-assessments';
    else if (requiredAverage <= 0) status = 'secured';
    else if (requiredAverage > 100 + EPS) status = 'unreachable';
    else if (currentAverage == null || requiredAverage <= currentAverage + EPS) status = 'on-track';
    else status = 'stretch';

    if (status === 'unreachable') {
      steps.push(`That is above 100%. The best final grade still possible is ${round1(maxFinal)}%.`);
    }
    if (status === 'secured') {
      steps.push(`The target is already reached: even 0% on the rest gives ${round1(earnedPoints)}%.`);
    }
  }

  const needs: AssessmentNeed[] = ungraded.map((assessment) => ({
    assessment,
    weight: assessment.weightPercent * scale,
    requiredScore: requiredAverage ?? 0,
  }));

  return {
    course, weightSum, weightIssue, unassignedWeight, gradedWeight, earnedPoints, remainingWeight,
    currentAverage, requiredAverage, maxFinal, status, needs, steps,
  };
}

/** Default effective hours for an assessment when the user has not set a target. */
export function targetHoursFor(assessment: Assessment, course: Course, config: Config): number {
  if (assessment.targetHours != null) return assessment.targetHours;
  const { hoursPerWeightPoint, difficultyHours } = config.grades;
  return assessment.weightPercent * hoursPerWeightPoint * difficultyHours[course.difficulty];
}

export interface SemesterSummary {
  totalCredits: number;
  /** Credit-weighted target across courses. */
  targetAverage: number | null;
  /** Credit-weighted running average across courses that have graded work. */
  currentAverage: number | null;
}

export function semesterSummary(standings: CourseStanding[]): SemesterSummary {
  const totalCredits = standings.reduce((s, st) => s + st.course.credits, 0);
  const gradedOnes = standings.filter((st) => st.currentAverage != null);
  const gradedCredits = gradedOnes.reduce((s, st) => s + st.course.credits, 0);
  return {
    totalCredits,
    targetAverage: totalCredits > 0
      ? standings.reduce((s, st) => s + st.course.targetPercent * st.course.credits, 0) / totalCredits
      : null,
    currentAverage: gradedCredits > 0
      ? gradedOnes.reduce((s, st) => s + (st.currentAverage ?? 0) * st.course.credits, 0) / gradedCredits
      : null,
  };
}
