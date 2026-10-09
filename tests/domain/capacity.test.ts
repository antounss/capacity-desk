import { describe, expect, it } from 'vitest';
import { dayCapacity, weekCapacity } from '../../src/domain/capacity';
import { FRI, MON, SAT, THU, block, commitment, data, h, session, shift, template, timeline } from '../helpers';

const hours = (min: number) => min / 60;

describe('weekly capacity', () => {
  it('empty week: 168 h - 56 h sleep - 14 h overhead = 98 h available, 7 h recovery, 91 h flexible', () => {
    // Defaults: sleep 23:00-07:00 (8 h/night), overhead 2 h/day, base recovery 1 h/day.
    const c = weekCapacity(timeline(data()));
    expect(hours(c.totalMin)).toBe(168);
    expect(hours(c.sleepMin)).toBe(56);
    expect(hours(c.overheadMin)).toBe(14);
    expect(hours(c.committedMin)).toBe(70);
    expect(hours(c.availableMin)).toBe(98);
    expect(hours(c.recoveryMin)).toBe(7);
    expect(hours(c.flexibleMin)).toBe(91);
    expect(hours(c.bufferMin)).toBe(91);
  });

  it('worked example: classes 20 h + training 4 h + shift 8 h + 20 h of study leaves a 34 h buffer', () => {
    // committed = 56 sleep + 14 overhead + 20 class + 4 training + 8 shift = 102 h
    // available = 168 - 102 = 66 h
    // recovery  = 7 base + 2 hard x 1.5 + 2 moderate x 1.0 = 12 h
    // flexible  = 66 - 12 = 54 h
    // buffer    = 54 - 20 planned = 34 h
    const d = data({
      fixedCommitments: [0, 1, 2, 3, 4].map((day) => commitment(day, h(8), h(12))),
      trainingTemplates: [
        template(0, h(18), { intensity: 3 }), template(1, h(18), { intensity: 2 }),
        template(3, h(18), { intensity: 3 }), template(4, h(18), { intensity: 2 }),
      ],
      shifts: [shift(SAT, h(10), h(18))],
      blocks: [0, 1, 2, 3, 4].map((day) => block(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'][day], h(13), 240)),
    });
    const c = weekCapacity(timeline(d));
    expect(hours(c.classMin)).toBe(20);
    expect(hours(c.trainingMin)).toBe(4);
    expect(hours(c.shiftMin)).toBe(8);
    expect(hours(c.committedMin)).toBe(102);
    expect(hours(c.availableMin)).toBe(66);
    expect(hours(c.recoveryMin)).toBe(12);
    expect(hours(c.flexibleMin)).toBe(54);
    expect(hours(c.workMin)).toBe(20);
    expect(hours(c.bufferMin)).toBe(34);
  });

  it('a skipped session takes no time and reserves no recovery', () => {
    const d = data({ trainingSessions: [session(MON, h(18), { intensity: 3, status: 'skipped' })] });
    const c = weekCapacity(timeline(d));
    expect(c.trainingMin).toBe(0);
    expect(hours(c.recoveryMin)).toBe(7);
  });
});

describe('edge cases', () => {
  it('shift crossing midnight (Thu 22:00 to Fri 02:00) is split across both days and eats into sleep', () => {
    // Thursday: shift 22:00-24:00 = 2 h. Sleep would be 00-07 + 23-24 = 8 h, minus the
    //           23-24 hour now worked = 7 h.
    // Friday:   shift 00:00-02:00 = 2 h. Sleep 00-07 minus 00-02, plus 23-24 = 6 h.
    const tl = timeline(data({ shifts: [shift(THU, h(22), h(2))] }));
    const thu = dayCapacity(tl, 3);
    const fri = dayCapacity(tl, 4);
    expect(hours(thu.shiftMin)).toBe(2);
    expect(hours(thu.sleepMin)).toBe(7);
    expect(hours(fri.shiftMin)).toBe(2);
    expect(hours(fri.sleepMin)).toBe(6);
    expect(hours(weekCapacity(tl).shiftMin)).toBe(4);
  });

  it('a shift from last Sunday night that ends Monday 01:00 counts 1 h on this Monday', () => {
    const tl = timeline(data({ shifts: [shift('2026-10-04', h(20), h(1))] }));
    expect(hours(dayCapacity(tl, 0).shiftMin)).toBe(1);
  });

  it('zero available hours: a fully booked day gives 0 flexible h and a negative buffer, never NaN', () => {
    // A 24-hour commitment on Monday. Overhead cannot be fitted, so it is 0 for the day.
    const d = data({
      fixedCommitments: [commitment(0, 0, 0, { kind: 'other', title: 'Travel day' })],
      blocks: [block(MON, h(10), 120)],
    });
    const mon = dayCapacity(timeline(d), 0);
    expect(mon.availableMin).toBe(0);
    expect(mon.overheadMin).toBe(0);
    expect(mon.flexibleMin).toBe(0);
    expect(mon.bufferMin).toBe(-120);
    for (const value of Object.values(mon)) expect(Number.isFinite(value)).toBe(true);
  });

  it('overlapping commitments are counted once: class 08-12 with a commute entered 11:30-12:30', () => {
    const d = data({
      fixedCommitments: [commitment(0, h(8), h(12)), commitment(0, h(11, 30), h(12, 30), { kind: 'commute', title: 'Bus' })],
    });
    const mon = dayCapacity(timeline(d), 0);
    expect(hours(mon.classMin)).toBe(4);
    expect(hours(mon.otherFixedMin)).toBe(0.5);
  });

  it('a bedtime after midnight (01:00 to 08:30) is still 7.5 h per day', () => {
    const d = data();
    d.settings = { ...d.settings, sleepStartMin: h(1), sleepEndMin: h(8, 30) };
    expect(hours(dayCapacity(timeline(d), 2).sleepMin)).toBe(7.5);
  });

  it('done and planned blocks both count as work; skipped ones do not', () => {
    const d = data({
      blocks: [block(FRI, h(9), 90, { status: 'done' }), block(FRI, h(14), 60), block(FRI, h(16), 60, { status: 'skipped' })],
    });
    const fri = dayCapacity(timeline(d), 4);
    expect(fri.workMin).toBe(150);
    expect(fri.doneMin).toBe(90);
  });
});
