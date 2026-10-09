// Starts SQLite (sql.js, WebAssembly) and opens the saved database.

import initSqlJs from 'sql.js';
// Vite copies the .wasm file into the build and gives back its URL. It is loaded from
// inside the app package; nothing is downloaded at runtime.
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { fileStore } from './fileStore';
import { Repository } from './repository';

export interface OpenResult {
  repo: Repository;
  /** Set when the main file was unreadable and an older copy (or an empty database) was used. */
  recovered: 'backup' | 'empty' | null;
  /** True when nothing was saved on this device before. */
  fresh: boolean;
}

export async function openDatabase(): Promise<OpenResult> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const files = await fileStore.read();

  for (let i = 0; i < files.length; i++) {
    try {
      const repo = new Repository(new SQL.Database(files[i]));
      repo.loadAll(); // proves the file is a readable database before it is trusted
      return { repo, recovered: i === 0 ? null : 'backup', fresh: false };
    } catch (error) {
      // A newer-version file must not be replaced by an empty database.
      if (error instanceof Error && error.message.includes('newer version')) throw error;
    }
  }
  return { repo: new Repository(new SQL.Database()), recovered: files.length > 0 ? 'empty' : null, fresh: files.length === 0 };
}

let pending: Promise<void> = Promise.resolve();

/** Saves the database file. Saves are queued so two never write at the same time. */
export function persist(repo: Repository): Promise<void> {
  pending = pending.catch(() => undefined).then(() => fileStore.write(repo.exportBytes()));
  return pending;
}
