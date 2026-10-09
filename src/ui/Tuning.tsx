// In-app editor for the model's numbers. Each field writes an override on top of
// src/config/defaultConfig.ts; nothing here changes logic.

import { defaultConfig, resolveConfig } from '../config/defaultConfig';
import { useApp } from '../app/store';
import { Button, Field, NumberInput } from './kit';
import { INTENSITY_LABEL, LOAD_LABEL } from './labels';

type Path = (string | number)[];

function getIn(source: unknown, path: Path): unknown {
  return path.reduce<unknown>((value, key) => (value as Record<string | number, unknown> | undefined)?.[key], source);
}

/** A copy of `source` with the value at `path` replaced. Objects on the way are created as needed. */
function setIn(source: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  const base = (typeof source === 'object' && source !== null ? source : {}) as Record<string | number, unknown>;
  const copy: Record<string | number, unknown> = Array.isArray(base) ? [...base] as never : { ...base };
  copy[key] = setIn(base[key], rest, value);
  return copy;
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <details className="border-b border-line py-2 last:border-b-0">
      <summary className="cursor-pointer py-1 font-medium">{title}</summary>
      {note ? <p className="mb-2 text-sm text-muted">{note}</p> : null}
      <div className="grid grid-cols-2 gap-3 pb-2">{children}</div>
    </details>
  );
}

export function Tuning() {
  const { data, setConfigOverrides } = useApp();
  const config = resolveConfig(data.configOverrides);
  const changed = Object.keys(data.configOverrides).length > 0;

  /** A number field bound to one config value. Lists are written whole, as the merge expects. */
  const num = (label: string, path: Path, opts: { min: number; max: number; step: number }) => {
    const value = getIn(config, path) as number;
    const original = getIn(defaultConfig, path) as number;
    const listRoot = path.findIndex((key) => typeof key === 'number');
    return (
      <Field key={path.join('.')} label={label} hint={value !== original ? `Default ${original}` : undefined}>
        <NumberInput
          value={value}
          min={opts.min}
          max={opts.max}
          step={opts.step}
          onChange={(next) => {
            if (next == null || next < opts.min || next > opts.max) return;
            if (listRoot === -1) {
              setConfigOverrides(setIn(data.configOverrides, path, next) as never);
            } else {
              const listPath = path.slice(0, listRoot);
              const list = setIn(getIn(config, listPath), path.slice(listRoot), next);
              setConfigOverrides(setIn(data.configOverrides, listPath, list) as never);
            }
          }}
        />
      </Field>
    );
  };
  const factor = { min: 0.05, max: 1.5, step: 0.05 };
  const multiplier = { min: 0.3, max: 1, step: 0.01 };

  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        These are rules of thumb, not measurements of you. Log energy for two or three weeks, then adjust them to what you see.
      </p>
      <Group title="Energy factors" note="effective hours = duration x factor for the energy level.">
        {([1, 2, 3, 4, 5] as const).map((level) => num(`Energy ${level}`, ['energy', 'factors', level], factor))}
        {num('Level assumed when not logged', ['energy', 'baselineLevel'], { min: 1, max: 5, step: 1 })}
      </Group>
      <Group title="Time of day" note="How usable each part of the day is for you.">
        {config.energy.timeOfDay.map((band, i) => num(band.label[0].toUpperCase() + band.label.slice(1), ['energy', 'timeOfDay', i, 'multiplier'], factor))}
      </Group>
      <Group title="Fatigue carryover" note="Applied to the day after, unless you check in that morning.">
        {([2, 3] as const).map((i) => num(`After ${INTENSITY_LABEL[i].toLowerCase()} training`, ['carryover', 'trainingMultiplier', i], multiplier))}
        {num('Short night is under (h)', ['carryover', 'shortNightHours'], { min: 3, max: 10, step: 0.5 })}
        {num('After a short night', ['carryover', 'shortNightMultiplier'], multiplier)}
        {num('Lowest carryover allowed', ['carryover', 'floor'], multiplier)}
        {num('Dip after hard training', ['carryover', 'postTraining', 'multiplier'], multiplier)}
        {num('Dip lasts (min)', ['carryover', 'postTraining', 'windowMin'], { min: 0, max: 480, step: 15 })}
      </Group>
      <Group title="Recovery budget" note="Reserved before any study time is counted as flexible.">
        {num('Base hours per day', ['recovery', 'baseHoursPerDay'], { min: 0, max: 6, step: 0.25 })}
        {([1, 2, 3] as const).map((i) => num(`Per ${INTENSITY_LABEL[i].toLowerCase()} session (h)`, ['recovery', 'hoursPerSession', i], { min: 0, max: 6, step: 0.25 }))}
      </Group>
      <Group title="Rest rules" note="Minimum hours from the end of one session to the start of the next on the same load.">
        {config.training.restRules.map((rule, i) => num(`${rule.groups.map((g) => LOAD_LABEL[g]).join(' + ')} (h)`, ['training', 'restRules', i, 'minGapHours'], { min: 0, max: 168, step: 1 }))}
        {num('Most training days in a row', ['training', 'maxConsecutiveDays'], { min: 1, max: 7, step: 1 })}
      </Group>
      <Group title="Planning" note="How suggested blocks are sized and where they stop.">
        {num('Block length (min)', ['planner', 'blockMin'], { min: 25, max: 240, step: 5 })}
        {num('Focus ceiling per day (h)', ['planner', 'maxFocusHoursPerDay'], { min: 1, max: 14, step: 0.5 })}
        {num('Nothing after waking for (min)', ['planner', 'afterWakeMin'], { min: 0, max: 240, step: 15 })}
        {num('Nothing before bed for (min)', ['planner', 'beforeBedMin'], { min: 0, max: 240, step: 15 })}
      </Group>
      <Group title="Grades and alerts">
        {num('Study hours per 1% of weight', ['grades', 'hoursPerWeightPoint'], { min: 0.05, max: 3, step: 0.05 })}
        {num('Exam alert horizon (days)', ['conflicts', 'examHorizonDays'], { min: 1, max: 60, step: 1 })}
        {num('Low-energy line for hard courses', ['conflicts', 'lowEnergyFactor'], factor)}
      </Group>
      {changed ? <Button className="mt-3 w-full" onClick={() => setConfigOverrides({})}>Reset all tuning to defaults</Button> : null}
    </div>
  );
}

