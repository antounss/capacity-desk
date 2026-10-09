// The energy model. Deliberately a small, explainable heuristic:
//
//   effective_minutes = duration x factor
//   factor (logged)    = factors[energy level logged on the block]
//   factor (predicted) = day factor x time-of-day multiplier x post-training dip
//   day factor         = factors[morning check-in]                    if logged
//                      = factors[baseline] x carryover from yesterday otherwise
//
// Every multiplier is returned with a label so the UI can show where a number came from.

import type { Config, EnergyLevel } from './types';
import { DAY, fmtHours } from './time';
import { type Span, clip, subtract, total } from './intervals';
import { type TimedBlock, type Timeline, dateOfDay, dayOfAbs, dayStart } from './timeline';

/** Factor for a logged level. A missing level falls back to the configured baseline. */
export function energyFactor(level: EnergyLevel | null | undefined, config: Config): number {
  const known = level != null ? config.energy.factors[level] : undefined;
  return known ?? config.energy.factors[config.energy.baselineLevel];
}

export function timeOfDayMultiplier(minuteOfDay: number, config: Config): number {
  const m = ((minuteOfDay % DAY) + DAY) % DAY;
  for (const band of config.energy.timeOfDay) {
    const wraps = band.fromMin > band.toMin;
    const inside = wraps ? m >= band.fromMin || m < band.toMin : m >= band.fromMin && m < band.toMin;
    if (inside) return band.multiplier;
  }
  return 1;
}

export interface SleepEstimate {
  minutes: number;
  /** True when the user logged the hours; false when estimated from the plan. */
  logged: boolean;
  /** Things booked inside the sleep window, latest first. */
  intruders: (Span & { title: string })[];
}

/** Sleep in the 24 hours ending at wake-up time on `day`. */
export function sleepBefore(tl: Timeline, day: number): SleepEstimate {
  const wake = dayStart(day) + tl.settings.sleepEndMin;
  const window = clip(tl.sleep, wake - DAY, wake);

  const titled: (Span & { title: string })[] = [
    ...tl.shifts.map((s) => ({ start: s.start, end: s.end, title: s.title })),
    ...tl.commitments.map((s) => ({ start: s.start, end: s.end, title: s.title })),
    ...tl.sessions.map((s) => ({ start: s.start, end: s.end, title: s.session.name })),
    ...tl.blocks.map((s) => ({ start: s.start, end: s.end, title: s.block.title })),
  ];
  const intruders = titled
    .filter((item) => total(clip(window, item.start, item.end)) > 0)
    .sort((a, b) => b.end - a.end);

  const logged = tl.dayLogs.get(dateOfDay(tl, day))?.sleepHours;
  if (logged != null) return { minutes: logged * 60, logged: true, intruders };
  return { minutes: total(subtract(window, intruders)), logged: false, intruders };
}

export interface DayEnergy {
  factor: number;
  /** True when the factor comes from a morning check-in rather than the model. */
  logged: boolean;
  /** The multipliers that produced the factor, in order, for display. */
  parts: { label: string; multiplier: number }[];
}

// dayEnergy is asked for the same day many times while scoring slots, so results are
// remembered per timeline. A Timeline is never mutated after it is built.
const dayEnergyCache = new WeakMap<Timeline, Map<number, DayEnergy>>();

export function dayEnergy(tl: Timeline, day: number): DayEnergy {
  let cache = dayEnergyCache.get(tl);
  if (!cache) dayEnergyCache.set(tl, (cache = new Map()));
  let result = cache.get(day);
  if (!result) cache.set(day, (result = computeDayEnergy(tl, day)));
  return result;
}

