// Conflicts about how much is planned and how usable those hours will be.

import { DAY, WEEKDAYS_LONG, diffDays, fmtHours, fmtTime } from '../time';
import { blockFactor, dayEnergy, effectiveBetween, explainSlot, sleepBefore } from '../energy';
import { findSlot, when } from '../planner';
import { type TimedBlock, type Timeline, dateOfDay, dayOfAbs, dayStart } from '../timeline';
import type { Conflict, Fix, Rule, RuleContext } from './types';

const movable = (tl: Timeline, b: TimedBlock) => b.block.status === 'planned' && b.start >= tl.nowAbs;
const clockOf = (abs: number) => abs - dayStart(dayOfAbs(abs));

/** A fix that moves a block to the best free slot before its deadline, if one exists. */
export function moveBlockFix(ctx: RuleContext, b: TimedBlock, opts: { avoidDay?: number; minFactor?: number } = {}): Fix | null {
  const { tl } = ctx;
  const assessment = tl.assessments.find((a) => a.id === b.block.assessmentId);
  const dueAbs = assessment?.dueDate ? dayStart(diffDays(tl.origin, assessment.dueDate)) : Infinity;
  const until = Math.min(dayStart(7), dueAbs);
  const good = (s: ReturnType<typeof findSlot>) =>
    s != null && s.start !== b.start && (opts.minFactor == null || s.factor >= opts.minFactor);
  // Prefer a slot after the block's current time: the days before it were planned
  // around it. Only look earlier in the week when nothing later works.
  let slot = findSlot(tl, b.end - b.start, b.start, until, b, opts.avoidDay);
  if (!good(slot)) slot = findSlot(tl, b.end - b.start, 0, until, b, opts.avoidDay);
  if (!slot || !good(slot)) return null;
  return {
    label: `Move "${b.block.title}" to ${when(slot.start)} (factor ${slot.factor.toFixed(2)})`,
    action: { type: 'moveBlock', blockId: b.block.id, date: dateOfDay(tl, dayOfAbs(slot.start)), startMin: clockOf(slot.start) },
  };
}

/** The planned block that moves the semester average least: the first to give up. */
function lowestLeverageBlock(ctx: RuleContext): TimedBlock | null {
  const scoreOf = (b: TimedBlock) =>
    b.block.category === 'project' ? -1 : ctx.ranked.find((t) => t.assessment.id === b.block.assessmentId)?.score ?? 0;
  const candidates = ctx.tl.blocks.filter((b) => movable(ctx.tl, b) && b.start < dayStart(7));
  if (candidates.length === 0) return null;
  return candidates.reduce((low, b) => (scoreOf(b) < scoreOf(low) || (scoreOf(b) === scoreOf(low) && b.start > low.start) ? b : low));
}

/** Rule 1: planned work eats into the recovery reserved for the week. */
export const recoveryRule: Rule = (ctx) => {
  const { tl, week, days } = ctx;
  if (week.bufferMin >= 0 || dayStart(7) <= tl.nowAbs) return [];

  const shortMin = -week.bufferMin;
  const sessions = tl.sessions.filter((s) => s.start >= 0 && s.start < dayStart(7));
  const hard = sessions.filter((s) => s.session.intensity === 3).length;
  const fixes: Fix[] = [];

  // Option A: cut from the day carrying the most planned work that can still change.
  let heaviest: number | null = null;
  const plannedOn = (day: number) => tl.blocks
    .filter((b) => movable(tl, b) && dayOfAbs(b.start) === day)
    .reduce((s, b) => s + (b.end - b.start), 0);
  for (let day = 0; day < 7; day++) {
    if (plannedOn(day) > 0 && (heaviest == null || days[day].workMin > days[heaviest].workMin)) heaviest = day;
  }
  if (heaviest != null) {
    const cut = Math.min(plannedOn(heaviest), Math.ceil(shortMin / 15) * 15);
    fixes.push({
      label: `Cut ${fmtHours(cut)} h of planned work from ${WEEKDAYS_LONG[heaviest]}`,
      action: { type: 'trimDay', date: dateOfDay(tl, heaviest), minutes: cut },
    });
  }
  // Option B: push the least valuable block out of the week.
  const low = lowestLeverageBlock(ctx);
  if (low) {
    fixes.push({
      label: `Move "${low.block.title}" (${fmtHours(low.end - low.start)} h, lowest grade impact) to next week`,
      action: { type: 'moveBlock', blockId: low.block.id, date: dateOfDay(tl, dayOfAbs(low.start) + 7), startMin: clockOf(low.start) },
    });
  }

  return [{
    key: 'recovery',
    rule: 'recovery',
    severity: 'critical',
    date: null,
    title: `Recovery is ${fmtHours(shortMin)} h below your threshold`,
    consequence: `${sessions.length} training session${sessions.length === 1 ? '' : 's'}${hard ? ` (${hard} hard)` : ''} + ${fmtHours(week.workMin)} h of study and project work `
      + `leave ${fmtHours(week.availableMin - week.workMin)} h for recovery this week. Your threshold is ${fmtHours(week.recoveryMin)} h.`,
    fixes,
  }];
};

