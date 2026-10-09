// Conflicts about the training plan itself.

import { WEEKDAYS_LONG, diffDays, fmtHours } from '../time';
import { findSessionSlot, when } from '../planner';
import { type TimedSession, type Timeline, dateOfDay, dayOfAbs } from '../timeline';
import { findRestViolations, longestTrainingRun } from '../training';
import type { Conflict, Fix, Rule } from './types';

const inWeek = (s: TimedSession) => s.start >= 0 && dayOfAbs(s.start) < 7;
const upcoming = (tl: Timeline, s: TimedSession) => s.end > tl.nowAbs && s.session.status !== 'done';

function moveFix(tl: Timeline, s: TimedSession, fromDay = 0): Fix | null {
  const slot = findSessionSlot(tl, s, fromDay);
  if (!slot) return null;
  return {
    label: `Move ${s.session.name} to ${when(slot.start)}`,
    action: { type: 'moveSession', sessionId: s.session.id, date: slot.date, startMin: slot.start - dayOfAbs(slot.start) * 1440 },
  };
}

/** Skipping is only offered when the weekly minimum survives it. */
function skipFix(tl: Timeline, s: TimedSession): Fix | null {
  const count = tl.sessions.filter(inWeek).length;
  if (count - 1 < tl.settings.minSessionsPerWeek) return null;
  return { label: `Skip ${s.session.name} this week (${count - 1} sessions left)`, action: { type: 'skipSession', sessionId: s.session.id } };
}

const present = <T>(items: (T | null)[]): T[] => items.filter((x): x is T => x != null);

/** Rule 2: two sessions on the same load group closer together than the rest rule allows. */
export const restGapRule: Rule = ({ tl }) => {
  const out: Conflict[] = [];
  for (const v of findRestViolations(tl.sessions, tl.config.training.restRules)) {
    if (!inWeek(v.second) || !upcoming(tl, v.second)) continue;
    const fixes = present([moveFix(tl, v.second), skipFix(tl, v.second)]);
    if (fixes.length === 0) {
      fixes.push({ label: 'No free day satisfies the rule. Make one of the two a light session.', action: { type: 'open', screen: 'schedule' } });
    }
    out.push({
      key: `rest:${v.rule.id}:${v.first.session.id}:${v.second.session.id}`,
      rule: 'rest-gap',
      severity: 'warning',
      date: dateOfDay(tl, dayOfAbs(v.second.start)),
      title: `${v.second.session.name} comes ${fmtHours(v.gapMin)} h after ${v.first.session.name}`,
      consequence: `${v.first.session.name} ends ${when(v.first.end)} and ${v.second.session.name} starts ${when(v.second.start)}. `
        + `Your rule for ${v.rule.groups.join('/')} sessions is ${v.rule.minGapHours} h apart, so the second one lands before recovery is done.`,
      fixes,
    });
  }
  return out;
};

/** Rule 3: training on more consecutive days than the rule allows. */
export const noRestDayRule: Rule = ({ tl }) => {
  const sessions = tl.sessions.filter(inWeek);
  const days = new Set(sessions.map((s) => dayOfAbs(s.start)));
  const run = longestTrainingRun(days, 0, 7);
  const max = tl.config.training.maxConsecutiveDays;
  if (run <= max) return [];

  const candidates = sessions.filter((s) => upcoming(tl, s));
  const fixes: Fix[] = [];
  if (candidates.length > 0) {
    const lightest = candidates.reduce((a, b) => (b.session.intensity < a.session.intensity ? b : a));
    fixes.push({
      label: `Make ${WEEKDAYS_LONG[dayOfAbs(lightest.start)]} the rest day: skip ${lightest.session.name}`,
      action: { type: 'skipSession', sessionId: lightest.session.id },
    });
  }
  return [{
    key: 'no-rest-day',
    rule: 'no-rest-day',
    severity: 'warning',
    date: null,
    title: 'No rest day this week',
    consequence: `Training is planned ${run} days in a row; your rule allows ${max}. With no full rest day, each study day starts with yesterday's fatigue.`,
    fixes,
  }];
};

/** Rule 4: fewer sessions planned than the weekly consistency requirement. */
export const consistencyRule: Rule = ({ tl, data, days }) => {
  const min = tl.settings.minSessionsPerWeek;
  // Someone who has not set up any training has no requirement to miss.
  const usesTraining = data.trainingTemplates.length > 0 || data.trainingSessions.length > 0;
  const count = tl.sessions.filter(inWeek).length;
  if (!usesTraining || min <= 0 || count >= min) return [];

  const todayDay = Math.max(0, diffDays(tl.origin, tl.today));
  const trainingDays = new Set(tl.sessions.filter(inWeek).map((s) => dayOfAbs(s.start)));
  let best: number | null = null;
  for (let day = todayDay; day < 7; day++) {
    if (trainingDays.has(day)) continue;
    if (best == null || days[day].bufferMin > days[best].bufferMin) best = day;
  }
  const fixes: Fix[] = best != null
    ? [{ label: `Add a session on ${WEEKDAYS_LONG[best]} (${fmtHours(Math.max(0, days[best].bufferMin))} h of buffer that day)`, action: { type: 'open', screen: 'schedule' } }]
    : [{ label: 'No free day left this week. Add a short session to a training day or accept the miss.', action: { type: 'open', screen: 'schedule' } }];

  return [{
    key: 'consistency',
    rule: 'consistency',
    severity: 'warning',
    date: null,
    title: `${count} of ${min} training sessions planned`,
    consequence: `Your consistency requirement is ${min} sessions a week. This week has ${count}, so the streak breaks unless one is added.`,
    fixes,
  }];
};

/** Rule 10: a hard session the day before an exam or midterm. */
export const hardBeforeAssessmentRule: Rule = ({ tl }) => {
  const out: Conflict[] = [];
  const { examKinds } = tl.config.conflicts;
  for (const a of tl.assessments) {
    if (a.scorePercent != null || !a.dueDate || !examKinds.includes(a.kind)) continue;
    const dueDay = diffDays(tl.origin, a.dueDate);
    if (dueDay < 1 || dueDay > 7) continue;
    const course = tl.courses.get(a.courseId);
    for (const s of tl.sessions) {
      if (dayOfAbs(s.start) !== dueDay - 1 || s.session.intensity < 3 || !upcoming(tl, s)) continue;
      const m = tl.config.carryover.trainingMultiplier[3];
      out.push({
        key: `hard-before:${a.id}:${s.session.id}`,
        rule: 'hard-before-assessment',
        severity: 'warning',
        date: dateOfDay(tl, dueDay - 1),
        title: `${s.session.name} (hard) is the day before ${course?.name ?? 'an'} ${a.name}`,
        consequence: `A hard session carries into the next day at x${m}. That puts ${Math.round((1 - m) * 100)}% less usable energy into the day of the ${a.kind}.`,
        fixes: present([moveFix(tl, s, dueDay), skipFix(tl, s)]).concat(
          [{ label: 'Or keep the day and make it a light session', action: { type: 'open', screen: 'schedule' } }],
        ),
      });
    }
  }
  return out;
};
