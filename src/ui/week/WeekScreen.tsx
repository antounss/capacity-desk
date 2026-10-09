import { Battery, Briefcase, ChevronLeft, ChevronRight, Dumbbell, PenLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { newId, useApp } from '../../app/store';
import type { Analysis } from '../../domain/analyze';
import type { Fix } from '../../domain/conflicts';
import { applyFix } from '../../domain/fixes';
import { addDays, diffDays, fmtDate, fmtHours, fmtTime, weekStartOf } from '../../domain/time';
import type { ResolvedSession } from '../../domain/timeline';
import type { AppData, Block, Now, Shift } from '../../domain/types';
import { ShiftSheet } from '../editors';
import { Button, Empty, Section } from '../kit';
import { BlockSheet, EnergySheet, LogBlockSheet, SessionSheet, TrainedSheet } from '../quick';
import { TopThree } from '../TopThree';
import { Conflicts } from './Conflicts';
import { DayAgenda, DayStrip } from './DayView';
import { Ledger } from './Ledger';

type Open =
  | { sheet: 'log' } | { sheet: 'energy' } | { sheet: 'trained' }
  | { sheet: 'shift'; item?: Shift }
  | { sheet: 'block'; item?: Block; date: string }
  | { sheet: 'session'; item?: ResolvedSession; date: string; done?: boolean };

interface Toast {
  message: string;
  undo?: () => void;
}

export function WeekScreen({ analysis, now, weekStart, onWeekChange, onNavigate }: {
  analysis: Analysis;
  now: Now;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  onNavigate: (screen: 'grades' | 'schedule' | 'settings') => void;
}) {
  const { data, apply, replaceAll } = useApp();
  const thisWeek = weekStartOf(now.date);
  const todayIndex = diffDays(weekStart, now.date);
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 0 && todayIndex < 7 ? todayIndex : 0);
  const [open, setOpen] = useState<Open | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const close = () => setOpen(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Conflicts are recomputed on every change. When a change introduces one that was
  // not there before, say so straight away instead of waiting for the user to scroll.
  const known = useRef<{ week: string; keys: Set<string> } | null>(null);
  useEffect(() => {
    const keys = new Set(analysis.conflicts.map((c) => c.key));
    const previous = known.current;
    known.current = { week: weekStart, keys };
    if (!previous || previous.week !== weekStart) return; // first look at this week: nothing is "new"
    const fresh = analysis.conflicts.filter((c) => !previous.keys.has(c.key) && c.severity !== 'info');
    if (fresh.length > 0) setToast({ message: `New conflict: ${fresh[0].title}` });
  }, [analysis.conflicts, weekStart]);

  const changeWeek = (next: string) => {
    onWeekChange(next);
    const index = diffDays(next, now.date);
    setSelectedDay(index >= 0 && index < 7 ? index : 0);
  };

  const onFix = (fix: Fix) => {
    const action = fix.action;
    if (!action) return;
    if (action.type === 'open') {
      if (action.screen === 'suggestions') document.getElementById('suggestions')?.scrollIntoView({ behavior: 'smooth' });
      else onNavigate(action.screen === 'tuning' ? 'settings' : action.screen);
      return;
    }
    const before: AppData = data;
    apply(applyFix(data, analysis.tl, action, newId));
    setToast({ message: `Done: ${fix.label}`, undo: () => { replaceAll(before); setToast(null); } });
  };

  const addSuggestions = (blocks: Omit<Block, 'id'>[]) => {
    apply(blocks.map((block) => ({ op: 'upsert', collection: 'blocks', entity: { ...block, id: newId() } })));
  };
  const confirmBlock = (block: Block, status: Block['status']) =>
    apply([{ op: 'upsert', collection: 'blocks', entity: { ...block, status } }]);

  const { plan, unconfirmed } = analysis;
  const selectedDate = addDays(weekStart, selectedDay);

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-40">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold">Week of {fmtDate(weekStart).slice(4)}</p>
          {weekStart !== thisWeek ? (
            <button type="button" className="text-sm text-accent underline" onClick={() => changeWeek(thisWeek)}>Back to this week</button>
          ) : <p className="text-sm text-muted">This week</p>}
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous week" className="flex size-11 items-center justify-center rounded-md border border-line bg-surface" onClick={() => changeWeek(addDays(weekStart, -7))}>
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button type="button" aria-label="Next week" className="flex size-11 items-center justify-center rounded-md border border-line bg-surface" onClick={() => changeWeek(addDays(weekStart, 7))}>
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </header>

      <div className="pb-5">
        <Ledger week={analysis.week} effective={analysis.effective} />
      </div>

      {unconfirmed.length > 0 ? (
        <Section title={unconfirmed.length === 1 ? '1 past block to confirm' : `${unconfirmed.length} past blocks to confirm`}>
          <p className="mb-1 text-sm text-muted">Planned time that has passed counts for nothing until you say whether it happened.</p>
          <ul>
            {unconfirmed.map(({ block }) => (
              <li key={block.id} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{block.title}</div>
                  <div className="num text-sm text-muted">{fmtDate(block.date)} {fmtTime(block.startMin)}, {fmtHours(block.durationMin)} h</div>
                </div>
                <Button onClick={() => confirmBlock(block, 'skipped')}>Skipped</Button>
                <Button tone="primary" onClick={() => setOpen({ sheet: 'block', item: { ...block, status: 'done' }, date: block.date })}>Done</Button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Conflicts
        conflicts={analysis.conflicts}
        onFix={onFix}
        emptyText={weekStart < thisWeek ? 'This week is over, so there is nothing left to flag.' : 'Nothing in this week’s plan breaks a rule.'}
      />

      <Section title="This week’s top 3" aside={<span className="text-sm text-muted">Grade impact per hour</span>}>
        <TopThree tasks={analysis.top3} hasCourses={data.courses.length > 0} />
      </Section>

      <Section title="Days">
        <DayStrip analysis={analysis} selected={selectedDay} onSelect={setSelectedDay} />
        <DayAgenda
          analysis={analysis}
          data={data}
          day={selectedDay}
          onPlan={() => setOpen({ sheet: 'block', date: selectedDate })}
          onEditBlock={(item) => setOpen({ sheet: 'block', item, date: item.date })}
          onEditSession={(item) => setOpen({ sheet: 'session', item, date: item.date })}
          onEditShift={(item) => setOpen({ sheet: 'shift', item })}
        />
      </Section>

      <Section
        id="suggestions"
        title="Suggested blocks"
        aside={plan.suggestions.length > 1
          ? <button type="button" className="text-sm font-medium text-accent underline" onClick={() => addSuggestions(plan.suggestions.map((s) => s.block))}>Add all {plan.suggestions.length}</button>
          : null}
      >
        {plan.suggestions.length === 0 && plan.unplaced.length === 0 ? (
          <Empty>
            Nothing to suggest. Suggestions appear when an assessment with a due date still needs hours, or when you set weekly project hours in Settings.
          </Empty>
        ) : null}
        <ul>
          {plan.suggestions.map((s) => (
            <li key={`${s.block.date}${s.block.startMin}`} className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.block.title}</div>
                <div className="num text-sm">{fmtDate(s.block.date)}, {fmtTime(s.block.startMin)} to {fmtTime(s.block.startMin + s.block.durationMin)}</div>
                <div className="num text-sm text-muted">{s.reason}</div>
              </div>
              <Button onClick={() => addSuggestions([s.block])}>Add</Button>
            </li>
          ))}
        </ul>
        {plan.unplaced.map((u) => (
          <p key={u.title} className="num mt-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Did not fit this week: {u.title}, {fmtHours(u.missingMin)} {u.effective ? 'effective ' : ''}h. Free up time before it is due, or lower its target hours.
          </p>
        ))}
      </Section>

      {/* Quick actions always log against today, whichever week is on screen. */}
      <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2 px-3 py-2">
          <QuickButton Icon={PenLine} label="Log block" onClick={() => setOpen({ sheet: 'log' })} />
          <QuickButton Icon={Battery} label="Energy" onClick={() => setOpen({ sheet: 'energy' })} />
          <QuickButton Icon={Dumbbell} label="Trained" onClick={() => setOpen({ sheet: 'trained' })} />
          <QuickButton Icon={Briefcase} label="Add shift" onClick={() => setOpen({ sheet: 'shift' })} />
        </div>
      </nav>

      {toast ? (
        <div role="status" className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-3 rounded-md bg-ink px-4 py-3 text-paper shadow-lg">
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.undo ? <button type="button" className="font-semibold underline" onClick={toast.undo}>Undo</button> : (
            <button type="button" className="font-semibold underline" onClick={() => { document.getElementById('conflicts')?.scrollIntoView({ behavior: 'smooth' }); setToast(null); }}>View</button>
          )}
        </div>
      ) : null}

      {open?.sheet === 'log' ? <LogBlockSheet now={now} onClose={close} /> : null}
      {open?.sheet === 'energy' ? <EnergySheet now={now} onClose={close} /> : null}
      {open?.sheet === 'trained' ? (
        <TrainedSheet now={now} onClose={close} onAddUnplanned={() => setOpen({ sheet: 'session', date: now.date, done: true })} />
      ) : null}
      {open?.sheet === 'shift' ? <ShiftSheet item={open.item} defaultDate={now.date} onClose={close} /> : null}
      {open?.sheet === 'block' ? <BlockSheet item={open.item} defaultDate={open.date} now={now} onClose={close} /> : null}
      {open?.sheet === 'session' ? (
        <SessionSheet item={open.item} defaultDate={open.date} defaultStatus={open.done ? 'done' : 'planned'} onClose={close} />
      ) : null}
    </div>
  );
}

function QuickButton({ Icon, label, onClick }: { Icon: typeof PenLine; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md border border-line bg-surface text-sm font-medium">
      <Icon size={20} aria-hidden className="text-accent" />
      {label}
    </button>
  );
}
