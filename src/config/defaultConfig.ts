// THE tuning file. Every number the model uses is here, with the reason for its default.
// Change a value here to change the shipped default, or change it in the app under
// Settings > Tuning, which stores an override on top of these values.
//
// None of these numbers is a measurement of you. They are starting rules of thumb.
// Log energy for two or three weeks, then adjust them to match what you observe.

import type { AppData, Config, DeepPartial, Settings } from '../domain/types';

export const defaultConfig: Config = {
  energy: {
    // effective_hours = duration x factor[energy level].
    // A 3 h block at energy 2 counts as 3 x 0.55 = 1.65 focused hours.
    factors: { 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.9, 5: 1.0 },
    // Assumed level for a day or block with no energy logged.
    baselineLevel: 3,
    // How usable each part of the day is. Shift these if you are a night person.
    timeOfDay: [
      { label: 'morning', fromMin: 5 * 60, toMin: 12 * 60, multiplier: 1.0 },
      { label: 'afternoon', fromMin: 12 * 60, toMin: 17 * 60, multiplier: 0.9 },
      { label: 'evening', fromMin: 17 * 60, toMin: 21 * 60, multiplier: 0.85 },
      { label: 'late', fromMin: 21 * 60, toMin: 5 * 60, multiplier: 0.7 },
    ],
  },

  carryover: {
    // Multiplier on the NEXT day's energy factor, by the hardest session of the day before.
    trainingMultiplier: { 1: 1.0, 2: 0.97, 3: 0.9 },
    // A night shorter than this counts as a short night...
    shortNightHours: 6.5,
    // ...and multiplies the next day's factor by this.
    shortNightMultiplier: 0.85,
    // Carryover never pushes a day below this share of baseline.
    floor: 0.6,
    // The dip in the hours right after a hard session on the same day.
    postTraining: { minIntensity: 3, windowMin: 120, multiplier: 0.85 },
  },

  recovery: {
    // Downtime reserved every day before anything else is planned.
    baseHoursPerDay: 1.0,
    // Extra recovery reserved for each session, by intensity.
    hoursPerSession: { 1: 0.5, 2: 1.0, 3: 1.5 },
  },

  training: {
    // Minimum gap between sessions that load the same thing.
    // "full" body sessions count against every strength group.
    restRules: [
      { id: 'legs', groups: ['legs', 'full'], minIntensity: 2, minGapHours: 48 },
      { id: 'push', groups: ['push', 'full'], minIntensity: 3, minGapHours: 36 },
      { id: 'pull', groups: ['pull', 'full'], minIntensity: 3, minGapHours: 36 },
    ],
    // Training more consecutive days than this raises a "no rest day" conflict.
    maxConsecutiveDays: 6,
  },

  planner: {
    // Length of a suggested focus block, and the shortest block worth suggesting.
    blockMin: 90,
    minBlockMin: 45,
    // Pause left between two suggested blocks.
    breakMin: 15,
    // Focused work beyond this many hours in one day is flagged, not counted on.
    maxFocusHoursPerDay: 5,
    // Nothing is suggested in the first hour after waking or the last hour before bed.
    afterWakeMin: 60,
    beforeBedMin: 60,
  },

  grades: {
    // Default effective hours for an assessment = weight% x this x difficulty factor.
    // A 30% exam in a medium course defaults to 30 x 0.4 = 12 effective hours.
    hoursPerWeightPoint: 0.4,
    difficultyHours: { 1: 0.8, 2: 1.0, 3: 1.25 },
    // Leverage is multiplied by the first row whose withinDays covers the days left.
    urgency: [
      { withinDays: 3, multiplier: 2.0 },
      { withinDays: 7, multiplier: 1.5 },
      { withinDays: 14, multiplier: 1.2 },
    ],
    noDueDateMultiplier: 0.8,
    // pressure = 1 + perPoint x (required average - your running average), clamped.
    pressure: { perPoint: 0.02, min: 0.5, max: 1.5 },
  },

  conflicts: {
    // Assessments further away than this do not raise an hours-gap conflict yet.
    examHorizonDays: 14,
    // A hard-course block in a slot below this factor is flagged.
    lowEnergyFactor: 0.6,
    hardDifficulty: 3,
    // Kinds of assessment that "hard training the day before" protects.
    examKinds: ['exam', 'midterm'],
  },
};

/** First-run values. Deliberately generic: the setup flow replaces them. */
export const defaultSettings: Settings = {
  onboarded: false,
  sleepStartMin: 23 * 60,
  sleepEndMin: 7 * 60,
  dailyOverheadMin: 120,
  minSessionsPerWeek: 3,
  projectHoursPerWeek: 0,
  notifyTraining: false,
  notifyConflicts: false,
  trainingLeadMin: 30,
};

export function emptyData(): AppData {
  return {
    fixedCommitments: [],
    shifts: [],
    trainingTemplates: [],
    trainingSessions: [],
    blocks: [],
    dayLogs: [],
    courses: [],
    assessments: [],
    settings: { ...defaultSettings },
    configOverrides: {},
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Overrides win over defaults, key by key. Arrays are replaced whole.
 * A value of the wrong type is ignored, so a corrupt override cannot break the model.
 */
function mergeDeep<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;
  if (Array.isArray(base)) return (Array.isArray(override) ? override : base) as T;
  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return base;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) out[key] = mergeDeep(base[key], override[key]);
    return out as T;
  }
  if (typeof base === 'number') {
    return (typeof override === 'number' && Number.isFinite(override) ? override : base) as T;
  }
  return (typeof override === typeof base ? override : base) as T;
}

export function resolveConfig(overrides: DeepPartial<Config> = {}): Config {
  return mergeDeep(defaultConfig, overrides);
}
