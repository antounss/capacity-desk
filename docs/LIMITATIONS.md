# Capacity Desk v1: limitations, untested paths, and v1.1

## What has been verified, and how

| Area | Verified by | Result |
|---|---|---|
| Capacity, energy, carryover, rest rules, conflicts, fixes, planner, grades, ranking, export/import, notification planning | 139 unit tests with worked examples (`npm test`) | Pass |
| Tests catch real regressions | Seven formulas broken on purpose, one at a time | All seven caught (one test had to be strengthened first) |
| SQLite schema, read/write, rollback, reopening a saved file | Tests against the real SQLite engine the app ships | Pass |
| UI flows: setup, import, logging, check-in, training, conflict appears on change, fix and undo, suggestions, grades, tuning, export, erase, restore | Automated run in headless Chromium at phone size (`e2e/smoke.cjs`, 19 steps) | Pass, no console errors, no requests leaving the app |
| Light and dark themes, layout at 412 px wide | Screenshots reviewed by eye | Looked right; small issues fixed |

The web preview (`npm run preview:page`) is the same app code in a browser. It shows the interface and the logic, but it is not the Android app: it stores data in that browser, cannot send notifications, and cannot export files.

## What has not been verified

Nothing below has run. Each item has a matching check in `docs/RELEASE.md`, section 6.

1. **The Android build itself.** Gradle has never been run on this project. The `android/` folder is the Capacitor 8 template plus edits to `app/build.gradle` (signing, version) and `AndroidManifest.xml` (backup off, one permission removed).
2. **The app inside Android's WebView.** It has only run in desktop Chromium. The SQLite engine is WebAssembly loaded from the app package; that load path on a phone is untested.
3. **Saving the database file on a phone.** The browser build saves to localStorage. The phone build saves through the Filesystem plugin with a write-then-rename sequence. That code path has never executed.
4. **Notifications.** What to schedule is unit tested. Handing it to Android, the permission prompt, delivery timing and survival across a reboot are not.
5. **The share sheet and file picker** for export and import.
6. **The Android back button**, safe-area insets, the keyboard over sheets, and the system time and date pickers.
7. **Logging in under 10 seconds.** The flow is 3 taps when the course and length are the same as last time, 5 taps when both change. A script does it in 0.3 seconds; a thumb has not been timed.
8. **The merged list of permissions.** The privacy policy states four. One plugin's dependency could not be inspected offline.
9. **The Play Console steps.** The checklist was written from Google's current help pages (October 2026), not from a real submission.

## Limitations of v1 by design

**The model**
- **The numbers are rules of thumb.** The energy factors, carryover multipliers and recovery budget are starting values, not measurements of you. Until they are tuned against two or three weeks of your own logs, treat effective hours as an estimate.
- **Fatigue carryover is one day deep.** Three hard days in a row cost the same as one. There is no accumulated load or deload logic.
- **Recovery is counted by the week.** Moving a session to another day in the same week does not change the weekly recovery number; only the rest-gap and overlap rules react to it.
- **Meals are counted but not placed.** Daily overhead comes off the hours available, but the planner does not know when lunch is. A 15-minute pause is kept after classes and shifts; it will still sometimes suggest a block over a meal.
- **Suggestions are greedy, not optimal.** Each block goes to the best free slot at that moment. A human can find better weeks.
- **Even pacing.** An exam's remaining hours are spread evenly over the days left. It does not front-load or taper.
- **Nothing is planned on the due date.** The app does not know what time an exam is.
- **A planned block that passes unconfirmed counts as zero** toward an exam target until you mark it done.

**Schedule**
- **Classes repeat every week with no exceptions.** There are no holidays, cancelled classes, or term dates. For summer, delete the classes.
- **Shifts are entered one at a time.** No repeating shifts, no copy from last week.
- **The week starts on Monday.** Not configurable.
- **One sleep window for all seven days.**

**Grades**
- **Percent only.** No GPA scale or letter grades, because scales differ between universities.
- **Remaining assessments are assumed to score the same.** There is no what-if for a single exam.
- **Leverage ranks assessments, not tasks.** There is no task list below the level of an assessment.

**Data**
- **CSV is export-only.** Import is JSON only. A CSV import would need rules for matching course names and was left out to keep import strict.
- **The database file is rewritten on every save.** Fine at this size (kilobytes); it is the first thing to replace if years of logs make it large.
- **No automatic backup.** Android cloud backup and phone-to-phone transfer are switched off so the privacy policy can say the data never leaves the device. If the phone is lost and you never exported, the data is gone. To reverse this decision: set `android:allowBackup="true"`, remove `data_extraction_rules.xml`, and rewrite the "Device backup" section of the privacy policy.
- **Fix actions have one level of undo**, for about 7 seconds.

**Notifications**
- **Rebuilt only while the app is open.** There is no background job. If you do not open the app for more than a week, reminders stop.
- **Inexact timing.** Android may deliver a reminder a few minutes late. Exact alarms need a permission that a planner should not ask for.
- **Conflict alerts are one summary per morning**, not one per conflict, and only for conflicts found while the app was open.

**Platform**
- **Android only.** iOS is deferred until the Android build is validated.
- **Needs Android 7.0 or later with Android System WebView 97 or later** (WebView updates through the Play Store, so this covers almost every phone that is still updated). On an older WebView the database engine will not start.
- **English only**, left-to-right. Dates and times follow a 24-hour format in the app's own text.
- **The app declares the network permission** although it never uses the network. Capacitor's template includes it. It is listed under v1.1.

## v1.1, in priority order

Ordered by what would matter most in real use, not by how interesting it is to build.

1. **Tuning from your own logs.** After a few weeks, compare logged energy against the prediction by time of day, after hard sessions and after short nights, and propose new factors ("your evenings log 0.62, the model says 0.64; your post-legs mornings log 0.58, the model says 0.68"). This is the step that turns generic rules into your model. Everything else on this list is polish by comparison.
2. **Weeks that differ.** Skip one class occurrence, mark holidays and exam periods, and switch between a semester profile and a summer profile without deleting classes.
3. **Protected windows.** Place meals and other "nothing goes here" windows on the clock so suggestions stop landing on lunch.
4. **Faster logging from outside the app.** A notification action or home-screen widget for "log block" and the morning check-in. Logging only works if it survives busy weeks.
5. **Repeating and copied shifts.** Seasonal work usually has a pattern for a few weeks at a time.
6. **Grade what-ifs and a grade scale.** "If I get 80 on the midterm, the final needs X", and an optional mapping from percent to your university's GPA scale.
7. **Multi-day training load.** A rolling load figure and a warning before the third hard day, once item 1 has given real numbers to base it on.
8. **A background check.** A daily job that rebuilds reminders and re-runs conflict detection without opening the app.
9. **Drop the network permission.** Remove `INTERNET` from the manifest and confirm on a device that the app still loads.
10. **CSV import**, automatic local backup files, and exam times on the due date.
11. **iOS**, after the Android version has been used for a full exam period.

Suggestions that came up while building and are deliberately **not** in v1, because the spec did not ask for them: calendar sync, an account or cloud sync, charts of energy over time, and streaks.
