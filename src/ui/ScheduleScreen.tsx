import type { Now } from '../domain/types';
import { Section } from './kit';
import { CommitmentList, ShiftList, TemplateList } from './ScheduleLists';

export function ScheduleScreen({ now }: { now: Now }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <h1 className="text-3xl">Schedule</h1>
      <p className="mt-1 mb-4 text-muted">The fixed shape of your week. Everything here is taken out of your hours before anything is planned.</p>
      <Section title="Classes and fixed commitments"><CommitmentList /></Section>
      <Section title="Training split" aside={<span className="text-sm text-muted">Repeats weekly</span>}>
        <TemplateList />
        <p className="mt-2 text-sm text-muted">To move or skip a session for one week only, tap it in that week’s day view.</p>
      </Section>
      <Section title="Work shifts"><ShiftList today={now.date} /></Section>
    </div>
  );
}
