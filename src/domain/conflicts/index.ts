// Runs every rule and returns the conflicts, most serious first.
// To add a rule: write a function of type Rule and add it to RULES.

import { dayStart } from '../timeline';
import { dayOverloadRule, lowEnergyRule, recoveryRule, shortNightRule } from './loadRules';
import { examGapRule, overlapRule } from './scheduleRules';
import { consistencyRule, hardBeforeAssessmentRule, noRestDayRule, restGapRule } from './trainingRules';
import type { Conflict, Rule, RuleContext, Severity } from './types';

export type { Conflict, Fix, FixAction, RuleContext, Severity } from './types';

const RULES: Rule[] = [
  recoveryRule,
  overlapRule,
  examGapRule,
  restGapRule,
  noRestDayRule,
  consistencyRule,
  shortNightRule,
  dayOverloadRule,
  hardBeforeAssessmentRule,
  lowEnergyRule,
];

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function detectConflicts(ctx: RuleContext): Conflict[] {
  // A week that is entirely over cannot be changed, so it has nothing to flag.
  if (dayStart(7) <= ctx.tl.nowAbs) return [];
  return RULES.flatMap((rule) => rule(ctx)).sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.date ?? '').localeCompare(b.date ?? ''),
  );
}
