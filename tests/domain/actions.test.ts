import { describe, expect, it } from 'vitest';
import { nextAssessmentId, removeAssessment, removeCourse, removeTemplate } from '../../src/app/actions';
import { applyMutations } from '../../src/domain/fixes';
import { MON, assessment, block, course, data, h, session, template } from '../helpers';

describe('cascading deletes', () => {
  it('deleting a course removes its assessments and unlinks its blocks, keeping the logged time', () => {
    const calc = course();
    const other = course();
    const exam = assessment(calc.id, 50);
    const kept = assessment(other.id, 50);
    const d = data({
      courses: [calc, other],
      assessments: [exam, kept],
      blocks: [block(MON, h(9), 60, { courseId: calc.id, assessmentId: exam.id, status: 'done' }), block(MON, h(11), 60, { courseId: other.id })],
    });
    const after = applyMutations(d, removeCourse(d, calc.id));
    expect(after.courses).toEqual([other]);
    expect(after.assessments).toEqual([kept]);
    expect(after.blocks).toHaveLength(2);
    expect(after.blocks[0]).toMatchObject({ courseId: null, assessmentId: null, status: 'done' });
    expect(after.blocks[1].courseId).toBe(other.id);
  });

  it('deleting an assessment unlinks blocks but keeps them on the course', () => {
    const c = course();
    const a = assessment(c.id, 50);
    const d = data({ courses: [c], assessments: [a], blocks: [block(MON, h(9), 60, { courseId: c.id, assessmentId: a.id })] });
    const after = applyMutations(d, removeAssessment(d, a.id));
    expect(after.blocks[0]).toMatchObject({ courseId: c.id, assessmentId: null });
  });

  it('deleting a template drops its pending per-week changes but keeps sessions already done', () => {
    const t = template(1, h(18));
    const moved = session(MON, h(18), { templateId: t.id });
    const done = session(MON, h(18), { templateId: t.id, weekStart: '2026-09-28', date: '2026-09-29', status: 'done' });
    const d = data({ trainingTemplates: [t], trainingSessions: [moved, done] });
    const after = applyMutations(d, removeTemplate(d, t.id));
    expect(after.trainingTemplates).toEqual([]);
    expect(after.trainingSessions).toEqual([done]);
  });
});

describe('attaching a logged block to an assessment', () => {
  it('picks the nearest ungraded assessment that is not past due', () => {
    const c = course();
    const past = assessment(c.id, 20, { dueDate: '2026-10-01' });
    const graded = assessment(c.id, 20, { dueDate: '2026-10-07', scorePercent: 80 });
    const next = assessment(c.id, 30, { dueDate: '2026-10-12' });
    const later = assessment(c.id, 30, { dueDate: '2026-11-12' });
    const d = data({ courses: [c], assessments: [later, past, graded, next] });
    expect(nextAssessmentId(d, c.id, MON)).toBe(next.id);
    expect(nextAssessmentId(d, 'missing', MON)).toBeNull();
  });
});
