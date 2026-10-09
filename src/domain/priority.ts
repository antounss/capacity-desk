// Ranks remaining assessments by grade impact per effective hour.
//
//   semester points = (course credits / total credits) x assessment weight
//   points per hour = semester points / target effective hours
//   score           = points per hour x urgency x pressure
//
// The three factors are returned separately with a sentence each, so the ranking
// can always be explained and tuned (config.grades).

import type { Assessment, Config, Course, ISODate } from './types';
import { diffDays, fmtHours } from './time';
import { type CourseStanding, targetHoursFor } from './grades';
import { type Timeline, dayStart } from './timeline';
import { blockFactor } from './energy';

export interface Progress {
  /** Effective minutes logged as done. */
  doneMin: number;
  /** Effective minutes still planned in the future. */
  plannedMin: number;
  /** The part of plannedMin that falls in the week in view. */
  plannedThisWeekMin: number;
}

/**
 * Effective minutes per assessment. A planned block whose time has passed without
 * being confirmed counts as nothing: unconfirmed work is not evidence of work.
 */
export function progressByAssessment(tl: Timeline): Map<string, Progress> {
  const map = new Map<string, Progress>();
  for (const b of tl.blocks) {
    const id = b.block.assessmentId;
    if (!id) continue;
    const entry = map.get(id) ?? { doneMin: 0, plannedMin: 0, plannedThisWeekMin: 0 };
    const effective = (b.end - b.start) * blockFactor(tl, b);
    if (b.block.status === 'done') entry.doneMin += effective;
    else if (b.end > tl.nowAbs) {
      entry.plannedMin += effective;
      if (b.start >= 0 && b.start < dayStart(7)) entry.plannedThisWeekMin += effective;
    }
    map.set(id, entry);
  }
  return map;
}