/** Rule 9: more focused work in one day than the day can hold. */
export const dayOverloadRule: Rule = (ctx) => {
  const { tl, days } = ctx;
  const ceiling = tl.config.planner.maxFocusHoursPerDay * 60;
  const out: Conflict[] = [];
  for (let day = 0; day < 7; day++) {
    const cap = days[day];
    const limit = Math.min(ceiling, cap.flexibleMin);
    const planned = tl.blocks.filter((b) => movable(tl, b) && dayOfAbs(b.start) === day);
    if (cap.workMin <= limit + 1 || planned.length === 0) continue;

    const overMin = cap.workMin - limit;
    const name = WEEKDAYS_LONG[day];
    const why = limit === ceiling
      ? `Your ceiling for focused work is ${fmtHours(ceiling)} h a day. Hours past it rarely count as focused hours.`
      : `After fixed commitments and ${fmtHours(cap.recoveryMin)} h of recovery, ${name} has ${fmtHours(cap.flexibleMin)} h of flexible time.`;
    const last = planned[planned.length - 1];
    const cut = Math.min(Math.ceil(overMin / 15) * 15, planned.reduce((s, b) => s + (b.end - b.start), 0));
    const move = moveBlockFix(ctx, last, { avoidDay: day });
    out.push({
      key: `overload:${dateOfDay(tl, day)}`,
      rule: 'day-overload',
      severity: 'warning',
      date: dateOfDay(tl, day),
      title: `${name}: ${fmtHours(cap.workMin)} h planned, room for ${fmtHours(limit)} h`,
      consequence: `${why} ${fmtHours(overMin)} h of the plan will not happen as written.`,
      fixes: [
        ...(move ? [move] : []),
        { label: `Cut ${fmtHours(cut)} h from ${name}`, action: { type: 'trimDay', date: dateOfDay(tl, day), minutes: cut } },
      ],
    });
  }
  return out;
};

