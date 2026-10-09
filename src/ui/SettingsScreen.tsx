import { useRef, useState } from 'react';
import { emptyData } from '../config/defaultConfig';
import { useApp } from '../app/store';
import privacy from '../content/privacy.json';
import { readTextFile, saveTextFile } from '../data/files';
import { notificationsSupported, requestNotificationPermission } from '../data/notifications';
import { blocksToCsv, dayLogsToCsv, exportJson, importJson } from '../domain/exportImport';
import { fmtHours, spanLength } from '../domain/time';
import type { AppData, Now } from '../domain/types';
import { Button, Field, NumberInput, Section, Sheet, Switch, TimeInput } from './kit';
import { Tuning } from './Tuning';

declare const __APP_VERSION__: string;

export function SettingsScreen({ now }: { now: Now }) {
  const { data, updateSettings, replaceAll } = useApp();
  const { settings } = data;
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ data: AppData; warnings: string[] } | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sleepMin = spanLength(settings.sleepStartMin, settings.sleepEndMin);

  const exportFile = async (name: string, text: string, mime: string) => {
    try {
      await saveTextFile(name, text, mime);
      setMessage(`Exported ${name}.`);
    } catch {
      setMessage('Export was cancelled or failed. Nothing left the app.');
    }
  };

  const toggleNotification = async (key: 'notifyTraining' | 'notifyConflicts', on: boolean) => {
    if (on && notificationsSupported && !(await requestNotificationPermission())) {
      setMessage('Android did not grant notification permission. Allow notifications for Capacity Desk in system settings, then switch this on again.');
      return;
    }
    updateSettings({ [key]: on });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = importJson(await readTextFile(file));
      if (result.ok) setPendingImport(result);
      else setMessage(result.error);
    } catch {
      setMessage('The file could not be read.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <h1 className="mb-4 text-3xl">Settings</h1>
      {message ? <p role="status" className="mb-4 rounded-md bg-info-soft px-3 py-2 text-info">{message}</p> : null}

      <Section title="Your day">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedtime"><TimeInput value={settings.sleepStartMin} onChange={(sleepStartMin) => updateSettings({ sleepStartMin })} /></Field>
          <Field label="Wake-up" hint={`${fmtHours(sleepMin)} h in bed`}><TimeInput value={settings.sleepEndMin} onChange={(sleepEndMin) => updateSettings({ sleepEndMin })} /></Field>
          <Field label="Meals and daily overhead (min)" hint="Time each day that is spoken for but has no fixed hour.">
            <NumberInput value={settings.dailyOverheadMin} min={0} max={720} step={15} onChange={(v) => v != null && v >= 0 && v <= 720 && updateSettings({ dailyOverheadMin: v })} />
          </Field>
          <Field label="Training sessions per week, minimum" hint="Your consistency requirement.">
            <NumberInput value={settings.minSessionsPerWeek} min={0} max={14} onChange={(v) => v != null && v >= 0 && v <= 14 && updateSettings({ minSessionsPerWeek: Math.round(v) })} />
          </Field>
          <Field label="Project hours per week" hint="Suggested after study is placed. 0 turns it off.">
            <NumberInput value={settings.projectHoursPerWeek} min={0} max={80} step={0.5} onChange={(v) => v != null && v >= 0 && v <= 80 && updateSettings({ projectHoursPerWeek: v })} />
          </Field>
        </div>
      </Section>

      <Section title="Notifications" aside={<span className="text-sm text-muted">Off until you turn them on</span>}>
        {notificationsSupported ? null : <p className="mb-1 text-sm text-muted">Notifications work in the installed Android app, not in a browser.</p>}
        <Switch label="Training reminders" hint="Before each planned session." checked={settings.notifyTraining} onChange={(on) => toggleNotification('notifyTraining', on)} />
        <Switch label="Conflict alerts" hint="One summary the next morning while conflicts are open." checked={settings.notifyConflicts} onChange={(on) => toggleNotification('notifyConflicts', on)} />
        {settings.notifyTraining ? (
          <Field label="Remind me this many minutes before">
            <NumberInput value={settings.trainingLeadMin} min={0} max={240} step={5} onChange={(v) => v != null && v >= 0 && v <= 240 && updateSettings({ trainingLeadMin: Math.round(v) })} />
          </Field>
        ) : null}
        <p className="mt-2 text-sm text-muted">Reminders are refreshed each time you open the app, and Android may deliver them a few minutes late.</p>
      </Section>

      <Section title="Tuning"><Tuning /></Section>

      <Section title="Your data">
        <p className="mb-3 text-sm text-muted">Everything is stored on this device only. Exports go wherever you choose in the share sheet.</p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => exportFile(`capacity-desk-backup-${now.date}.json`, exportJson(data, new Date().toISOString()), 'application/json')}>Export a full backup (JSON)</Button>
          <Button onClick={() => exportFile(`capacity-desk-blocks-${now.date}.csv`, blocksToCsv(data), 'text/csv')}>Export blocks (CSV)</Button>
          <Button onClick={() => exportFile(`capacity-desk-check-ins-${now.date}.csv`, dayLogsToCsv(data), 'text/csv')}>Export check-ins (CSV)</Button>
          <Button onClick={() => fileInput.current?.click()}>Import a backup (JSON)</Button>
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Backup file" onChange={(e) => onPickFile(e.target.files?.[0])} />
          <Button tone="danger" onClick={() => setConfirmErase(true)}>Erase all data</Button>
        </div>
      </Section>

      <Section title="About">
        <p className="num">Capacity Desk {__APP_VERSION__}</p>
        <p className="mt-1 text-muted">{privacy.summary}</p>
        <p className="mt-1 text-muted">Capacity Desk is a planning tool. Its energy and recovery figures are rules of thumb, not medical or training advice.</p>
        <button type="button" className="mt-2 text-accent underline" onClick={() => setShowPolicy(true)}>Read the privacy policy</button>
      </Section>

      {pendingImport ? (
        <Sheet title="Replace everything with this backup?" onClose={() => setPendingImport(null)}>
          <p className="num">
            The backup holds {pendingImport.data.courses.length} courses, {pendingImport.data.assessments.length} assessments, {pendingImport.data.blocks.length} blocks,
            {' '}{pendingImport.data.fixedCommitments.length} fixed commitments, {pendingImport.data.trainingTemplates.length} weekly sessions and {pendingImport.data.shifts.length} shifts.
          </p>
          {pendingImport.warnings.map((w) => <p key={w} className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{w}</p>)}
          <p className="text-muted">What is in the app now will be removed. Export a backup first if you want to keep it.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setPendingImport(null)}>Cancel</Button>
            <Button tone="primary" className="flex-1" onClick={() => { replaceAll(pendingImport.data); setPendingImport(null); setMessage('Backup imported.'); }}>Replace my data</Button>
          </div>
        </Sheet>
      ) : null}

      {confirmErase ? (
        <Sheet title="Erase all data?" onClose={() => setConfirmErase(false)}>
          <p className="text-muted">This removes your schedule, training, blocks, check-ins, courses, grades and settings from this device. It cannot be undone, and there is no copy anywhere else.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setConfirmErase(false)}>Cancel</Button>
            <Button tone="danger" className="flex-1" onClick={() => { replaceAll(emptyData()); setConfirmErase(false); }}>Erase everything</Button>
          </div>
        </Sheet>
      ) : null}

      {showPolicy ? (
        <Sheet title="Privacy policy" onClose={() => setShowPolicy(false)}>
          <p className="text-sm text-muted">Effective {privacy.effectiveDate}</p>
          <p>{privacy.summary}</p>
          {privacy.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="mb-1 text-lg">{section.heading}</h3>
              {section.body.map((line) => <p key={line} className="mb-1 text-muted">{line}</p>)}
              {section.list.length > 0 ? (
                <ul className="mb-1 list-disc pl-5 text-muted">
                  {section.list.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : null}
              {section.after.map((line) => <p key={line} className="mb-1 text-muted">{line}</p>)}
            </div>
          ))}
        </Sheet>
      ) : null}
    </div>
  );
}
