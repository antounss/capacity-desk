import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/config/defaultConfig';
import { blocksToCsv, dayLogsToCsv, exportJson, importJson } from '../../src/domain/exportImport';
import { MON, TUE, assessment, block, commitment, course, data, h, session, shift, template } from '../helpers';

function sample() {
  const c = course({ name: 'Calculus' });
  const a = assessment(c.id, 40, { dueDate: '2026-10-20' });
  const d = data({
    fixedCommitments: [commitment(0, h(8), h(10))],
    shifts: [shift(TUE, h(22), h(2), { note: 'Night shift' })],
    trainingTemplates: [template(1, h(18))],
    trainingSessions: [session(MON, h(18), { status: 'done' })],
    blocks: [block(MON, h(9), 90, { courseId: c.id, assessmentId: a.id, status: 'done', energy: 4, title: 'Calculus: Assessment' })],
    dayLogs: [{ id: 'log1', date: MON, energy: 4, sleepHours: 7.5 }],
    courses: [c],
    assessments: [a],
  });
  d.settings = { ...d.settings, onboarded: true, sleepStartMin: h(23, 30), projectHoursPerWeek: 4 };
  d.configOverrides = { energy: { factors: { 2: 0.5 } } };
  return d;
}

describe('JSON backup', () => {
  it('export then import returns exactly the same data', () => {
    const original = sample();
    const result = importJson(exportJson(original, '2026-10-08T20:00:00Z'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(original);
      expect(result.warnings).toEqual([]);
    }
  });

  it('rejects files that are not a backup, with a reason the user can act on', () => {
    expect(importJson('not json')).toEqual({ ok: false, error: 'This file is not valid JSON.' });
    expect(importJson('{"hello": 1}')).toEqual({ ok: false, error: 'This is not a Capacity Desk backup file.' });
    expect(importJson('[]').ok).toBe(false);
    expect(importJson('null').ok).toBe(false);
  });

  it('refuses a backup from a newer app version instead of half-reading it', () => {
    const newer = JSON.stringify({ format: 'capacity-desk-backup', version: 99, data: {} });
    const result = importJson(newer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('newer version');
  });

  it('skips invalid rows and reports how many, keeping the valid ones', () => {
    const file = JSON.parse(exportJson(sample(), 'now'));
    file.data.blocks.push({ id: 'bad1', date: '2026-13-45', startMin: 0, durationMin: 60 }); // impossible date
    file.data.blocks.push({ ...file.data.blocks[0], id: 'bad2', energy: 9 }); // energy outside 1 to 5
    file.data.shifts.push('nonsense');
    const result = importJson(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(1);
      expect(result.data.shifts).toHaveLength(1);
      expect(result.warnings).toEqual([
        '1 invalid or duplicate row(s) skipped in shifts.',
        '2 invalid or duplicate row(s) skipped in blocks.',
      ]);
    }
  });

  it('drops assessments whose course is missing and clears block links that point nowhere', () => {
    const file = JSON.parse(exportJson(sample(), 'now'));
    file.data.courses = [];
    const result = importJson(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assessments).toEqual([]);
      expect(result.data.blocks[0].courseId).toBeNull();
      expect(result.data.blocks[0].assessmentId).toBeNull();
    }
  });

  it('bad settings fall back to defaults, and unknown fields are not carried into storage', () => {
    const file = JSON.parse(exportJson(sample(), 'now'));
    file.data.settings = { sleepStartMin: 'late', dailyOverheadMin: -50, minSessionsPerWeek: 5, injected: true };
    file.data.courses[0].extra = '<script>';
    const result = importJson(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings).toEqual({ ...defaultSettings, minSessionsPerWeek: 5 });
      expect(result.data.courses[0]).not.toHaveProperty('extra');
    }
  });
});

describe('CSV export', () => {
  it('writes one row per block with the course name', () => {
    const lines = blocksToCsv(sample()).trim().split('\r\n');
    expect(lines[0]).toBe('date,start,duration_min,category,title,course,status,energy_1_to_5');
    expect(lines[1]).toBe('2026-10-05,09:00,90,study,Calculus: Assessment,Calculus,done,4');
  });

  it('quotes commas and quotes, and defuses text a spreadsheet would run as a formula', () => {
    const d = data({ blocks: [block(MON, 0, 30, { title: 'Read "ch. 3", notes' }), block(TUE, 0, 30, { title: '=SUM(A1)' })] });
    const lines = blocksToCsv(d).trim().split('\r\n');
    expect(lines[1]).toContain('"Read ""ch. 3"", notes"');
    expect(lines[2]).toContain(",'=SUM(A1),");
  });

  it('exports check-ins, leaving unlogged values empty', () => {
    const d = data({ dayLogs: [{ id: 'l', date: MON, energy: null, sleepHours: 6 }] });
    expect(dayLogsToCsv(d)).toBe('date,energy_1_to_5,sleep_hours\r\n2026-10-05,,6\r\n');
  });
});
