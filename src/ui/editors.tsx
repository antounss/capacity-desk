// Add/edit sheets for the things that are set up once and changed rarely:
// classes and other fixed commitments, the training split, shifts, courses, assessments.

import { useState } from 'react';
import { removeAssessment, removeCourse, removeTemplate } from '../app/actions';
import { newId, useApp } from '../app/store';
import { targetHoursFor } from '../domain/grades';
import { resolveConfig } from '../config/defaultConfig';
import { fmtHours, spanLength } from '../domain/time';
import type { Assessment, Course, FixedCommitment, Shift, TrainingTemplate } from '../domain/types';
import { Button, Choice, DateInput, Field, NumberInput, Select, Sheet, TextInput, TimeInput } from './kit';
import { DIFFICULTY_OPTIONS, INTENSITY_OPTIONS, KIND_OPTIONS, LOAD_OPTIONS, WEEKDAY_OPTIONS } from './labels';
import { WEEKDAYS } from '../domain/time';

function SaveBar({ onSave, onDelete, disabled, saveLabel = 'Save' }: { onSave: () => void; onDelete?: () => void; disabled?: boolean; saveLabel?: string }) {
  return (
    <div className="flex gap-2 pt-1">
      {onDelete ? <Button tone="danger" onClick={onDelete}>Delete</Button> : null}
      <Button tone="primary" className="flex-1" disabled={disabled} onClick={onSave}>{saveLabel}</Button>
    </div>
  );
}

