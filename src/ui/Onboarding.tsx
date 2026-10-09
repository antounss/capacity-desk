// First-run setup. Every step is optional and everything can be changed later in
// Schedule, Grades and Settings; the steps reuse the same lists those screens use.

import { useState } from 'react';
import { useApp } from '../app/store';
import { fmtHours, spanLength } from '../domain/time';
import { Button, Field, NumberInput, TimeInput } from './kit';
import { CommitmentList, CourseList, TemplateList } from './ScheduleLists';

const STEPS = ['Your day', 'Classes', 'Training', 'Courses'];

export function Onboarding() {
  const { data, updateSettings } = useApp();
  const { settings } = data;
  // Step 0 is the welcome page; steps 1 to 4 are STEPS.
  const [step, setStep] = useState(0);
  const finish = () => updateSettings({ onboarded: true });

  if (step === 0) {
    return (
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 px-5 py-10">
        <img src="./icon.svg" alt="" className="size-16 rounded-xl" />
        <h1 className="text-4xl leading-[1.1]">A week has 168 hours. Capacity Desk shows how many you can actually use.</h1>
        <p className="text-lg text-muted">
          It takes your classes, shifts, training and sleep, reserves recovery first, weighs each hour by your energy,
          and warns you where the plan will break before it does.
        </p>
        <p className="text-muted">Your data stays on this phone. There is no account and nothing is uploaded.</p>
        <div className="flex flex-col gap-2 pt-2">
          <Button tone="primary" onClick={() => setStep(1)}>Set up my week</Button>
          <Button onClick={finish}>Skip setup and look around</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 pt-[calc(1.5rem+var(--flow-top))] pb-[calc(1.5rem+var(--flow-bottom))]">
      <p className="num text-sm text-muted">Step {step} of {STEPS.length}</p>
      <div className="mt-1 mb-5 flex gap-1" aria-hidden>
        {STEPS.map((name, i) => <span key={name} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-accent' : 'bg-line'}`} />)}
      </div>

      <div className="flex-1">
        {step === 1 ? (
          <>
            <h1 className="text-3xl leading-tight">When do you sleep?</h1>
            <p className="mt-1 mb-4 text-muted">Sleep and daily overhead come off the top of every day.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bedtime"><TimeInput value={settings.sleepStartMin} onChange={(sleepStartMin) => updateSettings({ sleepStartMin })} /></Field>
              <Field label="Wake-up" hint={`${fmtHours(spanLength(settings.sleepStartMin, settings.sleepEndMin))} h in bed`}>
                <TimeInput value={settings.sleepEndMin} onChange={(sleepEndMin) => updateSettings({ sleepEndMin })} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Meals, showering and other daily overhead (minutes)" hint="A typical figure is 90 to 150.">
                <NumberInput value={settings.dailyOverheadMin} min={0} max={720} step={15} onChange={(v) => v != null && v >= 0 && v <= 720 && updateSettings({ dailyOverheadMin: v })} />
              </Field>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-3xl leading-tight">What is fixed every week?</h1>
            <p className="mt-1 mb-4 text-muted">Classes, labs, your commute, anything that repeats at a set time.</p>
            <CommitmentList />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-3xl leading-tight">What is your training split?</h1>
            <p className="mt-1 mb-4 text-muted">Add the sessions you repeat each week. Leave this empty if you do not train on a schedule.</p>
            <TemplateList />
            <div className="mt-4">
              <Field label="Fewest sessions a week you will accept" hint="A week planned below this is flagged.">
                <NumberInput value={settings.minSessionsPerWeek} min={0} max={14} onChange={(v) => v != null && v >= 0 && v <= 14 && updateSettings({ minSessionsPerWeek: Math.round(v) })} />
              </Field>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 className="text-3xl leading-tight">Which courses are you taking?</h1>
            <p className="mt-1 mb-4 text-muted">Add each course with its credits and the grade you are aiming for. Exams, weights and scores go in Grades afterwards.</p>
            <CourseList />
          </>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        <Button onClick={() => setStep(step - 1)}>Back</Button>
        {step < STEPS.length
          ? <Button tone="primary" className="flex-1" onClick={() => setStep(step + 1)}>Next: {STEPS[step].toLowerCase()}</Button>
          : <Button tone="primary" className="flex-1" onClick={finish}>Open my week</Button>}
      </div>
    </div>
  );
}
