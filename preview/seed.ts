// The sample week from docs/sample-data.json, moved to the current week, so the
// preview opens on something that looks live whenever it is first opened.

import sample from '../docs/sample-data.json';
import { importJson } from '../src/domain/exportImport';
import { addDays, diffDays, isValidDate, nowFrom, weekStartOf } from '../src/domain/time';
import type { AppData } from '../src/domain/types';

export function sampleForThisWeek(): AppData | undefined {
  const today = nowFrom().date;
  const shiftDays = diffDays(weekStartOf(sample.data.shifts[0].date), weekStartOf(today));
  const moved: unknown = JSON.parse(JSON.stringify(sample), (_key, value) =>
    typeof value === 'string' && isValidDate(value) ? addDays(value, shiftDays) : value);

  const result = importJson(JSON.stringify(moved));
  if (!result.ok) return undefined;
  const data = result.data;

  // The sample was written as if it were Thursday. Anything it marks as done on a day
  // that has not happened yet goes back to planned.
  data.blocks = data.blocks.map((b) => (b.date > today && b.status === 'done' ? { ...b, status: 'planned', energy: null } : b));
  data.trainingSessions = data.trainingSessions.filter((s) => !(s.date > today && s.status === 'done'));
  data.dayLogs = data.dayLogs.filter((l) => l.date <= today);
  return data;
}
