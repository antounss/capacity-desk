import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CalendarRange, GraduationCap, ListChecks, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { handleBack } from './app/backStack';
import { AppProvider, useApp } from './app/store';
import { syncNotifications } from './data/notifications';
import { analyzeWeek } from './domain/analyze';
import { planNotifications } from './domain/notifications';
import { nowFrom, weekStartOf } from './domain/time';
import type { AppData, Now } from './domain/types';
import { GradesScreen } from './ui/GradesScreen';
import { Onboarding } from './ui/Onboarding';
import { ScheduleScreen } from './ui/ScheduleScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { WeekScreen } from './ui/week/WeekScreen';

type Tab = 'week' | 'grades' | 'schedule' | 'settings';

const TABS: { id: Tab; label: string; Icon: typeof CalendarRange }[] = [
  { id: 'week', label: 'Week', Icon: CalendarRange },
  { id: 'grades', label: 'Grades', Icon: GraduationCap },
  { id: 'schedule', label: 'Schedule', Icon: ListChecks },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

/** The current date and minute, refreshed while the app is open and when it returns to the front. */
function useNow(): Now {
  const [now, setNow] = useState(() => nowFrom());
  useEffect(() => {
    const tick = () => setNow((prev) => {
      const next = nowFrom();
      return next.date === prev.date && next.minute === prev.minute ? prev : next;
    });
    const timer = setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

function Shell() {
  const { data, saveFailed, loadNote } = useApp();
  const now = useNow();
  const thisWeek = weekStartOf(now.date);
  const [tab, setTab] = useState<Tab>('week');
  const [weekStart, setWeekStart] = useState(thisWeek);
  const scroller = useRef<HTMLElement>(null);

  // Everything on screen is derived here, from the data and the time. It is recomputed
  // on every change, which is what keeps conflicts current without a "check" button.
  const analysis = useMemo(() => analyzeWeek(data, weekStart, now), [data, weekStart, now]);
  const current = useMemo(
    () => (weekStart === thisWeek ? analysis : analyzeWeek(data, thisWeek, now)),
    [analysis, data, weekStart, thisWeek, now],
  );

  // Reminders always follow the real current week, whichever week is on screen.
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    const { tl, conflicts } = currentRef.current;
    syncNotifications(planNotifications(tl, conflicts, data.settings)).catch(() => undefined);
  }, [data, now.date]);

  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [tab]);

  // Android back: close an open sheet, else return to Week, else leave the app.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (handleBack()) return;
      if (tabRef.current !== 'week') setTab('week');
      else NativeApp.exitApp();
    });
    return () => { listener.then((l) => l.remove()); };
  }, []);

  if (!data.settings.onboarded) {
    return <main className="h-full overflow-y-auto"><Onboarding /></main>;
  }

  return (
    <div className="flex h-full flex-col">
      <main ref={scroller} className="flex-1 overflow-y-auto pt-[var(--flow-top)]">
        {saveFailed ? (
          <p role="alert" className="bg-critical-soft px-4 py-2 text-sm text-critical">
            Your last change could not be saved to storage. Free up space on the device, then make any change to try again.
          </p>
        ) : null}
        {loadNote ? <p role="status" className="bg-warning-soft px-4 py-2 text-sm text-warning">{loadNote}</p> : null}
        {__PREVIEW__ ? (
          <p className="bg-info-soft px-4 py-2 text-sm text-info">
            Web preview with an invented student’s week. Changes are saved in this browser only. To enter your own week, use Settings, Erase all data.
          </p>
        ) : null}

        {tab === 'week' ? (
          <WeekScreen analysis={analysis} now={now} weekStart={weekStart} onWeekChange={setWeekStart} onNavigate={setTab} />
        ) : null}
        {tab === 'grades' ? <GradesScreen analysis={current} /> : null}
        {tab === 'schedule' ? <ScheduleScreen now={now} /> : null}
        {tab === 'settings' ? <SettingsScreen now={now} /> : null}
      </main>

      <nav aria-label="Sections" className="z-30 border-t border-line bg-surface pb-[var(--flow-bottom)]">
        <div className="mx-auto grid h-15 max-w-xl grid-cols-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === id ? 'text-accent' : 'text-muted'}`}
            >
              <Icon size={22} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** `initialData` is used once, on a device with nothing saved yet. Only the web preview passes it. */
export default function App({ initialData }: { initialData?: AppData }) {
  return (
    <AppProvider initialData={initialData}>
      <Shell />
    </AppProvider>
  );
}
