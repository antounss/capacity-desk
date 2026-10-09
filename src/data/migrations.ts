// The database schema, as a list of migrations. SQLite stores how many have been
// applied in PRAGMA user_version. To change the schema, append a new entry; never
// edit an entry that has shipped, because existing phones have already run it.
//
// Column names are the snake_case form of the field names in src/domain/types.ts.
// tests/data/repository.test.ts fails if the two ever disagree.

export const MIGRATIONS: string[] = [
  // 1: initial schema
  `
  CREATE TABLE fixed_commitments (
    id        TEXT PRIMARY KEY,
    kind      TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    weekday   INTEGER NOT NULL,
    start_min INTEGER NOT NULL,
    end_min   INTEGER NOT NULL
  );

  CREATE TABLE shifts (
    id        TEXT PRIMARY KEY,
    date      TEXT    NOT NULL,
    start_min INTEGER NOT NULL,
    end_min   INTEGER NOT NULL,
    note      TEXT    NOT NULL
  );

  CREATE TABLE training_templates (
    id           TEXT PRIMARY KEY,
    weekday      INTEGER NOT NULL,
    start_min    INTEGER NOT NULL,
    duration_min INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    load         TEXT    NOT NULL,
    intensity    INTEGER NOT NULL
  );

  CREATE TABLE training_sessions (
    id           TEXT PRIMARY KEY,
    template_id  TEXT,
    week_start   TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    start_min    INTEGER NOT NULL,
    duration_min INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    load         TEXT    NOT NULL,
    intensity    INTEGER NOT NULL,
    status       TEXT    NOT NULL
  );

  CREATE TABLE blocks (
    id            TEXT PRIMARY KEY,
    date          TEXT    NOT NULL,
    start_min     INTEGER NOT NULL,
    duration_min  INTEGER NOT NULL,
    category      TEXT    NOT NULL,
    title         TEXT    NOT NULL,
    course_id     TEXT,
    assessment_id TEXT,
    status        TEXT    NOT NULL,
    energy        INTEGER
  );

  CREATE TABLE day_logs (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    energy      INTEGER,
    sleep_hours REAL
  );

  CREATE TABLE courses (
    id             TEXT PRIMARY KEY,
    name           TEXT    NOT NULL,
    credits        REAL    NOT NULL,
    difficulty     INTEGER NOT NULL,
    target_percent REAL    NOT NULL
  );

  CREATE TABLE assessments (
    id             TEXT PRIMARY KEY,
    course_id      TEXT NOT NULL,
    name           TEXT NOT NULL,
    kind           TEXT NOT NULL,
    weight_percent REAL NOT NULL,
    due_date       TEXT,
    score_percent  REAL,
    target_hours   REAL
  );

  -- Settings and tuning overrides, stored as JSON under a key.
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX blocks_by_date ON blocks (date);
  CREATE INDEX shifts_by_date ON shifts (date);
  CREATE INDEX sessions_by_date ON training_sessions (date);
  `,
];
