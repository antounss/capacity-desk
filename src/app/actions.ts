// Changes that touch more than one row, written as pure functions that return
// mutations. The store applies them in one transaction.

import type { Mutation } from '../domain/fixes';
import type { AppData } from '../domain/types';

/** Deleting a course also deletes its assessments and unlinks blocks that pointed at them. */
export function removeCourse(data: AppData, courseId: string): Mutation[] {
  const assessments = data.assessments.filter((a) => a.courseId === courseId);
  const gone = new Set(assessments.map((a) => a.id));
  return [
    { op: 'remove', collection: 'courses', id: courseId },
    ...assessments.map((a): Mutation => ({ op: 'remove', collection: 'assessments', id: a.id })),
    ...data.blocks
      .filter((b) => b.courseId === courseId || (b.assessmentId && gone.has(b.assessmentId)))
      .map((b): Mutation => ({ op: 'upsert', collection: 'blocks', entity: { ...b, courseId: null, assessmentId: null } })),
  ];
}

export function removeAssessment(data: AppData, assessmentId: string): Mutation[] {
  return [
    { op: 'remove', collection: 'assessments', id: assessmentId },
    ...data.blocks
      .filter((b) => b.assessmentId === assessmentId)
      .map((b): Mutation => ({ op: 'upsert', collection: 'blocks', entity: { ...b, assessmentId: null } })),
  ];
}

/** Deleting a template also deletes the per-week changes that were made to it. */
export function removeTemplate(data: AppData, templateId: string): Mutation[] {
  return [
    { op: 'remove', collection: 'trainingTemplates', id: templateId },
    ...data.trainingSessions
      .filter((s) => s.templateId === templateId && s.status === 'planned')
      .map((s): Mutation => ({ op: 'remove', collection: 'trainingSessions', id: s.id })),
  ];
}

/** The next ungraded assessment of a course, used to attach a logged block to it. */
export function nextAssessmentId(data: AppData, courseId: string, today: string): string | null {
  const open = data.assessments
    .filter((a) => a.courseId === courseId && a.scorePercent == null && (!a.dueDate || a.dueDate >= today))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  return open[0]?.id ?? null;
}
