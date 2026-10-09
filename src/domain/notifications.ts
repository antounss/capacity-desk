// Decides which local notifications should exist. Pure: it returns a list, and
// src/data/notifications.ts hands that list to Android. The list is rebuilt after
// every change, so a moved session moves its reminder and a fixed conflict cancels its alert.

import type { ISODate, Settings } from './types';
import { DAY, addDays, fmtTime } from './time';
import type { Conflict } from './conflicts';
import { type Timeline, dayOfAbs, dayStart } from './timeline';

export interface PlannedNotification {
  /** Android needs a 32-bit integer id. Stable ids let a reschedule replace the old one. */
  id: number;
  kind: 'training' | 'conflict';
  title: string;
  body: string;
  date: ISODate;
  minute: number;
}

/** Fixed id for the one conflict digest, so it is replaced rather than stacked. */
export const CONFLICT_NOTIFICATION_ID = 1;

/** Small string hash (djb2), folded into a positive 31-bit integer above the fixed ids. */
function idFor(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 2_000_000_000) + 1000;
}

const INTENSITY = { 1: 'light', 2: 'moderate', 3: 'hard' } as const;

export function planNotifications(tl: Timeline, conflicts: Conflict[], settings: Settings): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const at = (abs: number) => ({ date: addDays(tl.origin, dayOfAbs(abs)), minute: abs - dayStart(dayOfAbs(abs)) });

  if (settings.notifyTraining) {
    for (const s of tl.sessions) {
      const fireAt = s.start - settings.trainingLeadMin;
      // Only the next 7 days: the list is rebuilt whenever the app is used.
      if (s.session.status !== 'planned' || fireAt <= tl.nowAbs || fireAt > tl.nowAbs + 7 * DAY) continue;
      out.push({
        id: idFor(`${s.session.id}:${s.start}`),
        kind: 'training',
        title: `${s.session.name} at ${fmtTime(s.start)}`,
        body: `${INTENSITY[s.session.intensity]} session, ${s.session.durationMin} min. Mark it done in Capacity Desk afterwards.`,
        ...at(fireAt),
      });
    }
  }

  if (settings.notifyConflicts) {
    const open = conflicts.filter((c) => c.severity !== 'info');
    if (open.length > 0) {
      // One digest the next morning, half an hour after wake-up, not one alert per conflict.
      const todayWake = dayStart(dayOfAbs(tl.nowAbs)) + settings.sleepEndMin + 30;
      const fireAt = todayWake > tl.nowAbs ? todayWake : todayWake + DAY;
      out.push({
        id: CONFLICT_NOTIFICATION_ID,
        kind: 'conflict',
        title: open.length === 1 ? '1 conflict in your week' : `${open.length} conflicts in your week`,
        body: open[0].title,
        ...at(fireAt),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.minute - b.minute);
}
