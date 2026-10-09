import { describe, expect, it } from 'vitest';
import { analyzeWeek } from '../../src/domain/analyze';
import { applyFix, applyMutations } from '../../src/domain/fixes';
import type { Conflict, FixAction } from '../../src/domain/conflicts';
import type { AppData, Now } from '../../src/domain/types';
import {
  FRI, MON, SAT, SUN, THU, TUE, WED, WEEK_START, assessment, block, commitment, course, data, h, session, shift, template,
} from '../helpers';

const analyze = (d: AppData, now: Now = WEEK_START) => analyzeWeek(d, MON, now);
const byRule = (conflicts: Conflict[], rule: string) => conflicts.filter((c) => c.rule === rule);

/** Applies a conflict's fix exactly as the app does, and returns the changed data. */
function fix(d: AppData, action: FixAction, now: Now = WEEK_START): AppData {
  let n = 0;
  return applyMutations(d, applyFix(d, analyze(d, now).tl, action, () => `new${++n}`));
}

describe('rule 1: recovery below threshold', () => {
  // The spec's example: "2 leg sessions this week + 20 hours of coursework -> recovery
  // drops below your threshold".
  //   committed = 56 sleep + 14 overhead + 30 class + 20 weekday shifts + 16 weekend shifts + 4 training = 140 h
  //   available = 168 - 140 = 28 h
  //   recovery  = 7 base + 2 hard legs x 1.5 + 2 moderate x 1.0 = 12 h
  //   flexible  = 28 - 12 = 16 h;  20 h of study planned  ->  buffer = -4 h
  const weekdays = [MON, TUE, WED, THU, FRI];
  const heavyWeek = () => data({
    fixedCommitments: [0, 1, 2, 3, 4].map((day) => commitment(day, h(8), h(14))),
    shifts: [
      ...weekdays.map((date) => shift(date, h(17), h(21))),
      shift(SAT, h(12), h(20)), shift(SUN, h(12), h(20)),
    ],
    trainingSessions: [
      session(MON, h(21), { name: 'Push', load: 'push', intensity: 2 }),
      session(TUE, h(21), { name: 'Legs A', load: 'legs', intensity: 3 }),
      session(WED, h(21), { name: 'Legs B', load: 'legs', intensity: 3 }),
      session(FRI, h(21), { name: 'Pull', load: 'pull', intensity: 2 }),
    ],
    blocks: [...weekdays.map((date) => block(date, h(14), 180)), block(SAT, h(7), 300)],
  });

  it('2 hard leg sessions + 20 h of study: recovery is 4 h under the 12 h threshold', () => {
    const result = analyze(heavyWeek());
    expect(result.week.bufferMin).toBe(-240);
    const [c] = byRule(result.conflicts, 'recovery');
    expect(c.severity).toBe('critical');
    expect(c.title).toBe('Recovery is 4 h below your threshold');
    expect(c.consequence).toContain('4 training sessions (2 hard) + 20 h of study and project work leave 8 h for recovery');
    expect(c.consequence).toContain('Your threshold is 12 h');
    expect(c.fixes[0].label).toBe('Cut 4 h of planned work from Saturday');
    expect(c.fixes[1].label).toContain('to next week');
  });

  it('applying "cut 4 h" clears the conflict', () => {
    const d = heavyWeek();
    const [c] = byRule(analyze(d).conflicts, 'recovery');
    const after = analyze(fix(d, c.fixes[0].action!));
    expect(after.week.bufferMin).toBe(0);
    expect(byRule(after.conflicts, 'recovery')).toEqual([]);
  });

  it('the same week also flags the back-to-back leg sessions and offers Saturday', () => {
    const d = heavyWeek();
    const [c] = byRule(analyze(d).conflicts, 'rest-gap');
    expect(c.title).toBe('Legs B comes 23 h after Legs A');
    // Thu 21:00 is only 47 h after Legs A ends, Fri 21:00 is taken by Pull: Saturday is first.
    expect(c.fixes[0].label).toBe('Move Legs B to Sat 21:00');
    expect(byRule(analyze(fix(d, c.fixes[0].action!)).conflicts, 'rest-gap')).toEqual([]);
  });
});

