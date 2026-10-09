// The week as a ledger of 168 hours: what is already spent, what is reserved for
// recovery, what is planned, and what is left. Unallocated hours are hatched.

import { useState } from 'react';
import type { Capacity } from '../../domain/capacity';
import type { EffectiveTotals } from '../../domain/energy';
import { fmtHours } from '../../domain/time';

interface Segment {
  label: string;
  minutes: number;
  className: string;
}

export function Ledger({ week, effective }: { week: Capacity; effective: EffectiveTotals }) {
  const [open, setOpen] = useState(false);
  const fixedMin = week.classMin + week.shiftMin + week.otherFixedMin + week.overheadMin;
  const over = week.bufferMin < 0;

  const segments: Segment[] = [
    { label: 'Sleep', minutes: week.sleepMin, className: 'bg-seg-sleep' },
    { label: 'Fixed', minutes: fixedMin, className: 'bg-seg-fixed' },
    { label: 'Training', minutes: week.trainingMin, className: 'bg-seg-training' },
    { label: 'Recovery', minutes: week.recoveryMin, className: 'bg-seg-recovery' },
    { label: 'Work', minutes: week.workMin, className: 'bg-seg-work' },
    over
      ? { label: 'Over', minutes: 0, className: '' }
      : { label: 'Buffer', minutes: week.bufferMin, className: 'hatch' },
  ];
  // When the plan is over capacity the parts add up to more than 168 h; the bar is
  // scaled to fit and the overflow is marked at the right-hand end.
  const drawn = segments.reduce((s, x) => s + x.minutes, 0) || 1;
  const overShare = over ? Math.min(1, -week.bufferMin / drawn) : 0;

  const effectiveTotal = effective.doneMin + effective.plannedMin;
  const summary = `Week of 168 hours: ${fmtHours(week.committedMin)} committed, ${fmtHours(week.recoveryMin)} recovery, `
    + `${fmtHours(week.workMin)} planned work, ${over ? `${fmtHours(-week.bufferMin)} over capacity` : `${fmtHours(week.bufferMin)} buffer`}.`;

  return (
    <div>
      <h1 className={`text-3xl leading-tight ${over ? 'text-critical' : ''}`}>
        {over ? `Over capacity by ${fmtHours(-week.bufferMin)} h` : `${fmtHours(week.bufferMin)} h of buffer this week`}
      </h1>
      <p className="mt-1 text-muted">
        {week.workMin > 0
          ? `${fmtHours(week.workMin)} h of work planned or logged, which counts as ${fmtHours(effectiveTotal)} focused hours at your energy.`
          : 'Nothing is planned yet. Flexible hours are what you can spend on study and projects.'}
      </p>

      <div role="img" aria-label={summary} className="relative mt-4 flex h-7 w-full overflow-hidden rounded-sm border border-line bg-surface">
        {segments.filter((s) => s.minutes > 0).map((s) => (
          <div key={s.label} className={s.className} style={{ width: `${(s.minutes / drawn) * 100}%` }} />
        ))}
        {over ? <div className="hatch-over absolute inset-y-0 right-0 bg-critical-soft" style={{ width: `${overShare * 100}%` }} /> : null}
      </div>

      <dl className="num mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <LedgerRow swatch="bg-seg-sleep" label="Sleep" minutes={week.sleepMin} />
        <LedgerRow swatch="bg-seg-fixed" label="Classes, shifts, commute, meals" minutes={fixedMin} />
        <LedgerRow swatch="bg-seg-training" label="Training" minutes={week.trainingMin} />
        <LedgerRow label="Committed" minutes={week.committedMin} strong note={`of ${fmtHours(week.totalMin)}`} />
        <LedgerRow swatch="bg-seg-recovery" label="Recovery, reserved first" minutes={week.recoveryMin} />
        <LedgerRow label="Flexible" minutes={week.flexibleMin} strong />
        <LedgerRow swatch="bg-seg-work" label="Study and project work" minutes={week.workMin} note={week.doneMin > 0 ? `${fmtHours(week.doneMin)} done` : undefined} />
        <LedgerRow swatch={over ? 'hatch-over' : 'hatch'} label={over ? 'Over capacity' : 'Buffer'} minutes={Math.abs(week.bufferMin)} strong critical={over} />
      </dl>

      <button type="button" className="mt-2 text-sm text-muted underline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the fixed breakdown' : 'Show the fixed breakdown'}
      </button>
      {open ? (
        <dl className="num mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-muted">
          <LedgerRow label="Classes" minutes={week.classMin} />
          <LedgerRow label="Work shifts" minutes={week.shiftMin} />
          <LedgerRow label="Commute and other" minutes={week.otherFixedMin} />
          <LedgerRow label="Meals and daily overhead" minutes={week.overheadMin} />
        </dl>
      ) : null}
    </div>
  );
}

function LedgerRow({ swatch, label, minutes, strong, note, critical }: {
  swatch?: string; label: string; minutes: number; strong?: boolean; note?: string; critical?: boolean;
}) {
  const tone = `${strong ? 'font-semibold' : ''} ${critical ? 'text-critical' : ''}`;
  return (
    <>
      <dt className={`flex items-center gap-2 ${tone}`}>
        <span aria-hidden className={`inline-block size-3 shrink-0 rounded-[2px] ${swatch ?? ''} ${swatch?.startsWith('hatch') ? 'border border-line' : ''}`} />
        {label}
      </dt>
      <dd className={`text-right ${tone}`}>
        {fmtHours(minutes)} h{note ? <span className="font-normal text-muted"> ({note})</span> : null}
      </dd>
    </>
  );
}
