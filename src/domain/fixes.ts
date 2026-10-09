// Turns a tapped fix into changes to stored data. Pure: it returns the changes and
// the app applies them, so every fix can be unit tested without a database.

import type { AppData, Block, CollectionName, TrainingSession } from './types';
import type { FixAction } from './conflicts/types';
import type { Timeline } from './timeline';

export type EntityOf<K extends CollectionName> = AppData[K][number];

/** One change to one collection, typed so a block can only be upserted into `blocks`. */
export type Mutation = {
  [K in CollectionName]:
    | { op: 'upsert'; collection: K; entity: EntityOf<K> }
    | { op: 'remove'; collection: K; id: string };
}[CollectionName];

/**
 * Stored form of a session shown on the timeline. A template slot that has never been
 * touched has no row yet, so changing it creates one that points back at the template.
 */
export function storedSession(tl: Timeline, sessionId: string, newId: () => string): TrainingSession | null {
  const found = tl.sessions.find((s) => s.session.id === sessionId)?.session;
  if (!found) return null;
  const { stored, ...fields } = found;
  return { ...fields, id: stored ? found.id : newId() };
}

export function applyFix(data: AppData, tl: Timeline, action: FixAction, newId: () => string): Mutation[] {
  switch (action.type) {
    case 'moveBlock': {
      const block = data.blocks.find((b) => b.id === action.blockId);
      if (!block) return [];
      return [{ op: 'upsert', collection: 'blocks', entity: { ...block, date: action.date, startMin: action.startMin } }];
    }
    case 'moveSession': {
      const session = storedSession(tl, action.sessionId, newId);
      if (!session) return [];
      // weekStart stays on the original week so the template slot there stays replaced.
      return [{ op: 'upsert', collection: 'trainingSessions', entity: { ...session, date: action.date, startMin: action.startMin } }];
    }
    case 'skipSession': {
      const session = storedSession(tl, action.sessionId, newId);
      if (!session) return [];
      return [{ op: 'upsert', collection: 'trainingSessions', entity: { ...session, status: 'skipped' } }];
    }
    case 'trimDay':
      return trimDay(data.blocks, action.date, action.minutes);
    case 'addBlocks':
      return action.blocks.map((block) => ({ op: 'upsert', collection: 'blocks', entity: { ...block, id: newId() } }));
    case 'open':
      return []; // navigation only; handled by the UI
  }
}

/** Removes `minutes` of planned work from a date, taking from the latest block first. */
function trimDay(blocks: Block[], date: string, minutes: number): Mutation[] {
  const planned = blocks
    .filter((b) => b.date === date && b.status === 'planned')
    .sort((a, b) => b.startMin - a.startMin);
  const out: Mutation[] = [];
  let left = minutes;
  for (const block of planned) {
    if (left <= 0) break;
    const cut = Math.min(left, block.durationMin);
    left -= cut;
    // A leftover under 15 minutes is not a block worth keeping.
    if (block.durationMin - cut < 15) out.push({ op: 'remove', collection: 'blocks', id: block.id });
    else out.push({ op: 'upsert', collection: 'blocks', entity: { ...block, durationMin: block.durationMin - cut } });
  }
  return out;
}

/** Applies mutations to a copy of the data. Used by tests and by the app's store. */
export function applyMutations(data: AppData, mutations: Mutation[]): AppData {
  const next: AppData = { ...data };
  for (const m of mutations) {
    const list = [...(next[m.collection] as { id: string }[])];
    const id = m.op === 'upsert' ? m.entity.id : m.id;
    const index = list.findIndex((e) => e.id === id);
    if (m.op === 'remove') {
      if (index >= 0) list.splice(index, 1);
    } else if (index >= 0) list[index] = m.entity;
    else list.push(m.entity);
    (next as unknown as Record<string, unknown>)[m.collection] = list;
  }
  return next;
}