describe('rule 5: exam hours gap', () => {
  // The spec's example, on a Monday with the exam on Wednesday of next week.
  const examIn9Days = () => {
    const calc = course({ name: 'Calculus', difficulty: 3 });
    const exam = assessment(calc.id, 30, { name: 'Midterm', kind: 'midterm', dueDate: '2026-10-14', targetHours: 14 });
    return data({
      courses: [calc],
      assessments: [exam, assessment(calc.id, 70)],
      // Four 2 h morning blocks at the baseline factor: 8 h x 0.75 = 6 effective hours.
      blocks: [TUE, WED, THU, FRI].map((date) => block(date, h(9), 120, { courseId: calc.id, assessmentId: exam.id })),
    });
  };

  it('"Exam in 9 days, effective study hours this week are 6, target 14. Gap: 8 hours."', () => {
    // On an even pace, 7 of the 9 days are in this week: 14 x 7/9 = 10.9 h belong here.
    // 6 are planned, so this week is 4.9 h short of its share of the 8 h gap.
    const result = analyze(examIn9Days());
    expect(result.effective.plannedMin).toBeCloseTo(360);
    const [c] = byRule(result.conflicts, 'exam-gap');
    expect(c.title).toBe('Calculus Midterm in 9 days: this week is 4.9 effective h short');
    expect(c.consequence).toContain('Target for this midterm is 14 effective h. Done 0, planned 6. Gap: 8 h.');
    expect(c.consequence).toContain('until Wed 14 Oct, 10.9 h of what is left belong in this week, and 6 h are planned');
    expect(c.severity).toBe('warning'); // more than 7 days out; it turns critical inside a week
  });

  it('the first fix adds the suggested blocks in one tap, and that clears the conflict for this week', () => {
    const d = examIn9Days();
    const [c] = byRule(analyze(d).conflicts, 'exam-gap');
    expect(c.fixes[0].label).toMatch(/^Add the \d+ suggested blocks? for it/);
    const after = analyze(fix(d, c.fixes[0].action!));
    expect(byRule(after.conflicts, 'exam-gap')).toEqual([]);
    // The total gap is not closed yet: the rest belongs to next week and is not nagged about now.
    expect(after.ranked[0].targetMin - after.ranked[0].plannedMin).toBeGreaterThan(60);
  });

  it('an exam inside the week counts the whole gap, and is critical', () => {
    const c1 = course({ name: 'Physics' });
    const quiz = assessment(c1.id, 100, { name: 'Quiz', kind: 'quiz', dueDate: FRI, targetHours: 4 });
    const [c] = byRule(analyze(data({ courses: [c1], assessments: [quiz] })).conflicts, 'exam-gap');
    expect(c.title).toBe('Physics Quiz in 4 days: this week is 4 effective h short');
    expect(c.severity).toBe('critical');
  });

  it('no conflict once done + planned hours reach the target, or when the exam is past the horizon', () => {
    const c1 = course();
    const funded = assessment(c1.id, 100, { dueDate: '2026-10-14', targetHours: 3 });
    const covered = data({
      courses: [c1], assessments: [funded],
      blocks: [block(TUE, h(9), 240, { assessmentId: funded.id })], // 4 h x 0.75 = 3 effective h
    });
    expect(byRule(analyze(covered).conflicts, 'exam-gap')).toEqual([]);

    const far = data({ courses: [c1], assessments: [assessment(c1.id, 100, { dueDate: '2026-11-20', targetHours: 30 })] });
    expect(byRule(analyze(far).conflicts, 'exam-gap')).toEqual([]);
  });
});

describe('rule 6: overlap', () => {
  it('"Work shift consumes your Thursday evening study block. Move Calculus review to Friday morning or next week."', () => {
    const d = data({
      shifts: [shift(THU, h(17), h(22))],
      blocks: [block(THU, h(18), 90, { title: 'Calculus review' })],
    });
    const [c] = byRule(analyze(d).conflicts, 'overlap');
    expect(c.severity).toBe('critical');
    expect(c.title).toBe('Work shift "Work shift" takes your Thu 18:00 Calculus review block');
    expect(c.consequence).toContain('runs Thu 17:00 to 22:00 and covers 1.5 h of the 1.5 h block');
    expect(c.fixes.map((f) => f.label)).toEqual([
      'Move "Calculus review" to Fri 08:00 (factor 0.75)',
      'Shift it to Thu 18:00 next week',
    ]);
    // Taking either fix removes the conflict.
    for (const f of c.fixes) expect(byRule(analyze(fix(d, f.action!)).conflicts, 'overlap')).toEqual([]);
  });

  it('a class on top of a training session offers to move the session', () => {
    const d = data({
      fixedCommitments: [commitment(1, h(17), h(19), { title: 'Physics lab' })],
      trainingTemplates: [template(1, h(18), { name: 'Pull' }), template(3, h(18)), template(5, h(18))],
    });
    const [c] = byRule(analyze(d).conflicts, 'overlap');
    expect(c.title).toBe('Class "Physics lab" overlaps Pull');
    expect(c.fixes[0].label).toBe('Move Pull to Wed 18:00');
  });

  it('a shift on top of a class is reported even though the app cannot move either', () => {
    const d = data({ fixedCommitments: [commitment(2, h(8), h(12), { title: 'Circuits' })], shifts: [shift(WED, h(10), h(15))] });
    const [c] = byRule(analyze(d).conflicts, 'overlap');
    expect(c.title).toBe('Work shift overlaps Circuits');
    expect(c.consequence).toContain('for 2 h');
  });
});