export interface RankedTask {
  assessment: Assessment;
  course: Course;
  /** Days until the due date; null when there is none. */
  daysLeft: number | null;
  targetMin: number;
  doneMin: number;
  plannedMin: number;
  plannedThisWeekMin: number;
  /** Target minus done. Planned work is not subtracted: it has not happened yet. */
  remainingMin: number;
  semesterPoints: number;
  pointsPerHour: number;
  urgency: number;
  pressure: number;
  score: number;
  reasons: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function urgencyFor(daysLeft: number | null, config: Config): number {
  if (daysLeft == null) return config.grades.noDueDateMultiplier;
  for (const row of [...config.grades.urgency].sort((a, b) => a.withinDays - b.withinDays)) {
    if (daysLeft <= row.withinDays) return row.multiplier;
  }
  return 1;
}

function pressureFor(standing: CourseStanding, config: Config): number {
  const { perPoint, min, max } = config.grades.pressure;
  if (standing.requiredAverage == null) return 1;
  // With nothing graded there is no running average, so compare against the target itself.
  const reference = standing.currentAverage ?? standing.course.targetPercent;
  return Math.min(max, Math.max(min, 1 + perPoint * (standing.requiredAverage - reference)));
}

/**
 * Ungraded assessments that are not past due, best score first.
 * Tasks whose target hours are already logged score 0 and sink to the bottom.
 */
export function rankTasks(
  standings: CourseStanding[],
  progress: Map<string, Progress>,
  today: ISODate,
  config: Config,
): RankedTask[] {
  const totalCredits = standings.reduce((s, st) => s + st.course.credits, 0);
  const tasks: RankedTask[] = [];

  for (const standing of standings) {
    const { course } = standing;
    for (const { assessment, weight } of standing.needs) {
      const daysLeft = assessment.dueDate ? diffDays(today, assessment.dueDate) : null;
      if (daysLeft != null && daysLeft < 0) continue; // past due: needs a score, not study time

      const targetMin = targetHoursFor(assessment, course, config) * 60;
      const { doneMin, plannedMin, plannedThisWeekMin } = progress.get(assessment.id)
        ?? { doneMin: 0, plannedMin: 0, plannedThisWeekMin: 0 };
      const remainingMin = Math.max(0, targetMin - doneMin);

      const creditShare = totalCredits > 0 ? course.credits / totalCredits : 0;
      const semesterPoints = creditShare * weight;
      const pointsPerHour = targetMin > 0 ? semesterPoints / (targetMin / 60) : 0;
      const urgency = urgencyFor(daysLeft, config);
      const pressure = pressureFor(standing, config);
      const score = remainingMin > 0 ? pointsPerHour * urgency * pressure : 0;

      const reasons = [
        `Controls ${round1(semesterPoints)} points of your semester average (${course.credits} of ${totalCredits} credits x ${round1(weight)}% weight).`,
        `${fmtHours(targetMin)} effective h budgeted, so ${round2(pointsPerHour)} points per hour.`,
        daysLeft == null
          ? `No due date: urgency x${urgency}.`
          : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}: urgency x${urgency}.`,
        standing.requiredAverage == null
          ? 'Nothing else left in this course.'
          : `Course needs ${round1(standing.requiredAverage)}% on remaining work${
              standing.currentAverage != null ? ` against ${round1(standing.currentAverage)}% so far` : ''
            }: pressure x${round2(pressure)}.`,
        remainingMin > 0
          ? `${fmtHours(doneMin)} h done, ${fmtHours(remainingMin)} h to go.`
          : `Target hours already logged (${fmtHours(doneMin)} h).`,
      ];

      tasks.push({
        assessment, course, daysLeft, targetMin, doneMin, plannedMin, plannedThisWeekMin, remainingMin,
        semesterPoints, pointsPerHour, urgency, pressure, score, reasons,
      });
    }
  }
  return tasks.sort((a, b) => b.score - a.score || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/** One line of demand for the planner: how much of what should land in the week in view. */
export interface Demand {
  title: string;
  category: 'study' | 'project';
  courseId: string | null;
  assessmentId: string | null;
  difficulty: 1 | 2 | 3;
  needMin: number;
  /** True when needMin is in effective minutes (study); false for raw minutes (projects). */
  effective: boolean;
  /** Blocks must end before this absolute minute. */
  dueAbs: number;
}

export interface WeekShare {
  /** Effective minutes of the remaining work that belong in the week in view, on an even pace. */
  quotaMin: number;
  /** The part of the quota that is not planned yet. */
  shortMin: number;
  /** Blocks for it must end before this absolute minute. */
  dueAbs: number;
}

/**
 * Splits what is left of a task evenly over the days until it is due, and returns the
 * share that falls in the week in view. Returns null when none of those days are in
 * this week (it is due today, or the week is before today or after the due date).
 *
 * Example: 14 h left, due in 9 days, 7 of those days in this week:
 *   quota = 14 x 7/9 = 10.9 h. With 6 h planned this week, the week is 4.9 h short.
 */
export function weekShare(tl: Timeline, task: RankedTask): WeekShare | null {
  if (task.daysLeft == null || !task.assessment.dueDate) return null;
  const dueDay = diffDays(tl.origin, task.assessment.dueDate);
  const from = Math.max(0, diffDays(tl.origin, tl.today));
  const to = Math.min(7, dueDay);
  // Nothing is planned on the due date itself: the time of day of an exam is not
  // known here, so only whole days before it are counted on.
  if (to <= from) return null;

  const share = Math.min(1, (to - from) / Math.max(1, task.daysLeft));
  const quotaMin = task.remainingMin * share;
  const totalGapMin = task.remainingMin - task.plannedMin;
  return {
    quotaMin,
    shortMin: Math.max(0, Math.min(quotaMin - task.plannedThisWeekMin, totalGapMin)),
    dueAbs: Math.min(dayStart(7), dayStart(dueDay)),
  };
}

/** Study demand for the week in view, in priority order, followed by project hours. */
export function weeklyDemand(tl: Timeline, ranked: RankedTask[]): Demand[] {
  const demands: Demand[] = [];
  const weekEnd = dayStart(7);

  for (const task of ranked) {
    const week = weekShare(tl, task);
    if (!week || week.shortMin <= 0) continue;
    demands.push({ ...demandBase(task), needMin: week.shortMin, dueAbs: week.dueAbs });
  }

  const projectTarget = tl.settings.projectHoursPerWeek * 60;
  const projectBooked = tl.blocks
    .filter((b) => b.block.category === 'project' && b.start >= 0 && b.start < weekEnd)
    .reduce((s, b) => s + (b.end - b.start), 0);
  if (projectTarget - projectBooked > 0) {
    demands.push({
      title: 'Project time', category: 'project', courseId: null, assessmentId: null,
      difficulty: 2, needMin: projectTarget - projectBooked, effective: false, dueAbs: weekEnd,
    });
  }
  return demands;
}

function demandBase(task: RankedTask): Omit<Demand, 'needMin' | 'dueAbs'> {
  return {
    title: `${task.course.name}: ${task.assessment.name}`,
    category: 'study',
    courseId: task.course.id,
    assessmentId: task.assessment.id,
    difficulty: task.course.difficulty,
    effective: true,
  };
}
