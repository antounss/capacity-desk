import { describe, expect, it } from 'vitest';
import { analyzeWeek } from '../../src/domain/analyze';
import { overlap } from '../../src/domain/intervals';
import { findSlot } from '../../src/domain/planner';
import { diffDays } from '../../src/domain/time';
import { FRI, MON, THU, WED, WEEK_START, assessment, block, commitment, course, data, h, session, timeline } from '../helpers';
import type { AppData } from '../../src/domain/types';

function plan(d: AppData, now = WEEK_START) {
  return analyzeWeek(d, MON, now).plan;
}

describe('block suggestions', () => {
  it('fills the best-energy free slots first: with mornings free, every suggestion starts in the morning band', () => {
    const c = course({ name: 'Calculus', difficulty: 3 });
    const exam = assessment(c.id, 30, { dueDate: '2026-10-12', targetHours: 6 });
    const { suggestions, unplaced } = plan(data({ courses: [c], assessments: [exam] }));
    expect(unplaced).toEqual([]);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.block.startMin).toBeGreaterThanOrEqual(h(7));
      expect(s.block.startMin).toBeLessThan(h(12));
      expect(s.factor).toBeCloseTo(0.75);
    }
    // Enough effective time is suggested to cover the 6 h target.
    const effective = suggestions.reduce((sum, s) => sum + s.block.durationMin * s.factor, 0);
    expect(effective).toBeGreaterThanOrEqual(6 * 60 - 1);
  });

  it('never suggests a slot on top of a class, training or sleep', () => {
    const c = course();
    const d = data({
      courses: [c],
      assessments: [assessment(c.id, 50, { dueDate: '2026-10-12', targetHours: 20 })],
      fixedCommitments: [0, 1, 2, 3, 4].map((day) => commitment(day, h(8), h(13))),
      trainingSessions: [session(MON, h(18)), session(WED, h(18)), session(FRI, h(18))],
    });
    const result = analyzeWeek(d, MON, WEEK_START);
    const busy = [...result.tl.commitments, ...result.tl.sessions, ...result.tl.sleep];
    for (const s of result.plan.suggestions) {
      const start = diffDays(MON, s.block.date) * 1440 + s.block.startMin;
      const span = { start, end: start + s.block.durationMin };
      expect(busy.every((b) => overlap(b, span) === 0)).toBe(true);
    }
  });

  it('gives the higher-energy slot to the hard course when two courses compete', () => {
    // Monday is walled off except two one-hour windows (a 15-minute pause is kept after
    // each wall): 09:15 in the morning band (1.00) and 19:15 in the evening band (0.85).
    // The light course has the higher priority, so it is placed first and takes the
    // morning. The swap step then hands the morning to the hard course.
    const light = course({ name: 'Light', difficulty: 1, credits: 4 });
    const hard = course({ name: 'Hard', difficulty: 3, credits: 3 });
    const walls = [
      commitment(0, h(7), h(9), { kind: 'other' }),
      commitment(0, h(10, 30), h(19), { kind: 'other' }),
      commitment(0, h(20, 30), h(23), { kind: 'other' }),
    ];
    const d = data({
      courses: [light, hard],
      assessments: [
        assessment(light.id, 100, { dueDate: '2026-10-06', targetHours: 0.5 }),
        assessment(hard.id, 100, { dueDate: '2026-10-06', targetHours: 0.5 }),
      ],
      fixedCommitments: walls,
    });
    // Overhead and base recovery are set to 0 here so the 3 free hours are all flexible.
    d.settings = { ...d.settings, dailyOverheadMin: 0 };
    d.configOverrides = { recovery: { baseHoursPerDay: 0 } };
    const { suggestions, unplaced } = plan(d);
    expect(unplaced).toEqual([]);
    const hardBlock = suggestions.find((s) => s.block.courseId === hard.id)!;
    const lightBlock = suggestions.find((s) => s.block.courseId === light.id)!;
    expect(hardBlock.block.startMin).toBe(h(9, 15));
    expect(lightBlock.block.startMin).toBe(h(19, 15));
    expect(hardBlock.reason).toContain('Hard course');
  });

  it('leaves a pause after a class instead of starting a block the minute it ends', () => {
    const c = course();
    const d = data({
      courses: [c],
      assessments: [assessment(c.id, 100, { dueDate: '2026-10-06', targetHours: 1 })],
      fixedCommitments: [commitment(0, h(8), h(10))],
    });
    const [first] = plan(d).suggestions;
    expect(first.block.startMin).toBe(h(10, 15));
  });

  it('places nothing after the due date and reports what did not fit', () => {
    // Due Tuesday, so only Monday counts. Monday is walled off except 90 minutes.
    const c = course();
    const d = data({
      courses: [c],
      assessments: [assessment(c.id, 100, { dueDate: '2026-10-06', targetHours: 10 })],
      fixedCommitments: [commitment(0, h(7), h(21, 30), { kind: 'other', title: 'Field trip' })],
    });
    const { suggestions, unplaced } = plan(d);
    expect(suggestions.every((s) => s.block.date === MON)).toBe(true);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0].missingMin).toBeGreaterThan(0);
  });

  it('stops at the daily focus ceiling (5 h) even when the day is empty', () => {
    const c = course();
    const d = data({ courses: [c], assessments: [assessment(c.id, 100, { dueDate: '2026-10-06', targetHours: 30 })] });
    const monday = plan(d).suggestions.filter((s) => s.block.date === MON);
    expect(monday.reduce((sum, s) => sum + s.block.durationMin, 0)).toBeLessThanOrEqual(300);
  });

  it('suggests nothing in the past: on Thursday 15:00 the earliest suggestion is Thursday 15:00', () => {
    const c = course();
    const d = data({ courses: [c], assessments: [assessment(c.id, 100, { dueDate: '2026-10-12', targetHours: 30 })] });
    const now = { date: THU, minute: h(15) };
    for (const s of plan(d, now).suggestions) {
      expect(s.block.date > THU || (s.block.date === THU && s.block.startMin >= h(15))).toBe(true);
    }
  });

  it('with nothing to study and no project target, it suggests nothing', () => {
    expect(plan(data()).suggestions).toEqual([]);
  });
});

describe('finding a slot to move something into', () => {
  it('picks the highest-energy free start: Friday morning beats Thursday evening', () => {
    const d = data({ blocks: [block(THU, h(18), 90)] });
    const tl = timeline(d, { date: THU, minute: h(17) });
    const slot = findSlot(tl, 90, 0, 7 * 1440, tl.blocks[0])!;
    expect(Math.floor(slot.start / 1440)).toBe(4); // Friday
    expect(slot.start % 1440).toBe(h(8)); // wake-up is 07:00 and the first hour is left alone
  });
});
