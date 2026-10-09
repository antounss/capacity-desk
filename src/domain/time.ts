// Date and time helpers. Dates are "YYYY-MM-DD" strings and are only ever converted
// through UTC day numbers, so daylight-saving changes cannot shift a date by a day.

import type { ISODate, Now } from './types';

export const DAY = 1440;
export const WEEK = 7 * DAY;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MS_PER_DAY = 86_400_000;

/** Whole days since 1970-01-01. */
export function dayNumber(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function isValidDate(date: unknown): date is ISODate {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return fromDayNumber(dayNumber(date)) === date;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromDayNumber(dayNumber(date) + n);
}

/** Days from a to b (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayOf(date: ISODate): number {
  // 1970-01-01 was a Thursday (index 3 when Monday is 0).
  return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

/** The Monday of the week containing `date`. */
export function weekStartOf(date: ISODate): ISODate {
  return addDays(date, -weekdayOf(date));
}

/** Length of a start/end pair where an end at or before the start means "next day". */
export function spanLength(startMin: number, endMin: number): number {
  return endMin > startMin ? endMin - startMin : endMin + DAY - startMin;
}

/** The device's local date and time, as the domain's Now. */
export function nowFrom(d: Date = new Date()): Now {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    minute: d.getHours() * 60 + d.getMinutes(),
  };
}

/** "18:30". Accepts minutes past midnight of any day. */
export function fmtTime(min: number): string {
  const m = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutes as hours with one decimal, without a trailing ".0": 90 -> "1.5", 120 -> "2". */
export function fmtHours(min: number): string {
  const h = Math.round((min / 60) * 10) / 10;
  return String(Object.is(h, -0) ? 0 : h);
}

/** "Thu". */
export function fmtWeekday(date: ISODate): string {
  return WEEKDAYS[weekdayOf(date)];
}

/** "Thu 8 Oct". */
export function fmtDate(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${fmtWeekday(date)} ${d} ${MONTHS[m - 1]}`;
}

/** Parses "18:30" to minutes after midnight, or null if it is not a time. */
export function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
