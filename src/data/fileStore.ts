// Where the SQLite file lives.
//  - On the phone: the app's private data folder. No other app can read it, and
//    Android deletes it when the app is uninstalled.
//  - In a browser (development only): localStorage.

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export interface FileStore {
  /** The saved database files to try, newest first. Empty on first run. */
  read(): Promise<Uint8Array[]>;
  write(bytes: Uint8Array): Promise<void>;
}

const NAME = 'capacitydesk.db';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // In chunks, because spreading a large array into fromCharCode overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const dir = Directory.Data;

async function readIfPresent(path: string): Promise<Uint8Array | null> {
  try {
    const file = await Filesystem.readFile({ path, directory: dir });
    return typeof file.data === 'string' ? fromBase64(file.data) : null;
  } catch {
    return null; // the file does not exist yet
  }
}

const ignore = () => undefined;

/**
 * Saving never overwrites the good file directly:
 *   1. write the new database to capacitydesk.db.tmp
 *   2. rename the current file to capacitydesk.db.bak
 *   3. rename the .tmp file into place
 * If the app is killed part-way, either the main file or the .bak file is intact,
 * and read() offers both.
 */
const nativeStore: FileStore = {
  async read() {
    const files = await Promise.all([readIfPresent(NAME), readIfPresent(`${NAME}.bak`)]);
    return files.filter((f): f is Uint8Array => f !== null);
  },
  async write(bytes) {
    await Filesystem.writeFile({ path: `${NAME}.tmp`, directory: dir, data: toBase64(bytes) });
    await Filesystem.deleteFile({ path: `${NAME}.bak`, directory: dir }).catch(ignore);
    await Filesystem.rename({ from: NAME, to: `${NAME}.bak`, directory: dir }).catch(ignore);
    await Filesystem.rename({ from: `${NAME}.tmp`, to: NAME, directory: dir });
  },
};

const browserStore: FileStore = {
  async read() {
    const saved = localStorage.getItem(NAME);
    return saved ? [fromBase64(saved)] : [];
  },
  async write(bytes) {
    localStorage.setItem(NAME, toBase64(bytes));
  },
};

export const fileStore: FileStore = Capacitor.isNativePlatform() ? nativeStore : browserStore;
