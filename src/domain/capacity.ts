// The capacity model. See docs/PLAN.md section 3 for the formulas in one place.
//
//   committed = sleep + classes + shifts + commute/other + overhead + training
//   available = total - committed
//   recovery  = base recovery + recovery for each session      (reserved first)
//   flexible  = available - recovery
//   buffer    = flexible - planned and logged work

import { DAY } from './time';
import { type Span, clip, merge, subtract, total } from './intervals';
import { type Timeline, dayStart } from './timeline';

export interface Capacity {
  totalMin: number;
  sleepMin: number;
  classMin: number;
  shiftMin: number;
  /** Commute and other fixed commitments. */
  otherFixedMin: number;
  /** Meals and daily overhead: counted, but not placed at a clock time. */
  overheadMin: number;
  trainingMin: number;
  committedMin: number;
  availableMin: number;
  /** Recovery reserved by the rules, whether or not the week can afford it. */
  recoveryMin: number;
  flexibleMin: number;
  /** Planned and done study/project minutes. */
  workMin: number;
  doneMin: number;
  bufferMin: number;
}

/**
 * Capacity for one day. When two commitments overlap, the minutes are counted once
 * and credited to the one that wins in real life: shift > class > commute/other >
 * training > sleep. A shift that runs into the sleep window therefore shows up as
 * more work and less sleep, which is what actually happens.
 */
export function dayCapacity(tl: Timeline, day: number): Capacity {
  const lo = dayStart(day);
  const hi = lo + DAY;
  const inDay = (spans: Span[]) => clip(spans, lo, hi);

  const shifts = merge(inDay(tl.shifts));
  const classes = subtract(inDay(tl.commitments.filter((c) => c.kind === 'class')), shifts);
  const otherFixed = subtract(
    inDay(tl.commitments.filter((c) => c.kind !== 'class')),
    [...shifts, ...classes],
  );
  const training = subtract(inDay(tl.sessions), [...shifts, ...classes, ...otherFixed]);
  const sleep = subtract(inDay(tl.sleep), [...shifts, ...classes, ...otherFixed, ...training]);

  const sleepMin = total(sleep);
  const classMin = total(classes);
  const shiftMin = total(shifts);
  const otherFixedMin = total(otherFixed);
  const trainingMin = total(training);

  const placed = sleepMin + classMin + shiftMin + otherFixedMin + trainingMin;
  // Overhead cannot exceed what is left of the day (a 20-hour day has no room for 2 h of meals).
  const overheadMin = Math.min(tl.settings.dailyOverheadMin, DAY - placed);
  const committedMin = placed + overheadMin;
  const availableMin = DAY - committedMin;

  // Recovery for a session is charged to the day the session starts on.
  const { baseHoursPerDay, hoursPerSession } = tl.config.recovery;
  const sessionRecovery = tl.sessions
    .filter((s) => s.start >= lo && s.start < hi)
    .reduce((sum, s) => sum + hoursPerSession[s.session.intensity] * 60, 0);
  const recoveryMin = baseHoursPerDay * 60 + sessionRecovery;

  const dayBlocks = tl.blocks.filter((b) => b.end > lo && b.start < hi);
  const workMin = total(inDay(dayBlocks));
  const doneMin = total(inDay(dayBlocks.filter((b) => b.block.status === 'done')));

  const flexibleMin = Math.max(0, availableMin - recoveryMin);
  return {
    totalMin: DAY, sleepMin, classMin, shiftMin, otherFixedMin, overheadMin, trainingMin,
    committedMin, availableMin, recoveryMin, flexibleMin, workMin, doneMin,
    bufferMin: flexibleMin - workMin,
  };
}

/** Capacity for the 7 days of the week in view. */
export function weekCapacity(tl: Timeline): Capacity {
  const days = Array.from({ length: 7 }, (_, day) => dayCapacity(tl, day));
  const sum = (pick: (c: Capacity) => number) => days.reduce((s, c) => s + pick(c), 0);

  const availableMin = sum((c) => c.availableMin);
  const recoveryMin = sum((c) => c.recoveryMin);
  const workMin = sum((c) => c.workMin);
  // Flexible time is pooled across the week: a packed Tuesday can borrow from a free
  // Saturday. Single-day overload is caught separately by the day-overload conflict.
  const flexibleMin = Math.max(0, availableMin - recoveryMin);
  return {
    totalMin: sum((c) => c.totalMin),
    sleepMin: sum((c) => c.sleepMin),
    classMin: sum((c) => c.classMin),
    shiftMin: sum((c) => c.shiftMin),
    otherFixedMin: sum((c) => c.otherFixedMin),
    overheadMin: sum((c) => c.overheadMin),
    trainingMin: sum((c) => c.trainingMin),
    committedMin: sum((c) => c.committedMin),
    availableMin,
    recoveryMin,
    flexibleMin,
    workMin,
    doneMin: sum((c) => c.doneMin),
    bufferMin: flexibleMin - workMin,
  };
}
