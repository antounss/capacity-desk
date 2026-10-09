# Google Play Console submission checklist

Work top to bottom. Nothing here has been done yet, and the steps come from Google's help pages as they read in October 2026, not from a completed submission. Where a screen differs from this list, trust the screen.

**The app is not store-ready until every box in parts A and B is ticked.**

## A. Before opening Play Console

- [ ] `npm test` passes.
- [ ] The app runs on a real phone and the device checklist in [`docs/RELEASE.md`](../RELEASE.md), section 6, passes on a **release** build.
- [ ] The application ID is final (`docs/RELEASE.md`, section 3). It can never be changed after the first upload.
- [ ] The upload key exists, is backed up outside the laptop, and its password is in a password manager.
- [ ] `npm run android:aab` produced a signed `app-release.aab`, and `jarsigner -verify` says `jar verified.`
- [ ] The merged manifest's permissions match the privacy policy.
- [ ] `[YOUR CONTACT EMAIL]` is replaced in `src/content/privacy.json`, `npm run privacy` has been run, and the app was rebuilt afterwards.
- [ ] The privacy policy is live at a public address that opens without signing in.
- [ ] Screenshots have been retaken on the phone, or checked against it.
- [ ] You have used the app yourself for at least two weeks with real data. Reviewers and testers find what you did not.

## B. Developer account

- [ ] Create a Google Play developer account at play.google.com/console. Choose a **personal** account unless you have a registered organisation.
  - One-time registration fee of US$25.
  - You must be at least 18.
  - Google asks for identity verification, which can include a government ID and a card in your legal name.
  - Lebanon is on Google's list of locations supported for developer registration.
- [ ] Complete device verification: new personal accounts must confirm access to a physical Android device through the Play Console mobile app before they can publish.
- [ ] Read what the account screens say will be shown publicly on your listing (developer name, contact details) before confirming.

## C. Create the app

- [ ] **Create app**: name `Capacity Desk`, default language English, type **App**, **Free**.
- [ ] Accept the declarations and the Play App Signing terms. Google holds the app signing key; your upload key signs what you send.
- [ ] Decide on "free" deliberately: Google has not allowed a published free app to be switched to paid later. Check the note on that screen.

## D. App content declarations

Under **Policy > App content**, using [`app-content.md`](app-content.md) and [`data-safety.md`](data-safety.md):

- [ ] Privacy policy URL
- [ ] App access: no special access needed
- [ ] Ads: none
- [ ] Content rating questionnaire
- [ ] Target audience: 18 and over
- [ ] Data safety: no data collected or shared
- [ ] Health apps declaration (read the reasoning in `app-content.md` before choosing)
- [ ] Advertising ID: not used
- [ ] Government, financial, news: no
- [ ] Anything else the page lists

## E. Store listing

Using [`listing.md`](listing.md):

- [ ] App name, short description, full description
- [ ] App icon (`graphics/play-icon-512.png`)
- [ ] Feature graphic (`graphics/feature-graphic-1024x500.png`)
- [ ] At least 2 phone screenshots; 4 or more at 1080 x 1920 is better
- [ ] Category **Productivity**, tags, contact email

## F. Closed testing (required for new personal accounts)

Personal accounts created after 13 November 2023 must run a closed test with **at least 12 testers opted in for at least 14 consecutive days** before they can apply for production. A tester who opts out and back in restarts their own count.

- [ ] **Testing > Closed testing**: create a track.
- [ ] Add testers by email list or Google Group. Recruit more than 12 (aim for 15 to 20) so one drop-out does not reset your timeline. Classmates who also train are the right testers: they are the people the app is for.
- [ ] Choose the countries where testers are.
- [ ] Create a release: upload `app-release.aab`, add release notes (the 1.0.0 entry in `CHANGELOG.md`, shortened).
- [ ] Send the release for review. Closed-test releases are reviewed too.
- [ ] When it is approved, send testers the opt-in link. Each must opt in **and** install.
- [ ] Ask testers for specific feedback: Was setup clear? Did a conflict ever look wrong? Did logging feel fast? Did they stop using it, and when?
- [ ] Keep notes on what they said and what you changed. The production application asks for exactly this.
- [ ] If you ship fixes during the test, raise `versionCode` each time.

A realistic timeline: about 3 weeks from first upload to being able to apply, if 12 people stay opted in.

## G. Apply for production

- [ ] When the Dashboard shows the requirement is met, choose **Apply for production**.
- [ ] Answer the three sections: about your closed test (how you recruited testers, how they engaged, a summary of feedback), about your app (audience, what it is for, expected installs in the first year), and about your production readiness (what you changed after testing, how you judged it ready). Answer from your notes, specifically and honestly.
- [ ] Wait for the decision. Google says review usually takes seven days or less, sometimes longer. If testing is judged insufficient you may be asked to continue the closed test.

## H. Production release

- [ ] **Production > Create new release**: promote the tested build, or upload a newer one with a higher `versionCode`.
- [ ] Choose countries.
- [ ] Start with a staged rollout (for example 20%) if offered, and raise it after a few days without problems.
- [ ] After it is live: install it from the store on your own phone and repeat the device checklist once more.

## I. Keeping it listed

- [ ] **Target API level.** Since 31 August 2026, new apps and updates must target Android 16 (API 36) or higher. This project targets 36. Google raises the bar about once a year; when it does, update Capacitor (which moves `targetSdkVersion` in `android/variables.gradle`), rebuild and re-test.
- [ ] Keep the privacy policy, the Data safety form and the app's behaviour in agreement. If you add anything that sends data off the device, update all three before releasing.
- [ ] Answer policy emails from Google promptly; unanswered notices can lead to removal.

## Sources

- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) (fee, age, verification)
- [Supported locations for developer and merchant registration](https://support.google.com/googleplay/android-developer/answer/9306917)
- [Target API level requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152) (character limits)
- [Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151) (icon, feature graphic, screenshots)
- [Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) (Android Studio version)
