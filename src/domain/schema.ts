// One description of every stored entity's fields. It is used twice:
//  - to validate rows coming in from a JSON import, and
//  - to map entities to and from SQLite columns (src/data/repository.ts).
// Keeping a single description means the backup format and the database cannot drift.

import { defaultSettings } from '../config/defaultConfig';
import type { AppData, CollectionName, Settings } from './types';
import { isValidDate } from './time';

export interface Field {
  type: 'text' | 'int' | 'real' | 'bool' | 'date';
  nullable?: true;
  /** Allowed values, for enum-like fields. */
  values?: readonly (string | number)[];
  min?: number;
  max?: number;
}

type EntityOf<K extends CollectionName> = AppData[K][number];
type FieldsOf<K extends CollectionName> = Record<keyof EntityOf<K> & string, Field>;

const id: Field = { type: 'text' };
const clock: Field = { type: 'int', min: 0, max: 1439 };
const weekday: Field = { type: 'int', min: 0, max: 6 };
const duration: Field = { type: 'int', min: 1, max: 1440 };
const level: Field = { type: 'int', values: [1, 2, 3, 4, 5], nullable: true };
const intensity: Field = { type: 'int', values: [1, 2, 3] };
const load: Field = { type: 'text', values: ['legs', 'push', 'pull', 'full', 'cardio', 'skill'] };
const status: Field = { type: 'text', values: ['planned', 'done', 'skipped'] };

export const ENTITY_FIELDS: { [K in CollectionName]: FieldsOf<K> } = {
  fixedCommitments: {
    id, kind: { type: 'text', values: ['class', 'commute', 'other'] }, title: { type: 'text' },
    weekday, startMin: clock, endMin: clock,
  },
  shifts: { id, date: { type: 'date' }, startMin: clock, endMin: clock, note: { type: 'text' } },
  trainingTemplates: {
    id, weekday, startMin: clock, durationMin: duration, name: { type: 'text' }, load, intensity,
  },
  trainingSessions: {
    id, templateId: { type: 'text', nullable: true }, weekStart: { type: 'date' }, date: { type: 'date' },
    startMin: clock, durationMin: duration, name: { type: 'text' }, load, intensity, status,
  },
  blocks: {
    id, date: { type: 'date' }, startMin: clock, durationMin: duration,
    category: { type: 'text', values: ['study', 'project'] }, title: { type: 'text' },
    courseId: { type: 'text', nullable: true }, assessmentId: { type: 'text', nullable: true },
    status, energy: level,
  },
  dayLogs: {
    id, date: { type: 'date' }, energy: level, sleepHours: { type: 'real', nullable: true, min: 0, max: 24 },
  },
  courses: {
    id, name: { type: 'text' }, credits: { type: 'real', min: 0, max: 60 },
    difficulty: { type: 'int', values: [1, 2, 3] }, targetPercent: { type: 'real', min: 0, max: 100 },
  },
  assessments: {
    id, courseId: { type: 'text' }, name: { type: 'text' },
    kind: { type: 'text', values: ['exam', 'midterm', 'project', 'lab', 'quiz', 'other'] },
    weightPercent: { type: 'real', min: 0, max: 100 }, dueDate: { type: 'date', nullable: true },
    scorePercent: { type: 'real', nullable: true, min: 0, max: 200 },
    targetHours: { type: 'real', nullable: true, min: 0, max: 500 },
  },
};

export const COLLECTIONS = Object.keys(ENTITY_FIELDS) as CollectionName[];

function fieldAccepts(field: Field, value: unknown): boolean {
  if (value === null || value === undefined) return field.nullable === true;
  if (field.values) return field.values.includes(value as string | number);
  switch (field.type) {
    case 'text': return typeof value === 'string';
    case 'bool': return typeof value === 'boolean';
    case 'date': return isValidDate(value);
    case 'int':
    case 'real': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (field.type === 'int' && !Number.isInteger(value)) return false;
      return value >= (field.min ?? -Infinity) && value <= (field.max ?? Infinity);
    }
  }
}

/** Returns a clean copy with only the known fields, or null when a field is invalid. */
export function validateEntity<K extends CollectionName>(collection: K, raw: unknown): EntityOf<K> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const fields = ENTITY_FIELDS[collection] as Record<string, Field>;
  const source = raw as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = source[name] ?? null;
    if (!fieldAccepts(field, value)) return null;
    clean[name] = value;
  }
  if (clean.id === '') return null;
  return clean as unknown as EntityOf<K>;
}

/** Settings from an untrusted source: every missing or invalid value falls back to the default. */
export function validateSettings(raw: unknown): Settings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...defaultSettings } as Record<string, unknown>;
  const limits: Partial<Record<keyof Settings, [number, number]>> = {
    sleepStartMin: [0, 1439], sleepEndMin: [0, 1439], dailyOverheadMin: [0, 720],
    minSessionsPerWeek: [0, 14], projectHoursPerWeek: [0, 80], trainingLeadMin: [0, 240],
  };
  for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {
    const value = source[key];
    if (typeof value !== typeof defaultSettings[key]) continue;
    const range = limits[key];
    if (range && (!Number.isFinite(value) || (value as number) < range[0] || (value as number) > range[1])) continue;
    out[key] = value;
  }
  return out as unknown as Settings;
}
