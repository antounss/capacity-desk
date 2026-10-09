// Rest rules between training sessions. Rules are data (config.training.restRules),
// so adding "no hard run the day after legs" is a config edit, not a code change.

import type { RestRule } from './types';
import type { TimedSession } from './timeline';

export interface RestViolation {
  rule: RestRule;
  first: TimedSession;
  second: TimedSession;
  /** Minutes from the end of the first session to the start of the second. */
  gapMin: number;
}

function ruleCovers(rule: RestRule, s: TimedSession): boolean {
  return rule.groups.includes(s.session.load) && s.session.intensity >= rule.minIntensity;
}

/** Every pair of back-to-back sessions that sits closer together than a rule allows. */
export function findRestViolations(sessions: TimedSession[], rules: RestRule[]): RestViolation[] {
  const out: RestViolation[] = [];
  for (const rule of rules) {
    const covered = sessions.filter((s) => ruleCovers(rule, s)).sort((a, b) => a.start - b.start);
    for (let i = 1; i < covered.length; i++) {
      const gapMin = covered[i].start - covered[i - 1].end;
      if (gapMin < rule.minGapHours * 60) {
        out.push({ rule, first: covered[i - 1], second: covered[i], gapMin });
      }
    }
  }
  return out;
}

/** Longest run of consecutive days with at least one session, within days [fromDay, toDay). */
export function longestTrainingRun(trainingDays: Set<number>, fromDay: number, toDay: number): number {
  let best = 0;
  let run = 0;
  for (let day = fromDay; day < toDay; day++) {
    run = trainingDays.has(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
