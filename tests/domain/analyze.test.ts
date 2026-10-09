import { describe, expect, it } from 'vitest';
import { resolveConfig, defaultConfig } from '../../src/config/defaultConfig';
import { analyzeWeek } from '../../src/domain/analyze';
import { MON, WED, WEEK_START, assessment, block, course, data, h } from '../helpers';

describe('the whole analysis', () => {
  it('a brand-new install with no data produces a clean, finite result', () => {
    const result = analyzeWeek(data(), MON, WEEK_START);
    expect(result.conflicts).toEqual([]);
    expect(result.top3).toEqual([]);
    expect(result.plan.suggestions).toEqual([]);
    expect(result.semester).toEqual({ totalCredits: 0, targetAverage: null, currentAverage: null });
    for (const value of Object.values(result.week)) expect(Number.isFinite(value)).toBe(true);
  });

  it('lists planned blocks whose time has passed without being confirmed', () => {
    const d = data({ blocks: [block(MON, h(9), 60), block(MON, h(14), 60, { status: 'done' }), block(WED, h(18), 60)] });
    const result = analyzeWeek(d, MON, { date: WED, minute: h(12) });
    expect(result.unconfirmed.map((b) => b.block.startMin)).toEqual([h(9)]);
  });

  it('counts effective hours toward an exam even from blocks logged weeks before the week in view', () => {
    const c = course();
    const exam = assessment(c.id, 100, { dueDate: '2026-10-16', targetHours: 10 });
    const d = data({
      courses: [c], assessments: [exam],
      blocks: [block('2026-09-14', h(9), 120, { assessmentId: exam.id, status: 'done', energy: 5 })],
    });
    const result = analyzeWeek(d, MON, WEEK_START);
    expect(result.ranked[0].doneMin).toBeCloseTo(120);
  });

  it('a zero-credit course or zero-weight assessment cannot divide by zero', () => {
    const c = course({ credits: 0 });
    const d = data({ courses: [c], assessments: [assessment(c.id, 0, { dueDate: '2026-10-09' })] });
    const result = analyzeWeek(d, MON, WEEK_START);
    for (const t of result.ranked) expect(Number.isFinite(t.score)).toBe(true);
  });
});

describe('config overrides', () => {
  it('a corrupt override is ignored field by field and the defaults stand', () => {
    const config = resolveConfig({
      energy: { factors: { 1: Number.NaN, 2: 'high' as unknown as number }, baselineLevel: 4 },
      planner: 'broken' as unknown as object,
    });
    expect(config.energy.factors[1]).toBe(defaultConfig.energy.factors[1]);
    expect(config.energy.factors[2]).toBe(defaultConfig.energy.factors[2]);
    expect(config.energy.baselineLevel).toBe(4);
    expect(config.planner).toEqual(defaultConfig.planner);
  });

  it('rest rules are replaced as a whole list, so a rule can be removed', () => {
    const config = resolveConfig({ training: { restRules: [{ id: 'legs', groups: ['legs'], minIntensity: 3, minGapHours: 72 }] } });
    expect(config.training.restRules).toHaveLength(1);
    expect(config.training.restRules[0].minGapHours).toBe(72);
  });
});
