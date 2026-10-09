// The app's state: the stored data held in memory, and the only functions allowed to
// change it. Every change updates the screen first, then SQLite, then the file.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyData } from '../config/defaultConfig';
import { applyMutations, type Mutation } from '../domain/fixes';
import type { AppData, Config, DeepPartial, Settings } from '../domain/types';
import { openDatabase, persist } from '../data/database';
import type { Repository } from '../data/repository';

export const newId = (): string =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface AppStore {
  data: AppData;
  /** Set when the last change could not be written to storage. */
  saveFailed: boolean;
  /** A one-line note about how the data was loaded, when something unusual happened. */
  loadNote: string | null;
  apply(mutations: Mutation[]): void;
  updateSettings(changes: Partial<Settings>): void;
  setConfigOverrides(overrides: DeepPartial<Config>): void;
  replaceAll(data: AppData): void;
}

const AppContext = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const store = useContext(AppContext);
  if (!store) throw new Error('useApp must be used inside AppProvider');
  return store;
}

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export function AppProvider({ children, initialData }: { children: ReactNode; initialData?: AppData }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [data, setData] = useState<AppData>(emptyData);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const repoRef = useRef<Repository | null>(null);
  // The latest data, readable from callbacks without waiting for a re-render.
  const dataRef = useRef(data);

  useEffect(() => {
    let cancelled = false;
    openDatabase()
      .then(({ repo, recovered, fresh }) => {
        if (cancelled) return;
        repoRef.current = repo;
        if (fresh && initialData) {
          repo.replaceAll(initialData);
          persist(repo).catch(() => setSaveFailed(true));
        }
        dataRef.current = repo.loadAll();
        setData(dataRef.current);
        if (recovered === 'backup') setLoadNote('The last save was unreadable, so the previous save was loaded. Your most recent change may be missing.');
        if (recovered === 'empty') setLoadNote('The saved data could not be read. The app started empty; import a backup from Settings if you have one.');
        setStatus({ kind: 'ready' });
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => { cancelled = true; };
    // Runs once: the database is opened when the app starts.
  }, []);

  /** Shows `next` immediately, then writes it. `write` describes the same change in SQL terms. */
  const commit = useCallback((next: AppData, write: (repo: Repository) => void) => {
    dataRef.current = next;
    setData(next);
    const repo = repoRef.current;
    if (!repo) return;
    try {
      write(repo);
    } catch {
      setSaveFailed(true);
      return;
    }
    persist(repo).then(() => setSaveFailed(false), () => setSaveFailed(true));
  }, []);

  const store = useMemo<AppStore>(() => ({
    data,
    saveFailed,
    loadNote,
    apply(mutations) {
      if (mutations.length === 0) return;
      commit(applyMutations(dataRef.current, mutations), (repo) =>
        repo.transaction(() => {
          for (const m of mutations) {
            if (m.op === 'upsert') repo.upsert(m.collection, m.entity as never);
            else repo.remove(m.collection, m.id);
          }
        }));
    },
    updateSettings(changes) {
      const settings = { ...dataRef.current.settings, ...changes };
      commit({ ...dataRef.current, settings }, (repo) => repo.saveSettings(settings));
    },
    setConfigOverrides(configOverrides) {
      commit({ ...dataRef.current, configOverrides }, (repo) => repo.saveConfigOverrides(configOverrides));
    },
    replaceAll(next) {
      commit(next, (repo) => repo.replaceAll(next));
    },
  }), [data, saveFailed, loadNote, commit]);

  if (status.kind === 'loading') {
    return <div className="flex h-full items-center justify-center text-muted">Opening your data</div>;
  }
  if (status.kind === 'error') {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-2xl">Your data could not be opened</h1>
        <p className="text-muted">{status.message}</p>
        <p className="text-muted">Nothing has been deleted. Close the app and open it again; if this keeps happening, update the app.</p>
      </div>
    );
  }
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
