import { CircleAlert, Info, OctagonAlert } from 'lucide-react';
import type { Conflict, Fix, Severity } from '../../domain/conflicts';
import { Empty, Section } from '../kit';

// Severity is shown with a shape and a word as well as a colour.
const SEVERITY: Record<Severity, { word: string; text: string; bg: string; Icon: typeof Info }> = {
  critical: { word: 'Breaks the plan', text: 'text-critical', bg: 'bg-critical-soft', Icon: OctagonAlert },
  warning: { word: 'Costs you', text: 'text-warning', bg: 'bg-warning-soft', Icon: CircleAlert },
  info: { word: 'Worth knowing', text: 'text-info', bg: 'bg-info-soft', Icon: Info },
};

export function Conflicts({ conflicts, onFix, emptyText }: { conflicts: Conflict[]; onFix: (fix: Fix) => void; emptyText: string }) {
  return (
    <Section
      id="conflicts"
      title={conflicts.length === 0 ? 'No conflicts' : conflicts.length === 1 ? '1 conflict' : `${conflicts.length} conflicts`}
      aside={<span className="text-sm text-muted">Checked on every change</span>}
    >
      {conflicts.length === 0 ? <Empty>{emptyText}</Empty> : (
        <ul className="flex flex-col gap-3">
          {conflicts.map((c) => <ConflictItem key={c.key} conflict={c} onFix={onFix} />)}
        </ul>
      )}
    </Section>
  );
}

function ConflictItem({ conflict, onFix }: { conflict: Conflict; onFix: (fix: Fix) => void }) {
  const { word, text, bg, Icon } = SEVERITY[conflict.severity];
  const actions = conflict.fixes.filter((fix) => fix.action);
  return (
    <li className="overflow-hidden rounded-md border border-line bg-surface">
      <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold ${bg} ${text}`}>
        <Icon size={16} aria-hidden />
        {word}
      </div>
      <div className="px-3 pt-2 pb-3">
        <h3 className="text-lg leading-snug">{conflict.title}</h3>
        <p className="mt-1 text-muted">{conflict.consequence}</p>
        <div className="mt-3 flex flex-col gap-2">
          {conflict.fixes.map((fix) => fix.action ? (
            <button
              key={fix.label}
              type="button"
              onClick={() => onFix(fix)}
              className="min-h-11 rounded-md border border-line bg-paper px-3 py-2 text-left font-medium"
            >
              {/* Lettered only when there is a real choice between actions. */}
              {actions.length > 1 ? <span className="text-muted">Option {String.fromCharCode(65 + actions.indexOf(fix))}. </span> : null}
              {fix.label}
            </button>
          ) : (
            <p key={fix.label} className="px-1 text-sm text-muted">{fix.label}</p>
          ))}
        </div>
      </div>
    </li>
  );
}
