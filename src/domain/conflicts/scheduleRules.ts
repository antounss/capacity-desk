// Conflicts about things landing on top of each other, and about exam preparation.

import { fmtDate, fmtHours, fmtTime } from '../time';
import { overlap } from '../intervals';
import { findSessionSlot, when } from '../planner';
import { weekShare } from '../priority';
import { type TimedItem, dateOfDay, dayOfAbs, dayStart } from '../timeline';
import { moveBlockFix } from './loadRules';
import type { Conflict, Fix, Rule } from './types';

const KIND_LABEL: Record<TimedItem['kind'], string> = {
  shift: 'Work shift', class: 'Class', commute: 'Commute', other: 'Commitment',
};
const clockOf = (abs: number) => abs - dayStart(dayOfAbs(abs));

/** Rule 6: a shift, class or session lands on a planned block, or on each other. */
export const overlapRule: Rule = (ctx) => {
  const { tl } = ctx;
  const out: Conflict[] = [];
  const weekEnd = dayStart(7);
  const fixed: TimedItem[] = [...tl.shifts, ...tl.commitments];

  // Planned blocks covered by something that cannot move.
  for (const b of tl.blocks) {
    if (b.block.status !== 'planned' || b.start < tl.nowAbs || b.start >= weekEnd) continue;
    const blockers = [
      ...fixed.map((f) => ({ span: f, label: `${KIND_LABEL[f.kind]} "${f.title}"`, id: f.id })),
      ...tl.sessions.map((s) => ({ span: s, label: `Training "${s.session.name}"`, id: s.session.id })),
      ...tl.blocks.filter((o) => o !== b && o.start <= b.start).map((o) => ({ span: o, label: `"${o.block.title}"`, id: o.block.id })),
    ];
    const hit = blockers.find((x) => overlap(x.span, b) > 0);
    if (!hit) continue;

    const lost = overlap(hit.span, b);
    const fixes: Fix[] = [];
    const move = moveBlockFix(ctx, b);
    if (move) fixes.push(move);
    fixes.push({
      label: `Shift it to ${when(b.start)} next week`,
      action: { type: 'moveBlock', blockId: b.block.id, date: dateOfDay(tl, dayOfAbs(b.start) + 7), startMin: clockOf(b.start) },
    });
    out.push({
      key: `overlap:${b.block.id}:${hit.id}`,
      rule: 'overlap',
      severity: 'critical',
      date: dateOfDay(tl, dayOfAbs(b.start)),
      title: `${hit.label} takes your ${when(b.start)} ${b.block.title} block`,
      consequence: `${hit.label} runs ${when(hit.span.start)} to ${fmtTime(hit.span.end)} and covers ${fmtHours(lost)} h of the ${fmtHours(b.end - b.start)} h block. `
        + 'That study time does not exist unless one of them moves.',
      fixes,
    });
  }

  // Training sessions covered by a shift, class or commute.
  for (const s of tl.sessions) {
    if (s.session.status !== 'planned' || s.start < tl.nowAbs || s.start >= weekEnd) continue;
    const hit = fixed.find((f) => overlap(f, s) > 0);
    if (!hit) continue;
    const slot = findSessionSlot(tl, s);
    out.push({
      key: `overlap:${s.session.id}:${hit.id}`,
      rule: 'overlap',
      severity: 'critical',
      date: dateOfDay(tl, dayOfAbs(s.start)),
      title: `${KIND_LABEL[hit.kind]} "${hit.title}" overlaps ${s.session.name}`,
      consequence: `${s.session.name} is at ${when(s.start)}, but "${hit.title}" runs ${when(hit.start)} to ${fmtTime(hit.end)}. `
        + 'The session will be missed or cut short, which counts against your weekly minimum.',
      fixes: slot
        ? [{ label: `Move ${s.session.name} to ${when(slot.start)}`, action: { type: 'moveSession', sessionId: s.session.id, date: slot.date, startMin: clockOf(slot.start) } }]
        : [{ label: 'No free day at that time. Change the start time in Schedule.', action: { type: 'open', screen: 'schedule' } }],
    });
  }

  // A shift on top of a class: nothing the app can move, but the user must know.
  for (const shift of tl.shifts) {
    if (shift.end <= tl.nowAbs || shift.start >= weekEnd || shift.end <= 0) continue;
    const cls = tl.commitments.find((c) => c.kind === 'class' && overlap(c, shift) > 0);
    if (!cls) continue;
    out.push({
      key: `overlap:${shift.id}:${cls.id}:${dayOfAbs(shift.start)}`,
      rule: 'overlap',
      severity: 'critical',
      date: dateOfDay(tl, Math.max(0, dayOfAbs(shift.start))),
      title: `Work shift overlaps ${cls.title}`,
      consequence: `The shift runs ${when(shift.start)} to ${fmtTime(shift.end)} and ${cls.title} is ${when(cls.start)} to ${fmtTime(cls.end)}. `
        + `You cannot be in both for ${fmtHours(overlap(cls, shift))} h. Capacity counts the shift.`,
      fixes: [{ label: 'Change the shift, or accept missing the class', action: { type: 'open', screen: 'schedule' } }],
    });
  }
  return out;
};

