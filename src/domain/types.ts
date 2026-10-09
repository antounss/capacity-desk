// Domain types. Nothing in src/domain imports React, Capacitor or the database:
// every function here takes plain data and returns plain data, so it can be unit tested.

/** Calendar date as "YYYY-MM-DD". Dates are never mixed with clock times. */
export type ISODate = string;

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
/** 1 = light, 2 = moderate, 3 = hard. */
export type Intensity = 1 | 2 | 3;
/** What a session loads. Rest rules are written against these groups. */
export type LoadGroup = 'legs' | 'push' | 'pull' | 'full' | 'cardio' | 'skill';

/** Weekly repeating commitment. weekday: 0 = Monday ... 6 = Sunday. */
export interface FixedCommitment {
  id: string;
  kind: 'class' | 'commute' | 'other';
  title: string;
  weekday: number;
  /** Minutes after midnight. */
  startMin: number;
  /** Minutes after midnight. An end at or before the start means "next day". */
  endMin: number;
}

/** A dated work shift. Hours vary week to week, so shifts are never templates. */
export interface Shift {
  id: string;
  date: ISODate;
  startMin: number;
  /** An end at or before the start means the shift crosses midnight. */
  endMin: number;
  note: string;
}

/** One slot of the weekly training split. */
export interface TrainingTemplate {
  id: string;
  weekday: number;
  startMin: number;
  durationMin: number;
  name: string;
  load: LoadGroup;
  intensity: Intensity;
}

export type SessionStatus = 'planned' | 'done' | 'skipped';

/**
 * A dated training session. Two uses:
 *  - templateId set: replaces that template's occurrence in the week `weekStart`
 *    (moved to another day, marked done, or skipped).
 *  - templateId null: a one-off session.
 */
export interface TrainingSession {
  id: string;
  templateId: string | null;
  weekStart: ISODate;
  date: ISODate;
  startMin: number;
  durationMin: number;
  name: string;
  load: LoadGroup;
  intensity: Intensity;
  status: SessionStatus;
}

export type BlockStatus = 'planned' | 'done' | 'skipped';

/** A study or project block, either planned ahead or logged after the fact. */
export interface Block {
  id: string;
  date: ISODate;
  startMin: number;
  durationMin: number;
  category: 'study' | 'project';
  title: string;
  courseId: string | null;
  assessmentId: string | null;
  status: BlockStatus;
  /** Energy felt during the block. null = not logged. */
  energy: EnergyLevel | null;
}

/** Morning check-in for one date. */
export interface DayLog {
  id: string;
  date: ISODate;
  energy: EnergyLevel | null;
  /** Hours actually slept the night before. null = not logged. */
  sleepHours: number | null;
}

export interface Course {
  id: string;
  name: string;
  credits: number;
  /** 1 = light, 2 = medium, 3 = hard cognitive load. */
  difficulty: 1 | 2 | 3;
  /** Target final grade in percent. */
  targetPercent: number;
}

export type AssessmentKind = 'exam' | 'midterm' | 'project' | 'lab' | 'quiz' | 'other';

export interface Assessment {
  id: string;
  courseId: string;
  name: string;
  kind: AssessmentKind;
  /** Share of the course grade, in percent. */
  weightPercent: number;
  dueDate: ISODate | null;
  /** Score in percent. null = not graded yet. */
  scorePercent: number | null;
  /** Effective hours the user wants to put in. null = use the default from config. */
  targetHours: number | null;
}

/** Facts about the user's life (as opposed to Config, which holds model parameters). */
export interface Settings {
  onboarded: boolean;
  /** Bedtime, minutes after midnight. */
  sleepStartMin: number;
  /** Wake time, minutes after midnight. */
  sleepEndMin: number;
  /** Meals, hygiene and other unplaced daily overhead. */
  dailyOverheadMin: number;
  /** The weekly consistency requirement for training. */
  minSessionsPerWeek: number;
  /** Hours per week the user wants for personal projects. */
  projectHoursPerWeek: number;
  notifyTraining: boolean;
  notifyConflicts: boolean;
  /** Minutes before a session that the reminder fires. */
  trainingLeadMin: number;
}

export interface RestRule {
  id: string;
  /** Sessions in any of these groups count against each other. */
  groups: LoadGroup[];
  /** Only sessions at or above this intensity are checked. */
  minIntensity: Intensity;
  /** Minimum hours from the end of one session to the start of the next. */
  minGapHours: number;
}

export interface TimeBand {
  label: string;
  fromMin: number;
  /** A band may wrap past midnight (fromMin > toMin). */
  toMin: number;
  multiplier: number;
}

/** Every tunable number in the model. Defaults live in src/config/defaultConfig.ts. */
export interface Config {
  energy: {
    factors: Record<EnergyLevel, number>;
    baselineLevel: EnergyLevel;
    timeOfDay: TimeBand[];
  };
  carryover: {
    trainingMultiplier: Record<Intensity, number>;
    shortNightHours: number;
    shortNightMultiplier: number;
    floor: number;
    postTraining: { minIntensity: Intensity; windowMin: number; multiplier: number };
  };
  recovery: {
    baseHoursPerDay: number;
    hoursPerSession: Record<Intensity, number>;
  };
  training: {
    restRules: RestRule[];
    maxConsecutiveDays: number;
  };
  planner: {
    blockMin: number;
    minBlockMin: number;
    breakMin: number;
    maxFocusHoursPerDay: number;
    afterWakeMin: number;
    beforeBedMin: number;
  };
  grades: {
    hoursPerWeightPoint: number;
    difficultyHours: Record<1 | 2 | 3, number>;
    urgency: { withinDays: number; multiplier: number }[];
    noDueDateMultiplier: number;
    pressure: { perPoint: number; min: number; max: number };
  };
  conflicts: {
    examHorizonDays: number;
    lowEnergyFactor: number;
    hardDifficulty: 1 | 2 | 3;
    examKinds: AssessmentKind[];
  };
}

/** Recursive "every field optional" version of a type, used for config overrides. */
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Everything the app stores. This is also the shape of the JSON backup. */
export interface AppData {
  fixedCommitments: FixedCommitment[];
  shifts: Shift[];
  trainingTemplates: TrainingTemplate[];
  trainingSessions: TrainingSession[];
  blocks: Block[];
  dayLogs: DayLog[];
  courses: Course[];
  assessments: Assessment[];
  settings: Settings;
  configOverrides: DeepPartial<Config>;
}

/** The entity collections of AppData (everything except settings and config). */
export type CollectionName =
  | 'fixedCommitments'
  | 'shifts'
  | 'trainingTemplates'
  | 'trainingSessions'
  | 'blocks'
  | 'dayLogs'
  | 'courses'
  | 'assessments';

/** A point in time as the domain sees it: a date and minutes after midnight. */
export interface Now {
  date: ISODate;
  minute: number;
}
