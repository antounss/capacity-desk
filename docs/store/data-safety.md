# Data safety form: answers

For **Policy > App content > Data safety** in Play Console. These answers are drafted from what the code does in v1.0.0, not from what the app is meant to do. Section 3 lists the code facts behind each answer so you can re-check them before every release.

Google's definitions decide the answers:

- "Collect" means transmitting data from the app off the user's device.
- Data that is only processed on the device and never sent off it does not have to be declared.
- "Share" means transferring data collected from the app to a third party.
- Every app must complete the form and give a privacy policy link, including apps that collect nothing.

Source: [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469).

## 1. Answers

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not asked when the answer above is No |
| Do you provide a way for users to request that their data is deleted? | Not asked when the answer above is No |
| Privacy policy URL | The public address of `privacy-policy.html` |

If the form asks whether users can create an account in the app: **No**.

The listing will then show "No data collected" and "No data shared with third parties".

## 2. Why "No" is accurate even though the app stores personal information

The app stores schedule details, grades, training sessions, energy ratings and optional sleep hours. Under Google's categories those would be "Health and fitness" (fitness info, health info), "App activity" (other user-generated content) and similar. They are not declared because none of it is transmitted off the device:

| What the app holds | Where it goes |
|---|---|
| Classes, commitments, shifts | SQLite file in the app's private storage. Never transmitted. |
| Training sessions and their status | Same. Never transmitted. |
| Study and project blocks, energy ratings | Same. Never transmitted. |
| Daily check-in: energy, hours slept | Same. Never transmitted. |
| Courses, assessments, scores, targets | Same. Never transmitted. |
| Settings and tuning values | Same. Never transmitted. |
| Last-used course and block length | WebView local storage on the device. Never transmitted. |

**Export is not collection or sharing.** When the user taps Export, the app writes a file and opens Android's share sheet. The user decides whether it goes anywhere and where. The developer receives nothing, and no third party is involved by the app.

**Notifications are not collection.** They are scheduled on the device from the user's own data. There is no push service and no server.

## 3. The code facts behind these answers

Re-check each line before every release. If any stops being true, the form and the privacy policy both have to change before that version ships.

- [ ] No `fetch`, `XMLHttpRequest`, `WebSocket` or `sendBeacon` call anywhere in `src/`. (Search for them.)
- [ ] `index.html` still carries the Content-Security-Policy with `connect-src 'self'`, which blocks requests to any other origin even if one were added by mistake.
- [ ] `package.json` dependencies contain no analytics, crash-reporting, advertising or remote-config library. Today they are: React, sql.js, lucide-react (icons), two bundled font packages, and four Capacitor plugins (app, filesystem, local-notifications, share).
- [ ] Fonts and the SQLite engine are bundled in the app, not loaded from a CDN.
- [ ] `android/app/google-services.json` does not exist, so no Firebase or Google services code is applied.
- [ ] `AndroidManifest.xml` still has `android:allowBackup="false"` and `data_extraction_rules.xml` still excludes everything, so Android does not copy the database to the user's Google account.
- [ ] The automated browser test (`npm run e2e`) still ends with "nothing was requested from outside the app".

## 4. What would change the answers

| If you add... | Then |
|---|---|
| Cloud sync or an account | Declare every synced data type as collected; answer the encryption and deletion questions; provide account deletion |
| Crash reporting or analytics | Declare "App info and performance" (crash logs, diagnostics) and possibly device IDs, as collected and shared with that provider |
| Ads | Declare what the ad SDK collects, and change the Ads declaration |
| Google Calendar or any online import | Declare the data types that travel, and the network use |
| Android auto-backup switched back on | Not "collection" by you, but the privacy policy's "Device backup" section must be rewritten |
