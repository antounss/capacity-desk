// Display names for stored values, in one place.

import type { AssessmentKind, Intensity, LoadGroup } from '../domain/types';
import { WEEKDAYS_LONG } from '../domain/time';

export const LOAD_LABEL: Record<LoadGroup, string> = {
  legs: 'Legs', push: 'Push', pull: 'Pull', full: 'Full body', cardio: 'Cardio', skill: 'Skill / core',
};
export const INTENSITY_LABEL: Record<Intensity, string> = { 1: 'Light', 2: 'Moderate', 3: 'Hard' };
export const KIND_LABEL: Record<AssessmentKind, string> = {
  exam: 'Exam', midterm: 'Midterm', project: 'Project', lab: 'Lab', quiz: 'Quiz', other: 'Other',
};
export const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: 'Light', 2: 'Medium', 3: 'Hard' };

export const WEEKDAY_OPTIONS = WEEKDAYS_LONG.map((label, value) => ({ value, label }));
export const LOAD_OPTIONS = (Object.keys(LOAD_LABEL) as LoadGroup[]).map((value) => ({ value, label: LOAD_LABEL[value] }));
export const INTENSITY_OPTIONS = ([1, 2, 3] as Intensity[]).map((value) => ({ value, label: INTENSITY_LABEL[value] }));
export const KIND_OPTIONS = (Object.keys(KIND_LABEL) as AssessmentKind[]).map((value) => ({ value, label: KIND_LABEL[value] }));
export const DIFFICULTY_OPTIONS = ([1, 2, 3] as const).map((value) => ({ value, label: DIFFICULTY_LABEL[value] }));
