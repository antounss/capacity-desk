// Writes docs/sample-data.json: an invented student's week, for trying the app and for
// store screenshots. Import it from Settings > Import a backup. None of this ships in the app.
//
//   node scripts/make-sample-data.mjs [monday]     e.g. node scripts/make-sample-data.mjs 2026-10-05
//
// The week defaults to the current one, so the sample always looks live.

import { writeFileSync } from 'node:fs';

const DAY_MS = 86_400_000;
function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - weekday * DAY_MS);
}
const monday = mondayOf(process.argv[2] ?? new Date().toISOString().slice(0, 10));
/** Date string `n` days after the Monday of the sample week. */
const day = (n) => new Date(monday.getTime() + n * DAY_MS).toISOString().slice(0, 10);
const at = (h, m = 0) => h * 60 + m;

let counter = 0;
const id = (prefix) => `${prefix}-${String(++counter).padStart(3, '0')}`;

// Classes: [title, weekdays, start, end]
const classes = [
  ['Calculus III', [0, 2], at(8), at(9, 30)],
  ['Data Structures', [0, 2], at(10), at(11, 30)],
  ['Physics II', [1, 3], at(9), at(10, 30)],
  ['Digital Logic', [1, 3], at(11), at(12, 30)],
  ['Physics lab', [4], at(9), at(12)],
  ['Technical Writing', [4], at(13), at(14, 30)],
];
const fixedCommitments = [
  ...classes.flatMap(([title, days, startMin, endMin]) =>
    days.map((weekday) => ({ id: id('fc'), kind: 'class', title, weekday, startMin, endMin }))),
  ...[0, 1, 2, 3, 4].map((weekday) => ({ id: id('fc'), kind: 'commute', title: 'Bus to campus', weekday, startMin: at(7, 15), endMin: at(7, 55) })),
];

const trainingTemplates = [
  { id: id('tt'), weekday: 0, startMin: at(18), durationMin: 75, name: 'Push', load: 'push', intensity: 3 },
  { id: id('tt'), weekday: 1, startMin: at(18), durationMin: 75, name: 'Legs', load: 'legs', intensity: 3 },
  { id: id('tt'), weekday: 3, startMin: at(18), durationMin: 75, name: 'Pull', load: 'pull', intensity: 3 },
  { id: id('tt'), weekday: 5, startMin: at(10), durationMin: 60, name: 'Legs and run', load: 'legs', intensity: 2 },
  { id: id('tt'), weekday: 6, startMin: at(9), durationMin: 45, name: 'Skills and core', load: 'skill', intensity: 1 },
];
// Monday's and Tuesday's sessions have been marked done.
const trainingSessions = [0, 1].map((i) => {
  const { id: templateId, weekday, ...rest } = trainingTemplates[i];
  return { id: id('ts'), templateId, weekStart: day(0), date: day(weekday), ...rest, status: 'done' };
});

const course = (name, credits, difficulty, targetPercent) => ({ id: id('co'), name, credits, difficulty, targetPercent });
const calc = course('Calculus III', 3, 3, 92);
const ds = course('Data Structures', 3, 3, 92);
const phys = course('Physics II', 3, 3, 90);
const logic = course('Digital Logic', 3, 2, 90);
const writing = course('Technical Writing', 2, 1, 90);
const courses = [calc, ds, phys, logic, writing];

const assess = (c, name, kind, weightPercent, dueDate, scorePercent = null, targetHours = null) =>
  ({ id: id('as'), courseId: c.id, name, kind, weightPercent, dueDate, scorePercent, targetHours });
const calcMidterm = assess(calc, 'Midterm', 'midterm', 30, day(9), null, 14);
const dsAssignment = assess(ds, 'Assignment 2', 'project', 10, day(7));
const physMidterm = assess(phys, 'Midterm', 'midterm', 30, day(22));
const assessments = [
  assess(calc, 'Quiz 1', 'quiz', 10, day(-11), 88),
  calcMidterm,
  assess(calc, 'Quiz 2', 'quiz', 10, day(31)),
  assess(calc, 'Final exam', 'exam', 50, day(71)),
  assess(ds, 'Assignment 1', 'project', 10, day(-14), 95),
  dsAssignment,
  assess(ds, 'Midterm', 'midterm', 30, day(17)),
  assess(ds, 'Term project', 'project', 10, day(52)),
  assess(ds, 'Final exam', 'exam', 40, day(73)),
  assess(phys, 'Quiz 1', 'quiz', 5, day(-6), 78),
  assess(phys, 'Lab reports', 'lab', 20, null),
  physMidterm,
  assess(phys, 'Final exam', 'exam', 45, day(74)),
  assess(logic, 'Midterm', 'midterm', 35, day(24)),
  assess(logic, 'Lab work', 'lab', 25, null),
  assess(logic, 'Final exam', 'exam', 40, day(72)),
  // Weights below add up to 90%, on purpose: the app flags it.
  assess(writing, 'Essay 1', 'project', 30, day(-9), 91),
  assess(writing, 'Essay 2', 'project', 30, day(11)),
  assess(writing, 'Portfolio', 'project', 30, day(66)),
];

const block = (dayIndex, startMin, durationMin, target, status, energy = null) => ({
  id: id('bl'), date: day(dayIndex), startMin, durationMin,
  category: target ? 'study' : 'project',
  title: target ? `${courses.find((c) => c.id === target.courseId).name}: ${target.name}` : 'Project',
  courseId: target ? target.courseId : null,
  assessmentId: target ? target.id : null,
  status, energy,
});
const blocks = [
  block(0, at(14), 90, dsAssignment, 'done', 4),
  block(0, at(16), 60, calcMidterm, 'done', 3),
  block(1, at(14), 90, calcMidterm, 'done', 4),
  block(1, at(20, 30), 60, physMidterm, 'done', 2),
  block(2, at(13), 90, calcMidterm, 'done', 4),
  block(2, at(15), 90, dsAssignment, 'done', 3),
  block(2, at(19), 90, null, 'done', 4),
  block(3, at(14), 90, physMidterm, 'planned'),
  block(3, at(20), 90, calcMidterm, 'planned'),
  block(4, at(15, 30), 90, calcMidterm, 'planned'),
  block(5, at(13), 120, dsAssignment, 'planned'),
  block(6, at(10, 30), 90, calcMidterm, 'planned'),
];

const shifts = [
  { id: id('sh'), date: day(3), startMin: at(17), endMin: at(22), note: 'Bookstore' },
  { id: id('sh'), date: day(5), startMin: at(16), endMin: at(21), note: 'Bookstore' },
];

const dayLogs = [
  { id: id('dl'), date: day(0), energy: 4, sleepHours: 7.5 },
  { id: id('dl'), date: day(1), energy: 4, sleepHours: 7 },
  { id: id('dl'), date: day(2), energy: 3, sleepHours: 6.5 },
];

const backup = {
  format: 'capacity-desk-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  data: {
    fixedCommitments, shifts, trainingTemplates, trainingSessions, blocks, dayLogs, courses, assessments,
    settings: {
      onboarded: true, sleepStartMin: at(23, 30), sleepEndMin: at(7), dailyOverheadMin: 120,
      minSessionsPerWeek: 4, projectHoursPerWeek: 3, notifyTraining: false, notifyConflicts: false, trainingLeadMin: 30,
    },
    configOverrides: {},
  },
};

writeFileSync(new URL('../docs/sample-data.json', import.meta.url), JSON.stringify(backup, null, 2));
console.log(`Wrote docs/sample-data.json for the week of ${day(0)}.`);
