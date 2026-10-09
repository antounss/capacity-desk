// The seven-day strip and the agenda for the selected day.

import { Briefcase, BookOpen, Dumbbell, GraduationCap, Hammer, MapPin, Plus } from 'lucide-react';
import type { Analysis } from '../../domain/analyze';
import { blockFactor } from '../../domain/energy';
import { clip } from '../../domain/intervals';
import { DAY, WEEKDAYS, WEEKDAYS_LONG, addDays, fmtDate, fmtHours, fmtTime } from '../../domain/time';
import { type ResolvedSession, dayStart, sessionsOn } from '../../domain/timeline';
import type { AppData, Block, Shift } from '../../domain/types';
import { Button, Empty } from '../kit';
import { INTENSITY_LABEL } from '../labels';

export function DayStrip({ analysis, selected, onSelect }: { analysis: Analysis; selected: number; onSelect: (day: number) => void }) {
  const { tl, days } = analysis;
  const ceiling = tl.config.planner.maxFocusHoursPerDay * 60;
  return (
    <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Day of the week">
      {days.map((cap, day) => {
        const date = addDays(tl.origin, day);
        const isToday = date === tl.today;
        const isSelected = day === selected;
        const limit = Math.min(ceiling, cap.flexibleMin);
        const over = cap.workMin > limit + 1;
        const fill = Math.min(1, cap.workMin / Math.max(1, ceiling));
        const trains = tl.sessions.some((s) => s.start >= dayStart(day) && s.start < dayStart(day) + DAY);
        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={`${WEEKDAYS_LONG[day]}, ${fmtHours(cap.workMin)} hours planned${over ? ', over the limit' : ''}`}
            onClick={() => onSelect(day)}
            className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 ${isSelected ? 'border-ink bg-surface' : 'border-transparent'}`}
          >
            <span className={`text-sm ${isToday ? 'font-semibold text-accent' : 'text-muted'}`}>{WEEKDAYS[day]}</span>
            <span className="num font-display text-lg font-semibold">{Number(date.slice(8))}</span>
            {/* A small gauge: planned work against the daily focus ceiling. */}
            <span aria-hidden className="flex h-8 w-2 flex-col justify-end overflow-hidden rounded-sm bg-line">
              <span className={over ? 'bg-critical' : 'bg-seg-work'} style={{ height: `${fill * 100}%` }} />
            </span>
            <span aria-hidden className={`size-1.5 rounded-full ${trains ? 'bg-seg-training' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  );
}

interface AgendaItem {
  key: string;
  start: number;
  end: number;
  title: string;
  detail: string;
  Icon: typeof Plus;
  muted?: boolean;
  onClick?: () => void;
}

export function DayAgenda({ analysis, data, day, onPlan, onEditBlock, onEditSession, onEditShift }: {
  analysis: Analysis;
  data: AppData;
  day: number;
  onPlan: () => void;
  onEditBlock: (b: Block) => void;
  onEditSession: (s: ResolvedSession) => void;
  onEditShift: (s: Shift) => void;
}) {
  const { tl, days, dayEnergies } = analysis;
  const date = addDays(tl.origin, day);
  const lo = dayStart(day);
  const cap = days[day];
  const energy = dayEnergies[day];
  const items: AgendaItem[] = [];

  // Classes, commute and shifts are shown clipped to this day, so a shift that began
  // yesterday evening appears here from 00:00.
  for (const c of tl.commitments) {
    for (const span of clip([c], lo, lo + DAY)) {
      items.push({
        key: `c${c.id}${span.start}`, start: span.start - lo, end: span.end - lo, title: c.title,
        detail: c.kind === 'class' ? 'Class' : c.kind === 'commute' ? 'Commute' : 'Fixed',
        Icon: c.kind === 'class' ? GraduationCap : MapPin,
      });
    }
  }
  for (const s of tl.shifts) {
    const shift = data.shifts.find((x) => x.id === s.id);
    for (const span of clip([s], lo, lo + DAY)) {
      items.push({
        key: `s${s.id}${span.start}`, start: span.start - lo, end: span.end - lo, title: s.title,
        detail: 'Work shift', Icon: Briefcase, onClick: shift ? () => onEditShift(shift) : undefined,
      });
    }
  }
  for (const s of sessionsOn(date, data.trainingTemplates, data.trainingSessions)) {
    items.push({
      key: `t${s.id}`, start: s.startMin, end: s.startMin + s.durationMin, title: s.name,
      detail: `Training, ${INTENSITY_LABEL[s.intensity].toLowerCase()}${s.status === 'planned' ? '' : `, ${s.status}`}`,
      Icon: Dumbbell, muted: s.status === 'skipped', onClick: () => onEditSession(s),
    });
  }
  for (const b of data.blocks.filter((x) => x.date === date)) {
    const timed = tl.blocks.find((x) => x.block.id === b.id);
    const counts = timed ? `counts as ${fmtHours(b.durationMin * blockFactor(tl, timed))} h` : 'skipped';
    items.push({
      key: `b${b.id}`, start: b.startMin, end: b.startMin + b.durationMin, title: b.title,
      detail: `${b.status === 'done' ? 'Done' : b.status === 'planned' ? 'Planned' : 'Skipped'}, ${counts}`,
      Icon: b.category === 'project' ? Hammer : BookOpen, muted: b.status === 'skipped', onClick: () => onEditBlock(b),
    });
  }
  items.sort((a, b) => a.start - b.start);

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl">{fmtDate(date)}</h3>
        <span className="num text-sm text-muted">{fmtHours(cap.flexibleMin)} h flexible, {fmtHours(cap.workMin)} h planned</span>
      </div>
      <p className="num mt-1 text-sm text-muted">
        Energy factor {energy.factor.toFixed(2)}{energy.logged ? ' from your check-in' : ` predicted: ${energy.parts.map((p) => `${p.label} ${p.multiplier.toFixed(2)}`).join(' x ')}`}
      </p>

      {items.length === 0 ? <Empty>Nothing is booked on this day.</Empty> : (
        <ul className="mt-2">
          {items.map(({ key, start, end, title, detail, Icon, muted, onClick }) => {
            const body = (
              <>
                <span className="num w-[5.5rem] shrink-0 text-sm text-muted">{fmtTime(start)} to {fmtTime(end)}</span>
                <Icon size={18} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-medium ${muted ? 'text-muted line-through' : ''}`}>{title}</span>
                  <span className="num block text-sm text-muted">{detail}</span>
                </span>
              </>
            );
            return (
              <li key={key} className="border-b border-line last:border-b-0">
                {onClick
                  ? <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left">{body}</button>
                  : <div className="flex items-center gap-3 py-2.5">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      <Button className="mt-3 w-full" onClick={onPlan}><Plus size={18} aria-hidden />Plan a block on {WEEKDAYS_LONG[day]}</Button>
    </div>
  );
}
