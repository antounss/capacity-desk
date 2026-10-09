# Capacity Desk v1 — one-page plan

## 1. Stack
**React 19 + TypeScript + Vite + Tailwind, wrapped for Android with Capacitor 8.**
The spec recommends Flutter or React Native; I chose differently for three reasons:
1. It is the stack you already build in (React, Vite, Tailwind), so you can read and change every file.
2. A Capacitor Android build needs only the Android SDK (no NDK, no Dart toolchain), which keeps the release build simple on a Windows laptop.
3. The whole app runs in a browser, so the UI can be exercised and screenshotted without an emulator. Cost: it is a WebView app, so it will feel slightly less native than Flutter. For forms, lists and meters that is an acceptable trade.

- **Storage:** SQLite, through `sql.js` (SQLite compiled to WebAssembly). The database file is saved to the app's private folder with `@capacitor/filesystem`. The same engine and the same SQL run in the unit tests, the browser and the phone, and there is no native library to break the build. Limit: the file is rewritten on every save, which is fine at this size (kilobytes) and is the first thing to replace if history grows.
- **Notifications:** `@capacitor/local-notifications`, opt-in, inexact alarms only (no special alarm permission).
- **Export/import:** full JSON backup (re-importable), CSV of logged blocks.
- No account, no network calls, no analytics.

## 2. Data model (SQLite tables)
| Table | Holds |
|---|---|
| `fixed_commitments` | Weekly repeating class, commute, other: weekday, start, end |
| `shifts` | Dated work shifts; may cross midnight |
| `training_templates` | The weekly split: weekday, start, duration, load group (legs/upper/full/cardio/skill), intensity 1–3 |
| `training_sessions` | Per-week changes to a template session (moved, done, skipped) and one-off sessions |
| `blocks` | Study/project blocks: date, start, duration, course, status planned/done, energy 1–5 |
| `day_logs` | Morning check-in: energy 1–5, optional hours slept |
| `courses`, `assessments` | Credits, difficulty, target %, and each assessment's weight, due date, score, target effective hours |
| `settings` | Sleep window, daily overhead, recovery budget, and the user's overrides of the rule file |

## 3. Formulas
All defaults live in one file, `src/config/defaultConfig.ts`, and can be changed in-app.

**Capacity (per week, 168 h):**
```
committed = sleep + classes + shifts + commute/other + meals/overhead + training   (overlaps counted once)
available = 168 − committed
recovery  = base recovery + Σ per-session recovery by intensity     (reserved first, not leftover)
flexible  = available − recovery
buffer    = flexible − planned and logged study/project hours
```

**Energy:**
```
effective_hours = duration × factor[energy]         factor = {1: 0.35, 2: 0.55, 3: 0.75, 4: 0.90, 5: 1.00}
day_factor      = factor[morning check-in]          if logged
                = factor[baseline 3] × carryover    otherwise
carryover       = hard training yesterday (×0.90, moderate ×0.97) × short night under 6.5 h (×0.85), floor 0.60
slot_factor     = day_factor × time-of-day (morning 1.00, afternoon 0.90, evening 0.85, late 0.70)
                  × 0.85 in the 2 h after a hard session
```
Energy logged on a block always overrides the prediction. These are rules of thumb, not measurements.

**Grades:**
```
earned   = Σ weight × score / 100 over graded work
required = (target − earned) / remaining weight × 100     (average needed on everything ungraded)
leverage = (credits share × weight) ÷ target effective hours × urgency × pressure
```
Grades stay in percent with credit-weighted averages; no GPA scale is assumed.

## 4. Conflict rules in v1
Each returns a plain sentence, a consequence with numbers, and one or two fixes. All are re-run on every change.
1. **Recovery below threshold** — planned work pushes buffer under zero.
2. **Rest gap** — two sessions on the same load group closer than the rule (legs: 48 h).
3. **No rest day** — training planned on too many consecutive days.
4. **Consistency** — fewer sessions planned than the weekly minimum.
5. **Exam gap** — effective hours done + planned are short of the assessment's target.
6. **Overlap** — a shift, class or training session lands on a planned block.
7. **Short night** — something runs into the sleep window; shows what tomorrow's hours shrink to.
8. **Hard task in a low-energy slot** — a difficult course placed where the predicted factor is low.
9. **Day overload** — more focused work in one day than the daily ceiling.
10. **Hard training before an assessment** — heavy session the day before an exam.

## 5. Smaller versions I am proposing up front
- **Fatigue carryover is one day deep.** Multi-day accumulated fatigue needs real logs to tune; a guessed model would look precise and be wrong.
- **Suggestions are a greedy placement** (best-energy free slot to the hardest, highest-leverage task), not an optimiser. Every suggestion states its reason and is accepted by tap, never applied silently.
- **Conflict notifications** are scheduled when the plan changes while the app is open. There is no background service re-checking the plan.

## 6. Changes made while building
- **Free time is padded.** Nothing is suggested in the first hour after waking, the last hour before bed, or within 15 minutes of a class, shift, session or other block. Without this the planner proposed 07:00 study blocks and blocks that started the minute a lab ended. All three paddings are tunable.
- **The exam-hours rule became pace-aware.** It splits what is left of an assessment evenly over the days until it is due and flags only the share that belongs in the week on screen. The first version flagged the whole gap, so the conflict stayed open even after the week was fully planned.
- **Exam-hours conflicts got a one-tap fix** that adds the suggested blocks for that assessment.
- **The morning check-in also takes hours slept** (optional). "Late nights" needed an input; this is the smallest one.
- **Leverage divides by an assessment's target hours, not by the hours still needed.** Dividing by hours still needed sent a nearly finished task to the top of the list. Tasks whose target hours are already logged now drop to the bottom instead.
- **The slot swap** between a hard and an easier course no longer needs equal block lengths, only that each block fits the other's slot.

## 7. What cannot be verified in this session
The Android SDK and Google's Maven repository are not reachable from the build environment used here, so the release AAB has to be built on your laptop. Domain logic, storage and UI are verified here; the Android wrapper is not, and the app will not be called store-ready until that build and the Play checklist are done.
