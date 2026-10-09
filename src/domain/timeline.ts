// Turns stored data into a Timeline: one number line of minutes where minute 0 is
// 00:00 on the Monday of the week in view. Everything else in the domain reads the
// Timeline, so "does this shift overlap that block" is plain interval arithmetic,
// including for shifts that cross midnight or spill in from the previous Sunday.

import type {
  AppData, Assessment, Block, Config, Course, DayLog, ISODate, Now, Settings, TrainingSession,
  TrainingTemplate,
} from './types';
import { DAY, addDays, diffDays, spanLength, weekStartOf, weekdayOf } from './time';
import { type Span, merge } from './intervals';

/** A training session for a specific date, after templates and overrides are combined. */
export interface ResolvedSession extends Omit<TrainingSession, 'id' | 'weekStart'> {
  /** The stored session id, or "<templateId>@<weekStart>" for an untouched template slot. */
  id: string;
  weekStart: ISODate;
  /** False when this comes straight from the template and nothing is stored for it yet. */
  stored: boolean;
}

export interface TimedSession extends Span {
  session: ResolvedSession;
}

export interface TimedItem extends Span {
  kind: 'class' | 'commute' | 'other' | 'shift';
  id: string;
  title: string;
}

export interface TimedBlock extends Span {
  block: Block;
}

export interface Timeline {
  origin: ISODate;
  /** Days covered, relative to origin: [fromDay, toDay). */
  fromDay: number;
  toDay: number;
  config: Config;
  settings: Settings;
  commitments: TimedItem[];
  shifts: TimedItem[];
  /** Skipped sessions and blocks are excluded; they take no time. */
  sessions: TimedSession[];
  blocks: TimedBlock[];
  /** Sleep windows as configured, before anything intrudes on them. */
  sleep: Span[];
  dayLogs: Map<ISODate, DayLog>;
  courses: Map<string, Course>;
  assessments: Assessment[];
  /** Absolute minute of "now". Used to keep suggestions and alerts in the future. */
  nowAbs: number;
  today: ISODate;
}

/** Sessions on one date: stored sessions dated there, plus untouched template slots. */
export function sessionsOn(
  date: ISODate,
  templates: TrainingTemplate[],
  stored: TrainingSession[],
): ResolvedSession[] {
  const weekStart = weekStartOf(date);
  const weekday = weekdayOf(date);
  const out: ResolvedSession[] = [];

  for (const t of templates) {
    if (t.weekday !== weekday) continue;
    // A stored session that points at this template for this week replaces the slot,
    // wherever it was moved to.
    const replaced = stored.some((s) => s.templateId === t.id && s.weekStart === weekStart);
    if (replaced) continue;
    out.push({
      id: `${t.id}@${weekStart}`, templateId: t.id, weekStart, date, startMin: t.startMin,
      durationMin: t.durationMin, name: t.name, load: t.load, intensity: t.intensity,
      status: 'planned', stored: false,
    });
  }
  for (const s of stored) {
    if (s.date === date) out.push({ ...s, stored: true });
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

/** The absolute minute where day index `day` starts. */
export function dayStart(day: number): number {
  return day * DAY;
}

export function dateOfDay(tl: Timeline, day: number): ISODate {
  return addDays(tl.origin, day);
}

export function dayOfAbs(abs: number): number {
  return Math.floor(abs / DAY);
}

export function buildTimeline(
  data: AppData,
  config: Config,
  origin: ISODate,
  now: Now,
  fromDay = -1,
  toDay = 8,
): Timeline {
  const { settings } = data;
  const commitments: TimedItem[] = [];
  const shifts: TimedItem[] = [];
  const sessions: TimedSession[] = [];
  const blocks: TimedBlock[] = [];
  const sleep: Span[] = [];

  // Start one day early so anything that crosses midnight into fromDay is included.
  for (let day = fromDay - 1; day < toDay; day++) {
    const date = addDays(origin, day);
    const base = dayStart(day);
    const weekday = weekdayOf(date);

    for (const c of data.fixedCommitments) {
      if (c.weekday !== weekday) continue;
      const start = base + c.startMin;
      commitments.push({
        kind: c.kind, id: c.id, title: c.title, start, end: start + spanLength(c.startMin, c.endMin),
      });
    }

    // A bedtime before the wake time (01:00 to 08:00) is a night that starts after
    // midnight; otherwise the night runs from this evening into tomorrow morning.
    const sleepStart = base + settings.sleepStartMin;
    sleep.push({ start: sleepStart, end: sleepStart + spanLength(settings.sleepStartMin, settings.sleepEndMin) });

    for (const s of sessionsOn(date, data.trainingTemplates, data.trainingSessions)) {
      if (s.status === 'skipped') continue;
      const start = base + s.startMin;
      sessions.push({ session: s, start, end: start + s.durationMin });
    }
  }

  const firstDate = addDays(origin, fromDay - 1);
  const lastDate = addDays(origin, toDay - 1);
  const inRange = (date: ISODate) => date >= firstDate && date <= lastDate;

  for (const s of data.shifts) {
    if (!inRange(s.date)) continue;
    const start = dayStart(diffDays(origin, s.date)) + s.startMin;
    shifts.push({
      kind: 'shift', id: s.id, title: s.note || 'Work shift', start, end: start + spanLength(s.startMin, s.endMin),
    });
  }
  for (const b of data.blocks) {
    if (!inRange(b.date) || b.status === 'skipped') continue;
    const start = dayStart(diffDays(origin, b.date)) + b.startMin;
    blocks.push({ block: b, start, end: start + b.durationMin });
  }

  const byStart = (a: Span, b: Span) => a.start - b.start;
  return {
    origin, fromDay, toDay, config, settings,
    commitments: commitments.sort(byStart),
    shifts: shifts.sort(byStart),
    sessions: sessions.sort(byStart),
    blocks: blocks.sort(byStart),
    sleep: merge(sleep),
    dayLogs: new Map(data.dayLogs.map((l) => [l.date, l])),
    courses: new Map(data.courses.map((c) => [c.id, c])),
    assessments: data.assessments,
    nowAbs: dayStart(diffDays(origin, now.date)) + now.minute,
    today: now.date,
  };
}

/** Every span that takes time out of a day, other than sleep and study blocks. */
export function fixedSpans(tl: Timeline): Span[] {
  return [...tl.shifts, ...tl.commitments, ...tl.sessions];
}

/**
 * Waking time inside [lo, hi) that nothing is booked into.
 * Pass `ignore` to treat one item as absent, when looking for somewhere to move it.
 */
export function freeSpans(tl: Timeline, lo: number, hi: number, ignore?: Span): Span[] {
  // Free time is padded: nothing starts right after waking, right before bed, or
  // back-to-back with a class, shift, session or another block.
  const { afterWakeMin, beforeBedMin, breakMin } = tl.config.planner;
  const paddedSleep = tl.sleep.map((s) => ({ start: s.start - beforeBedMin, end: s.end + afterWakeMin }));
  const booked = [...fixedSpans(tl), ...tl.blocks]
    .filter((s) => s !== ignore)
    .map((s) => ({ start: s.start - breakMin, end: s.end + breakMin }));
  const busy = [...booked, ...paddedSleep].filter((s) => s.end > lo && s.start < hi);
  const free: Span[] = [];
  let cursor = lo;
  for (const b of merge(busy)) {
    if (b.end <= lo) continue;
    if (b.start >= hi) break;
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < hi) free.push({ start: cursor, end: hi });
  return free;
}
