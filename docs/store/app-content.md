# App content declarations: answers

For **Policy > App content** in Play Console. Google adds and renames declarations from time to time, so complete whatever that page lists; the answers below cover the ones that existed in October 2026 and follow from how the app behaves.

## Privacy policy

The public address of `privacy-policy.html`. See "Hosting the privacy policy" in [listing.md](listing.md).

## App access

**All functionality is available without special access.** There is no login, no paywall and no restricted area, so reviewers need no credentials.

## Ads

**No, my app does not contain ads.**

## Advertising ID

**No**, the app does not use an advertising ID. No ad or analytics SDK is included.

## Content rating questionnaire

The questionnaire's exact wording changes; the answer to every content question is No.

| Question | Answer |
|---|---|
| Email address | Your contact email |
| Category | The option for utility / productivity / other apps (not a game, not a social or communication app) |
| Violence, blood, fear | No |
| Sexuality, nudity | No |
| Language (profanity, crude humour) | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling, simulated gambling | No |
| Can users interact or exchange content with other users? | No |
| Does the app share the user's location with others? | No |
| Does the app allow purchases of digital goods? | No |
| Does the app contain unrestricted web access (a general browser)? | No |

Expected result: the lowest rating in each scheme (for example "Everyone", PEGI 3). The questionnaire gives the actual ratings when you submit it; if any comes back higher, re-read your answers.

## Target audience and content

| Question | Answer |
|---|---|
| Target age groups | **18 and over** only |
| Could the store listing unintentionally appeal to children? | No |

Reasoning: the app is written for university students. Selecting any group under 13 brings the app under Google's Families policy, which adds requirements this app has no reason to take on. If you later want 16 to 17 year-olds included, read the policy text shown on that screen first.

## Data safety

See [data-safety.md](data-safety.md). Short version: no data collected, no data shared.

## Health apps declaration

Every app has to complete this, including apps with no health features. Google's categories include:

- **Activity and Fitness:** "Apps that monitor and record physical activities, exercise routines, and workouts."
- **Sleep Management:** "Apps dedicated to improving and tracking sleep patterns and quality."
- **Stress Management, Relaxation, Mental Acuity:** guidance on stress, mindfulness, meditation, cognitive health.
- Or: **"My app doesn't provide any health features."**

**This one is a judgment call, and it is yours to make as the developer.** What the app does:

- It stores the user's planned training sessions and whether each was done, moved or skipped. It records no sets, reps, heart rate, distance or anything from a sensor.
- It has one optional field for hours slept, used only to adjust the next day's energy estimate.
- It reads nothing from Health Connect, Google Fit or any device sensor.

**Recommendation: select "Activity and Fitness" and nothing else.** The app does record workouts as done, which is close to the wording of that category, and declaring it costs nothing beyond the review Google already does. Declaring "no health features" is defensible for a planner, but if a reviewer disagrees it becomes a rejection and a resubmission. Do not select Sleep Management: the app is not "dedicated to" sleep, and one optional number is not sleep tracking.

Whichever you choose, the listing and the About screen already say that the app is a planning tool and gives no medical or training advice. Keep that sentence.

Source: [Provide information for the Health apps declaration form](https://support.google.com/googleplay/android-developer/answer/14738291).

## Other declarations

| Declaration | Answer |
|---|---|
| Government app | No |
| Financial features | None (no loans, banking, payments, crypto or financial advice) |
| News app | No |
| COVID-19 contact tracing or status | No, if still asked |

## Permissions the reviewer will see

`INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. None of them needs a permissions declaration form. Exact-alarm access is deliberately removed in the manifest, so no alarm declaration applies. Confirm the list against the merged manifest (see `docs/RELEASE.md`, section 6).
