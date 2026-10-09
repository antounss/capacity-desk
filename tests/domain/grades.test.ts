import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config/defaultConfig';
import { courseStanding, semesterSummary, targetHoursFor } from '../../src/domain/grades';
import { assessment, course } from '../helpers';

describe('required score', () => {
  it('worked example: target 90, midterm 30% at 85 and quiz 10% at 92 -> need 92.2% on the remaining 60%', () => {
    // earned   = 0.30 x 85 + 0.10 x 92 = 25.5 + 9.2 = 34.7 points
    // required = (90 - 34.7) / 0.60 = 92.17%
    const c = course({ targetPercent: 90 });
    const s = courseStanding(c, [
      assessment(c.id, 30, { kind: 'midterm', scorePercent: 85 }),
      assessment(c.id, 10, { kind: 'quiz', scorePercent: 92 }),
      assessment(c.id, 40, { kind: 'exam' }),
      assessment(c.id, 20, { kind: 'project' }),
    ]);
    expect(s.earnedPoints).toBeCloseTo(34.7);
    expect(s.gradedWeight).toBeCloseTo(40);
    expect(s.remainingWeight).toBeCloseTo(60);
    expect(s.currentAverage).toBeCloseTo(86.75);
    expect(s.requiredAverage).toBeCloseTo(92.1667, 3);
    expect(s.status).toBe('stretch'); // 92.2 needed against 86.75 so far
    expect(s.needs).toHaveLength(2);
    expect(s.steps.join(' ')).toContain('(90 - 34.7) / 60% = 92.2%');
  });

  it('nothing graded: the required average is the target itself', () => {
    const c = course({ targetPercent: 88 });
    const s = courseStanding(c, [assessment(c.id, 50), assessment(c.id, 50)]);
    expect(s.requiredAverage).toBeCloseTo(88);
    expect(s.currentAverage).toBeNull();
    expect(s.status).toBe('on-track');
  });

  it('secured: 60% graded at 100 with a target of 60 needs 0% on the rest', () => {
    const c = course({ targetPercent: 60 });
    const s = courseStanding(c, [assessment(c.id, 60, { scorePercent: 100 }), assessment(c.id, 40)]);
    expect(s.requiredAverage).toBeCloseTo(0);
    expect(s.status).toBe('secured');
  });

  it('unreachable: 50% graded at 60 with a target of 90 needs 120%; best possible final is 80', () => {
    // earned = 30. required = (90 - 30) / 0.50 = 120%. max final = 30 + 50 = 80.
    const c = course({ targetPercent: 90 });
    const s = courseStanding(c, [assessment(c.id, 50, { scorePercent: 60 }), assessment(c.id, 50)]);
    expect(s.requiredAverage).toBeCloseTo(120);
    expect(s.maxFinal).toBeCloseTo(80);
    expect(s.status).toBe('unreachable');
  });

  it('everything graded: reports the final grade and whether the target was met', () => {
    const c = course({ targetPercent: 90 });
    const met = courseStanding(c, [assessment(c.id, 50, { scorePercent: 95 }), assessment(c.id, 50, { scorePercent: 90 })]);
    expect(met.requiredAverage).toBeNull();
    expect(met.status).toBe('final-met');
    const missed = courseStanding(c, [assessment(c.id, 100, { scorePercent: 70 })]);
    expect(missed.status).toBe('final-missed');
  });
});

describe('weights that do not sum to 100%', () => {
  it('under 100: the missing share is treated as ungraded work, and flagged', () => {
    // Midterm 30% at 80 and final 40% entered; 30% of the course not entered yet.
    // earned = 24. remaining = 40 + 30 unassigned = 70. required = (90 - 24) / 0.70 = 94.3%.
    const c = course({ targetPercent: 90 });
    const s = courseStanding(c, [assessment(c.id, 30, { scorePercent: 80 }), assessment(c.id, 40)]);
    expect(s.weightIssue).toBe('under');
    expect(s.unassignedWeight).toBeCloseTo(30);
    expect(s.requiredAverage).toBeCloseTo(94.2857, 3);
    expect(s.steps[0]).toContain('Weights add up to 70%');
  });

  it('over 100: weights are scaled to 100 and flagged, never used as entered', () => {
    // 60 + 60 = 120 -> each scaled to 50. earned = 50 x 80 / 100 = 40. required = (90 - 40) / 0.50 = 100%.
    const c = course({ targetPercent: 90 });
    const s = courseStanding(c, [assessment(c.id, 60, { scorePercent: 80 }), assessment(c.id, 60)]);
    expect(s.weightIssue).toBe('over');
    expect(s.earnedPoints).toBeCloseTo(40);
    expect(s.requiredAverage).toBeCloseTo(100);
    expect(s.steps[0]).toContain('Scaled down to 100%');
  });

  it('33.3 + 33.3 + 33.4 counts as 100, not as a rounding error', () => {
    const c = course();
    expect(courseStanding(c, [assessment(c.id, 33.3), assessment(c.id, 33.3), assessment(c.id, 33.4)]).weightIssue).toBe('ok');
  });

  it('a course with no assessments yet does not crash and asks for the target on 100%', () => {
    const c = course({ targetPercent: 85 });
    const s = courseStanding(c, []);
    expect(s.status).toBe('no-assessments');
    expect(s.requiredAverage).toBeCloseTo(85);
  });
});

describe('defaults and semester view', () => {
  it('default target hours: 30% x 0.4 = 12 h for a medium course, x1.25 = 15 h for a hard one', () => {
    const medium = course({ difficulty: 2 });
    const hard = course({ difficulty: 3 });
    expect(targetHoursFor(assessment(medium.id, 30), medium, defaultConfig)).toBeCloseTo(12);
    expect(targetHoursFor(assessment(hard.id, 30), hard, defaultConfig)).toBeCloseTo(15);
    expect(targetHoursFor(assessment(hard.id, 30, { targetHours: 14 }), hard, defaultConfig)).toBe(14);
  });

  it('semester average is credit-weighted: 80 in 3 credits and 90 in 1 credit -> 82.5', () => {
    const a = course({ credits: 3 });
    const b = course({ credits: 1 });
    const summary = semesterSummary([
      courseStanding(a, [assessment(a.id, 50, { scorePercent: 80 }), assessment(a.id, 50)]),
      courseStanding(b, [assessment(b.id, 50, { scorePercent: 90 }), assessment(b.id, 50)]),
    ]);
    expect(summary.totalCredits).toBe(4);
    expect(summary.currentAverage).toBeCloseTo(82.5);
  });
});
