// The lists of classes, training sessions, shifts and courses. Used by the Schedule
// screen and by first-run setup, so both edit the same data the same way.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../app/store';
import { WEEKDAYS, addDays, fmtDate, fmtHours, fmtTime, spanLength } from '../domain/time';
import type { Course, FixedCommitment, Shift, TrainingTemplate } from '../domain/types';
import { CommitmentSheet, CourseSheet, ShiftSheet, TemplateSheet } from './editors';
import { Button, Empty } from './kit';
import { INTENSITY_LABEL, LOAD_LABEL } from './labels';

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button className="mt-2 w-full" onClick={onClick}><Plus size={18} aria-hidden />{label}</Button>;
}

function ListRow({ primary, secondary, onClick }: { primary: string; secondary: string; onClick: () => void }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
        <span className="min-w-0 truncate font-medium">{primary}</span>
        <span className="num shrink-0 text-sm text-muted">{secondary}</span>
      </button>
    </li>
  );
}

export function CommitmentList() {
  const { data } = useApp();
  const [open, setOpen] = useState<{ item?: FixedCommitment } | null>(null);
  const sorted = [...data.fixedCommitments].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  const weeklyMin = sorted.reduce((s, c) => s + spanLength(c.startMin, c.endMin), 0);
  return (
    <div>
      {sorted.length === 0 ? <Empty>Nothing yet. Add each class once and tick the days it repeats on.</Empty> : (
        <>
          <p className="num text-sm text-muted">{fmtHours(weeklyMin)} h a week</p>
          <ul>
            {sorted.map((c) => (
              <ListRow key={c.id} primary={c.title} secondary={`${WEEKDAYS[c.weekday]} ${fmtTime(c.startMin)} to ${fmtTime(c.endMin)}`} onClick={() => setOpen({ item: c })} />
            ))}
          </ul>
        </>
      )}
      <AddButton label="Add a class or fixed commitment" onClick={() => setOpen({})} />
      {open ? <CommitmentSheet item={open.item} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

export function TemplateList() {
  const { data } = useApp();
  const [open, setOpen] = useState<{ item?: TrainingTemplate } | null>(null);
  const sorted = [...data.trainingTemplates].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  return (
    <div>
      {sorted.length === 0 ? <Empty>No sessions yet. Add the sessions you repeat every week.</Empty> : (
        <ul>
          {sorted.map((t) => (
            <ListRow
              key={t.id}
              primary={`${t.name} (${LOAD_LABEL[t.load].toLowerCase()}, ${INTENSITY_LABEL[t.intensity].toLowerCase()})`}
              secondary={`${WEEKDAYS[t.weekday]} ${fmtTime(t.startMin)}, ${t.durationMin} min`}
              onClick={() => setOpen({ item: t })}
            />
          ))}
        </ul>
      )}
      <AddButton label="Add a weekly session" onClick={() => setOpen({})} />
      {open ? <TemplateSheet item={open.item} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

export function ShiftList({ today }: { today: string }) {
  const { data } = useApp();
  const [open, setOpen] = useState<{ item?: Shift } | null>(null);
  // Old shifts stay in the data (and in exports) but are not listed forever.
  const recent = data.shifts.filter((s) => s.date >= addDays(today, -7)).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  return (
    <div>
      {recent.length === 0 ? <Empty>No shifts in the last week or ahead. Shifts are dated, because hours change week to week.</Empty> : (
        <ul>
          {recent.map((s) => (
            <ListRow
              key={s.id}
              primary={`${fmtDate(s.date)}${s.note ? `, ${s.note}` : ''}`}
              secondary={`${fmtTime(s.startMin)} to ${fmtTime(s.endMin)}, ${fmtHours(spanLength(s.startMin, s.endMin))} h`}
              onClick={() => setOpen({ item: s })}
            />
          ))}
        </ul>
      )}
      <AddButton label="Add a work shift" onClick={() => setOpen({})} />
      {open ? <ShiftSheet item={open.item} defaultDate={today} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

export function CourseList() {
  const { data } = useApp();
  const [open, setOpen] = useState<{ item?: Course } | null>(null);
  return (
    <div>
      {data.courses.length === 0 ? <Empty>No courses yet.</Empty> : (
        <ul>
          {data.courses.map((c) => (
            <ListRow key={c.id} primary={c.name} secondary={`${c.credits} credits, target ${c.targetPercent}%`} onClick={() => setOpen({ item: c })} />
          ))}
        </ul>
      )}
      <AddButton label="Add a course" onClick={() => setOpen({})} />
      {open ? <CourseSheet item={open.item} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

