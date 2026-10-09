import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeWeek } from '../../src/domain/analyze';
import { importJson } from '../../src/domain/exportImport';
import { weekStartOf } from '../../src/domain/time';

// docs/sample-data.json is what a new user is told to import to try the app, so it
// has to stay valid as the schema changes.
describe('the sample backup in docs/', () => {
  const result = importJson(readFileSync(new URL('../../docs/sample-data.json', import.meta.url), 'utf8'));

  it('imports with nothing skipped', () => {
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('analyses cleanly and shows the conflicts it was built to show', () => {
    if (!result.ok) throw new Error(result.error);
    const thursday = result.data.shifts[0].date;
    const analysis = analyzeWeek(result.data, weekStartOf(thursday), { date: thursday, minute: 10 * 60 + 30 });
    const rules = analysis.conflicts.map((c) => c.rule);
    expect(rules).toContain('overlap');
    expect(rules).toContain('exam-gap');
    expect(analysis.top3).toHaveLength(3);
    expect(analysis.standings.find((s) => s.course.name === 'Technical Writing')?.weightIssue).toBe('under');
  });
});
