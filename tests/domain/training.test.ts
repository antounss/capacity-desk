import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config/defaultConfig';
import { sessionsOn } from '../../src/domain/timeline';
import { findRestViolations, longestTrainingRun } from '../../src/domain/training';
import { FRI, MON, SAT, TUE, WED, data, h, session, template, timeline } from '../helpers';

const rules = defaultConfig.training.restRules;

describe('rest rules', () => {
  it('legs Tue 18:00-19:00 then legs Wed 18:00 is a 23 h gap: violates the 48 h rule', () => {
    const tl = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'legs', intensity: 3 }), session(WED, h(18), { load: 'legs', intensity: 3 })],
    }));
    const [v] = findRestViolations(tl.sessions, rules);
    expect(v.rule.id).toBe('legs');
    expect(v.gapMin).toBe(23 * 60);
  });

  it('legs Tue then legs Fri is a 71 h gap: allowed', () => {
    const tl = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'legs', intensity: 3 }), session(FRI, h(18), { load: 'legs', intensity: 3 })],
    }));
    expect(findRestViolations(tl.sessions, rules)).toEqual([]);
  });

  it('a full-body session counts against legs', () => {
    const tl = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'full', intensity: 2 }), session(WED, h(18), { load: 'legs', intensity: 2 })],
    }));
    expect(findRestViolations(tl.sessions, rules)).toHaveLength(1);
  });

  it('a light leg session is below the rule and is ignored; push and pull on back-to-back days are fine', () => {
    const light = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'legs', intensity: 1 }), session(WED, h(18), { load: 'legs', intensity: 3 })],
    }));
    expect(findRestViolations(light.sessions, rules)).toEqual([]);
    const split = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'push', intensity: 3 }), session(WED, h(18), { load: 'pull', intensity: 3 })],
    }));
    expect(findRestViolations(split.sessions, rules)).toEqual([]);
  });

  it('skipped sessions are not checked', () => {
    const tl = timeline(data({
      trainingSessions: [session(TUE, h(18), { load: 'legs', intensity: 3, status: 'skipped' }), session(WED, h(18), { load: 'legs', intensity: 3 })],
    }));
    expect(findRestViolations(tl.sessions, rules)).toEqual([]);
  });
});

describe('weekly split and per-week changes', () => {
  it('a template slot appears every week until a stored session replaces it for one week', () => {
    const legs = template(1, h(18), { name: 'Legs', load: 'legs' });
    expect(sessionsOn(TUE, [legs], [])).toHaveLength(1);

    // Moved to Saturday for the week of 2026-10-05 only.
    const moved = session(SAT, h(10), { templateId: legs.id, weekStart: MON, name: 'Legs', load: 'legs' });
    expect(sessionsOn(TUE, [legs], [moved])).toHaveLength(0);
    expect(sessionsOn(SAT, [legs], [moved])).toHaveLength(1);
    expect(sessionsOn('2026-10-13', [legs], [moved])).toHaveLength(1); // next Tuesday is untouched
  });
});

describe('rest days', () => {
  it('finds the longest run of consecutive training days', () => {
    expect(longestTrainingRun(new Set([0, 1, 2, 4, 5]), 0, 7)).toBe(3);
    expect(longestTrainingRun(new Set([0, 1, 2, 3, 4, 5, 6]), 0, 7)).toBe(7);
    expect(longestTrainingRun(new Set(), 0, 7)).toBe(0);
  });
});