/**
 * Rule 5: effective hours done and planned fall short of an assessment's target.
 * Only the share of the gap that belongs in the week in view is flagged, so planning
 * this week properly clears the conflict even when later weeks still have hours to place.
 */
export const examGapRule: Rule = ({ tl, ranked, plan }) => {
  const out: Conflict[] = [];
  const horizon = tl.config.conflicts.examHorizonDays;
  for (const task of ranked) {
    const { daysLeft, assessment, course } = task;
    if (daysLeft == null || daysLeft > horizon || !assessment.dueDate) continue;
    const gapMin = task.targetMin - task.doneMin - task.plannedMin;
    if (gapMin < 15) continue;

    const week = weekShare(tl, task);
    const dueToday = daysLeft === 0;
    const shortMin = dueToday ? gapMin : week?.shortMin ?? 0;
    if (shortMin < 15) continue;

    const totals = `Target for this ${assessment.kind} is ${fmtHours(task.targetMin)} effective h. `
      + `Done ${fmtHours(task.doneMin)}, planned ${fmtHours(task.plannedMin)}. Gap: ${fmtHours(gapMin)} h.`;
    const pace = week && week.quotaMin < task.remainingMin - 1
      ? ` On an even pace until ${fmtDate(assessment.dueDate)}, ${fmtHours(week.quotaMin)} h of what is left belong in this week, and ${fmtHours(task.plannedThisWeekMin)} h are planned.`
      : '';

    const suggested = plan.suggestions.filter((s) => s.block.assessmentId === assessment.id);
    const suggestedMin = suggested.reduce((sum, s) => sum + s.block.durationMin, 0);
    const fixes: Fix[] = [
      suggested.length > 0
        ? {
            label: `Add the ${suggested.length} suggested block${suggested.length === 1 ? '' : 's'} for it (${fmtHours(suggestedMin)} h)`,
            action: { type: 'addBlocks', blocks: suggested.map((s) => s.block) },
          }
        : {
            label: dueToday
              ? 'It is due today, so nothing can be planned ahead of it.'
              : 'Nothing is suggested for it: higher-impact work already fills the days before it, up to your daily focus ceiling.',
          },
      { label: `Lower its target if less than ${fmtHours(task.targetMin)} h is enough`, action: { type: 'open', screen: 'grades' } },
    ];

    out.push({
      key: `exam-gap:${assessment.id}`,
      rule: 'exam-gap',
      severity: daysLeft <= 7 ? 'critical' : 'warning',
      date: assessment.dueDate,
      title: dueToday
        ? `${course.name} ${assessment.name} is today: ${fmtHours(gapMin)} effective h short`
        : `${course.name} ${assessment.name} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}: this week is ${fmtHours(shortMin)} effective h short`,
      consequence: totals + pace,
      fixes,
    });
  }
  return out;
};
