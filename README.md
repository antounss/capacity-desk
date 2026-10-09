# Capacity Desk

A personal operations manager that allocates time **and** energy. A calendar shows time; Capacity Desk models capacity: how many hours you really have after sleep, classes, shifts and training, how usable those hours are at your energy, and where the plan will break before it does.

Android first, local-first: one SQLite file on the device, no account, no server, no network requests.

**Status: v1.0.0, not yet store-ready.** The logic, storage and UI are tested. The Android release build has not been run yet (see [docs/LIMITATIONS.md](docs/LIMITATIONS.md) and [docs/RELEASE.md](docs/RELEASE.md)).

## Quick start

You need Node.js 22 or newer.

```bash
npm install
npm test          # 139 unit tests: capacity, energy, conflicts, grades, storage
npm run dev       # the app in your browser at http://localhost:5173
```

To see it with data straight away:

```bash
npm run sample    # writes docs/sample-data.json for the current week
```

Then in the app: skip setup, open **Settings > Import a backup**, and pick `docs/sample-data.json`. It is an invented student's week with a few conflicts built in.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check, no output files |
| `npm run build` | Type-check, then build the web app into `dist/` |
| `npm run preview` | Serve the built app at http://localhost:4173 |
| `npm run e2e` | Optional browser test of the main flows (see `e2e/smoke.cjs` for setup) |
| `npm run preview:page` | Build the whole app as one self-contained HTML file that opens on the sample week, for showing it on a phone before the Android build exists |
| `npm run android:sync` | Build, then copy the web app into the Android project |
| `npm run android:run` | Build and run on a connected phone or emulator |
| `npm run android:apk` | Build a release APK |
| `npm run android:aab` | Build a release AAB for Google Play |

Building for Android needs Android Studio and a signing key. Both are covered step by step in [docs/RELEASE.md](docs/RELEASE.md).

## How the code is organised

Think of it as a calculator in a case. `src/domain` is the calculator: it takes plain data and returns numbers and sentences, and knows nothing about screens or databases. Everything else is the case around it.

```
src/
  config/defaultConfig.ts   THE tuning file: every factor, threshold and rule, with its reason
  domain/                   Pure functions. No React, no Capacitor, no SQL.
    types.ts                  The data model
    time.ts, intervals.ts     Dates, clock times, interval arithmetic
    timeline.ts               Turns stored data into one number line of minutes for a week
    capacity.ts               committed / available / recovery / flexible / buffer
    energy.ts                 Energy factors, fatigue carryover, effective hours
    training.ts               Rest rules between sessions
    grades.ts                 Required-score maths, weights that do not sum to 100
    priority.ts               Grade impact per effective hour, weekly share of each task
    planner.ts                Greedy placement of suggested blocks
    conflicts/                One function per conflict rule, plus the runner
    fixes.ts                  Turns a tapped fix into data changes
    notifications.ts          Decides which reminders should exist
    exportImport.ts           JSON backup (validated on import) and CSV export
    schema.ts                 One description of every stored field (validation + SQL mapping)
    analyze.ts                The single entry point the UI calls
  data/                     Where data lives and how it leaves
    migrations.ts             The SQL schema, as numbered migrations
    repository.ts             Reads and writes AppData in SQLite
    fileStore.ts              Saves the database file (phone: private storage; browser: localStorage)
    database.ts               Starts SQLite (sql.js, WebAssembly) and opens the file
    notifications.ts          Hands planned reminders to Android
    files.ts                  Export through the share sheet, import through a file picker
  app/                      State: the store, multi-row actions, Android back button
  ui/                       React components. Screens: Week, Grades, Schedule, Settings, first-run setup
  content/privacy.json      The privacy policy (shown in-app; also the source of docs/store/privacy-policy.*)
tests/                      Unit tests, with the worked example in each test name or comment
e2e/smoke.cjs               Optional end-to-end test in a real browser
preview/                    The single-file web preview build (sample data, no WebAssembly, fonts embedded)
android/                    The Capacitor Android project (open this folder in Android Studio)
scripts/                    Sample data, icon, privacy-policy and Gradle helpers
docs/                       Plan, release guide, limitations, store materials
```

**The flow on every change:** the UI calls a store action, the store updates memory and SQLite, and `analyzeWeek(data, week, now)` recomputes everything on screen: capacity, effective hours, grades, ranking, suggestions and conflicts. Conflicts are never "run"; they are simply part of what gets recomputed.

## Changing the model

- **A number** (an energy factor, a threshold, a rest gap): edit `src/config/defaultConfig.ts`, or change it in the app under **Settings > Tuning**. No logic changes.
- **A conflict rule:** write a function of type `Rule` in `src/domain/conflicts/` and add it to the `RULES` list in `src/domain/conflicts/index.ts`. Add a test with a worked example.
- **The database:** append a migration to `src/data/migrations.ts` and add the field to `src/domain/schema.ts` and `src/domain/types.ts`. A test fails if the three disagree.

The formulas are written out in [docs/PLAN.md](docs/PLAN.md), section 3.

## Documentation

| File | Contents |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | The one-page plan: stack, data model, formulas, conflict rules |
| [docs/RELEASE.md](docs/RELEASE.md) | Building a signed APK/AAB on your machine, and what to check on a phone |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | What v1 does not do, what is untested, and the prioritised v1.1 list |
| [docs/store/](docs/store/) | Listing copy, privacy policy, data safety answers, content rating answers, Play Console checklist, icon, feature graphic, screenshots |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
