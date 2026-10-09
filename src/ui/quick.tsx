// The four quick actions, plus the sheets for editing a block or a dated session.
// The logging sheets are built to be finished in a few taps: every field has a
// sensible default and the common answers are one-tap buttons.

import { Check } from 'lucide-react';
import { useState } from 'react';
import { nextAssessmentId } from '../app/actions';
import { newId, useApp } from '../app/store';
import { addDays, fmtDate, fmtTime, weekStartOf } from '../domain/time';
import { type ResolvedSession, sessionsOn } from '../domain/timeline';
import type { Block, EnergyLevel, Now, TrainingSession } from '../domain/types';
import { Button, Choice, DateInput, ENERGY_OPTIONS, Empty, Field, NumberInput, Select, Sheet, TextInput, TimeInput } from './kit';
import { INTENSITY_LABEL, INTENSITY_OPTIONS, LOAD_OPTIONS } from './labels';

const DURATIONS = [25, 50, 90, 120];
const LAST_LOG_KEY = 'capacitydesk.lastLog';

/** What the user picked last time, so the next log starts from it. A convenience only. */
function readLastLog(): { what: string; minutes: number } | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LAST_LOG_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object' && 'what' in parsed && 'minutes' in parsed) {
      return { what: String(parsed.what), minutes: Number(parsed.minutes) };
    }
  } catch { /* storage unavailable: start from defaults */ }
  return null;
}

/** Options for "what was it": each course, then project and general study. */
function useWhatOptions() {
  const { data } = useApp();
  return [
    ...data.courses.map((c) => ({ value: c.id, label: c.name })),
    { value: 'project', label: 'Project' },
    { value: 'other', label: 'Other study' },
  ];
}

function describeWhat(data: ReturnType<typeof useApp>['data'], what: string, today: string) {
  const course = data.courses.find((c) => c.id === what);
  if (!course) {
    return { category: what === 'project' ? 'project' as const : 'study' as const, title: what === 'project' ? 'Project' : 'Study', courseId: null, assessmentId: null };
  }
  const assessmentId = nextAssessmentId(data, course.id, today);
  const assessment = data.assessments.find((a) => a.id === assessmentId);
  return { category: 'study' as const, title: assessment ? `${course.name}: ${assessment.name}` : course.name, courseId: course.id, assessmentId };
}

export function LogBlockSheet({ now, onClose }: { now: Now; onClose: () => void }) {
  const { data, apply } = useApp();
  const options = useWhatOptions();
  const last = readLastLog();
  const [what, setWhat] = useState(options.some((o) => o.value === last?.what) ? last!.what : options[0].value);
  const [minutes, setMinutes] = useState<number | null>(last?.minutes && last.minutes > 0 ? last.minutes : 50);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [custom, setCustom] = useState(false);
  // By default the block is assumed to have just ended.
  const [date, setDate] = useState(now.date);
  const [startMin, setStartMin] = useState<number | null>(null);
  const valid = minutes != null && minutes >= 5 && minutes <= 720;

  const save = () => {
    if (!valid) return;
    let start = startMin ?? now.minute - minutes;
    let day = date;
    if (start < 0) { start += 1440; day = addDays(date, -1); } // it started before midnight
    const block: Block = {
      id: newId(), date: day, startMin: start, durationMin: Math.round(minutes), status: 'done', energy,
      ...describeWhat(data, what, now.date),
    };
    apply([{ op: 'upsert', collection: 'blocks', entity: block }]);
    try { localStorage.setItem(LAST_LOG_KEY, JSON.stringify({ what, minutes })); } catch { /* convenience only */ }
    onClose();
  };

  return (
    <Sheet title="Log a finished block" onClose={onClose}>
      <Choice label="What did you work on" value={what} onChange={setWhat} options={options} columns={2} />
      <Choice label="For how long" value={minutes} onChange={setMinutes} columns={4}
        options={DURATIONS.map((m) => ({ value: m, label: `${m} min` }))} />
      <Choice<EnergyLevel | null> label="Energy during it" value={energy} onChange={setEnergy} options={ENERGY_OPTIONS} />
      {custom ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
          <Field label="Started"><TimeInput value={startMin ?? Math.max(0, now.minute - (minutes ?? 0))} onChange={setStartMin} /></Field>
          <Field label="Minutes"><NumberInput value={minutes} onChange={setMinutes} min={5} max={720} step={5} /></Field>
        </div>
      ) : (
        <button type="button" className="self-start text-sm text-muted underline" onClick={() => setCustom(true)}>
          It ended just now. Change the time or length
        </button>
      )}
      <Button tone="primary" disabled={!valid} onClick={save}>Log block</Button>
    </Sheet>
  );
}

