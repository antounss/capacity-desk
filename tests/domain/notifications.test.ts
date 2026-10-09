import { describe, expect, it } from 'vitest';
import { analyzeWeek } from '../../src/domain/analyze';
import { CONFLICT_NOTIFICATION_ID, planNotifications } from '../../src/domain/notifications';
import type { AppData, Now } from '../../src/domain/types';
import { MON, THU, TUE, block, data, h, session, shift, template } from '../helpers';

function plan(d: AppData, now: Now) {
  const result = analyzeWeek(d, MON, now);
  return planNotifications(result.tl, result.conflicts, d.settings);
}

const withSettings = (d: AppData, s: Partial<AppData['settings']>) => ({ ...d, settings: { ...d.settings, ...s } });

describe('notifications are opt-in', () => {
  it('nothing is scheduled with the default settings', () => {
    const d = data({ trainingTemplates: [template(1, h(18))], shifts: [shift(THU, h(17), h(22))], blocks: [block(THU, h(18), 90)] });
    expect(plan(d, { date: MON, minute: h(8) })).toEqual([]);
  });
});

describe('training reminders', () => {
  it('fires 30 minutes before each planned session in the next 7 days', () => {
    const d = withSettings(data({ trainingTemplates: [template(1, h(18), { name: 'Legs', intensity: 3 })] }), { notifyTraining: true });
    const list = plan(d, { date: MON, minute: h(8) });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'training', date: TUE, minute: h(17, 30), title: 'Legs at 18:00' });
    expect(list[0].body).toContain('hard session, 60 min');
  });

  it('skips sessions that are done, skipped, or whose reminder time has passed', () => {
    const d = withSettings(
      data({
        trainingSessions: [
          session(MON, h(18), { status: 'done' }),
          session(TUE, h(7), {}), // reminder would be 06:30, already past at 08:00 on Tuesday
          session(THU, h(18), { status: 'skipped' }),
        ],
      }),
      { notifyTraining: true },
    );
    expect(plan(d, { date: TUE, minute: h(8) })).toEqual([]);
  });

  it('a moved session gets a different id, so the old reminder is replaced', () => {
    const before = withSettings(data({ trainingSessions: [session(TUE, h(18), { id: 'x' })] }), { notifyTraining: true });
    const after = withSettings(data({ trainingSessions: [session(THU, h(18), { id: 'x' })] }), { notifyTraining: true });
    const now = { date: MON, minute: 0 };
    expect(plan(before, now)[0].id).not.toBe(plan(after, now)[0].id);
  });
});

describe('conflict alerts', () => {
  const conflicted = () => withSettings(
    data({ shifts: [shift(THU, h(17), h(22))], blocks: [block(THU, h(18), 90, { title: 'Calculus review' })] }),
    { notifyConflicts: true },
  );

  it('one digest half an hour after the next wake-up, not one alert per conflict', () => {
    const list = plan(conflicted(), { date: MON, minute: h(20) });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: CONFLICT_NOTIFICATION_ID, kind: 'conflict', date: TUE, minute: h(7, 30) });
    expect(list[0].title).toBe('1 conflict in your week');
    expect(list[0].body).toContain('Calculus review');
  });

  it('before wake-up time it fires the same morning', () => {
    expect(plan(conflicted(), { date: MON, minute: h(5) })[0]).toMatchObject({ date: MON, minute: h(7, 30) });
  });

  it('no conflicts, no alert', () => {
    expect(plan(withSettings(data(), { notifyConflicts: true }), { date: MON, minute: h(8) })).toEqual([]);
  });
});