function computeDayEnergy(tl: Timeline, day: number): DayEnergy {
  const { config } = tl;
  const checkIn = tl.dayLogs.get(dateOfDay(tl, day))?.energy;
  if (checkIn != null) {
    // A check-in already includes how last night and yesterday's session feel today,
    // so carryover is not applied on top of it (that would count fatigue twice).
    const factor = energyFactor(checkIn, config);
    return { factor, logged: true, parts: [{ label: `check-in ${checkIn}/5`, multiplier: factor }] };
  }

  const base = energyFactor(null, config);
  const parts = [{ label: `baseline ${config.energy.baselineLevel}/5`, multiplier: base }];
  let carry = 1;

  const yesterday = tl.sessions.filter((s) => dayOfAbs(s.start) === day - 1);
  if (yesterday.length > 0) {
    const hardest = yesterday.reduce((a, b) => (b.session.intensity > a.session.intensity ? b : a));
    const m = config.carryover.trainingMultiplier[hardest.session.intensity];
    if (m !== 1) {
      carry *= m;
      parts.push({ label: `${hardest.session.name} yesterday`, multiplier: m });
    }
  }

  const sleep = sleepBefore(tl, day);
  if (sleep.minutes < config.carryover.shortNightHours * 60) {
    carry *= config.carryover.shortNightMultiplier;
    parts.push({ label: `short night (${fmtHours(sleep.minutes)} h)`, multiplier: config.carryover.shortNightMultiplier });
  }

  if (carry < config.carryover.floor) {
    parts.push({ label: 'carryover floor', multiplier: config.carryover.floor / carry });
    carry = config.carryover.floor;
  }
  return { factor: base * carry, logged: false, parts };
}

/** Predicted factor for one minute on the timeline. */
export function slotFactor(tl: Timeline, abs: number): number {
  const { postTraining } = tl.config.carryover;
  let factor = dayEnergy(tl, dayOfAbs(abs)).factor * timeOfDayMultiplier(abs, tl.config);
  const justTrained = tl.sessions.some(
    (s) => s.session.intensity >= postTraining.minIntensity && abs >= s.end && abs < s.end + postTraining.windowMin,
  );
  if (justTrained) factor *= postTraining.multiplier;
  return factor;
}

/** "baseline 3/5 0.75 x Legs yesterday 0.90 x evening 0.85" for the slot at `abs`. */
export function explainSlot(tl: Timeline, abs: number): string {
  const fmt = (n: number) => n.toFixed(2);
  const parts = dayEnergy(tl, dayOfAbs(abs)).parts.map((p) => `${p.label} ${fmt(p.multiplier)}`);
  const m = ((abs % DAY) + DAY) % DAY;
  const band = tl.config.energy.timeOfDay.find((b) =>
    b.fromMin > b.toMin ? m >= b.fromMin || m < b.toMin : m >= b.fromMin && m < b.toMin,
  );
  if (band) parts.push(`${band.label} ${fmt(band.multiplier)}`);
  const { postTraining } = tl.config.carryover;
  const justTrained = tl.sessions.some(
    (s) => s.session.intensity >= postTraining.minIntensity && abs >= s.end && abs < s.end + postTraining.windowMin,
  );
  if (justTrained) parts.push(`after hard training ${fmt(postTraining.multiplier)}`);
  return parts.join(' x ');
}

/** Energy logged on the block always wins; otherwise the prediction for its midpoint. */
export function blockFactor(tl: Timeline, b: TimedBlock): number {
  if (b.block.energy != null) return energyFactor(b.block.energy, tl.config);
  return slotFactor(tl, (b.start + b.end) / 2);
}

export function effectiveMinutes(tl: Timeline, b: TimedBlock): number {
  return (b.end - b.start) * blockFactor(tl, b);
}

export interface EffectiveTotals {
  doneMin: number;
  plannedMin: number;
}

/** Effective minutes of work inside [lo, hi), split by done and still planned. */
export function effectiveBetween(tl: Timeline, lo: number, hi: number): EffectiveTotals {
  const totals = { doneMin: 0, plannedMin: 0 };
  for (const b of tl.blocks) {
    const inside = total(clip([b], lo, hi));
    if (inside === 0) continue;
    const effective = inside * blockFactor(tl, b);
    if (b.block.status === 'done') totals.doneMin += effective;
    else totals.plannedMin += effective;
  }
  return totals;
}
