import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { emptyData } from '../../src/config/defaultConfig';
import { COLLECTIONS, ENTITY_FIELDS } from '../../src/domain/schema';
import { MIGRATIONS } from '../../src/data/migrations';
import { Repository, migrate, snakeCase } from '../../src/data/repository';
import { MON, TUE, assessment, block, commitment, course, h, session, shift, template } from '../helpers';

// These tests run the real SQLite engine (compiled to WebAssembly), the same one the
// app ships, so the SQL here is the SQL that runs on the phone.
let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });

function sample() {
  const c = course({ name: 'Calculus' });
  const a = assessment(c.id, 40, { dueDate: '2026-10-20', targetHours: 12.5 });
  const d = emptyData();
  d.fixedCommitments = [commitment(0, h(8), h(10))];
  d.shifts = [shift(TUE, h(22), h(2), { note: "Night shift; it's long" })];
  d.trainingTemplates = [template(1, h(18))];
  d.trainingSessions = [session(MON, h(18), { status: 'done' })];
  d.blocks = [block(MON, h(9), 90, { courseId: c.id, assessmentId: a.id, status: 'done', energy: 4 }), block(TUE, h(9), 60)];
  d.dayLogs = [{ id: 'log1', date: MON, energy: 4, sleepHours: 7.5 }, { id: 'log2', date: TUE, energy: null, sleepHours: null }];
  d.courses = [c];
  d.assessments = [a];
  d.settings = { ...d.settings, onboarded: true, notifyTraining: true, projectHoursPerWeek: 4 };
  d.configOverrides = { energy: { factors: { 2: 0.5 } } };
  return d;
}

describe('schema', () => {
  it('every table has exactly the columns the domain types describe', () => {
    const db = new SQL.Database();
    migrate(db);
    for (const collection of COLLECTIONS) {
      const info = db.exec(`PRAGMA table_info(${snakeCase(collection)})`)[0];
      const columns = info.values.map((row) => String(row[1])).sort();
      const expected = Object.keys(ENTITY_FIELDS[collection]).map(snakeCase).sort();
      expect(columns, collection).toEqual(expected);
    }
  });

  it('migrating twice changes nothing, and the version matches the number of migrations', () => {
    const db = new SQL.Database();
    migrate(db);
    migrate(db);
    expect(db.exec('PRAGMA user_version')[0].values[0][0]).toBe(MIGRATIONS.length);
  });

  it('refuses to open data written by a newer app version rather than damaging it', () => {
    const db = new SQL.Database();
    db.run(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    expect(() => migrate(db)).toThrow('newer version');
  });
});

describe('reading and writing', () => {
  it('a fresh database loads as empty data with default settings', () => {
    expect(new Repository(new SQL.Database()).loadAll()).toEqual(emptyData());
  });

  it('everything written is read back identically, including nulls, booleans and decimals', () => {
    const repo = new Repository(new SQL.Database());
    const original = sample();
    repo.replaceAll(original);
    expect(repo.loadAll()).toEqual(original);
  });

  it('data survives closing and reopening the database file', () => {
    const first = new Repository(new SQL.Database());
    const original = sample();
    first.replaceAll(original);
    const bytes = first.exportBytes();

    const reopened = new Repository(new SQL.Database(bytes));
    expect(reopened.loadAll()).toEqual(original);
  });

  it('writes still work after an export (sql.js reopens the database when exporting)', () => {
    const repo = new Repository(new SQL.Database());
    repo.exportBytes();
    repo.upsert('shifts', shift(MON, h(9), h(17)));
    expect(repo.loadAll().shifts).toHaveLength(1);
  });

  it('upsert replaces a row with the same id; remove deletes it', () => {
    const repo = new Repository(new SQL.Database());
    const b = block(MON, h(9), 60);
    repo.upsert('blocks', b);
    repo.upsert('blocks', { ...b, durationMin: 90, status: 'done', energy: 5 });
    expect(repo.loadAll().blocks).toEqual([{ ...b, durationMin: 90, status: 'done', energy: 5 }]);
    repo.remove('blocks', b.id);
    expect(repo.loadAll().blocks).toEqual([]);
  });

  it('text is passed as a parameter, never pasted into SQL', () => {
    const repo = new Repository(new SQL.Database());
    const hostile = shift(MON, 0, 60, { note: "x'); DROP TABLE shifts; --" });
    repo.upsert('shifts', hostile);
    expect(repo.loadAll().shifts[0].note).toBe(hostile.note);
  });

  it('a failed replaceAll rolls back and leaves the old data in place', () => {
    const repo = new Repository(new SQL.Database());
    repo.upsert('shifts', shift(MON, h(9), h(17)));
    const broken = sample();
    // A row SQLite must reject: NOT NULL column set to null.
    (broken.shifts[0] as unknown as { note: null }).note = null;
    expect(() => repo.replaceAll(broken)).toThrow();
    const after = repo.loadAll();
    expect(after.shifts).toHaveLength(1);
    expect(after.courses).toEqual([]);
  });

  it('a row that no longer passes validation is skipped on load instead of crashing the app', () => {
    const db = new SQL.Database();
    const repo = new Repository(db);
    repo.upsert('blocks', block(MON, h(9), 60));
    db.run("INSERT INTO blocks (id, date, start_min, duration_min, category, title, status) VALUES ('bad', 'not-a-date', 0, 60, 'study', 'x', 'planned')");
    expect(repo.loadAll().blocks).toHaveLength(1);
  });
});
