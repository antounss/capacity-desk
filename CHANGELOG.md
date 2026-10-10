# Changelog

All notable changes to Capacity Desk. Versions follow [semantic versioning](https://semver.org).
The version is set in `package.json` and in `android/app/build.gradle` (`versionName`, plus `versionCode`, which must rise with every upload).

## Unreleased

Found on the first run on a real phone (2026-10-10):

- **Fixed:** the on-screen keyboard covered the Save button in sheets. Action buttons now sit in a bar pinned to the bottom of the sheet, the form above them scrolls, and the sheet is lifted above the keyboard on phones where the keyboard overlaps the page.
- **Fixed:** `npm run android:sync` failed on Node.js versions before 22.18 because the Capacitor config was a TypeScript file. It is now `capacitor.config.json`.

## 1.0.0 (2026-10-09)

First version. Android `versionCode` 1.

**Capacity**
- Weekly ledger of 168 hours: sleep, classes, shifts, commute, meals and training are taken out; recovery is reserved before anything is called flexible; what is left after planned work is the buffer.
- Overlapping commitments are counted once. Shifts may cross midnight.

**Energy**
- Energy logged 1 to 5 per block or per day turns hours into effective hours through a factor table.
- One-day fatigue carryover from hard training and short nights, a time-of-day profile, and a dip after hard sessions. Every factor is tunable in the app.

**Planning**
- Suggested study and project blocks, placed in the best predicted-energy slots, each with its reason. Hard courses get the stronger slots.
- Rest rules between sessions that load the same muscle group.

**Conflicts**
- Ten rules, re-checked on every change, each with a consequence in numbers and one or two fixes that can be applied with a tap and undone: recovery below threshold, rest gap, no rest day, training minimum missed, exam hours behind pace, overlap, short night, hard course in a low-energy slot, day overload, hard training before an exam.

**Grades**
- Courses with weighted assessments. Required average on remaining work, with the calculation shown.
- Weights that do not sum to 100% are flagged, not silently corrected.
- Tasks ranked by grade impact per effective hour, with a weekly top 3 and the reasons.

**Logging**
- Quick actions: log a finished block, morning energy check-in, mark training done, add a shift.

**Data**
- Stored in SQLite on the device only. No account, no network requests, no analytics.
- Full JSON backup with validated import; CSV export of blocks and check-ins.
- Opt-in local notifications: training reminders and a morning conflict summary.

**Known gaps:** see `docs/LIMITATIONS.md`. The release build and on-device behaviour have not been verified yet.