export function EnergySheet({ now, onClose }: { now: Now; onClose: () => void }) {
  const { data, apply } = useApp();
  const log = data.dayLogs.find((l) => l.date === now.date);
  const save = (changes: { energy?: EnergyLevel | null; sleepHours?: number | null }) => {
    apply([{
      op: 'upsert', collection: 'dayLogs',
      entity: { id: log?.id ?? newId(), date: now.date, energy: log?.energy ?? null, sleepHours: log?.sleepHours ?? null, ...changes },
    }]);
  };
  const sleep = log?.sleepHours ?? null;

  return (
    <Sheet title={`Check-in for ${fmtDate(now.date)}`} onClose={onClose}>
      <Choice<EnergyLevel | null> label="How much energy do you have today" value={log?.energy ?? null} onChange={(energy) => save({ energy })} options={ENERGY_OPTIONS} />
      <p className="text-sm text-muted">
        {log?.energy != null
          ? 'Saved. Today is now planned from this instead of the prediction.'
          : 'One tap saves it. Without a check-in, today is predicted from yesterday’s training and last night’s sleep.'}
      </p>
      <Field label="Hours slept last night (optional)" hint="Overrides the estimate made from your plan.">
        <NumberInput value={sleep} onChange={(sleepHours) => save({ sleepHours: sleepHours != null && sleepHours >= 0 && sleepHours <= 24 ? sleepHours : null })} min={0} max={24} step={0.5} placeholder="Not logged" />
      </Field>
      <Button tone="primary" onClick={onClose}>Done</Button>
    </Sheet>
  );
}

/** The stored form of a session shown on screen. An untouched template slot gets a new row. */
function toStored(s: ResolvedSession): TrainingSession {
  const { stored, ...fields } = s;
  return { ...fields, id: stored ? s.id : newId() };
}

