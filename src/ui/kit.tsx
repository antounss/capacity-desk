// Small shared building blocks. Each does one thing and has no knowledge of the domain.

import { X } from 'lucide-react';
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { pushBack } from '../app/backStack';
import { fmtTime, parseTime } from '../domain/time';

type Tone = 'primary' | 'quiet' | 'danger';

const TONES: Record<Tone, string> = {
  primary: 'bg-accent text-accent-ink border-accent',
  quiet: 'bg-surface text-ink border-line',
  danger: 'bg-surface text-critical border-critical',
};

export function Button({ tone = 'quiet', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 font-medium disabled:opacity-40 ${TONES[tone]} ${className}`}
    />
  );
}

/** A bottom sheet. Closes on the scrim, the close button, Escape and Android back. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => pushBack(onClose), [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in max-h-[92%] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-2xl bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 flex size-11 items-center justify-center rounded-md text-muted">
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-sm text-critical">{error}</span> : hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

const INPUT = 'min-h-11 w-full rounded-md border border-line bg-surface px-3';

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={INPUT} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * A number box. While it has focus it shows exactly what was typed, so the field can
 * be cleared and retyped even when the value is saved on every keystroke. It reports
 * null while the text is empty or not a number.
 */
export function NumberInput({ value, onChange, min, max, step = 1, placeholder }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string;
}) {
  const [typed, setTyped] = useState<string | null>(null); // null = not being edited
  return (
    <input
      className={`${INPUT} num`}
      type="number"
      inputMode="decimal"
      value={typed ?? value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onFocus={() => setTyped(value == null ? '' : String(value))}
      onBlur={() => setTyped(null)}
      onChange={(e) => {
        setTyped(e.target.value);
        const n = e.target.value === '' ? null : Number(e.target.value);
        onChange(n !== null && Number.isFinite(n) ? n : null);
      }}
    />
  );
}

/** Clock time as minutes after midnight, using the phone's own time picker. */
export function TimeInput({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  return (
    <input
      className={`${INPUT} num`}
      type="time"
      value={fmtTime(value)}
      onChange={(e) => { const m = parseTime(e.target.value); if (m !== null) onChange(m); }}
    />
  );
}

export function DateInput({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  return <input className={`${INPUT} num`} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string | number>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <select
      className={INPUT}
      value={String(value)}
      onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
    >
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

/** One-tap choice between a few options. Big targets: this is what makes logging fast. */
export function Choice<T extends string | number | null>({ label, value, onChange, options, columns }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; sub?: string }[]; columns?: number;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-md border px-1 py-1 text-center leading-tight ${
                selected ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
              }`}
            >
              <span className="font-medium">{o.label}</span>
              {o.sub ? <span className={`text-xs ${selected ? '' : 'text-muted'}`}>{o.sub}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export const ENERGY_OPTIONS = [
  { value: 1 as const, label: '1', sub: 'Drained' },
  { value: 2 as const, label: '2', sub: 'Low' },
  { value: 3 as const, label: '3', sub: 'OK' },
  { value: 4 as const, label: '4', sub: 'Good' },
  { value: 5 as const, label: '5', sub: 'Sharp' },
];

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="flex flex-col">
        <span id={labelId} className="font-medium">{label}</span>
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={`flex h-8 w-14 shrink-0 items-center rounded-full border px-0.5 ${checked ? 'justify-end border-accent bg-accent' : 'justify-start border-line bg-line'}`}
      >
        <span className="size-6 rounded-full bg-surface shadow-sm" />
      </button>
    </div>
  );
}

/** A titled group of content, separated from its neighbours by space and a rule. */
export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-line pt-4 pb-5 scroll-mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A tappable list row. */
export function Row({ onClick, children, label }: { onClick?: () => void; children: ReactNode; label?: string }) {
  const className = 'flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0';
  return onClick
    ? <button type="button" aria-label={label} onClick={onClick} className={className}>{children}</button>
    : <div className={className}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-muted">{children}</p>;
}
