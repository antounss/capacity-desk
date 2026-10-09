// Small builders so each test states only the facts it is about.
// The reference week is Monday 2026-10-05 to Sunday 2026-10-11.

import { defaultConfig, emptyData } from '../src/config/defaultConfig';
import { buildTimeline } from '../src/domain/timeline';
import type {
  AppData, Assessment, Block, Config, Course, FixedCommitment, Now, Shift, TrainingSession, TrainingTemplate,
} from '../src/domain/types';

export const MON = '2026-10-05';
export const TUE = '2026-10-06';
export const WED = '2026-10-07';
export const THU = '2026-10-08';
export const FRI = '2026-10-09';
export const SAT = '2026-10-10';
export const SUN = '2026-10-11';

/** Monday 00:00: the whole week is still ahead. */
export const WEEK_START: Now = { date: MON, minute: 0 };

export const h = (hours: number, minutes = 0) => hours * 60 + minutes;

let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;

export function data(partial: Partial<AppData> = {}): AppData {
  return { ...emptyData(), ...partial };
}

export function commitment(weekday: number, startMin: number, endMin: number, p: Partial<FixedCommitment> = {}): FixedCommitment {
  return { id: nextId('c'), kind: 'class', title: 'Class', weekday, startMin, endMin, ...p };
}

export function shift(date: string, startMin: number, endMin: number, p: Partial<Shift> = {}): Shift {
  return { id: nextId('s'), date, startMin, endMin, note: '', ...p };
}

export function template(weekday: number, startMin: number, p: Partial<TrainingTemplate> = {}): TrainingTemplate {
  return { id: nextId('t'), weekday, startMin, durationMin: 60, name: 'Session', load: 'push', intensity: 2, ...p };
}

export function session(date: string, startMin: number, p: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: nextId('ts'), templateId: null, weekStart: MON, date, startMin, durationMin: 60,
    name: 'Session', load: 'push', intensity: 2, status: 'planned', ...p,
  };
}

export function block(date: string, startMin: number, durationMin: number, p: Partial<Block> = {}): Block {
  return {
    id: nextId('b'), date, startMin, durationMin, category: 'study', title: 'Study',
    courseId: null, assessmentId: null, status: 'planned', energy: null, ...p,
  };
}

export function course(p: Partial<Course> = {}): Course {
  return { id: nextId('course'), name: 'Course', credits: 3, difficulty: 2, targetPercent: 90, ...p };
}

export function assessment(courseId: string, weightPercent: number, p: Partial<Assessment> = {}): Assessment {
  return {
    id: nextId('a'), courseId, name: 'Assessment', kind: 'exam', weightPercent,
    dueDate: null, scorePercent: null, targetHours: null, ...p,
  };
}

export function timeline(d: AppData, now: Now = WEEK_START, config: Config = defaultConfig) {
  return buildTimeline(d, config, MON, now, -1, 22);
}
