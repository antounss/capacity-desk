// Backup and export. JSON is the full backup and can be imported again.
// CSV is for looking at your own logs in a spreadsheet; it is export-only in v1.

import { emptyData } from '../config/defaultConfig';
import type { AppData } from './types';
import { COLLECTIONS, validateEntity, validateSettings } from './schema';
import { fmtTime } from './time';

export const BACKUP_FORMAT = 'capacity-desk-backup';
export const BACKUP_VERSION = 1;

export function exportJson(data: AppData, exportedAt: string): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, data }, null, 2);
}

export type ImportResult =
  | { ok: true; data: AppData; warnings: string[] }
  | { ok: false; error: string };

/**
 * Reads a backup. Nothing from the file is trusted: every row is validated, unknown
 * fields are dropped, and rows that fail are skipped and reported instead of imported.
 */
export function importJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const file = parsed as { format?: unknown; version?: unknown; data?: unknown };
  if (typeof parsed !== 'object' || parsed === null || file.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This is not a Capacity Desk backup file.' };
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app, then import again.' };
  }
  if (typeof file.data !== 'object' || file.data === null) {
    return { ok: false, error: 'The backup has no data section.' };
  }

  const source = file.data as Record<string, unknown>;
  const data = emptyData();
  const warnings: string[] = [];
  const store = data as unknown as Record<string, unknown>;

  for (const collection of COLLECTIONS) {
    const rows = Array.isArray(source[collection]) ? (source[collection] as unknown[]) : [];
    const seen = new Set<string>();
    const clean = [];
    for (const row of rows) {
      const entity = validateEntity(collection, row);
      if (!entity || seen.has(entity.id)) continue;
      seen.add(entity.id);
      clean.push(entity);
    }
    if (clean.length < rows.length) {
      warnings.push(`${rows.length - clean.length} invalid or duplicate row(s) skipped in ${collection}.`);
    }
    store[collection] = clean;
  }

  // Repair references so nothing points at a row that was skipped.
  const courseIds = new Set(data.courses.map((c) => c.id));
  const before = data.assessments.length;
  data.assessments = data.assessments.filter((a) => courseIds.has(a.courseId));
  if (data.assessments.length < before) {
    warnings.push(`${before - data.assessments.length} assessment(s) skipped because their course is missing.`);
  }
  const assessmentIds = new Set(data.assessments.map((a) => a.id));
  data.blocks = data.blocks.map((b) => ({
    ...b,
    courseId: b.courseId && courseIds.has(b.courseId) ? b.courseId : null,
    assessmentId: b.assessmentId && assessmentIds.has(b.assessmentId) ? b.assessmentId : null,
  }));

  data.settings = validateSettings(source.settings);
  const overrides = source.configOverrides;
  data.configOverrides = typeof overrides === 'object' && overrides !== null && !Array.isArray(overrides) ? overrides : {};
  return { ok: true, data, warnings };
}

/** Quotes a CSV cell, and defuses cells a spreadsheet would run as a formula. */
function cell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export function blocksToCsv(data: AppData): string {
  const courseName = new Map(data.courses.map((c) => [c.id, c.name]));
  const rows = [...data.blocks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
    .map((b) => [
      b.date, fmtTime(b.startMin), b.durationMin, b.category, b.title,
      b.courseId ? courseName.get(b.courseId) ?? '' : '', b.status, b.energy,
    ]);
  return csv([['date', 'start', 'duration_min', 'category', 'title', 'course', 'status', 'energy_1_to_5'], ...rows]);
}

export function dayLogsToCsv(data: AppData): string {
  const rows = [...data.dayLogs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => [l.date, l.energy, l.sleepHours]);
  return csv([['date', 'energy_1_to_5', 'sleep_hours'], ...rows]);
}
