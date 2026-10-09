import { describe, expect, it } from 'vitest';
import { clip, merge, subtract, total } from '../../src/domain/intervals';
import {
  addDays, diffDays, fmtDate, fmtHours, fmtTime, isValidDate, parseTime, spanLength, weekStartOf, weekdayOf,
} from '../../src/domain/time';

describe('dates', () => {
  it('knows 2026-10-08 is a Thursday (index 3, Monday = 0)', () => {
    expect(weekdayOf('2026-10-08')).toBe(3);
    expect(weekdayOf('2026-10-05')).toBe(0);
    expect(weekdayOf('2026-10-11')).toBe(6);
  });

  it('finds the Monday of a week, including from a Sunday', () => {
    expect(weekStartOf('2026-10-08')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05');
  });

  it('adds days across month, year and daylight-saving boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    // Lebanon moves its clocks in late March and late October. Dates must not shift.
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(diffDays('2026-10-05', '2026-10-14')).toBe(9);
  });

  it('rejects dates that do not exist', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
  });
});

describe('clock times', () => {
  it('measures a span that crosses midnight: 22:00 to 02:00 is 4 hours', () => {
    expect(spanLength(22 * 60, 2 * 60)).toBe(240);
    expect(spanLength(9 * 60, 17 * 60)).toBe(480);
  });

  it('formats and parses', () => {
    expect(fmtTime(18 * 60 + 30)).toBe('18:30');
    expect(fmtTime(1440 + 90)).toBe('01:30'); // minutes into the next day
    expect(fmtHours(90)).toBe('1.5');
    expect(fmtHours(120)).toBe('2');
    expect(fmtDate('2026-10-08')).toBe('Thu 8 Oct');
    expect(parseTime('07:05')).toBe(425);
    expect(parseTime('25:00')).toBeNull();
  });
});

describe('intervals', () => {
  it('merges touching and overlapping spans', () => {
    expect(merge([{ start: 5, end: 10 }, { start: 0, end: 5 }, { start: 8, end: 12 }])).toEqual([{ start: 0, end: 12 }]);
  });

  it('subtracts: 0-10 minus 2-4 and 8-20 leaves 0-2 and 4-8', () => {
    expect(subtract([{ start: 0, end: 10 }], [{ start: 2, end: 4 }, { start: 8, end: 20 }])).toEqual([
      { start: 0, end: 2 }, { start: 4, end: 8 },
    ]);
  });

  it('clips to a window and totals', () => {
    expect(total(clip([{ start: -30, end: 30 }, { start: 50, end: 500 }], 0, 100))).toBe(80);
  });
});