describe('rules 2 to 4: the training plan', () => {
  it('rest gap: a session that is already done is not flagged again', () => {
    const d = data({
      trainingSessions: [
        session(MON, h(18), { load: 'legs', intensity: 3 }),
        session(TUE, h(18), { load: 'legs', intensity: 3, status: 'done' }),
      ],
    });
    expect(byRule(analyze(d, { date: WED, minute: 0 }).conflicts, 'rest-gap')).toEqual([]);
  });

  it('no rest day: 7 days of training in a row, and the fix skips the lightest session', () => {
    const d = data({
      trainingTemplates: [0, 1, 2, 3, 4, 5, 6].map((day) =>
        template(day, h(18), { intensity: day === 6 ? 1 : 2, name: day === 6 ? 'Mobility' : 'Session', load: day % 2 ? 'push' : 'pull' })),
    });
    const [c] = byRule(analyze(d).conflicts, 'no-rest-day');
    expect(c.consequence).toContain('7 days in a row; your rule allows 6');
    expect(c.fixes[0].label).toBe('Make Sunday the rest day: skip Mobility');
    expect(byRule(analyze(fix(d, c.fixes[0].action!)).conflicts, 'no-rest-day')).toEqual([]);
  });

  it('consistency: 2 sessions planned against a minimum of 3', () => {
    const d = data({ trainingTemplates: [template(0, h(18)), template(2, h(18))] });
    const [c] = byRule(analyze(d).conflicts, 'consistency');
    expect(c.title).toBe('2 of 3 training sessions planned');
  });

  it('consistency: someone with no training set up is not nagged', () => {
    expect(byRule(analyze(data()).conflicts, 'consistency')).toEqual([]);
  });
});

describe('rule 7: short night', () => {
  it('a shift to 01:00 leaves 6 h of sleep and shrinks Friday: 2 h planned counts as 1.3 instead of 1.5', () => {
    // Friday factor = 0.75 baseline x 0.85 short night = 0.6375. 120 min x 0.6375 = 76.5 min.
    const d = data({ shifts: [shift(THU, h(19), h(1))], blocks: [block(FRI, h(9), 120)] });
    const [c] = byRule(analyze(d).conflicts, 'short-night');
    expect(c.title).toBe('Work shift leaves 6 h of sleep before Friday');
    expect(c.consequence).toContain('inside your 23:00 to 07:00 sleep window');
    expect(c.consequence).toContain('counts as 1.3 effective h instead of about 1.5');
  });

  it('logging real sleep at the check-in removes the conflict', () => {
    const d = data({
      shifts: [shift(THU, h(19), h(1))],
      dayLogs: [{ id: 'l', date: FRI, energy: null, sleepHours: 7.5 }],
    });
    expect(byRule(analyze(d).conflicts, 'short-night')).toEqual([]);
  });

  it('a sleep window that is itself too short is reported once, not seven times', () => {
    const d = data();
    d.settings = { ...d.settings, sleepStartMin: 0, sleepEndMin: h(6) };
    const found = byRule(analyze(d).conflicts, 'short-night');
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe('Your sleep window is 6 h');
    expect(found[0].severity).toBe('info');
  });
});

