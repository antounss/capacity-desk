// The one entry point the UI calls. Given stored data, a week and the time now, it
// returns everything shown on screen. Because it is a pure function of its inputs,
// re-running it after every change is how conflicts get checked "whenever the plan
// changes" rather than on request.

import { resolveConfig } from '../config/defaultConfig';
import type { AppData, Config, ISODate, Now } from './types';
import { diffDays } from './time';
import { type Capacity, dayCapacity, weekCapacity } from './capacity';
import { type Conflict, detectConflicts } from './conflicts';
import { type DayEnergy, type EffectiveTotals, dayEnergy, effectiveBetween } from './energy';
import { type CourseStanding, type SemesterSummary, courseStanding, semesterSummary } from './grades';
import { type PlanResult, suggestBlocks } from './planner';
import { type RankedTask, progressByAssessment, rankTasks, weeklyDemand } from './priority';
import { type TimedBlock, type Timeline, buildTimeline, dayStart } from './timeline';

export interface Analysis {
  config: Config;
  tl: Timeline;
  week: Capacity;
  days: Capacity[];
  dayEnergies: DayEnergy[];
  /** Effective minutes of work in the week, done and still planned. */
  effective: EffectiveTotals;
  standings: CourseStanding[];
  semester: SemesterSummary;
  ranked: RankedTask[];
  /** The three highest-leverage tasks that still need hours. */
  top3: RankedTask[];
  plan: PlanResult;
  conflicts: Conflict[];
  /** Planned blocks whose time has passed without being confirmed or skipped. */
  unconfirmed: TimedBlock[];
}

/**
 * How many days around the week the timeline must cover: far enough back to include
 * every block that counts toward an ungraded assessment, and far enough ahead to
 * reach the exam horizon. Capped so a stray old record cannot make it huge.
 */
function timelineRange(data: AppData, config: Config, weekStart: ISODate, now: Now): [number, number] {
  const MAX_DAYS = 200;
  const open = new Set(data.assessments.filter((a) => a.scorePercent == null).map((a) => a.id));
  let from = Math.min(-1, diffDays(weekStart, now.date) - 1);
  let to = Math.max(8, diffDays(weekStart, now.date) + config.conflicts.examHorizonDays + 2);
  for (const b of data.blocks) {
    if (!b.assessmentId || !open.has(b.assessmentId)) continue;
    const day = diffDays(weekStart, b.date);
    from = Math.min(from, day - 1);
    to = Math.max(to, day + 2);
  }
  return [Math.max(from, -MAX_DAYS), Math.min(to, MAX_DAYS)];
}

export function analyzeWeek(data: AppData, weekStart: ISODate, now: Now): Analysis {
  const config = resolveConfig(data.configOverrides);
  const [fromDay, toDay] = timelineRange(data, config, weekStart, now);
  const tl = buildTimeline(data, config, weekStart, now, fromDay, toDay);

  const days = Array.from({ length: 7 }, (_, day) => dayCapacity(tl, day));
  const week = weekCapacity(tl);
  const dayEnergies = Array.from({ length: 7 }, (_, day) => dayEnergy(tl, day));

  const standings = data.courses.map((course) => courseStanding(course, data.assessments));
  const ranked = rankTasks(standings, progressByAssessment(tl), now.date, config);
  const plan = suggestBlocks(tl, weeklyDemand(tl, ranked), days);
  const conflicts = detectConflicts({ data, tl, week, days, ranked, plan });

  return {
    config, tl, week, days, dayEnergies,
    effective: effectiveBetween(tl, 0, dayStart(7)),
    standings,
    semester: semesterSummary(standings),
    ranked,
    top3: ranked.filter((t) => t.score > 0).slice(0, 3),
    plan,
    conflicts,
    unconfirmed: tl.blocks.filter((b) => b.block.status === 'planned' && b.end <= tl.nowAbs && b.start >= 0),
  };
}
