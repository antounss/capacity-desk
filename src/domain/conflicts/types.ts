import type { AppData, Block, ISODate } from '../types';
import type { Capacity } from '../capacity';
import type { PlanResult } from '../planner';
import type { RankedTask } from '../priority';
import type { Timeline } from '../timeline';

/** A change the app can apply for the user when they tap a fix. */
export type FixAction =
  | { type: 'moveBlock'; blockId: string; date: ISODate; startMin: number }
  | { type: 'moveSession'; sessionId: string; date: ISODate; startMin: number }
  | { type: 'skipSession'; sessionId: string }
  | { type: 'trimDay'; date: ISODate; minutes: number }
  | { type: 'addBlocks'; blocks: Omit<Block, 'id'>[] }
  | { type: 'open'; screen: 'suggestions' | 'grades' | 'schedule' | 'settings' | 'tuning' };

export interface Fix {
  label: string;
  /** Missing when the fix is advice the app cannot carry out itself. */
  action?: FixAction;
}

export type Severity = 'critical' | 'warning' | 'info';

export interface Conflict {
  /** Stable across recalculations, so the app can tell a new conflict from an old one. */
  key: string;
  rule: string;
  severity: Severity;
  /** The date the conflict bites, when it has one. */
  date: ISODate | null;
  title: string;
  /** What happens if nothing changes, with numbers. */
  consequence: string;
  fixes: Fix[];
}

/** Everything a rule may read. Rules never read the clock or storage themselves. */
export interface RuleContext {
  data: AppData;
  tl: Timeline;
  week: Capacity;
  days: Capacity[];
  ranked: RankedTask[];
  /** The planner's suggestions, so a rule can offer them as a one-tap fix. */
  plan: PlanResult;
}

export type Rule = (ctx: RuleContext) => Conflict[];
