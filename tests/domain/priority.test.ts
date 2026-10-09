import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config/defaultConfig';
import { analyzeWeek } from '../../src/domain/analyze';
import { courseStanding } from '../../src/domain/grades';
import { progressByAssessment, rankTasks, weekShare, weeklyDemand } from '../../src/domain/priority';
import { MON, THU, WED, WEEK_START, assessment, block, course, data, h, timeline } from '../helpers';

describe('grade impact per effective hour', () => {
  it('worked example: 3 of 6 credits x 40% exam = 20 semester points over 16 h = 1.25 pts/h, x1.5 urgency = 1.875', () => {
    // Two 3-credit courses. Exam is 40% of course A, due in 5 days.
    // semester points = 3/6 x 40 = 20
    // target hours    = 40 x 0.4 x 1.0 (medium) = 16 h  ->  20 / 16 = 1.25 points per hour
    // urgency         = x1.5 (due within 7 days)
    // pressure        = x1.0 (nothing graded: required average equals the target)
    const a = course({ name: 'A', credits: 3 });
    const b = course({ name: 'B', credits: 3 });
    const exam = assessment(a.id, 40, { dueDate: '2026-10-10' });
    const rest = [assessment(a.id, 60), assessment(b.id, 100)];
    const standings = [a, b].map((c) => courseStanding(c, [exam, ...rest]));
    const ranked = rankTasks(standings, new Map(), MON, defaultConfig);

    const top = ranked[0];
    expect(top.assessment.id).toBe(exam.id);
    expect(top.semesterPoints).toBeCloseTo(20);
    expect(top.targetMin).toBeCloseTo(16 * 60);
    expect(top.pointsPerHour).toBeCloseTo(1.25);
    expect(top.urgency).toBe(1.5);
    expect(top.pressure).toBeCloseTo(1);
    expect(top.score).toBeCloseTo(1.875);
    expect(top.reasons[0]).toContain('20 points of your semester average');
  });

  it('more credits outrank fewer credits when everything else is equal', () => {
    const big = course({ name: 'Big', credits: 4 });
    const small = course({ name: 'Small', credits: 2 });
    const all = [assessment(big.id, 100, { dueDate: '2026-10-20' }), assessment(small.id, 100, { dueDate: '2026-10-20' })];
    const ranked = rankTasks([big, small].map((c) => courseStanding(c, all)), new Map(), MON, defaultConfig);
    expect(ranked.map((t) => t.course.name)).toEqual(['Big', 'Small']);
  });

  it('pressure rises when the course needs more than the running average: need 95 against 85 -> x1.2', () => {
    // 50% graded at 85, target 90 -> required (90 - 42.5) / 0.5 = 95. pressure = 1 + 0.02 x (95 - 85) = 1.2
    const c = course({ targetPercent: 90 });
    const all = [assessment(c.id, 50, { scorePercent: 85 }), assessment(c.id, 50, { dueDate: '2026-10-30' })];
    const [task] = rankTasks([courseStanding(c, all)], new Map(), MON, defaultConfig);
    expect(task.pressure).toBeCloseTo(1.2);
  });

  it('a task whose target hours are already logged scores 0; a past-due one is left out', () => {
    const c = course();
    const funded = assessment(c.id, 30, { dueDate: '2026-10-12', targetHours: 2 });
    const overdue = assessment(c.id, 30, { dueDate: '2026-10-01' });
    const open = assessment(c.id, 40, { dueDate: '2026-10-20' });
    const progress = new Map([[funded.id, { doneMin: 130, plannedMin: 0, plannedThisWeekMin: 0 }]]);
    const ranked = rankTasks([courseStanding(c, [funded, overdue, open])], progress, MON, defaultConfig);
    expect(ranked.map((t) => t.assessment.id)).toEqual([open.id, funded.id]);
    expect(ranked[1].score).toBe(0);
  });

  it('top 3 lists only tasks that still need hours, each with its reasons', () => {
    const c = course();
    const items = [10, 20, 30, 40].map((w, i) => assessment(c.id, w, { dueDate: `2026-10-${12 + i}`, name: `A${w}` }));
    const result = analyzeWeek(data({ courses: [c], assessments: items }), MON, WEEK_START);
    expect(result.top3).toHaveLength(3);
    for (const task of result.top3) expect(task.reasons.length).toBeGreaterThanOrEqual(4);
  });
});

describe('progress toward an assessment', () => {
  it('counts done blocks at their logged energy, future planned blocks at the prediction, and stale planned blocks as nothing', () => {
    const c = course();
    const exam = assessment(c.id, 40);
    const tl = timeline(
      data({
        courses: [c],
        assessments: [exam],
        blocks: [
          block(MON, h(9), 120, { assessmentId: exam.id, status: 'done', energy: 4 }), // 120 x 0.90 = 108
          block(MON, h(14), 60, { assessmentId: exam.id }), // in the past, never confirmed -> 0
          block(THU, h(9), 60, { assessmentId: exam.id }), // future: 60 x 0.75 = 45
        ],
      }),
      { date: WED, minute: h(12) },
    );
    const p = progressByAssessment(tl).get(exam.id)!;
    expect(p.doneMin).toBeCloseTo(108);
    expect(p.plannedMin).toBeCloseTo(45);
  });
});

describe('weekly demand', () => {
  it('spreads what is left over the days until it is due: 14 h due in 14 days puts 7 h into this week', () => {
    const c = course();
    const exam = assessment(c.id, 40, { dueDate: '2026-10-19', targetHours: 14 });
    const d = data({ courses: [c], assessments: [exam] });
    const tl = timeline(d);
    const ranked = rankTasks([courseStanding(c, [exam])], progressByAssessment(tl), MON, defaultConfig);
    const [demand] = weeklyDemand(tl, ranked);
    expect(demand.needMin).toBeCloseTo(7 * 60);
    expect(demand.effective).toBe(true);
  });

  it('once this week holds its share, nothing more is asked of it, even though later weeks still owe hours', () => {
    // Same exam. 7 effective hours planned this week: 560 min of mornings x 0.75 = 420.
    const c = course();
    const exam = assessment(c.id, 40, { dueDate: '2026-10-19', targetHours: 14 });
    const mornings = [MON, '2026-10-06', WED, THU].map((date) => block(date, h(8), 140, { assessmentId: exam.id }));
    const tl = timeline(data({ courses: [c], assessments: [exam], blocks: mornings }));
    const ranked = rankTasks([courseStanding(c, [exam])], progressByAssessment(tl), MON, defaultConfig);
    expect(ranked[0].plannedThisWeekMin).toBeCloseTo(420);
    expect(weekShare(tl, ranked[0])).toMatchObject({ shortMin: 0 });
    expect(weeklyDemand(tl, ranked)).toEqual([]);
  });

  it('adds project hours last, minus what is already booked', () => {
    const d = data({ blocks: [block(MON, h(9), 60, { category: 'project', title: 'App' })] });
    d.settings = { ...d.settings, projectHoursPerWeek: 4 };
    const demands = weeklyDemand(timeline(d), []);
    expect(demands).toHaveLength(1);
    expect(demands[0].needMin).toBe(180);
    expect(demands[0].effective).toBe(false);
  });
});