/** Tap several weekdays at once: a class on Mon and Wed is entered in one go. */
function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Days</legend>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, day) => {
          const selected = value.includes(day);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? value.filter((d) => d !== day) : [...value, day].sort())}
              className={`min-h-11 rounded-md border text-sm font-medium ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CommitmentSheet({ item, defaultKind = 'class', onClose }: { item?: FixedCommitment; defaultKind?: FixedCommitment['kind']; onClose: () => void }) {
  const { apply } = useApp();
  const [kind, setKind] = useState(item?.kind ?? defaultKind);
  const [title, setTitle] = useState(item?.title ?? '');
  const [days, setDays] = useState<number[]>(item ? [item.weekday] : []);
  const [startMin, setStart] = useState(item?.startMin ?? 8 * 60);
  const [endMin, setEnd] = useState(item?.endMin ?? 9 * 60 + 30);
  const sameTime = startMin === endMin;

  const save = () => {
    // Editing changes the one row; adding creates a row for each chosen day.
    const targets = item ? [{ id: item.id, weekday: days[0] ?? item.weekday }] : days.map((weekday) => ({ id: newId(), weekday }));
    apply(targets.map(({ id, weekday }) => ({
      op: 'upsert', collection: 'fixedCommitments', entity: { id, kind, title: title.trim(), weekday, startMin, endMin },
    })));
    onClose();
  };

  return (
    <Sheet title={item ? 'Edit commitment' : 'Add a fixed commitment'} onClose={onClose}>
      <Choice label="What is it" value={kind} onChange={setKind} options={[
        { value: 'class', label: 'Class' }, { value: 'commute', label: 'Commute' }, { value: 'other', label: 'Other' },
      ]} />
      <Field label="Name"><TextInput value={title} onChange={setTitle} placeholder={kind === 'class' ? 'Calculus III' : kind === 'commute' ? 'Bus to campus' : 'Family lunch'} /></Field>
      {item
        ? <Field label="Day"><Select value={days[0]} onChange={(d) => setDays([d])} options={WEEKDAY_OPTIONS} /></Field>
        : <WeekdayPicker value={days} onChange={setDays} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><TimeInput value={startMin} onChange={setStart} /></Field>
        <Field label="Ends" error={sameTime ? 'Must differ from the start' : null}
          hint={endMin < startMin ? 'Ends the next day' : `${fmtHours(spanLength(startMin, endMin))} h`}>
          <TimeInput value={endMin} onChange={setEnd} />
        </Field>
      </div>
      <SaveBar
        onSave={save}
        disabled={!title.trim() || days.length === 0 || sameTime}
        onDelete={item ? () => { apply([{ op: 'remove', collection: 'fixedCommitments', id: item.id }]); onClose(); } : undefined}
        saveLabel={!item && days.length > 1 ? `Add on ${days.length} days` : 'Save'}
      />
    </Sheet>
  );
}

export function TemplateSheet({ item, onClose }: { item?: TrainingTemplate; onClose: () => void }) {
  const { data, apply } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [weekday, setWeekday] = useState(item?.weekday ?? 0);
  const [startMin, setStart] = useState(item?.startMin ?? 18 * 60);
  const [durationMin, setDuration] = useState<number | null>(item?.durationMin ?? 60);
  const [load, setLoad] = useState(item?.load ?? 'push');
  const [intensity, setIntensity] = useState(item?.intensity ?? 2);
  const validDuration = durationMin != null && durationMin >= 5 && durationMin <= 600;

  const save = () => {
    if (!validDuration) return;
    apply([{
      op: 'upsert', collection: 'trainingTemplates',
      entity: { id: item?.id ?? newId(), name: name.trim(), weekday, startMin, durationMin: Math.round(durationMin), load, intensity },
    }]);
    onClose();
  };

  return (
    <Sheet title={item ? 'Edit session' : 'Add a weekly session'} onClose={onClose}>
      <Field label="Name"><TextInput value={name} onChange={setName} placeholder="Pull day" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day"><Select value={weekday} onChange={setWeekday} options={WEEKDAY_OPTIONS} /></Field>
        <Field label="Starts"><TimeInput value={startMin} onChange={setStart} /></Field>
      </div>
      <Field label="Length in minutes" error={durationMin != null && !validDuration ? 'Between 5 and 600' : null}>
        <NumberInput value={durationMin} onChange={setDuration} min={5} max={600} step={5} />
      </Field>
      <Field label="What it loads" hint="Rest rules compare sessions that load the same thing.">
        <Select value={load} onChange={setLoad} options={LOAD_OPTIONS} />
      </Field>
      <Choice label="Intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} />
      <SaveBar
        onSave={save}
        disabled={!name.trim() || !validDuration}
        onDelete={item ? () => { apply(removeTemplate(data, item.id)); onClose(); } : undefined}
      />
    </Sheet>
  );
}

export function ShiftSheet({ item, defaultDate, onClose }: { item?: Shift; defaultDate: string; onClose: () => void }) {
  const { apply } = useApp();
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [startMin, setStart] = useState(item?.startMin ?? 17 * 60);
  const [endMin, setEnd] = useState(item?.endMin ?? 22 * 60);
  const [note, setNote] = useState(item?.note ?? '');
  const sameTime = startMin === endMin;

  const save = () => {
    apply([{ op: 'upsert', collection: 'shifts', entity: { id: item?.id ?? newId(), date, startMin, endMin, note: note.trim() } }]);
    onClose();
  };

  return (
    <Sheet title={item ? 'Edit shift' : 'Add a work shift'} onClose={onClose}>
      <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><TimeInput value={startMin} onChange={setStart} /></Field>
        <Field label="Ends" error={sameTime ? 'Must differ from the start' : null}
          hint={endMin < startMin ? `Ends the next day, ${fmtHours(spanLength(startMin, endMin))} h` : `${fmtHours(spanLength(startMin, endMin))} h`}>
          <TimeInput value={endMin} onChange={setEnd} />
        </Field>
      </div>
      <Field label="Note (optional)"><TextInput value={note} onChange={setNote} placeholder="Evening shift" /></Field>
      <SaveBar
        onSave={save}
        disabled={!date || sameTime}
        onDelete={item ? () => { apply([{ op: 'remove', collection: 'shifts', id: item.id }]); onClose(); } : undefined}
      />
    </Sheet>
  );
}

export function CourseSheet({ item, onClose }: { item?: Course; onClose: () => void }) {
  const { data, apply } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [credits, setCredits] = useState<number | null>(item?.credits ?? 3);
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? 2);
  const [target, setTarget] = useState<number | null>(item?.targetPercent ?? 90);
  const valid = name.trim() && credits != null && credits >= 0 && target != null && target >= 0 && target <= 100;

  const save = () => {
    if (!valid || credits == null || target == null) return;
    apply([{ op: 'upsert', collection: 'courses', entity: { id: item?.id ?? newId(), name: name.trim(), credits, difficulty, targetPercent: target } }]);
    onClose();
  };

  return (
    <Sheet title={item ? 'Edit course' : 'Add a course'} onClose={onClose}>
      <Field label="Course name"><TextInput value={name} onChange={setName} placeholder="Data Structures" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Credits"><NumberInput value={credits} onChange={setCredits} min={0} max={60} step={0.5} /></Field>
        <Field label="Target grade (%)"><NumberInput value={target} onChange={setTarget} min={0} max={100} /></Field>
      </div>
      <Choice label="How demanding is it to study" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
      <p className="text-sm text-muted">Hard courses are given your highest-energy slots and more default study hours.</p>
      <SaveBar
        onSave={save}
        disabled={!valid}
        onDelete={item ? () => { apply(removeCourse(data, item.id)); onClose(); } : undefined}
      />
    </Sheet>
  );
}

export function AssessmentSheet({ item, course, onClose }: { item?: Assessment; course: Course; onClose: () => void }) {
  const { data, apply } = useApp();
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState(item?.kind ?? 'exam');
  const [weight, setWeight] = useState<number | null>(item?.weightPercent ?? null);
  const [dueDate, setDueDate] = useState(item?.dueDate ?? '');
  const [score, setScore] = useState<number | null>(item?.scorePercent ?? null);
  const [targetHours, setTargetHours] = useState<number | null>(item?.targetHours ?? null);
  const valid = name.trim() && weight != null && weight > 0 && weight <= 100 && (score == null || (score >= 0 && score <= 200));

  const draft: Assessment = {
    id: item?.id ?? newId(), courseId: course.id, name: name.trim(), kind, weightPercent: weight ?? 0,
    dueDate: dueDate || null, scorePercent: score, targetHours,
  };
  const defaultHours = targetHoursFor({ ...draft, targetHours: null }, course, resolveConfig(data.configOverrides));

  return (
    <Sheet title={item ? 'Edit assessment' : `Add to ${course.name}`} onClose={onClose}>
      <Field label="Name"><TextInput value={name} onChange={setName} placeholder="Midterm" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={kind} onChange={setKind} options={KIND_OPTIONS} /></Field>
        <Field label="Weight (% of course)"><NumberInput value={weight} onChange={setWeight} min={0} max={100} placeholder="30" /></Field>
      </div>
      <Field label="Due date (optional)" hint="Needed for urgency, exam alerts and suggested blocks.">
        <DateInput value={dueDate} onChange={setDueDate} />
      </Field>
      <Field label="Score (%)" hint="Leave empty until it is graded."><NumberInput value={score} onChange={setScore} min={0} max={200} placeholder="Not graded yet" /></Field>
      <Field label="Study hours to put in" hint={`Effective hours. Empty uses the default for this weight: ${fmtHours(defaultHours * 60)} h.`}>
        <NumberInput value={targetHours} onChange={setTargetHours} min={0} max={500} step={0.5} placeholder={fmtHours(defaultHours * 60)} />
      </Field>
      <SaveBar
        onSave={() => { apply([{ op: 'upsert', collection: 'assessments', entity: draft }]); onClose(); }}
        disabled={!valid}
        onDelete={item ? () => { apply(removeAssessment(data, item.id)); onClose(); } : undefined}
      />
    </Sheet>
  );
}