/** Rule 7: something booked into the sleep window makes the next day a short-night day. */
export const shortNightRule: Rule = (ctx) => {
  const { tl } = ctx;
  const { shortNightHours, shortNightMultiplier: m } = tl.config.carryover;
  const bed = fmtTime(tl.settings.sleepStartMin);
  const wake = fmtTime(tl.settings.sleepEndMin);
  const out: Conflict[] = [];
  let windowTooShort = false;

  for (let day = 0; day <= 7; day++) {
    // Once the wake-up time has passed, the night is history and cannot be fixed.
    if (dayStart(day) + tl.settings.sleepEndMin <= tl.nowAbs) continue;
    const sleep = sleepBefore(tl, day);
    if (sleep.logged || sleep.minutes >= shortNightHours * 60) continue;
    if (sleep.intruders.length === 0) { windowTooShort = true; continue; }

    const intruder = sleep.intruders[0];
    const name = WEEKDAYS_LONG[day % 7];
    const work = effectiveBetween(tl, dayStart(day), dayStart(day) + DAY);
    const effective = work.doneMin + work.plannedMin;
    const impact = effective > 0 && !dayEnergy(tl, day).logged
      ? `The work planned that day counts as ${fmtHours(effective)} effective h instead of about ${fmtHours(effective / m)}.`
      : `Anything planned that day counts for ${Math.round((1 - m) * 100)}% less.`;

    const fixes: Fix[] = [];
    const lateBlock = tl.blocks.find((b) => b.start === intruder.start && b.end === intruder.end && movable(tl, b));
    if (lateBlock) {
      const move = moveBlockFix(ctx, lateBlock);
      if (move) fixes.push(move);
    }
    const hardest = tl.blocks
      .filter((b) => movable(tl, b) && dayOfAbs(b.start) === day && b !== lateBlock)
      .sort((a, b) => (tl.courses.get(b.block.courseId ?? '')?.difficulty ?? 0) - (tl.courses.get(a.block.courseId ?? '')?.difficulty ?? 0))[0];
    if (hardest) {
      const move = moveBlockFix(ctx, hardest, { avoidDay: day, minFactor: blockFactor(tl, hardest) + 0.05 });
      if (move) fixes.push(move);
    }
    fixes.push({ label: 'If you sleep more than this, log the real hours at the morning check-in' });

    out.push({
      key: `short-night:${dateOfDay(tl, day)}`,
      rule: 'short-night',
      severity: 'warning',
      date: dateOfDay(tl, Math.max(0, day - 1)),
      title: `${intruder.title} leaves ${fmtHours(sleep.minutes)} h of sleep before ${name}`,
      consequence: `It runs ${when(intruder.start)} to ${fmtTime(intruder.end)}, inside your ${bed} to ${wake} sleep window. `
        + `Under ${shortNightHours} h of sleep multiplies ${name}'s energy by ${m}. ${impact}`,
      fixes,
    });
  }

  if (windowTooShort) {
    const hours = fmtHours(sleepWindowMinutes(tl));
    out.push({
      key: 'sleep-window',
      rule: 'short-night',
      severity: 'info',
      date: null,
      title: `Your sleep window is ${hours} h`,
      consequence: `That is under the ${shortNightHours} h short-night line, so every day is multiplied by ${m}. `
        + `Move bedtime earlier, or lower the line in Tuning if ${hours} h is enough for you.`,
      fixes: [{ label: 'Open sleep settings', action: { type: 'open', screen: 'settings' } }],
    });
  }
  return out;
};

function sleepWindowMinutes(tl: Timeline): number {
  const { sleepStartMin, sleepEndMin } = tl.settings;
  return sleepEndMin > sleepStartMin ? sleepEndMin - sleepStartMin : sleepEndMin + DAY - sleepStartMin;
}

/** Rule 8: a hard course planned where predicted energy is low. */
export const lowEnergyRule: Rule = (ctx) => {
  const { tl } = ctx;
  const { lowEnergyFactor, hardDifficulty } = tl.config.conflicts;
  const out: Conflict[] = [];
  for (const b of tl.blocks) {
    if (!movable(tl, b) || b.start >= dayStart(7) || b.block.energy != null) continue;
    const course = tl.courses.get(b.block.courseId ?? '');
    if (!course || course.difficulty < hardDifficulty) continue;
    const factor = blockFactor(tl, b);
    if (factor >= lowEnergyFactor) continue;

    const length = b.end - b.start;
    const move = moveBlockFix(ctx, b, { minFactor: factor + 0.1 });
    out.push({
      key: `low-energy:${b.block.id}`,
      rule: 'low-energy',
      severity: 'info',
      date: dateOfDay(tl, dayOfAbs(b.start)),
      title: `${course.name} at ${when(b.start)} sits in a low-energy slot`,
      consequence: `Predicted factor ${factor.toFixed(2)} (${explainSlot(tl, (b.start + b.end) / 2)}). `
        + `The ${fmtHours(length)} h block counts as ${fmtHours(length * factor)} effective h.`,
      fixes: move ? [move] : [{ label: 'No better free slot this week. Swap it with an easier course by hand.' }],
    });
  }
  return out;
};
