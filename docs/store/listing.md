# Google Play store listing

Copy for the **Main store listing** page. Character counts are checked against Google's limits (app name 30, short description 80, full description 4000).

## App name

```
Capacity Desk
```

Alternative if you want the purpose in the name (28 characters): `Capacity Desk: Time & Energy`

## Short description

```
Plan your week by real capacity: hours, energy, recovery and grade impact.
```

## Full description

```
A calendar shows you time. Capacity Desk shows you capacity: how many hours you really have this week, how much those hours are worth at your energy, and where the plan will break before it does.

It is built for students who are juggling coursework, training, projects and part-time work, and who would rather see an honest number than a motivational quote.

Your week as a budget of 168 hours
Enter your classes, commute, shifts, sleep and training split once. Capacity Desk takes them out of the week, reserves recovery time before anything else, and shows what is left: flexible hours, planned work, and your remaining buffer.

Energy, not just minutes
Rate your energy from 1 to 5 after a block or in the morning. Three hours at low energy count as fewer focused hours than three hours at your best. Hard training and short nights lower the next day's estimate. Every factor is visible and adjustable.

Conflicts before they happen
The plan is re-checked every time you change it. When something breaks, you get a plain sentence, the consequence in numbers, and one or two fixes you can apply with a tap:
• A work shift that lands on a study block
• Two leg sessions without enough rest between them
• An exam whose preparation hours are behind pace
• A week where planned work eats into recovery
• A hard course scheduled in a low-energy slot

What to work on first
Add each course with its assessments and weights. Capacity Desk works out the score you need on what remains, shows the calculation, and ranks your work by grade impact per focused hour. You always see this week's top three, with the reasons.

Suggested blocks
It proposes where study and project blocks should go, giving your highest-energy free slots to your hardest courses. Nothing is added until you accept it.

Logging in a few taps
Log a finished block, check in your energy, mark a session done or add a shift from the bottom of the screen.

Your data stays on your phone
• No account and no sign-in
• No ads, no analytics, no tracking
• Nothing is uploaded: the app makes no network requests
• Export a full backup or a spreadsheet file whenever you want
• Notifications are off until you turn them on

Good to know
The energy and recovery figures are rules of thumb that you tune to yourself; they are not measurements. Capacity Desk is a planning tool and does not give medical or training advice. Grades are handled in percent with credit-weighted averages.
```

## Other listing fields

| Field | Value |
|---|---|
| App or game | App |
| Free or paid | Free |
| Category | Productivity |
| Tags | Choose from Google's list at the time; look for productivity, planner and education-related tags |
| Contact email | `[YOUR CONTACT EMAIL]` (shown publicly on the listing) |
| Website | Optional. The page that hosts the privacy policy is enough |
| Privacy policy URL | The public address of `privacy-policy.html` (see below) |

## Graphics

| Asset | File | Google's requirement |
|---|---|---|
| App icon | `graphics/play-icon-512.png` | 512 x 512, 32-bit PNG, up to 1024 KB |
| Feature graphic | `graphics/feature-graphic-1024x500.png` | 1024 x 500, JPEG or 24-bit PNG without alpha |
| Phone screenshots | `screenshots/01` to `08` | At least 2, up to 8; JPEG or 24-bit PNG without alpha; each side 320 to 3840 px; long side at most twice the short side. 1080 x 1920 or larger qualifies for more placements |

**About the screenshots.** The eight files are rendered from the real app code running in a desktop browser at 1080 x 1920 with the invented sample data in `docs/sample-data.json`. They are accurate to the interface, but they are not photographs of a phone: there is no status bar, and fonts and system pickers can differ slightly on a device. Before publishing, either retake them on your phone with the sample data imported, or compare each one against the phone and keep them only if they match. Screenshots must show the app as users will see it.

## Hosting the privacy policy

Google needs a public web address, not a file. The simplest free option:

1. Create a public GitHub repository (it can be the project itself, or a tiny one that holds only the policy).
2. Put `docs/store/privacy-policy.html` in it, renamed to `index.html` if it is the only page.
3. In the repository: **Settings > Pages**, choose the branch and folder, and save.
4. Open the address GitHub gives you and confirm the policy loads without signing in.

Before you publish it, replace `[YOUR CONTACT EMAIL]` in `src/content/privacy.json` and run `npm run privacy` to regenerate the Markdown and HTML. The same text is shown inside the app under Settings > About, so rebuild the app too.