export function TrainedSheet({ now, onClose, onAddUnplanned }: { now: Now; onClose: () => void; onAddUnplanned: () => void }) {
  const { data, apply } = useApp();
  const today = sessionsOn(now.date, data.trainingTemplates, data.trainingSessions);
  const setStatus = (s: ResolvedSession, status: TrainingSession['status']) =>
    apply([{ op: 'upsert', collection: 'trainingSessions', entity: { ...toStored(s), status } }]);

  return (
    <Sheet title="Today’s training" onClose={onClose}>
      {today.length === 0 ? <Empty>No session is planned for today.</Empty> : (
        <ul className="flex flex-col">
          {today.map((s) => (
            <li key={s.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${s.status === 'skipped' ? 'text-muted line-through' : ''}`}>{s.name}</div>
                <div className="num text-sm text-muted">{fmtTime(s.startMin)}, {s.durationMin} min, {INTENSITY_LABEL[s.intensity].toLowerCase()}</div>
              </div>
              {s.status === 'planned' ? (
                <>
                  <Button onClick={() => setStatus(s, 'skipped')}>Skip</Button>
                  <Button tone="primary" onClick={() => setStatus(s, 'done')}><Check size={18} aria-hidden />Done</Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">{s.status === 'done' ? 'Done' : 'Skipped'}</span>
                  <Button onClick={() => setStatus(s, 'planned')}>Undo</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button onClick={onAddUnplanned}>Log a session that was not planned</Button>
    </Sheet>
  );
}

/** Plan a new block, or edit one. */
export function BlockSheet({ item, defaultDate, defaultStart, now, onClose }: {
  item?: Block; defaultDate: string; defaultStart?: number; now: Now; onClose: () => void;
}) {
  const { data, apply } = useApp();
  const options = useWhatOptions();
  const initialWhat = item ? (item.courseId ?? (item.category === 'project' ? 'project' : 'other')) : options[0].value;
  const [what, setWhat] = useState(options.some((o) => o.value === initialWhat) ? initialWhat : 'other');
  const [title, setTitle] = useState(item?.title ?? '');
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [startMin, setStart] = useState(item?.startMin ?? defaultStart ?? 9 * 60);
  const [minutes, setMinutes] = useState<number | null>(item?.durationMin ?? 90);
  const [status, setStatus] = useState(item?.status ?? 'planned');
  const [energy, setEnergy] = useState<EnergyLevel | null>(item?.energy ?? null);
  const valid = date && minutes != null && minutes >= 5 && minutes <= 720;

  const save = () => {
    if (!valid || minutes == null) return;
    const described = describeWhat(data, what, now.date);
    // Keep the link to the same assessment when the course has not changed.
    const keepLink = item && item.courseId === described.courseId;
    apply([{
      op: 'upsert', collection: 'blocks',
      entity: {
        id: item?.id ?? newId(), date, startMin, durationMin: Math.round(minutes), status,
        energy: status === 'done' ? energy : null,
        ...described,
        assessmentId: keepLink ? item.assessmentId : described.assessmentId,
        title: title.trim() || described.title,
      },
    }]);
    onClose();
  };

  return (
    <Sheet title={item ? 'Edit block' : 'Plan a block'} onClose={onClose}>
      <Field label="What"><Select value={what} onChange={setWhat} options={options} /></Field>
      <Field label="Label (optional)"><TextInput value={title} onChange={setTitle} placeholder="Chapter 4 problem set" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
        <Field label="Starts"><TimeInput value={startMin} onChange={setStart} /></Field>
        <Field label="Minutes"><NumberInput value={minutes} onChange={setMinutes} min={5} max={720} step={5} /></Field>
      </div>
      <Choice label="Status" value={status} onChange={setStatus} options={[
        { value: 'planned', label: 'Planned' }, { value: 'done', label: 'Done' }, { value: 'skipped', label: 'Skipped' },
      ]} />
      {status === 'done' ? <Choice<EnergyLevel | null> label="Energy during it" value={energy} onChange={setEnergy} options={ENERGY_OPTIONS} /> : null}
      <div className="flex gap-2">
        {item ? <Button tone="danger" onClick={() => { apply([{ op: 'remove', collection: 'blocks', id: item.id }]); onClose(); }}>Delete</Button> : null}
        <Button tone="primary" className="flex-1" disabled={!valid} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}

/** Edit one dated session (move it, mark it, change it for this week), or log a one-off. */
export function SessionSheet({ item, defaultDate, defaultStatus = 'planned', onClose }: {
  item?: ResolvedSession; defaultDate: string; defaultStatus?: TrainingSession['status']; onClose: () => void;
}) {
  const { apply } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [startMin, setStart] = useState(item?.startMin ?? 18 * 60);
  const [minutes, setMinutes] = useState<number | null>(item?.durationMin ?? 60);
  const [load, setLoad] = useState(item?.load ?? 'push');
  const [intensity, setIntensity] = useState(item?.intensity ?? 2);
  const [status, setStatus] = useState(item?.status ?? defaultStatus);
  const valid = name.trim() && date && minutes != null && minutes >= 5 && minutes <= 600;

  const save = () => {
    if (!valid || minutes == null) return;
    const base: TrainingSession = item
      ? toStored(item)
      : { id: newId(), templateId: null, weekStart: weekStartOf(date), date, startMin, durationMin: 60, name: '', load, intensity, status };
    apply([{
      op: 'upsert', collection: 'trainingSessions',
      entity: { ...base, name: name.trim(), date, startMin, durationMin: Math.round(minutes), load, intensity, status },
    }]);
    onClose();
  };

  return (
    <Sheet title={item ? `${item.name} this week` : 'Add a one-off session'} onClose={onClose}>
      {item?.templateId ? <p className="text-sm text-muted">Changes here apply to this week only. The weekly split is edited in Schedule.</p> : null}
      <Field label="Name"><TextInput value={name} onChange={setName} placeholder="Run" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
        <Field label="Starts"><TimeInput value={startMin} onChange={setStart} /></Field>
        <Field label="Minutes"><NumberInput value={minutes} onChange={setMinutes} min={5} max={600} step={5} /></Field>
      </div>
      <Field label="What it loads"><Select value={load} onChange={setLoad} options={LOAD_OPTIONS} /></Field>
      <Choice label="Intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} />
      <Choice label="Status" value={status} onChange={setStatus} options={[
        { value: 'planned', label: 'Planned' }, { value: 'done', label: 'Done' }, { value: 'skipped', label: 'Skipped' },
      ]} />
      <div className="flex gap-2">
        {item?.stored && item.templateId ? (
          <Button onClick={() => { apply([{ op: 'remove', collection: 'trainingSessions', id: item.id }]); onClose(); }}>Reset to weekly plan</Button>
        ) : null}
        {item?.stored && !item.templateId ? (
          <Button tone="danger" onClick={() => { apply([{ op: 'remove', collection: 'trainingSessions', id: item.id }]); onClose(); }}>Delete</Button>
        ) : null}
        <Button tone="primary" className="flex-1" disabled={!valid} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
