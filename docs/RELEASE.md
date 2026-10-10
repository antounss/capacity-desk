# Building and releasing Capacity Desk for Android

Nothing in this file has been run yet. The Android SDK was not reachable where the app was built, so the first time these steps run will be on your machine. Treat the first pass as a test of the steps as well as of the app, and note anything that differs.

Paths and commands are written for Windows. On macOS or Linux use `./gradlew` in place of `gradlew` and forward slashes.

## 1. One-time setup

1. **Node.js 22 or newer.** Check with `node -v`.
2. **Android Studio 2025.2.1 or newer** (Capacitor 8's minimum). It brings its own JDK, so no separate Java install is needed.
3. In Android Studio, open **SDK Manager** and install **Android 16 (API 36)** under SDK Platforms, and **Android SDK Build-Tools**, **Platform-Tools** and **Command-line Tools** under SDK Tools.
4. In the project folder:
   ```
   npm install
   npm test
   ```
   All tests should pass before you build anything.

## 2. Run it on your phone (debug build)

This is the first real test. Do it before thinking about signing.

1. On the phone: enable Developer options, then USB debugging. Connect it by USB and accept the prompt.
2. In the project folder:
   ```
   npm run android:sync
   npm run android:open
   ```
   Android Studio opens the `android` folder. The first Gradle sync downloads the build tools and can take several minutes.
3. Pick your phone in the device list and press **Run**.

If the Gradle sync fails, read the first error, not the last. The most likely causes on a first build are a missing SDK platform (install API 36) or an old Android Studio.

Then work through **section 6, the device checklist**. Do not go further until it passes.

## 3. Choose the application ID (permanent)

The ID is currently `com.capacitydesk.app`. Once an app is uploaded to Google Play its ID can never change, and it should be a name you control. If you want a different one, change it now in all three places:

- `capacitor.config.json` → `appId`
- `android/app/build.gradle` → `namespace` and `applicationId`
- `android/app/src/main/java/com/capacitydesk/app/MainActivity.java` → the `package` line, and move the file to the matching folder

Then run `npm run android:sync`. `android/app/src/main/res/values/strings.xml` also holds the ID in two strings; update those to match.

## 4. Create the upload key (once)

Google Play uses two keys. You keep the **upload key** and sign every upload with it. Google keeps the **app signing key** and re-signs what users download (Play App Signing, required for new apps). If you lose the upload key you can ask Google to reset it; it is still worth backing up.

1. Create the key with the `keytool` that ships with Android Studio:
   ```
   "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v ^
     -keystore capacity-desk-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   It asks for a password and your name. Use a long password and store it in a password manager.
2. Move `capacity-desk-upload.jks` somewhere outside the project (for example `C:\Users\you\keys\`), and keep a copy somewhere safe that is not this laptop.
3. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in:
   ```
   storeFile=C:/Users/you/keys/capacity-desk-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   Use forward slashes in the path. `keystore.properties`, `*.jks` and `*.keystore` are in `.gitignore`. Never commit them.

## 5. Build the release

Command-line builds need `JAVA_HOME` to point at a JDK. Use Android Studio's:

```
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
```

Then:

| Goal | Command | Output |
|---|---|---|
| AAB for Google Play | `npm run android:aab` | `android/app/build/outputs/bundle/release/app-release.aab` |
| APK to install directly | `npm run android:apk` | `android/app/build/outputs/apk/release/app-release.apk` |

Each command type-checks, builds the web app, copies it into the Android project and runs Gradle.

Check the result before uploading:

- If `keystore.properties` is missing, Gradle still succeeds but the APK is named `app-release-unsigned.apk` and the AAB is unsigned. Google Play rejects both. Fix the properties file and build again.
- Confirm the signature:
  ```
  "C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe" -verify android\app\build\outputs\bundle\release\app-release.aab
  ```
  It should print `jar verified.`
- Install the release APK on your phone (`adb install -r android\app\build\outputs\apk\release\app-release.apk`) and repeat the device checklist on it. A release build can behave differently from a debug build.

Alternatively, in Android Studio: **Build > Generate Signed App Bundle or APK**, and choose the same keystore.

## 6. Device checklist

Each item is something that could not be tested without a phone. Tick them on a debug build first, then again on the release APK.

**Starts and stores**
- [ ] The app opens to the first-run screen, not a blank page. (A blank page means the web files or the SQLite engine did not load; check Logcat for the error.)
- [ ] Complete setup, add a class, a session and a course. Force-stop the app and reopen: everything is still there.
- [ ] Restart the phone and reopen: everything is still there.

**Layout**
- [ ] Nothing sits under the status bar or the navigation bar, in portrait and landscape.
- [ ] Open "Log block" and a sheet with text fields (for example "Add a course"): the keyboard does not cover the field or the Save button.
- [ ] The time and date fields open the phone's own pickers.
- [ ] Switch the phone to dark mode: the app follows.

**Back button**
- [ ] With a sheet open, Back closes the sheet. On Grades, Back returns to Week. On Week, Back leaves the app.

**Logging speed**
- [ ] Time yourself logging a finished block, from tapping "Log block" to the sheet closing. The target is under 10 seconds.

**Export and import**
- [ ] Settings > Export a full backup opens the share sheet, and the saved file opens as readable JSON.
- [ ] Export blocks (CSV) opens in a spreadsheet app.
- [ ] Erase all data, then Import a backup with the file you exported: everything returns.

**Notifications**
- [ ] Turning on "Training reminders" shows Android's permission prompt once. It must **not** open the "Alarms & reminders" settings screen.
- [ ] Add a session 40 minutes from now with a 30-minute reminder: a notification arrives within a few minutes of the 10-minute mark.
- [ ] Mark that session skipped before the reminder time: no notification arrives.
- [ ] With a conflict open and "Conflict alerts" on, a summary arrives the next morning about 30 minutes after your wake-up time.
- [ ] Restart the phone before a reminder is due: it still arrives.

**Permissions**
- [ ] In Android Studio open `android/app/src/main/AndroidManifest.xml` and the **Merged Manifest** tab. The `uses-permission` list should be exactly: `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. If anything else appears, either remove it with `tools:node="remove"` or add it to `src/content/privacy.json` (then `npm run privacy`). The privacy policy lists permissions exactly, so the two must match.

**Updating**
- [ ] With data in the app, raise `versionCode` to 2, build, and install over the top (`adb install -r`). The data is still there.

## 7. Releasing an update later

1. Raise `version` in `package.json` and `versionName` in `android/app/build.gradle` to the same value.
2. Raise `versionCode` in `android/app/build.gradle` by at least 1. Google Play refuses an upload whose code it has seen before.
3. Add an entry to `CHANGELOG.md`.
4. `npm test`, then `npm run android:aab`.
5. If the change touches what is stored or sent, update `src/content/privacy.json`, run `npm run privacy`, republish the hosted policy, and review `docs/store/data-safety.md`.

The Google Play side is in [store/play-console-checklist.md](store/play-console-checklist.md).
