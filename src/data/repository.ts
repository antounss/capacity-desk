// Reads and writes AppData in SQLite. The Repository only talks SQL to a sql.js
// Database; where the database file is kept is the job of fileStore.ts.

import type { Database, SqlValue } from 'sql.js';
import { emptyData } from '../config/defaultConfig';
import type { EntityOf } from '../domain/fixes';
import { COLLECTIONS, ENTITY_FIELDS, type Field, validateEntity, validateSettings } from '../domain/schema';
import type { AppData, CollectionName, Config, DeepPartial, Settings } from '../domain/types';
import { MIGRATIONS } from './migrations';

/** "trainingSessions" -> "training_sessions", "startMin" -> "start_min". */
export const snakeCase = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function userVersion(db: Database): number {
  return Number(db.exec('PRAGMA user_version')[0].values[0][0]);
}

/** Brings a database up to the current schema. Safe to call on every start. */
export function migrate(db: Database): void {
  const applied = userVersion(db);
  if (applied > MIGRATIONS.length) {
    throw new Error('This data was saved by a newer version of Capacity Desk. Update the app to open it.');
  }
  for (let i = applied; i < MIGRATIONS.length; i++) {
    // Each migration is all-or-nothing, so a crash cannot leave half a schema behind.
    db.run('BEGIN');
    try {
      db.run(MIGRATIONS[i]);
      db.run(`PRAGMA user_version = ${i + 1}`);
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }
}

function toColumn(field: Field, value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (field.type === 'bool') return value ? 1 : 0;
  return value as SqlValue;
}

function fromColumn(field: Field, value: SqlValue): unknown {
  if (value === null) return null;
  if (field.type === 'bool') return value === 1;
  return value;
}

export class Repository {
  constructor(private readonly db: Database) {
    migrate(db);
  }

  loadAll(): AppData {
    const data = emptyData();
    const store = data as unknown as Record<string, unknown>;
    for (const collection of COLLECTIONS) store[collection] = this.loadCollection(collection);
    data.settings = validateSettings(this.readJson('settings'));
    const overrides = this.readJson('configOverrides');
    data.configOverrides = (typeof overrides === 'object' && overrides !== null ? overrides : {}) as DeepPartial<Config>;
    return data;
  }

  private loadCollection<K extends CollectionName>(collection: K): EntityOf<K>[] {
    const fields = Object.entries(ENTITY_FIELDS[collection] as Record<string, Field>);
    const columns = fields.map(([name]) => snakeCase(name)).join(', ');
    const statement = this.db.prepare(`SELECT ${columns} FROM ${snakeCase(collection)}`);
    const out: EntityOf<K>[] = [];
    try {
      while (statement.step()) {
        const row = statement.get();
        const raw: Record<string, unknown> = {};
        fields.forEach(([name, field], i) => { raw[name] = fromColumn(field, row[i]); });
        // Rows are validated on the way out as well, so one bad row cannot crash the app.
        const entity = validateEntity(collection, raw);
        if (entity) out.push(entity);
      }
    } finally {
      statement.free();
    }
    return out;
  }

  upsert<K extends CollectionName>(collection: K, entity: EntityOf<K>): void {
    const fields = Object.entries(ENTITY_FIELDS[collection] as Record<string, Field>);
    const columns = fields.map(([name]) => snakeCase(name)).join(', ');
    const marks = fields.map(() => '?').join(', ');
    const values = fields.map(([name, field]) => toColumn(field, (entity as unknown as Record<string, unknown>)[name]));
    this.db.run(`INSERT OR REPLACE INTO ${snakeCase(collection)} (${columns}) VALUES (${marks})`, values);
  }

  remove(collection: CollectionName, id: string): void {
    this.db.run(`DELETE FROM ${snakeCase(collection)} WHERE id = ?`, [id]);
  }

  saveSettings(settings: Settings): void {
    this.writeJson('settings', settings);
  }

  saveConfigOverrides(overrides: DeepPartial<Config>): void {
    this.writeJson('configOverrides', overrides);
  }

  /** Replaces everything in one transaction. Used by import and by "erase all data". */
  replaceAll(data: AppData): void {
    this.transaction(() => {
      for (const collection of COLLECTIONS) {
        this.db.run(`DELETE FROM ${snakeCase(collection)}`);
        for (const entity of data[collection]) this.upsert(collection, entity as never);
      }
      this.saveSettings(data.settings);
      this.saveConfigOverrides(data.configOverrides);
    });
  }

  /** Runs several writes as one unit: all of them are saved, or none. */
  transaction(work: () => void): void {
    this.db.run('BEGIN');
    try {
      work();
      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  /** The whole database as the bytes of a normal SQLite file. */
  exportBytes(): Uint8Array {
    return this.db.export();
  }

  private readJson(key: string): unknown {
    const result = this.db.exec('SELECT value FROM settings WHERE key = ?', [key]);
    const text = result[0]?.values[0]?.[0];
    if (typeof text !== 'string') return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  }
}
