// Interval arithmetic on a line of minutes. A Span is half-open: [start, end).

export interface Span {
  start: number;
  end: number;
}

export function length(s: Span): number {
  return Math.max(0, s.end - s.start);
}

export function total(spans: Span[]): number {
  return spans.reduce((sum, s) => sum + length(s), 0);
}

/** Sorts spans and joins any that touch or overlap. */
export function merge(spans: Span[]): Span[] {
  const sorted = spans.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** The parts of `spans` that fall inside [lo, hi). */
export function clip(spans: Span[], lo: number, hi: number): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const start = Math.max(s.start, lo);
    const end = Math.min(s.end, hi);
    if (end > start) out.push({ start, end });
  }
  return out;
}

/** The parts of `from` not covered by any span in `remove`. Result is merged. */
export function subtract(from: Span[], remove: Span[]): Span[] {
  const cuts = merge(remove);
  const out: Span[] = [];
  for (const base of merge(from)) {
    let cursor = base.start;
    for (const cut of cuts) {
      if (cut.end <= cursor) continue;
      if (cut.start >= base.end) break;
      if (cut.start > cursor) out.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
    }
    if (cursor < base.end) out.push({ start: cursor, end: base.end });
  }
  return out;
}

export function overlap(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}