describe('rules 8 to 10: quality of the plan', () => {
  it('low energy: a hard course at 21:00 the day after hard legs runs at 0.47 and can move to a better slot', () => {
    // 0.75 baseline x 0.90 legs yesterday x 0.70 late = 0.4725, below the 0.60 line.
    const calc = course({ name: 'Calculus', difficulty: 3 });
    const d = data({
      courses: [calc],
      trainingSessions: [session(MON, h(18), { name: 'Legs', load: 'legs', intensity: 3 })],
      blocks: [block(TUE, h(21), 60, { courseId: calc.id, title: 'Calculus' })],
    });
    const [c] = byRule(analyze(d).conflicts, 'low-energy');
    expect(c.title).toBe('Calculus at Tue 21:00 sits in a low-energy slot');
    expect(c.consequence).toContain('Predicted factor 0.47');
    expect(c.consequence).toContain('Legs yesterday 0.90');
    expect(c.fixes[0].label).toBe('Move "Calculus" to Wed 08:00 (factor 0.75)');
  });

  it('low energy: an easy course in the same slot is not flagged', () => {
    const easy = course({ difficulty: 1 });
    const d = data({ courses: [easy], blocks: [block(TUE, h(21, 30), 30, { courseId: easy.id })] });
    expect(byRule(analyze(d).conflicts, 'low-energy')).toEqual([]);
  });

  it('day overload: 7.5 h planned on Wednesday against a 5 h ceiling', () => {
    const d = data({ blocks: [block(WED, h(8), 150), block(WED, h(11), 150), block(WED, h(14), 150)] });
    const [c] = byRule(analyze(d).conflicts, 'day-overload');
    expect(c.title).toBe('Wednesday: 7.5 h planned, room for 5 h');
    expect(c.consequence).toContain('2.5 h of the plan will not happen as written');
    const cut = c.fixes.find((f) => f.action?.type === 'trimDay')!;
    expect(cut.label).toBe('Cut 2.5 h from Wednesday');
    expect(byRule(analyze(fix(d, cut.action!)).conflicts, 'day-overload')).toEqual([]);
  });

  it('hard training the day before a midterm offers to move it to after the exam', () => {
    const c1 = course({ name: 'Physics' });
    const d = data({
      courses: [c1],
      assessments: [assessment(c1.id, 30, { name: 'Midterm', kind: 'midterm', dueDate: THU, targetHours: 0 })],
      trainingSessions: [session(WED, h(18), { name: 'Legs', load: 'legs', intensity: 3 })],
    });
    const [c] = byRule(analyze(d).conflicts, 'hard-before-assessment');
    expect(c.title).toBe('Legs (hard) is the day before Physics Midterm');
    expect(c.fixes[0].label).toBe('Move Legs to Thu 18:00');
  });
});

describe('when conflicts are checked', () => {
  it('a week that is entirely in the past has nothing to flag', () => {
    // On a live week this data raises an overlap and a missed-consistency conflict.
    const d = data({
      shifts: [shift(THU, h(17), h(22))],
      blocks: [block(THU, h(18), 90)],
      trainingTemplates: [template(0, h(18)), template(2, h(18))],
    });
    expect(analyze(d).conflicts.length).toBeGreaterThanOrEqual(2);
    expect(analyze(d, { date: '2026-10-12', minute: 0 }).conflicts).toEqual([]);
  });

  it('keys are stable between runs, so the app can tell a new conflict from a known one', () => {
    const d = data({ shifts: [shift(THU, h(17), h(22))], blocks: [block(THU, h(18), 90)] });
    expect(analyze(d).conflicts.map((c) => c.key)).toEqual(analyze(d).conflicts.map((c) => c.key));
  });

  it('adding a shift to a clean plan produces the conflict on the very next analysis', () => {
    const clean = data({ blocks: [block(THU, h(18), 90, { title: 'Calculus review' })] });
    expect(analyze(clean).conflicts).toEqual([]);
    const withShift = { ...clean, shifts: [shift(THU, h(17), h(22))] };
    expect(byRule(analyze(withShift).conflicts, 'overlap')).toHaveLength(1);
  });

  it('conflicts are ordered critical first', () => {
    const d = data({
      shifts: [shift(THU, h(17), h(22))],
      blocks: [block(THU, h(18), 90)],
      trainingTemplates: [template(0, h(18)), template(2, h(18))],
    });
    const severities = analyze(d).conflicts.map((c) => c.severity);
    expect(severities[0]).toBe('critical');
    expect([...severities].sort((a, b) => ['critical', 'warning', 'info'].indexOf(a) - ['critical', 'warning', 'info'].indexOf(b))).toEqual(severities);
  });
});
