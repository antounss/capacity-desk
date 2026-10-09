// Suggests where study and project blocks should go. This is a greedy placement, not
// an optimiser, on purpose: each step can be explained in one sentence.
//
//   1. Cut the free waking time of each remaining day into candidate slots.
//   2. Give slots to demands in priority order, best predicted energy first.
//      A day stops taking blocks when its flexible time or focus ceiling is used up.
//   3. Among the slots chosen, hand the highest-energy ones to the hardest courses.

import type { Block, ISODate } from './types';
import { DAY, WEEKDAYS_LONG, fmtHours, fmtTime } from './time';
import type { Span } from './intervals';
import type { Capacity } from './capacity';
import { slotFactor } from './energy';
import type { Demand } from './priority';
import { findRestViolations } from './training';
import {
  type TimedSession, type Timeline, dateOfDay, dayOfAbs, dayStart, freeSpans,
} from './timeline';

export interface Suggestion {
  /** Ready to store once the user accepts it (the app adds the id). */
  block: Omit<Block, 'id'>;
  factor: number;
  reason: string;
}

export interface PlanResult {
  suggestions: Suggestion[];
  /** Demand that did not fit anywhere this week. */
  unplaced: { title: string; missingMin: number; effective: boolean }[];
}

interface Slot extends Span {
  day: number;
  factor: number;
  used: boolean;
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/** "Thu 18:00" for an absolute minute. */
export function when(abs: number): string {
  const day = ((dayOfAbs(abs) % 7) + 7) % 7;
  return `${WEEKDAYS_LONG[day].slice(0, 3)} ${fmtTime(abs)}`;
}

function candidateSlots(tl: Timeline): Slot[] {
  const { blockMin, minBlockMin, breakMin } = tl.config.planner;
  const slots: Slot[] = [];
  const earliest = roundUp(tl.nowAbs, 15);
  for (let day = 0; day < 7; day++) {
    const lo = Math.max(dayStart(day), earliest);
    const hi = dayStart(day) + DAY;
    if (lo >= hi) continue;
    for (const free of freeSpans(tl, lo, hi)) {
      let cursor = free.start;
      while (free.end - cursor >= minBlockMin) {
        const len = Math.min(blockMin, free.end - cursor);
        slots.push({ day, start: cursor, end: cursor + len, factor: slotFactor(tl, cursor + len / 2), used: false });
        cursor += len + breakMin;
      }
    }
  }
  return slots;
}

export function suggestBlocks(tl: Timeline, demands: Demand[], days: Capacity[]): PlanResult {
  const { minBlockMin, maxFocusHoursPerDay } = tl.config.planner;
  const slots = candidateSlots(tl);
  // Minutes each day can still take: bounded by flexible time and by the focus ceiling.
  const budget = days.map((c) => Math.max(0, Math.min(c.flexibleMin, maxFocusHoursPerDay * 60) - c.workMin));

  const placed: { demand: Demand; slot: Slot; len: number }[] = [];
  const unplaced: PlanResult['unplaced'] = [];

  for (const demand of demands) {
    let need = demand.needMin;
    while (need > 1) {
      const open = slots.filter((s) => !s.used && s.end <= demand.dueAbs && budget[s.day] >= minBlockMin);
      if (open.length === 0) break;
      const slot = open.reduce((best, s) => (s.factor > best.factor ? s : best));

      // Do not book a full block when less is needed, but never suggest a sliver.
      const rawNeed = demand.effective ? need / slot.factor : need;
      const len = Math.min(slot.end - slot.start, budget[slot.day], Math.max(minBlockMin, roundUp(rawNeed, 15)));
      slot.used = true;
      budget[slot.day] -= len;
      need -= demand.effective ? len * slot.factor : len;
      placed.push({ demand, slot, len });
    }
    if (need > 1) unplaced.push({ title: demand.title, missingMin: need, effective: demand.effective });
  }

  giveBestSlotsToHardestCourses(placed);

  const bestFactor = slots.reduce((best, s) => Math.max(best, s.factor), 0);
  const suggestions = placed
    .sort((a, b) => a.slot.start - b.slot.start)
    .map(({ demand, slot, len }) => ({
      block: {
        date: dateOfDay(tl, slot.day),
        startMin: slot.start - dayStart(slot.day),
        durationMin: len,
        category: demand.category,
        title: demand.title,
        courseId: demand.courseId,
        assessmentId: demand.assessmentId,
        status: 'planned' as const,
        energy: null,
      },
      factor: slot.factor,
      reason: reasonFor(demand, slot, len, bestFactor),
    }));
  return { suggestions, unplaced };
}

/**
 * Priority decided who gets time; difficulty decides who gets the best of that time.
 * Two placements swap slots when the harder course holds the weaker slot, each block
 * fits in the other's slot, and both still finish before their due dates.
 */
function giveBestSlotsToHardestCourses(placed: { demand: Demand; slot: Slot; len: number }[]): void {
  const fits = (p: { demand: Demand; len: number }, slot: Slot) =>
    p.len <= slot.end - slot.start && slot.start + p.len <= p.demand.dueAbs;
  for (const hard of placed) {
    for (const easy of placed) {
      const worthIt = hard.demand.difficulty > easy.demand.difficulty && hard.slot.factor < easy.slot.factor;
      if (worthIt && fits(hard, easy.slot) && fits(easy, hard.slot)) [hard.slot, easy.slot] = [easy.slot, hard.slot];
    }
  }
}

/** Says why a block landed where it did, without calling a weak slot a strong one. */
function reasonFor(demand: Demand, slot: Slot, len: number, bestFactor: number): string {
  const nearBest = slot.factor >= bestFactor * 0.9;
  const why = demand.difficulty === 3 && nearBest ? 'Hard course, placed in one of the highest-energy slots left this week'
    : demand.difficulty === 1 ? 'Light course, placed after the harder ones took the stronger slots'
    : nearBest ? 'One of the highest-energy slots left this week'
    : 'Best slot still free after higher-priority work and the daily focus ceiling';
  const counts = demand.effective
    ? ` ${fmtHours(len)} h here counts as ${fmtHours(len * slot.factor)} effective h.`
    : '';
  return `${why} (predicted factor ${slot.factor.toFixed(2)}).${counts}`;
}

export interface FoundSlot {
  start: number;
  factor: number;
}

/**
 * Best-energy free start time for something `durationMin` long inside [fromAbs, toAbs).
 * `ignore` is the item being moved, so its current place counts as free.
 */
export function findSlot(
  tl: Timeline,
  durationMin: number,
  fromAbs: number,
  toAbs: number,
  ignore?: Span,
  avoidDay?: number,
): FoundSlot | null {
  let best: FoundSlot | null = null;
  const lo = Math.max(roundUp(tl.nowAbs, 15), fromAbs);
  for (const free of freeSpans(tl, lo, toAbs, ignore)) {
    for (let start = roundUp(free.start, 15); start + durationMin <= free.end; start += 30) {
      if (avoidDay != null && dayOfAbs(start) === avoidDay) continue;
      const factor = slotFactor(tl, start + durationMin / 2);
      if (!best || factor > best.factor + 1e-9) best = { start, factor };
    }
  }
  return best;
}

/**
 * First later day (then earlier day) in the week where `session` can sit at the same
 * clock time without hitting a commitment, a block, sleep or a rest rule.
 */
export function findSessionSlot(tl: Timeline, session: TimedSession, fromDay = 0): { date: ISODate; start: number } | null {
  const clock = session.start - dayStart(dayOfAbs(session.start));
  const length = session.end - session.start;
  const currentDay = dayOfAbs(session.start);
  const order = [...Array(7).keys()]
    .filter((d) => d !== currentDay && d >= fromDay)
    .sort((a, b) => Number(a < currentDay) - Number(b < currentDay) || a - b);

  for (const day of order) {
    const start = dayStart(day) + clock;
    if (start < tl.nowAbs) continue;
    const candidate: TimedSession = { ...session, start, end: start + length };
    const isFree = freeSpans(tl, start, start + length, session).some((f) => f.start <= start && f.end >= start + length);
    if (!isFree) continue;
    const others = tl.sessions.filter((s) => s !== session);
    const breaksRule = findRestViolations([...others, candidate], tl.config.training.restRules).some(
      (v) => v.first === candidate || v.second === candidate,
    );
    if (!breaksRule) return { date: dateOfDay(tl, day), start };
  }
  return null;
}
