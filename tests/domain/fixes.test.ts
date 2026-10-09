import { describe, expect, it } from 'vitest';
import { applyFix, applyMutations, storedSession } from '../../src/domain/fixes';
import { MON, SAT, TUE, WED, block, data, h, session, template, timeline } from '../helpers';

const newId = () => 'generated';

describe('applying fixes', () => {
  it('moving an untouched template session stores a session that points back at the template', () => {
    const legs = template(1, h(18), { name: 'Legs', load: 'legs', intensity: 3 });
    const d = data({ trainingTemplates: [legs] });
    const tl = timeline(d);
    const shown = tl.sessions.find((s) => s.session.name === 'Legs' && s.start > 0 && s.start < 7 * 1440)!;

    const [m] = applyFix(d, tl, { type: 'moveSession', sessionId: shown.session.id, date: SAT, startMin: h(10) }, newId);
    expect(m).toEqual({
      op: 'upsert',
      collection: 'trainingSessions',
      entity: {
        id: 'generated', templateId: legs.id, weekStart: MON, date: SAT, startMin: h(10),
        durationMin: 60, name: 'Legs', load: 'legs', intensity: 3, status: 'planned',
      },
    });

    // After the move, Tuesday is empty and Saturday has the session, this week only.
    const after = timeline(applyMutations(d, [m]));
    const days = after.sessions.filter((s) => s.start >= 0 && s.start < 7 * 1440).map((s) => Math.floor(s.start / 1440));
    expect(days).toEqual([5]);
  });

  it('a session that is already stored keeps its id when changed', () => {
    const stored = session(TUE, h(18));
    const d = data({ trainingSessions: [stored] });
    expect(storedSession(timeline(d), stored.id, newId)?.id).toBe(stored.id);
  });

  it('skipping marks the session skipped rather than deleting it', () => {
    const stored = session(TUE, h(18));
    const d = data({ trainingSessions: [stored] });
    const [m] = applyFix(d, timeline(d), { type: 'skipSession', sessionId: stored.id }, newId);
    expect(m.op === 'upsert' && 'status' in m.entity && m.entity.status).toBe('skipped');
  });

  it('trimming a day cuts the latest planned block first, never touches done blocks, and drops slivers', () => {
    const done = block(WED, h(8), 120, { status: 'done' });
    const early = block(WED, h(11), 90);
    const late = block(WED, h(15), 60);
    const d = data({ blocks: [done, early, late] });

    // Cut 140 min: all 60 of the late block, then 80 of the 90-minute block. The 10
    // minutes left over is not worth keeping, so that block goes too.
    const after = applyMutations(d, applyFix(d, timeline(d), { type: 'trimDay', date: WED, minutes: 140 }, newId));
    expect(after.blocks.map((b) => b.id)).toEqual([done.id]);

    // Cut 30 min: the late block shrinks to 30.
    const small = applyMutations(d, applyFix(d, timeline(d), { type: 'trimDay', date: WED, minutes: 30 }, newId));
    expect(small.blocks.find((b) => b.id === late.id)?.durationMin).toBe(30);
    expect(small.blocks.find((b) => b.id === early.id)?.durationMin).toBe(90);
  });

  it('a fix for something that no longer exists changes nothing', () => {
    const d = data();
    expect(applyFix(d, timeline(d), { type: 'moveBlock', blockId: 'gone', date: MON, startMin: 0 }, newId)).toEqual([]);
    expect(applyFix(d, timeline(d), { type: 'skipSession', sessionId: 'gone' }, newId)).toEqual([]);
  });
});
